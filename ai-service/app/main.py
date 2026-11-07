from contextlib import asynccontextmanager
from pathlib import Path as FilePath
from typing import AsyncGenerator, Dict, Any, List, Optional
import os
import sys
import tempfile
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException, Path, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure ai-service root directory is in sys.path
ai_service_root = str(FilePath(__file__).resolve().parent.parent)
if ai_service_root not in sys.path:
    sys.path.insert(0, ai_service_root)

from app.services.document_storage_service import get_document_by_id
from app.services.pipeline_service import process_document_pipeline
from app.services.rag_service import (
    answer_document_question,
    DocumentNotFoundError,
    GeminiServiceBusyError,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager handling startup and shutdown events.
    """
    print("[INFO] DocuMind AI Service starting up...")
    yield
    print("[INFO] DocuMind AI Service shutting down...")


# Initialize FastAPI application
app = FastAPI(
    title="DocuMind AI Service",
    description="Microservice responsible for document text extraction, vector embeddings, semantic retrieval, and Gemini RAG intelligence.",
    version="0.1.0",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing (CORS) configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request & Response Models
# ============================================================================

class ProcessDocumentResponse(BaseModel):
    status: str = Field(..., description="Processing status ('completed' or 'failed')")
    document_id: str = Field(..., description="UUID of the processed document")
    filename: str = Field(..., description="Original filename of the document")
    total_pages: int = Field(..., description="Total pages extracted from the PDF")
    chunks_stored: int = Field(..., description="Total semantic chunks stored with 768D embeddings")
    message: str = Field(..., description="Human-readable status message")


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question to answer using the document context")
    top_k: Optional[int] = Field(default=5, ge=1, le=20, description="Maximum number of relevant chunks to retrieve")


class SourceChunk(BaseModel):
    chunk_index: int = Field(..., description="0-indexed position of the chunk in the document")
    content: str = Field(..., description="Extracted text content of the chunk")
    similarity_score: float = Field(..., description="Cosine similarity score (higher is more relevant)")
    id: Optional[str] = Field(None, description="UUID of the chunk record")
    page_number: Optional[int] = Field(None, description="Source page number in the original PDF")


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Generated answer grounded strictly in document context")
    source_chunks: List[SourceChunk] = Field(default_factory=list, description="Retrieved chunks supporting the answer")
    document_id: str = Field(..., description="UUID of the document queried")
    user_question: str = Field(..., description="The user's original question")
    model: str = Field(..., description="Gemini model ID used for generation")


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health", response_model=Dict[str, str], tags=["Health"])
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint returning service operational status.
    """
    return {
        "status": "success",
        "message": "DocuMind AI Service is running",
    }


@app.post(
    "/api/documents/{document_id}/process",
    response_model=ProcessDocumentResponse,
    status_code=status.HTTP_200_OK,
    tags=["Documents"],
    summary="Process PDF/DOCX/TXT document and store vector embeddings",
    description="Triggers the end-to-end document processing pipeline: text extraction, semantic chunking, Gemini 768-dimensional embedding generation, and vector storage in PostgreSQL pgvector.",
)
async def process_document_endpoint(
    document_id: str = Path(..., description="UUID of the document to process"),
    file: Optional[UploadFile] = File(None, description="Optional uploaded document file (PDF, DOCX, TXT) forwarded via multipart/form-data"),
) -> Dict[str, Any]:
    """
    Triggers the end-to-end processing pipeline for a given document.

    Accepts the forwarded document file as multipart/form-data directly,
    eliminating any dependency on shared filesystem paths between services.
    """
    # 1. Validate UUID format
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id parameter cannot be empty.",
        )

    cleaned_id = document_id.strip()
    try:
        valid_uuid = str(uuid.UUID(cleaned_id))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document ID format: '{cleaned_id}'. A valid UUID is required.",
        )

    has_file = file is not None and bool(getattr(file, "filename", None))
    print(f"[AI Service] Processing request received for document: {valid_uuid} (file payload attached: {has_file})")

    # 2. Check if document exists in database (handle missing document with HTTP 404)
    doc = get_document_by_id(valid_uuid)
    if not doc:
        print(f"[AI Service ERROR] Document {valid_uuid} not found in database.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{valid_uuid}' not found.",
        )

    temp_path = None
    try:
        # If file was forwarded via multipart/form-data, buffer it to a temporary file
        orig_filename = None
        if has_file:
            orig_filename = file.filename or doc.get("filename", "document.pdf")
            file_suffix = FilePath(orig_filename).suffix or ".pdf"
            content = await file.read()
            print(f"[AI Service] File received: {orig_filename} ({len(content)} bytes)")
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix) as tmp_file:
                tmp_file.write(content)
                temp_path = tmp_file.name
            print(f"[AI Service] Temporary file created: {temp_path}")

        # 3. Call process_document_pipeline with forwarded file path
        result = process_document_pipeline(
            document_id=valid_uuid,
            override_file_path=temp_path,
            override_filename=orig_filename if has_file else None,
        )

        # 4. Handle processing failures safely without exposing secrets or internal paths
        if result.get("status") != "completed":
            error_msg = result.get("error", "Document processing failed.")
            print(f"[AI Service ERROR] Processing failed for document {valid_uuid}: {error_msg}")
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_msg,
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

        print(f"[AI Service SUCCESS] Document {valid_uuid} successfully processed and indexed ({result.get('chunks_stored', 0)} chunks).")
        return result
    finally:
        # Always clean up temporary file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                print(f"[AI Service] Temporary file cleaned up: {temp_path}")
            except OSError as cleanup_err:
                print(f"[AI Service WARN] Could not remove temp file {temp_path}: {cleanup_err}")


