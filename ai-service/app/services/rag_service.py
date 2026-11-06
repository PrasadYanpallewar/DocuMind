from pathlib import Path
from typing import Any, Dict, List, Optional
import os
import re
import sys
import time
import uuid

# Ensure ai-service root directory is in sys.path
ai_service_root = str(Path(__file__).resolve().parent.parent.parent)
if ai_service_root not in sys.path:
    sys.path.insert(0, ai_service_root)

# Try imports with fallbacks
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

try:
    from app.services.embedding_service import get_genai_client
    from app.services.retrieval_service import (
        search_similar_chunks,
        DocumentNotFoundError,
    )
except ImportError:
    from .embedding_service import get_genai_client
    from .retrieval_service import (
        search_similar_chunks,
        DocumentNotFoundError,
    )


# Model configuration
DEFAULT_GENERATION_MODEL: str = os.getenv("GEMINI_GENERATION_MODEL", "gemini-3.5-flash-lite")

# Retry configuration for temporary Gemini API errors
class GeminiServiceBusyError(RuntimeError):
    """Raised when Gemini API is overloaded or temporarily busy after retries exhaust."""
    pass


BUSY_ERROR_MESSAGE: str = "AI is temporarily busy. Please try again in a moment."
RETRY_DELAYS: List[float] = [2.0, 5.0]  # Max 2 retries: 2s on 1st retry, 5s on 2nd retry
RETRYABLE_STATUS_CODES = {503, 429, 500}
NON_RETRYABLE_STATUS_CODES = {400, 404}


def is_retryable_gemini_error(exc: Exception) -> bool:
    """
    Checks if a Gemini API exception is eligible for automatic retry.
    Eligible: 503 (Unavailable), 429 (Resource Exhausted), 500 (Internal Server Error).
    Non-retryable: 400 (Bad Request), 404 (Not Found).
    """
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if isinstance(code, int):
        if code in NON_RETRYABLE_STATUS_CODES:
            return False
        if code in RETRYABLE_STATUS_CODES:
            return True

    err_str = str(exc).upper()
    if "400" in err_str or "INVALID_ARGUMENT" in err_str or "404" in err_str or "NOT_FOUND" in err_str:
        return False

    for indicator in (
        "503",
        "UNAVAILABLE",
        "429",
        "RESOURCE_EXHAUSTED",
        "RATE_LIMIT",
        "500",
        "INTERNAL",
    ):
        if indicator in err_str:
            return True

    return False

# System instruction enforcing strict factual grounding and hallucination prevention
SYSTEM_INSTRUCTION: str = (
    "You are DocuMind AI, an intelligent, factual, and precise document assistant. "
    "Your objective is to answer user questions based strictly and exclusively on the provided document excerpts.\n\n"
    "Strict Rules:\n"
    "1. Grounding: Answer ONLY using the facts directly stated in the context below. Do NOT assume, extrapolate, or bring in outside information.\n"
    "2. No Hallucination: If the provided context does not contain enough information to answer the question, respond with: "
    "'The document does not contain enough information to answer this question.'\n"
    "3. Conciseness: Be direct, clear, objective, and professional. Avoid conversational filler."
)

EMPTY_CONTEXT_FALLBACK_ANSWER: str = (
    "The document does not contain enough information to answer this question."
)


def build_context_from_chunks(chunks: List[Dict[str, Any]]) -> str:
    """
    Formats retrieved document chunks into a structured context string for Gemini.

    Args:
        chunks (List[Dict[str, Any]]): Retrieved chunk records.

    Returns:
        str: Multi-line structured context string.
    """
    if not chunks:
        return ""

    context_parts: List[str] = []
    for i, chunk in enumerate(chunks):
        c_index = chunk.get("chunk_index", i)
        content = (chunk.get("content") or "").strip()
        page_num = chunk.get("page_number")
        page_label = f" (Page {page_num})" if page_num is not None else ""

        context_parts.append(f"[Excerpt {i + 1} - Chunk {c_index}{page_label}]:\n{content}")

    return "\n\n".join(context_parts)


