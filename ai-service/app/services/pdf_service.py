import os
from typing import Any, Dict, List, TypedDict
import fitz  # PyMuPDF


class PageContent(TypedDict):
    page_number: int
    text: str


class ExtractedPDFData(TypedDict):
    total_pages: int
    pages: List[PageContent]


def extract_text_from_pdf(file_path: str) -> ExtractedPDFData:
    """
    Extracts text page-by-page from a PDF file using PyMuPDF (fitz).

    Args:
        file_path (str): Path to the target PDF file.

    Returns:
        ExtractedPDFData: Dictionary containing:
            - 'total_pages' (int): Total number of pages in the document.
            - 'pages' (List[PageContent]): List of dicts, each with:
                - 'page_number' (int): 1-indexed page number.
                - 'text' (str): Extracted text content of the page.

    Raises:
        FileNotFoundError: If the specified file does not exist.
        ValueError: If the file is empty, corrupted, encrypted, or invalid PDF.
        RuntimeError: If text extraction fails unexpectedly.
    """
    # 1. Verify file existence
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found at path: '{file_path}'")

    if not os.path.isfile(file_path):
        raise ValueError(f"Path is not a regular file: '{file_path}'")

    # 2. Check for empty file
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        raise ValueError(f"The PDF file at '{file_path}' is empty (0 bytes).")

    doc = None
    try:
        # 3. Open PDF document with PyMuPDF
        try:
            doc = fitz.open(file_path)
        except Exception as e:
            raise ValueError(f"Failed to open or parse PDF document '{file_path}': {e}") from e

        # 4. Check encryption / password protection
        if doc.is_encrypted:
            raise ValueError(f"The PDF file '{file_path}' is encrypted/password-protected and cannot be read.")

        # 5. Check page count
        total_pages = doc.page_count
        if total_pages == 0:
            raise ValueError(f"The PDF file '{file_path}' contains no pages.")

        pages_data: List[PageContent] = []

        # 6. Extract text page by page preserving 1-indexed page numbers
        for index in range(total_pages):
            try:
                page = doc.load_page(index)
                page_text = page.get_text("text").strip()
                pages_data.append(
                    {
                        "page_number": index + 1,
                        "text": page_text,
                    }
                )
            except Exception as e:
                raise RuntimeError(
                    f"Error extracting text from page {index + 1} of '{file_path}': {e}"
                ) from e

        return {
            "total_pages": total_pages,
            "pages": pages_data,
        }

    finally:
        # 7. Always ensure document handle is closed
        if doc is not None:
            doc.close()


if __name__ == "__main__":
    import sys
    import json

    # Allow CLI testing by passing path or falling back to sample upload
    target_path = sys.argv[1] if len(sys.argv) > 1 else None

    if not target_path:
        default_dir = os.path.join(os.path.dirname(__file__), "../../../backend/uploads")
        if os.path.exists(default_dir):
            pdfs = [os.path.join(default_dir, f) for f in os.listdir(default_dir) if f.lower().endswith(".pdf")]
            if pdfs:
                target_path = pdfs[0]

    if not target_path or not os.path.exists(target_path):
        print("Usage: python -m app.services.pdf_service <path_to_pdf>")
        sys.exit(1)

    print(f"Extracting text from: {target_path}")
    try:
        result = extract_text_from_pdf(target_path)
        print(f"Total Pages: {result['total_pages']}")
        for p in result["pages"]:
            preview = p["text"][:120].replace('\n', ' ') if p["text"] else "[No text on page]"
            print(f"Page {p['page_number']}: {preview}...")
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
