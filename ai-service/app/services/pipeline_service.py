from pathlib import Path
from typing import Any, Dict, List, Optional
import os
import re
import sys
import uuid

# Ensure ai-service root directory is in sys.path
ai_service_root = str(Path(__file__).resolve().parent.parent.parent)
if ai_service_root not in sys.path:
    sys.path.insert(0, ai_service_root)

# Resolve default upload storage directory
DEFAULT_UPLOAD_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent / "backend" / "uploads"
).resolve()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(DEFAULT_UPLOAD_DIR))).resolve()

# Service imports with fallback for relative imports
try:
    from app.services.pdf_service import extract_text_from_pdf
    from app.services.document_parser_service import extract_text_from_document
    from app.services.chunking_service import chunk_document_pages
    from app.services.embedding_service import generate_embeddings_batch
    from app.services.document_storage_service import (
        get_document_by_id,
        update_document_status,
        store_document_chunks,
    )
except ImportError:
    from .pdf_service import extract_text_from_pdf
    from .document_parser_service import extract_text_from_document
    from .chunking_service import chunk_document_pages
    from .embedding_service import generate_embeddings_batch
    from .document_storage_service import (
        get_document_by_id,
        update_document_status,
        store_document_chunks,
    )


def _sanitize_error(error_message: str, file_path: Optional[str] = None) -> str:
    """
    Sanitizes error messages to ensure internal file paths, API keys, credentials,
    and system internals are never exposed to API responses.

    Args:
        error_message: Raw error message string.
        file_path: Optional specific file path to scrub.

    Returns:
        str: Sanitized, user-safe error message.
    """
    if not error_message:
        return "An unexpected error occurred during document processing."

    sanitized = str(error_message)

    # 1. Redact specific file path if provided
    if file_path and file_path in sanitized:
        sanitized = sanitized.replace(file_path, "[FILE]")

    # 2. Redact Windows absolute filesystem paths (e.g., C:\..., D:\...)
    sanitized = re.sub(r"[a-zA-Z]:\\[^\s'\"]+", "[FILE_PATH]", sanitized)

    # 3. Redact Unix-style absolute filesystem paths
    sanitized = re.sub(r"/(?:[a-zA-Z0-9._-]+/)+[a-zA-Z0-9._-]+", "[FILE_PATH]", sanitized)

    # 4. Redact Google API key patterns
    sanitized = re.sub(r"AIza[0-9A-Za-z-_]{20,50}", "[REDACTED_API_KEY]", sanitized)
    sanitized = re.sub(r"AQ\.[a-zA-Z0-9-_]{20,60}", "[REDACTED_API_KEY]", sanitized)

    # 5. Redact connection strings or passwords
    sanitized = re.sub(r"://[^:]+:[^@]+@", "://[REDACTED_USER]:[REDACTED_PASSWORD]@", sanitized)

    return sanitized


