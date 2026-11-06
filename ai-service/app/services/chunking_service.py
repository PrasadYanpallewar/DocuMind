from typing import Any, Dict, List, TypedDict, Union


class ChunkData(TypedDict):
    chunk_index: int
    page_number: int
    content: str
    word_count: int


def chunk_document_pages(
    pages_data: Union[Dict[str, Any], List[Dict[str, Any]]],
    chunk_size: int = 500,
    overlap: int = 100,
) -> List[ChunkData]:
    """
    Chunks extracted PDF page text into overlapping segments of approximately
    chunk_size words with specified word overlap between consecutive chunks.

    Args:
        pages_data: Dictionary containing 'pages' list (from extract_text_from_pdf)
                    or a direct list of page dictionaries [{"page_number": int, "text": str}].
        chunk_size: Target number of words per chunk (default: 500).
        overlap: Number of overlapping words between consecutive chunks (default: 100).

    Returns:
        List[ChunkData]: Structured list of chunks containing:
            - chunk_index (int): Sequential 0-indexed identifier for the chunk.
            - page_number (int): Original source page number.
            - content (str): Text content of the chunk.
            - word_count (int): Number of words in the chunk.

    Raises:
        ValueError: If parameters or input format are invalid.
        TypeError: If input types are incorrect.
    """
    # 1. Input validation
    if pages_data is None:
        raise ValueError("Input pages_data cannot be None.")

    if not isinstance(chunk_size, int) or chunk_size <= 0:
        raise ValueError(f"chunk_size must be a positive integer, got: {chunk_size}")

    if not isinstance(overlap, int) or overlap < 0:
        raise ValueError(f"overlap must be a non-negative integer, got: {overlap}")

    if overlap >= chunk_size:
        raise ValueError(
            f"overlap ({overlap}) must be strictly less than chunk_size ({chunk_size})."
        )

    # Normalize pages collection
    if isinstance(pages_data, dict):
        if "pages" not in pages_data:
            raise ValueError("Input dictionary must contain a 'pages' key.")
        raw_pages = pages_data["pages"]
    elif isinstance(pages_data, list):
        raw_pages = pages_data
    else:
        raise TypeError(
            f"Expected pages_data to be a dict or list, got: {type(pages_data).__name__}"
        )

    if not isinstance(raw_pages, list):
        raise TypeError("Pages collection must be a list of page objects.")

    chunks: List[ChunkData] = []
    chunk_index = 0
    step = chunk_size - overlap

    # 2. Iterate through pages and split into chunks
    for page_entry in raw_pages:
        if not isinstance(page_entry, dict):
            continue

        page_number = page_entry.get("page_number", 1)
        raw_text = page_entry.get("text", "")

        if not isinstance(raw_text, str):
            raw_text = str(raw_text)

        # 3. Ignore empty text pages
        cleaned_text = raw_text.strip()
        if not cleaned_text:
            continue

        words = cleaned_text.split()
        if not words:
            continue

        # If page text fits entirely within a single chunk
        if len(words) <= chunk_size:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "page_number": page_number,
                    "content": " ".join(words),
                    "word_count": len(words),
                }
            )
            chunk_index += 1
            continue

        # Sliding window with overlap
        for i in range(0, len(words), step):
            chunk_words = words[i : i + chunk_size]
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "page_number": page_number,
                    "content": " ".join(chunk_words),
                    "word_count": len(chunk_words),
                }
            )
            chunk_index += 1

            # Terminate if the current window reached or passed the end
            if i + chunk_size >= len(words):
                break

    return chunks


if __name__ == "__main__":
    # Small test example demonstrating chunking with overlap and empty page skipping
    sample_pdf_data = {
        "total_pages": 3,
        "pages": [
            {
                "page_number": 1,
                "text": " ".join([f"Page1Word{i}" for i in range(1, 1201)]),  # 1200 words
            },
            {
                "page_number": 2,
                "text": "    \n\t   ",  # Empty page -> will be ignored
            },
            {
                "page_number": 3,
                "text": "This is page 3 with brief content for executive review.",  # Small page
            },
        ],
    }

    print("Running sample chunking test...")
    results = chunk_document_pages(sample_pdf_data, chunk_size=500, overlap=100)

    print(f"Total chunks created: {len(results)}\n")
    for chunk in results:
        preview = chunk["content"][:60]
        print(
            f"Chunk Index: {chunk['chunk_index']} | "
            f"Page: {chunk['page_number']} | "
            f"Words: {chunk['word_count']} | "
            f"Preview: '{preview}...'"
        )