def build_rag_prompt(context: str, question: str) -> str:
    """
    Constructs the user prompt combining the document context and user question.
    """
    return (
        f"Context from document:\n"
        f"\"\"\"\n"
        f"{context}\n"
        f"\"\"\"\n\n"
        f"User Question: {question}\n\n"
        f"Answer:"
    )


def answer_document_question(
    document_id: str,
    user_question: str,
    top_k: int = 5,
    min_similarity: Optional[float] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    client: Optional[Any] = None,
    conn: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Performs Retrieval-Augmented Generation (RAG) question answering for a document:
    1. Validates inputs.
    2. Performs semantic search in PostgreSQL using pgvector to retrieve the top-k chunks.
    3. Handles empty retrieval results safely.
    4. Constructs grounded context from retrieved chunks.
    5. Prompts Gemini with strict anti-hallucination system instructions.
    6. Returns the generated answer alongside source chunk citations and similarity scores.

    Args:
        document_id (str): UUID of the document to query.
        user_question (str): Natural language question asked by the user.
        top_k (int): Number of most similar chunks to retrieve (default: 5).
        min_similarity (Optional[float]): Optional threshold to filter low-similarity chunks.
        model (Optional[str]): Gemini generation model ID override (default: gemini-3.5-flash-lite).
        api_key (Optional[str]): Optional API key override.
        client (Optional[genai.Client]): Optional pre-initialized GenAI client.
        conn (Optional[Any]): Optional active psycopg2 database connection.

    Returns:
        Dict[str, Any]: Structured RAG response containing:
            - "answer" (str): Grounded answer from Gemini (or fallback notice).
            - "source_chunks" (List[Dict[str, Any]]): Retrieved chunks with index and similarity score.
            - "document_id" (str): The document UUID.
            - "user_question" (str): The original question.
            - "model" (str): The model ID used.

    Raises:
        ValueError: If document_id or user_question is empty/invalid.
        DocumentNotFoundError: If the document does not exist in PostgreSQL.
        RuntimeError: If Gemini API generation fails.
    """
    # 1. Input validation
    if not document_id or not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string.")

    cleaned_doc_id = document_id.strip()
    try:
        uuid.UUID(cleaned_doc_id)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid document ID format: '{cleaned_doc_id}'. A valid UUID is required.")

    if not user_question or not isinstance(user_question, str) or not user_question.strip():
        raise ValueError("User question cannot be empty or whitespace.")

    cleaned_question = user_question.strip()
    active_model = model or DEFAULT_GENERATION_MODEL

    # 2. Semantic search to retrieve relevant chunks
    retrieved_chunks = search_similar_chunks(
        document_id=cleaned_doc_id,
        query=cleaned_question,
        top_k=top_k,
        min_similarity=min_similarity,
        conn=conn,
    )

    # 3. Handle empty retrieval results safely without unnecessary API calls
    if not retrieved_chunks:
        return {
            "answer": EMPTY_CONTEXT_FALLBACK_ANSWER,
            "source_chunks": [],
            "document_id": cleaned_doc_id,
            "user_question": cleaned_question,
            "model": active_model,
        }

    # Format source chunks for response
    source_chunks: List[Dict[str, Any]] = [
        {
            "id": chunk.get("id"),
            "chunk_index": chunk.get("chunk_index"),
            "content": chunk.get("content"),
            "similarity_score": chunk.get("similarity_score"),
            "page_number": chunk.get("page_number"),
        }
        for chunk in retrieved_chunks
    ]

    # 4. Build context and prompt from retrieved chunks
    context_text = build_context_from_chunks(retrieved_chunks)
    prompt_text = build_rag_prompt(context_text, cleaned_question)

    # 5. Initialize GenAI client
    active_client = client or get_genai_client(api_key=api_key)

    # 6. Call Gemini model with automatic retries for temporary API errors (503, 429, 500)
    config = types.GenerateContentConfig(
        temperature=0.2,  # Low temperature for deterministic, factual grounding
        system_instruction=SYSTEM_INSTRUCTION,
    )

    max_retries = len(RETRY_DELAYS)  # Max 2 retries
    last_retryable_exc: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            response = active_client.models.generate_content(
                model=active_model,
                contents=prompt_text,
                config=config,
            )

            answer_text = (response.text or "").strip()
            if not answer_text:
                answer_text = EMPTY_CONTEXT_FALLBACK_ANSWER

            return {
                "answer": answer_text,
                "source_chunks": source_chunks,
                "document_id": cleaned_doc_id,
                "user_question": cleaned_question,
                "model": active_model,
            }

        except Exception as exc:
            # Non-retryable error (e.g. 400, 404, or validation errors) -> do not retry
            if not is_retryable_gemini_error(exc):
                error_msg = str(exc)
                api_key_val = api_key or os.getenv("GEMINI_API_KEY") or ""
                if api_key_val and len(api_key_val) > 6:
                    error_msg = error_msg.replace(api_key_val, "[REDACTED_API_KEY]")
                raise RuntimeError(f"Failed to generate RAG answer with Gemini: {error_msg}") from exc

            last_retryable_exc = exc

            # If retries remain, wait with specified delay (2s then 5s)
            if attempt < max_retries:
                delay = RETRY_DELAYS[attempt]
                print(
                    f"[Gemini API Retry] Temporary API error (attempt {attempt + 1}/{max_retries + 1}). "
                    f"Retrying in {int(delay)}s..."
                )
                time.sleep(delay)
            else:
                # All retries exhausted -> raise GeminiServiceBusyError with friendly message
                print(
                    f"[Gemini API Retry] All {max_retries} retries exhausted on temporary Gemini API error."
                )
                raise GeminiServiceBusyError(BUSY_ERROR_MESSAGE) from last_retryable_exc


def generate_rag_answer(
    document_id: str,
    user_question: str,
    top_k: int = 5,
    min_similarity: Optional[float] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    client: Optional[Any] = None,
    conn: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Convenience alias for answer_document_question.
    """
    return answer_document_question(
        document_id=document_id,
        user_question=user_question,
        top_k=top_k,
        min_similarity=min_similarity,
        model=model,
        api_key=api_key,
        client=client,
        conn=conn,
    )


if __name__ == "__main__":
    print("=== Testing DocuMind RAG Service Module ===")

    # 1. Test input validation
    try:
        answer_document_question("", "What is the summary?")
        print("[FAIL] Empty document_id was not caught.")
    except ValueError as e:
        print(f"[PASS] Empty document_id caught: {e}")

    try:
        answer_document_question("not-a-uuid", "What is the summary?")
        print("[FAIL] Invalid UUID format was not caught.")
    except ValueError as e:
        print(f"[PASS] Invalid UUID format caught: {e}")

    try:
        answer_document_question("00000000-0000-0000-0000-000000000000", "   ")
        print("[FAIL] Empty user_question was not caught.")
    except ValueError as e:
        print(f"[PASS] Empty user_question caught: {e}")

    # 2. Test context builder
    sample_chunks = [
        {"chunk_index": 0, "content": "DocuMind is an AI document assistant.", "page_number": 1},
        {"chunk_index": 1, "content": "It supports PDF chunking and pgvector search.", "page_number": 2},
    ]
    built_ctx = build_context_from_chunks(sample_chunks)
    assert "[Excerpt 1 - Chunk 0 (Page 1)]:" in built_ctx
    assert "DocuMind is an AI document assistant." in built_ctx
    print(f"[PASS] Context builder verified with {len(sample_chunks)} chunks.")

    # 3. Test prompt builder
    sample_prompt = build_rag_prompt(built_ctx, "What does DocuMind do?")
    assert "User Question: What does DocuMind do?" in sample_prompt
    print("[PASS] RAG prompt builder verified.")

    print("RAG service module self-test complete.")
