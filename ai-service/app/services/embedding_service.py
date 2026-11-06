from pathlib import Path
from typing import Any, List, Optional
import os

# Load environment variables from ai-service/.env if available
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

# Model configuration
EMBEDDING_MODEL: str = "gemini-embedding-001"
TARGET_DIMENSION: int = 768


def get_genai_client(api_key: Optional[str] = None) -> Any:
    """
    Initializes and returns a Google GenAI Client using the provided key
    or the GEMINI_API_KEY environment variable.

    Raises:
        ImportError: If the google-genai SDK is not installed.
        ValueError: If GEMINI_API_KEY is not configured or empty.
    """
    if genai is None:
        raise ImportError(
            "google-genai SDK is not installed. Please run 'pip install google-genai' or install requirements."
        )

    resolved_key = (api_key if api_key is not None else (os.getenv("GEMINI_API_KEY") or "")).strip()
    if not resolved_key:
        raise ValueError(
            "GEMINI_API_KEY environment variable is not set. "
            "Please configure GEMINI_API_KEY in your environment or ai-service/.env."
        )

    return genai.Client(api_key=resolved_key)


def generate_embedding(
    text: str,
    api_key: Optional[str] = None,
    client: Optional[Any] = None,
) -> List[float]:
    """
    Generates a 768-dimensional text embedding vector using Google Gemini (gemini-embedding-001).

    Args:
        text (str): Non-empty text string to embed.
        api_key (Optional[str]): Optional API key overriding GEMINI_API_KEY env var.
        client (Optional[genai.Client]): Optional pre-initialized GenAI client.

    Returns:
        List[float]: Vector of exactly 768 float values matching PostgreSQL vector(768).

    Raises:
        ValueError: If input text is empty or GEMINI_API_KEY is missing.
        RuntimeError: If the Gemini API call fails.
    """
    # 1. Validate empty/blank input
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Input text cannot be empty or whitespace.")

    # 2. Client initialization & API key validation
    active_client = client or get_genai_client(api_key=api_key)

    # 3. Call Gemini embedding model
    try:
        config = types.EmbedContentConfig(
            output_dimensionality=TARGET_DIMENSION,
        )

        response = active_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text.strip(),
            config=config,
        )

        if not response or not response.embeddings or len(response.embeddings) == 0:
            raise RuntimeError("Gemini API returned an empty embedding response.")

        embedding_values: List[float] = list(response.embeddings[0].values)

        # 4. Verify output dimensionality strictly matches PostgreSQL vector(768)
        if len(embedding_values) != TARGET_DIMENSION:
            raise RuntimeError(
                f"Embedding dimension mismatch: expected {TARGET_DIMENSION}, got {len(embedding_values)}."
            )

        return embedding_values

    except Exception as exc:
        # Sanitize error message to prevent accidental API key leakage
        error_msg = str(exc)
        api_key_val = api_key or os.getenv("GEMINI_API_KEY") or ""
        if api_key_val and len(api_key_val) > 6:
            error_msg = error_msg.replace(api_key_val, "[REDACTED_API_KEY]")

        raise RuntimeError(f"Failed to generate embedding with Gemini API: {error_msg}") from exc


def generate_embeddings_batch(
    texts: List[str],
    api_key: Optional[str] = None,
    client: Optional[Any] = None,
) -> List[List[float]]:
    """
    Generates embeddings for a batch of text chunks, reusing the GenAI client.

    Args:
        texts (List[str]): List of text strings to embed.
        api_key (Optional[str]): Optional API key override.
        client (Optional[genai.Client]): Optional pre-initialized GenAI client.

    Returns:
        List[List[float]]: List of 768-dimensional float vectors.
    """
    if not texts:
        return []

    active_client = client or get_genai_client(api_key=api_key)
    return [generate_embedding(t, client=active_client) for t in texts]


if __name__ == "__main__":
    print("=== Testing DocuMind Gemini Embedding Service ===")

    # 1. Test empty input validation
    try:
        generate_embedding("   ")
        print("FAIL: Empty input was not rejected.")
    except ValueError as e:
        print(f"PASS: Empty input validation caught: {e}")

    # 2. Test missing API key validation
    try:
        # Force empty key test
        generate_embedding("DocuMind document search", api_key="")
        print("FAIL: Missing API key was not rejected.")
    except ValueError as e:
        print(f"PASS: Missing API key validation caught: {e}")

    # 3. Test live embedding if GEMINI_API_KEY is configured
    current_key = os.getenv("GEMINI_API_KEY")
    if current_key:
        print("\nFound GEMINI_API_KEY in environment. Testing live embedding...")
        try:
            sample_query = "DocuMind intelligent document extraction and semantic search."
            vector = generate_embedding(sample_query)
            print(f"[SUCCESS] Successfully generated embedding for: '{sample_query}'")
            print(f"  Vector Dimensions: {len(vector)} (Matches PostgreSQL vector(768))")
            print(f"  Sample values: {vector[:5]}...")
        except Exception as e:
            print(f"Live API test error: {e}")
    else:
        print("\nNote: Set GEMINI_API_KEY in environment or ai-service/.env to test live API calls.")
