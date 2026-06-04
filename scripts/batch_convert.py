#!/usr/bin/env python3
"""Batch-convert unique PDFs from ~/Desktop/masters/ into theory/extra/."""

import re
from pathlib import Path
from pdf_to_md import pdf_to_text, clean_transcript

MASTERS = Path.home() / "Desktop" / "masters"
OUTPUT = Path(__file__).resolve().parent.parent / "theory" / "extra"

ALREADY_TRANSCRIBED = {
    "ESG (6)",
    "ESG (3)",
    "MASTERS",
    "Masters_notes (2)",
    "NotesMasters",
    "Pierre_wagering",
    "arbitrage",
    "intermittentcontributions_michael",
    "intermittentcontributions_michael 2",
    "lambert_Selffinanced",
    "lambert_Selffinanced 2",
    "IEEE_Trans_Paper",
}


def stem_normalised(p: Path) -> str:
    return p.stem.strip()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    all_pdfs = sorted(MASTERS.rglob("*.pdf"))
    skipped, converted, failed = [], [], []

    for pdf in all_pdfs:
        stem = stem_normalised(pdf)
        if stem in ALREADY_TRANSCRIBED:
            skipped.append(pdf.name)
            continue

        safe_name = re.sub(r"[^\w\-.]", "_", stem) + ".md"
        out_path = OUTPUT / safe_name
        try:
            raw = pdf_to_text(pdf)
            text = clean_transcript(raw)
            if len(text.strip()) < 20:
                failed.append((pdf.name, "empty/too short after extraction"))
                continue
            out_path.write_text(text, encoding="utf-8")
            lines = text.count("\n") + 1
            converted.append((pdf.name, safe_name, lines))
            print(f"  OK  {pdf.name} -> {safe_name} ({lines} lines)")
        except Exception as e:
            failed.append((pdf.name, str(e)))
            print(f"  FAIL {pdf.name}: {e}")

    print(f"\n=== Summary ===")
    print(f"Converted: {len(converted)}")
    print(f"Skipped (duplicate): {len(skipped)}")
    print(f"Failed: {len(failed)}")
    if failed:
        for name, reason in failed:
            print(f"  - {name}: {reason}")


if __name__ == "__main__":
    main()
