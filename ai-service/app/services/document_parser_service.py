import os
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

try:
    import docx
except ImportError:
    docx = None

try:
    from app.services.pdf_service import extract_text_from_pdf
except ImportError:
    from .pdf_service import extract_text_from_pdf


class PageContent(TypedDict):
    page_number: int
    text: str


class ExtractedDocumentData(TypedDict):
    total_pages: int
    pages: List[PageContent]


def extract_text_from_docx(file_path: str) -> ExtractedDocumentData:
    """
    Extracts text from a Word document (.docx) including all paragraphs and tables.

    Args:
        file_path (str): Absolute or relative path to the .docx file.

    Returns:
        ExtractedDocumentData: Dictionary with total_pages and list of page dicts.

    Raises:
        ImportError: If python-docx is not installed.
        FileNotFoundError: If the file does not exist.
        ValueError: If the file is empty, corrupted, or contains no readable text.
    """
    if docx is None:
        raise ImportError(
            "python-docx is not installed. Please run 'pip install python-docx' in ai-service."
        )

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"DOCX file not found at path: '{file_path}'")

    if os.path.getsize(file_path) == 0:
        raise ValueError(f"The DOCX file at '{file_path}' is empty (0 bytes).")

    try:
        doc = docx.Document(file_path)
    except Exception as e:
        raise ValueError(f"Failed to open or parse DOCX document '{file_path}': {e}") from e

    text_parts: List[str] = []

    # 1. Extract all paragraph text
    for para in doc.paragraphs:
        cleaned = para.text.strip()
        if cleaned:
            text_parts.append(cleaned)

    # 2. Extract text from all tables (rows and cells)
    for table in doc.tables:
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_cells:
                # Deduplicate repeated merged cell values in the same row
                seen = []
                for c in row_cells:
                    if not seen or seen[-1] != c:
                        seen.append(c)
                text_parts.append(" | ".join(seen))

    combined_text = "\n\n".join(text_parts).strip()

    if not combined_text:
        raise ValueError(
            f"The DOCX file at '{file_path}' contains no readable text."
        )

    return {
        "total_pages": 1,
        "pages": [
            {
                "page_number": 1,
                "text": combined_text,
            }
        ],
    }


def extract_text_from_txt(file_path: str) -> ExtractedDocumentData:
    """
    Extracts text from a plain text file (.txt) with robust encoding fallback.

    Args:
        file_path (str): Path to the text file.

    Returns:
        ExtractedDocumentData: Dictionary with total_pages and list of page dicts.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file is empty or blank.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"TXT file not found at path: '{file_path}'")

    if os.path.getsize(file_path) == 0:
        raise ValueError(f"The TXT file at '{file_path}' is empty (0 bytes).")

    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "iso-8859-1"]
    raw_content = None

    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                raw_content = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if raw_content is None:
        raise ValueError(f"Unable to decode text file '{file_path}' using supported encodings.")

    cleaned_text = raw_content.strip()

    if not cleaned_text:
        raise ValueError(f"The TXT file at '{file_path}' contains only whitespace or is empty.")

    return {
        "total_pages": 1,
        "pages": [
            {
                "page_number": 1,
                "text": cleaned_text,
            }
        ],
    }


def extract_text_from_document(
    file_path: str,
    filename: Optional[str] = None,
) -> ExtractedDocumentData:
    """
    Unified document text extractor supporting PDF, DOCX, and TXT files.

    Args:
        file_path (str): Local filesystem path to the document file.
        filename (Optional[str]): Original filename to help detect extension.

    Returns:
        ExtractedDocumentData: Total page count and per-page text segments.

    Raises:
        ValueError: If the file extension is unsupported or content is invalid.
    """
    name_to_check = filename or file_path
    ext = Path(name_to_check).suffix.lower()

    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext in [".txt", ".text"]:
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(
            f"Unsupported document format '{ext}'. Only PDF (.pdf), Word (.docx), and Text (.txt) files are supported."
        )