@app.post(
    "/api/documents/{document_id}/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Chat"],
    summary="Ask a question about a document (RAG Q&A)",
    description="Performs semantic vector search against document chunks in PostgreSQL pgvector, constructs a grounded context, and generates a fact-based answer with Gemini.",
)
def document_chat_endpoint(
    document_id: str = Path(..., description="UUID of the document to query"),
    request: ChatRequest = ...,
) -> Dict[str, Any]:
    """
    Answers user questions grounded strictly in the context of the specified document.

    Validates the document ID format and question, checks document existence,
    and executes the RAG pipeline via answer_document_question.
    """
    # 1. Validate UUID format
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id parameter cannot be empty.",
        )

    cleaned_id = document_id.strip()
    try:
        valid_uuid = str(uuid.UUID(cleaned_id))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document ID format: '{cleaned_id}'. A valid UUID is required.",
        )

    # 2. Validate question content
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty or whitespace.",
        )

    # 3. Check if document exists in database (handle missing document with HTTP 404)
    doc = get_document_by_id(valid_uuid)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{valid_uuid}' not found.",
        )

    # 4. Invoke RAG question answering pipeline
    try:
        result = answer_document_question(
            document_id=valid_uuid,
            user_question=request.question.strip(),
            top_k=request.top_k or 5,
        )
        return result
    except DocumentNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except GeminiServiceBusyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is temporarily busy. Please try again in a moment.",
        )
    except Exception as err:
        # Check if error indicates temporary busy state
        error_msg = str(err)
        if "AI is temporarily busy" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI is temporarily busy. Please try again in a moment.",
            )

        # Sanitize error message to prevent accidental key/secret leakage
        api_key_val = os.getenv("GEMINI_API_KEY", "")
        if api_key_val and len(api_key_val) > 6:
            error_msg = error_msg.replace(api_key_val, "[REDACTED_API_KEY]")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat generation failed: {error_msg}",
        )


if __name__ == "__main__":
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "10000"))
    reload_enabled: bool = os.getenv("RELOAD", "false").lower() in ("true", "1")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload_enabled)