def process_document_pipeline(
    document_id: str,
    override_file_path: Optional[str] = None,
    override_filename: Optional[str] = None,
    raise_on_error: bool = False,
) -> Dict[str, Any]:
    """
    Executes the end-to-end PDF processing and indexing pipeline for a given document.

    Pipeline Steps:
        1. Fetch document record from PostgreSQL.
        2. Verify document file exists (either via forwarded override_file_path or storage_path).
        3. Update document status to 'processing'.
        4. Extract text page-by-page using document_parser_service (PDF, DOCX, TXT).
        5. Split extracted text into overlapping chunks (chunking_service).
        6. Generate 768-dimensional embeddings using Gemini (embedding_service).
        7. Store chunks and vector embeddings in PostgreSQL (document_storage_service).
        8. Update document status to 'completed' on success.
        9. On failure, update document status to 'failed' and handle error safely.

    Args:
        document_id: UUID string of the document to process.
        override_file_path: Optional path to temporary file forwarded from multipart upload.
        override_filename: Optional original filename of the document.
        raise_on_error: If True, re-raises caught exceptions after updating status to 'failed'.

    Returns:
        Dict[str, Any]: Structured execution summary safe for API responses.
    """
    # 0. Basic parameter validation
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        return {
            "status": "failed",
            "document_id": str(document_id),
            "error": "document_id must be a non-empty string.",
        }

    cleaned_id = document_id.strip()

    # Validate UUID syntax early to prevent database query errors
    try:
        uuid.UUID(cleaned_id)
    except (ValueError, AttributeError):
        return {
            "status": "failed",
            "document_id": cleaned_id,
            "error": f"Invalid document ID format. Expected a valid UUID.",
        }

    document_exists_in_db = False
    target_storage_path = None
    doc_filename = override_filename or "document.pdf"

    try:
        # Step 1: Fetch the document record from PostgreSQL
        print(f"[AI Service] Fetching document record for {cleaned_id}...")
        doc = get_document_by_id(cleaned_id)
        if not doc:
            print(f"[AI Service ERROR] Document with ID '{cleaned_id}' not found in database.")
            return {
                "status": "failed",
                "document_id": cleaned_id,
                "error": f"Document with ID '{cleaned_id}' not found.",
            }

        document_exists_in_db = True
        doc_filename = override_filename or doc.get("filename", "document.pdf")
        target_storage_path = override_file_path or doc.get("storage_path")

        # Step 2: Verify document file exists
        if not target_storage_path:
            raise ValueError("Document record is missing a valid storage_path and no forwarded file was provided.")

        resolved_path = Path(target_storage_path).resolve()

        # If not using forwarded temporary file, enforce local storage directory boundary
        if not override_file_path:
            try:
                resolved_path.relative_to(UPLOAD_DIR)
            except ValueError:
                workspace_root = Path(__file__).resolve().parent.parent.parent.parent.resolve()
                try:
                    resolved_path.relative_to(workspace_root)
                except ValueError:
                    raise ValueError("Security violation: Document file is located outside the allowed storage directory.")

        if not resolved_path.exists():
            raise FileNotFoundError(f"Document file does not exist on disk for: '{doc_filename}'.")

        if not resolved_path.is_file():
            raise ValueError(f"Document storage target is not a regular file for: '{doc_filename}'.")

        # Step 3: Update document status to 'processing'
        print(f"[AI Service] Updating status to 'processing' for document {cleaned_id} ('{doc_filename}')...")
        update_document_status(cleaned_id, "processing")

        # Step 4: Extract text using document_parser_service (PDF, DOCX, TXT)
        print(f"[AI Service] Extracting text from '{doc_filename}'...")
        extracted_data = extract_text_from_document(str(resolved_path), filename=doc_filename)
        total_pages = extracted_data.get("total_pages", 0)

        if total_pages == 0 or not extracted_data.get("pages"):
            raise ValueError(f"The document '{doc_filename}' contains no readable pages or text.")

        print(f"[AI Service] Text extracted: {total_pages} pages from '{doc_filename}'")

        # Step 5: Split extracted text using existing chunking_service
        chunks = chunk_document_pages(extracted_data, chunk_size=500, overlap=100)

        if not chunks:
            raise ValueError(
                f"No extractable text found in '{doc_filename}'. The document may be blank or contain only unreadable content."
            )

        print(f"[AI Service] Number of chunks created: {len(chunks)} chunks")

        # Step 6: Generate embeddings using generate_embeddings_batch from embedding_service
        print(f"[AI Service] Generating 768-dimensional Gemini embeddings for {len(chunks)} chunks...")
        chunk_contents = [c["content"] for c in chunks]
        embeddings = generate_embeddings_batch(chunk_contents)

        if len(embeddings) != len(chunks):
            raise RuntimeError(
                f"Generated embeddings count ({len(embeddings)}) does not match chunk count ({len(chunks)})."
            )

        print(f"[AI Service] Embeddings generated: {len(embeddings)} embeddings")

        # Step 7: Store chunks and embeddings using document_storage_service
        print(f"[AI Service] Storing {len(chunks)} chunks with pgvector embeddings in database...")
        stored_count = store_document_chunks(
            document_id=cleaned_id,
            chunks=chunks,
            embeddings=embeddings,
            clear_existing=True,
        )

        print(f"[AI Service] Chunks stored in pgvector: {stored_count} chunks")

        # Step 8: Update document status to 'completed' on success
        print(f"[AI Service] Successfully stored {stored_count} chunks. Updating status to 'completed'...")
        update_document_status(cleaned_id, "completed")

        print(f"[AI Service] Final document status: completed for document {cleaned_id}")
        return {
            "status": "completed",
            "document_id": cleaned_id,
            "filename": doc_filename,
            "total_pages": total_pages,
            "chunks_stored": stored_count,
            "message": "Document processed and indexed successfully.",
        }

    except Exception as exc:
        print(f"[AI Service ERROR] Document processing failed for {cleaned_id}: {exc}")
        # Step 9: On failure, update status to 'failed' and handle error safely
        if document_exists_in_db:
            try:
                update_document_status(cleaned_id, "failed")
                print(f"[AI Service] Final document status: failed for document {cleaned_id}")
            except Exception as update_err:
                print(f"[AI Service ERROR] Failed to update document status to 'failed': {update_err}")

        sanitized_error = _sanitize_error(str(exc), file_path=target_storage_path)

        if raise_on_error:
            raise RuntimeError(sanitized_error) from exc

        return {
            "status": "failed",
            "document_id": cleaned_id,
            "error": sanitized_error,
        }


if __name__ == "__main__":
    print("=== Testing DocuMind Pipeline Service Module ===")

    # Test error sanitization
    sample_err = "Error at D:\\DocuMind\\backend\\uploads\\secret-file.pdf with key AIzaSyD1234567890123456789012345678901"
    clean_err = _sanitize_error(sample_err)
    assert "secret-file.pdf" not in clean_err
    assert "AIzaSy" not in clean_err
    print(f"[PASS] Error sanitization verified: '{clean_err}'")

    # Test invalid UUID rejection without DB call
    invalid_res = process_document_pipeline("invalid-uuid-format")
    assert invalid_res["status"] == "failed"
    print(f"[PASS] Invalid UUID format caught cleanly: {invalid_res['error']}")

    print("Pipeline module self-test complete.")
