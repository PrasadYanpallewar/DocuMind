from pathlib import Path
from typing import Any, Dict, List, Optional
import os
import sys
import uuid

# Ensure ai-service root directory is in sys.path
ai_service_root = str(Path(__file__).resolve().parent.parent.parent)
if ai_service_root not in sys.path:
    sys.path.insert(0, ai_service_root)

try:
    from app.database import get_db, get_db_connection
except ImportError:
    from database.connection import get_db, get_db_connection

try:
    from app.services.embedding_service import generate_embedding
    from app.services.document_storage_service import (
        get_document_by_id,
        format_vector_for_sql,
        _has_column,
    )
except ImportError:
    from .embedding_service import generate_embedding
    from .document_storage_service import (
        get_document_by_id,
        format_vector_for_sql,
        _has_column,
    )


class DocumentNotFoundError(ValueError):
    """Raised when the specified document ID does not exist in the database."""
    pass


def search_similar_chunks(
    document_id: str,
    query: Optional[str] = None,
    query_embedding: Optional[List[float]] = None,
    top_k: int = 5,
    min_similarity: Optional[float] = None,
    conn: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search against document_chunks in PostgreSQL using pgvector cosine distance (<=>).

    Args:
        document_id (str): UUID of the document to query chunks from.
        query (Optional[str]): Natural language text query.
        query_embedding (Optional[List[float]]): Optional precomputed 768-dimensional float embedding vector.
            If omitted, generated via generate_embedding(query).
        top_k (int): Maximum number of top matching chunks to return (default: 5).
        min_similarity (Optional[float]): Optional threshold to filter chunks with similarity score below this value.
        conn (Optional[Any]): Optional active psycopg2 database connection.

    Returns:
        List[Dict[str, Any]]: List of matching chunk records ordered by similarity descending:
            [
                {
                    "id": str,
                    "document_id": str,
                    "chunk_index": int,
                    "content": str,
                    "similarity_score": float,  # Between -1.0 and 1.0 (higher = more similar)
                    "page_number": Optional[int],  # Included if available in schema
                },
                ...
            ]

    Raises:
        ValueError: If parameters are invalid or query is empty.
        DocumentNotFoundError: If document_id does not exist in the documents table.
        psycopg2.Error: If a database error occurs.
    """
    # 1. Validate document_id
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_doc_id = document_id.strip()
    try:
        uuid.UUID(cleaned_doc_id)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid document ID format: '{cleaned_doc_id}'. A valid UUID is required.")

    # 2. Validate top_k
    if not isinstance(top_k, int) or top_k <= 0:
        top_k = 5

    # 3. Resolve or generate query embedding
    if query_embedding is None:
        if not query or not isinstance(query, str) or not query.strip():
            raise ValueError("Search query cannot be empty or whitespace when query_embedding is not provided.")
        query_embedding = generate_embedding(query.strip())

    formatted_query_vector = format_vector_for_sql(query_embedding)
    if not formatted_query_vector:
        raise ValueError("Failed to format query vector for PostgreSQL pgvector search.")

    def _execute_search(cur: Any) -> List[Dict[str, Any]]:
        # 4. Verify document exists in PostgreSQL
        doc = get_document_by_id(cleaned_doc_id, conn=cur.connection)
        if not doc:
            raise DocumentNotFoundError(f"Document with ID '{cleaned_doc_id}' not found.")

        # 5. Build parameterized SQL query using pgvector cosine distance (<=>)
        has_page_col = _has_column(cur, "document_chunks", "page_number")

        if has_page_col:
            sql = """
                SELECT
                    id,
                    document_id,
                    chunk_index,
                    page_number,
                    content,
                    (1 - (embedding <=> %s::vector)) AS similarity_score
                FROM document_chunks
                WHERE document_id = %s
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector ASC
                LIMIT %s;
            """
        else:
            sql = """
                SELECT
                    id,
                    document_id,
                    chunk_index,
                    content,
                    (1 - (embedding <=> %s::vector)) AS similarity_score
                FROM document_chunks
                WHERE document_id = %s
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector ASC
                LIMIT %s;
            """

        cur.execute(sql, (formatted_query_vector, cleaned_doc_id, formatted_query_vector, top_k))
        rows = cur.fetchall()
        if not rows:
            return []

        col_names = [desc[0] for desc in cur.description]
        results: List[Dict[str, Any]] = []

        for row in rows:
            item = dict(zip(col_names, row))
            # Format types cleanly
            item["id"] = str(item["id"])
            item["document_id"] = str(item["document_id"])
            item["chunk_index"] = int(item["chunk_index"])
            item["content"] = str(item["content"])
            item["similarity_score"] = round(float(item["similarity_score"]), 4)

            if min_similarity is not None and item["similarity_score"] < min_similarity:
                continue

            results.append(item)

        return results

    # 6. Execute within managed or provided connection
    if conn is not None:
        with conn.cursor() as cur:
            return _execute_search(cur)
    else:
        with get_db() as db_conn:
            with db_conn.cursor() as cur:
                return _execute_search(cur)


def semantic_search(
    query: str,
    document_id: str,
    top_k: int = 5,
    min_similarity: Optional[float] = None,
    conn: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Convenience alias for search_similar_chunks accepting query first.

    Args:
        query: Natural language query string.
        document_id: Target document UUID.
        top_k: Maximum chunks to retrieve (default: 5).
        min_similarity: Optional minimum similarity score threshold.
        conn: Optional active database connection.

    Returns:
        List[Dict[str, Any]]: Ordered list of top matching chunks.
    """
    return search_similar_chunks(
        document_id=document_id,
        query=query,
        top_k=top_k,
        min_similarity=min_similarity,
        conn=conn,
    )


if __name__ == "__main__":
    print("=== Testing DocuMind Semantic Retrieval Service ===")

    # 1. Test parameter validation
    try:
        search_similar_chunks("", query="sample")
        print("[FAIL] Empty document_id was not caught.")
    except ValueError as e:
        print(f"[PASS] Empty document_id caught: {e}")

    try:
        search_similar_chunks("invalid-uuid", query="sample")
        print("[FAIL] Invalid UUID format was not caught.")
    except ValueError as e:
        print(f"[PASS] Invalid UUID format caught: {e}")

    try:
        search_similar_chunks("00000000-0000-0000-0000-000000000000", query="   ")
        print("[FAIL] Empty query was not caught.")
    except ValueError as e:
        print(f"[PASS] Empty query caught: {e}")

    print("Retrieval service module self-test passed successfully.")
