from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import os
import sys

# Ensure ai-service root directory is in sys.path
ai_service_root = str(Path(__file__).resolve().parent.parent.parent)
if ai_service_root not in sys.path:
    sys.path.insert(0, ai_service_root)

from psycopg2.extras import execute_values

try:
    from app.database import get_db, get_db_connection
except ImportError:
    from database.connection import get_db, get_db_connection  # Fallback for alternative execution paths


# Configuration constants
TARGET_VECTOR_DIMENSION: int = 768
VALID_DOCUMENT_STATUSES: Tuple[str, ...] = ("pending", "processing", "completed", "failed")

# In-memory cache for schema column checks
_column_cache: Dict[str, bool] = {}


def _has_column(cursor: Any, table_name: str, column_name: str) -> bool:
    """
    Checks if a column exists in the target table, caching the result to avoid redundant catalog queries.
    """
    cache_key = f"{table_name}.{column_name}"
    if cache_key in _column_cache:
        return _column_cache[cache_key]

    cursor.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s;
        """,
        (table_name, column_name),
    )
    exists = cursor.fetchone() is not None
    _column_cache[cache_key] = exists
    return exists


def format_vector_for_sql(embedding: Optional[List[float]]) -> Optional[str]:
    """
    Serializes a list of floats into PostgreSQL pgvector literal format '[v1, v2, ...]'.

    Args:
        embedding: List of float values representing vector components.

    Returns:
        Optional[str]: Formatted string suitable for %s::vector SQL placeholder, or None if input is None.

    Raises:
        TypeError: If embedding is not a list/tuple of numeric values.
        ValueError: If embedding length does not match TARGET_VECTOR_DIMENSION (768).
    """
    if embedding is None:
        return None

    if not isinstance(embedding, (list, tuple)):
        raise TypeError(f"Embedding must be a list or tuple of floats, got: {type(embedding).__name__}")

    if len(embedding) != TARGET_VECTOR_DIMENSION:
        raise ValueError(
            f"Embedding dimensionality mismatch: expected {TARGET_VECTOR_DIMENSION}, got {len(embedding)}"
        )

    return f"[{','.join(str(float(x)) for x in embedding)}]"


def get_document_by_id(
    document_id: str,
    conn: Optional[Any] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetches document metadata from the 'documents' table using its UUID.

    Args:
        document_id: String representation of the document's UUID.
        conn: Optional active psycopg2 database connection.

    Returns:
        Optional[Dict[str, Any]]: Document details dictionary or None if not found.

    Raises:
        ValueError: If document_id is empty or invalid.
    """
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_id = document_id.strip()

    def _query(cur: Any) -> Optional[Dict[str, Any]]:
        cur.execute(
            """
            SELECT id, user_id, filename, storage_path, file_size, mime_type, status, created_at
            FROM documents
            WHERE id = %s;
            """,
            (cleaned_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        col_names = [desc[0] for desc in cur.description]
        return dict(zip(col_names, row))

    if conn is not None:
        with conn.cursor() as cur:
            return _query(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _query(cur)


def update_document_status(
    document_id: str,
    status: str,
    conn: Optional[Any] = None,
) -> bool:
    """
    Updates the status of a document in the 'documents' table.

    Args:
        document_id: UUID of the document to update.
        status: Target status ('pending', 'processing', 'completed', 'failed').
        conn: Optional active psycopg2 database connection.

    Returns:
        bool: True if a document row was updated, False if document was not found.

    Raises:
        ValueError: If document_id is invalid or status is not in VALID_DOCUMENT_STATUSES.
    """
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_id = document_id.strip()
    normalized_status = status.strip().lower()

    if normalized_status not in VALID_DOCUMENT_STATUSES:
        raise ValueError(
            f"Invalid status '{status}'. Must be one of: {', '.join(VALID_DOCUMENT_STATUSES)}"
        )

    def _execute_update(cur: Any) -> bool:
        cur.execute(
            """
            UPDATE documents
            SET status = %s
            WHERE id = %s;
            """,
            (normalized_status, cleaned_id),
        )
        return cur.rowcount > 0

    if conn is not None:
        with conn.cursor() as cur:
            return _execute_update(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _execute_update(cur)


def delete_document_chunks(
    document_id: str,
    conn: Optional[Any] = None,
) -> int:
    """
    Deletes all existing chunks for a document from the 'document_chunks' table.
    Ensures no duplicate or stale chunks remain when re-processing a document.

    Args:
        document_id: UUID of the document.
        conn: Optional active psycopg2 database connection.

    Returns:
        int: Number of deleted chunk records.
    """
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_id = document_id.strip()

    def _execute_delete(cur: Any) -> int:
        cur.execute(
            """
            DELETE FROM document_chunks
            WHERE document_id = %s;
            """,
            (cleaned_id,),
        )
        return cur.rowcount

    if conn is not None:
        with conn.cursor() as cur:
            return _execute_delete(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _execute_delete(cur)


def insert_document_chunk(
    document_id: str,
    chunk_index: int,
    content: str,
    embedding: Optional[List[float]] = None,
    page_number: Optional[int] = None,
    conn: Optional[Any] = None,
) -> str:
    """
    Inserts a single chunk with its 768-dimensional embedding vector into 'document_chunks'.
    Uses ON CONFLICT (document_id, chunk_index) DO UPDATE to prevent duplicate chunk records.

    Args:
        document_id: UUID of the parent document.
        chunk_index: Sequential 0-indexed position of this chunk.
        content: Text content of the chunk.
        embedding: Optional 768-dimensional float list.
        page_number: Optional 1-indexed source page number.
        conn: Optional active psycopg2 database connection.

    Returns:
        str: UUID of the inserted or updated chunk record.
    """
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    if not isinstance(chunk_index, int) or chunk_index < 0:
        raise ValueError(f"chunk_index must be a non-negative integer, got: {chunk_index}")

    if not isinstance(content, str) or not content.strip():
        raise ValueError("content must be a non-empty text string.")

    cleaned_id = document_id.strip()
    formatted_vector = format_vector_for_sql(embedding)

    def _execute_insert(cur: Any) -> str:
        has_page_col = _has_column(cur, "document_chunks", "page_number")

        if has_page_col:
            sql = """
                INSERT INTO document_chunks (document_id, chunk_index, page_number, content, embedding)
                VALUES (%s, %s, %s, %s, %s::vector)
                ON CONFLICT (document_id, chunk_index)
                DO UPDATE SET
                    page_number = EXCLUDED.page_number,
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding
                RETURNING id;
            """
            params = (cleaned_id, chunk_index, page_number, content, formatted_vector)
        else:
            sql = """
                INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
                VALUES (%s, %s, %s, %s::vector)
                ON CONFLICT (document_id, chunk_index)
                DO UPDATE SET
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding
                RETURNING id;
            """
            params = (cleaned_id, chunk_index, content, formatted_vector)

        cur.execute(sql, params)
        row = cur.fetchone()
        return str(row[0]) if row else ""

    if conn is not None:
        with conn.cursor() as cur:
            return _execute_insert(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _execute_insert(cur)


def store_document_chunks(
    document_id: str,
    chunks: List[Dict[str, Any]],
    embeddings: Optional[List[List[float]]] = None,
    clear_existing: bool = True,
    conn: Optional[Any] = None,
) -> int:
    """
    Stores multiple chunks and their 768-dimensional embeddings in 'document_chunks'.

    Args:
        document_id: UUID of the parent document.
        chunks: List of chunk dictionaries containing 'content', and optionally 'chunk_index',
                'page_number', and 'embedding'.
        embeddings: Optional parallel list of 768-dimensional float lists matching chunks by index.
        clear_existing: If True, deletes existing chunks for this document first to prevent duplicates.
        conn: Optional active psycopg2 database connection.

    Returns:
        int: Number of chunks stored.

    Raises:
        ValueError: If input arguments or embeddings are invalid.
    """
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_id = document_id.strip()

    if not isinstance(chunks, list):
        raise TypeError(f"chunks must be a list of dictionaries, got: {type(chunks).__name__}")

    if not chunks:
        return 0

    if embeddings is not None:
        if len(embeddings) != len(chunks):
            raise ValueError(
                f"Embeddings count ({len(embeddings)}) does not match chunks count ({len(chunks)})."
            )

    def _execute_batch(cur: Any) -> int:
        if clear_existing:
            cur.execute("DELETE FROM document_chunks WHERE document_id = %s;", (cleaned_id,))

        has_page_col = _has_column(cur, "document_chunks", "page_number")

        prepared_rows: List[Tuple[Any, ...]] = []
        for i, chunk in enumerate(chunks):
            if not isinstance(chunk, dict):
                raise TypeError(f"Chunk at index {i} must be a dictionary, got: {type(chunk).__name__}")

            c_index = chunk.get("chunk_index", i)
            c_content = chunk.get("content", "")
            c_page = chunk.get("page_number", 1)

            c_embedding = None
            if embeddings is not None:
                c_embedding = embeddings[i]
            elif "embedding" in chunk:
                c_embedding = chunk["embedding"]

            formatted_vec = format_vector_for_sql(c_embedding)

            if has_page_col:
                prepared_rows.append((cleaned_id, c_index, c_page, c_content, formatted_vec))
            else:
                prepared_rows.append((cleaned_id, c_index, c_content, formatted_vec))

        if not prepared_rows:
            return 0

        if has_page_col:
            insert_sql = """
                INSERT INTO document_chunks (document_id, chunk_index, page_number, content, embedding)
                VALUES %s
                ON CONFLICT (document_id, chunk_index)
                DO UPDATE SET
                    page_number = EXCLUDED.page_number,
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding;
            """
            template = "(%s, %s, %s, %s, %s::vector)"
        else:
            insert_sql = """
                INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
                VALUES %s
                ON CONFLICT (document_id, chunk_index)
                DO UPDATE SET
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding;
            """
            template = "(%s, %s, %s, %s::vector)"

        execute_values(cur, insert_sql, prepared_rows, template=template)
        return len(prepared_rows)

    if conn is not None:
        with conn.cursor() as cur:
            return _execute_batch(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _execute_batch(cur)


def get_document_chunks(
    document_id: str,
    conn: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves all stored chunks for a given document ordered by chunk_index.

    Args:
        document_id: UUID of the document.
        conn: Optional active psycopg2 database connection.

    Returns:
        List[Dict[str, Any]]: List of chunk dictionaries.
    """
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_id = document_id.strip()

    def _query_chunks(cur: Any) -> List[Dict[str, Any]]:
        has_page_col = _has_column(cur, "document_chunks", "page_number")
        if has_page_col:
            sql = """
                SELECT id, document_id, chunk_index, page_number, content, embedding, created_at
                FROM document_chunks
                WHERE document_id = %s
                ORDER BY chunk_index ASC;
            """
        else:
            sql = """
                SELECT id, document_id, chunk_index, content, embedding, created_at
                FROM document_chunks
                WHERE document_id = %s
                ORDER BY chunk_index ASC;
            """
        cur.execute(sql, (cleaned_id,))
        rows = cur.fetchall()
        col_names = [desc[0] for desc in cur.description]
        return [dict(zip(col_names, r)) for r in rows]

    if conn is not None:
        with conn.cursor() as cur:
            return _query_chunks(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _query_chunks(cur)


if __name__ == "__main__":
    print("=== Testing DocuMind Document Storage Service ===")

    # 1. Test vector formatting
    dummy_vec = [0.01 * (i % 10) for i in range(768)]
    formatted = format_vector_for_sql(dummy_vec)
    assert formatted is not None and formatted.startswith("[") and formatted.endswith("]")
    print(f"[PASS] Vector formatting produced valid string with 768 dimensions.")

    # 2. Test vector dimension validation
    try:
        format_vector_for_sql([0.1, 0.2])  # Invalid dimension
        print("[FAIL] Did not catch dimension mismatch.")
    except ValueError as e:
        print(f"[PASS] Dimension validation caught: {e}")

    # 3. Test status validation
    try:
        update_document_status("some-id", "unknown_status")
        print("[FAIL] Did not catch invalid status.")
    except ValueError as e:
        print(f"[PASS] Status validation caught: {e}")

    print("All unit validations passed successfully.")
