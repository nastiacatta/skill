#!/usr/bin/env python3
"""Convert PDF files to markdown transcripts.

Usage:
    python scripts/pdf_to_md.py <input.pdf> [output.md]
    python scripts/pdf_to_md.py <input_dir/> <output_dir/>

If output is omitted, writes alongside the PDF with a .md extension.
When given directories, converts every PDF found in input_dir.
"""

import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required: pip install pymupdf")


PAGE_MARKER_RE = re.compile(r"^--\s*\d+\s+of\s+\d+\s*--$")
STANDALONE_PAGE_NUM_RE = re.compile(r"^\s*\d{1,4}\s*$")


def pdf_to_text(pdf_path: Path) -> str:
    doc = fitz.open(str(pdf_path))
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n".join(pages)


def clean_transcript(raw: str) -> str:
    lines = raw.splitlines()
    cleaned = []
    for line in lines:
        if PAGE_MARKER_RE.match(line.strip()):
            continue
        if STANDALONE_PAGE_NUM_RE.match(line) and not line.strip().startswith("0"):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def convert_one(pdf_path: Path, md_path: Path) -> None:
    raw = pdf_to_text(pdf_path)
    text = clean_transcript(raw)
    md_path.write_text(text, encoding="utf-8")
    line_count = text.count("\n") + 1
    print(f"  {pdf_path.name} -> {md_path.name} ({line_count} lines)")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1])

    if src.is_dir():
        dst_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else src
        dst_dir.mkdir(parents=True, exist_ok=True)
        pdfs = sorted(src.glob("*.pdf"))
        if not pdfs:
            sys.exit(f"No PDFs found in {src}")
        print(f"Converting {len(pdfs)} PDF(s):")
        for pdf in pdfs:
            md_name = pdf.stem.replace(" ", "_") + ".md"
            convert_one(pdf, dst_dir / md_name)
    elif src.is_file() and src.suffix.lower() == ".pdf":
        if len(sys.argv) > 2:
            dst = Path(sys.argv[2])
        else:
            dst = src.with_suffix(".md")
        print(f"Converting 1 PDF:")
        convert_one(src, dst)
    else:
        sys.exit(f"Not a PDF file or directory: {src}")

    print("Done.")


if __name__ == "__main__":
    main()
