from pathlib import Path
import os
import sys

# Ensure ai-service root directory is in sys.path
ai_service_root = Path(__file__).resolve().parent
if str(ai_service_root) not in sys.path:
    sys.path.insert(0, str(ai_service_root))

# Load environment configuration from ai-service/.env
try:
    from dotenv import load_dotenv
    env_path = ai_service_root / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

try:
    from app.services.rag_service import (
        answer_document_question,
        DocumentNotFoundError,
    )
except ImportError:
    from services.rag_service import (
        answer_document_question,
        DocumentNotFoundError,
    )


# Test Configuration
TEST_DOCUMENT_ID = "9da330ed-ca76-4de0-8181-0d90b0e05ece"
TEST_QUESTION = "What event did I participate in?"


def run_rag_test() -> None:
    """
    Executes a verification test against the DocuMind RAG question answering pipeline.
    Displays the generated answer and chunk similarity scores safely without exposing secrets.
    """
    print("=" * 60)
    print("  DocuMind RAG Question Answering - Service Verification")
    print("=" * 60)
    print(f"Document ID : {TEST_DOCUMENT_ID}")
    print(f"Question    : {TEST_QUESTION}")
    print("-" * 60)

    try:
        result = answer_document_question(
            document_id=TEST_DOCUMENT_ID,
            user_question=TEST_QUESTION,
            top_k=5,
        )

        answer = result.get("answer", "")
        source_chunks = result.get("source_chunks", [])
        model_used = result.get("model", "unknown")

        print(f"\n[Model Used]: {model_used}")
        print(f"\n[Generated Answer]:\n{answer}\n")
        print("-" * 60)
        print(f"[Retrieved Source Chunks]: {len(source_chunks)}")

        if not source_chunks:
            print("  Note: No chunks found for this document yet.")
            print("  (Run document processing if chunks have not been ingested)")
        else:
            for i, chunk in enumerate(source_chunks):
                chunk_idx = chunk.get("chunk_index", "N/A")
                sim_score = chunk.get("similarity_score", 0.0)
                page_num = chunk.get("page_number")
                page_str = f" | Page: {page_num}" if page_num is not None else ""
                content = (chunk.get("content") or "").replace("\n", " ").strip()
                preview = content[:120] + "..." if len(content) > 120 else content

                print(f"\n  Chunk #{i + 1}:")
                print(f"    Index      : {chunk_idx}{page_str}")
                print(f"    Similarity : {sim_score:.4f}")
                print(f"    Excerpt    : \"{preview}\"")

        print("\n" + "=" * 60)
        print("  RAG verification test completed successfully.")
        print("=" * 60)

    except DocumentNotFoundError as err:
        print(f"\n[ERROR] Target document not found in database: {err}")
    except Exception as err:
        # Sanitize error to prevent accidental leakage of API keys or credentials
        err_msg = str(err)
        api_key_val = os.getenv("GEMINI_API_KEY", "")
        if api_key_val and len(api_key_val) > 6:
            err_msg = err_msg.replace(api_key_val, "[REDACTED_API_KEY]")
        print(f"\n[ERROR] RAG test execution failed: {err_msg}")
        sys.exit(1)


if __name__ == "__main__":
    run_rag_test()
