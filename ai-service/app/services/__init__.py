"""
Services package for DocuMind AI Service.
Handles document processing, text extraction, embeddings, vector storage, semantic retrieval, and RAG QA.
"""

from .pdf_service import extract_text_from_pdf
from .chunking_service import chunk_document_pages
from .embedding_service import generate_embedding, generate_embeddings_batch
from .document_storage_service import (
    get_document_by_id,
    update_document_status,
    store_document_chunks,
    get_document_chunks,
)
from .pipeline_service import process_document_pipeline
from .retrieval_service import (
    search_similar_chunks,
    semantic_search,
    DocumentNotFoundError,
)
from .rag_service import (
    answer_document_question,
    generate_rag_answer,
    build_context_from_chunks,
    build_rag_prompt,
)

__all__ = [
    "extract_text_from_pdf",
    "chunk_document_pages",
    "generate_embedding",
    "generate_embeddings_batch",
    "get_document_by_id",
    "update_document_status",
    "store_document_chunks",
    "get_document_chunks",
    "process_document_pipeline",
    "search_similar_chunks",
    "semantic_search",
    "DocumentNotFoundError",
    "answer_document_question",
    "generate_rag_answer",
    "build_context_from_chunks",
    "build_rag_prompt",
]
