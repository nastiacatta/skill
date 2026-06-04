#!/usr/bin/env python3
"""
Convert a Markdown study script to an Overleaf-friendly LaTeX document.

This is a pragmatic converter tailored to this repo's presentation scripts:
- headings -> \\section / \\subsection
- fenced code blocks -> listings
- blockquotes -> quote
- simple tables -> tabular (booktabs)
- bullet/numbered lists -> itemize/enumerate

It is not a full Markdown parser; it aims to produce clean, paste-ready LaTeX.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


# Do NOT escape braces globally: it breaks LaTeX math like \{...\} and also
# interferes with injected commands (\textbf{...}). We assume literal braces
# are rare in the source text; if needed, users can write \{ \} explicitly.
SPECIAL_CHARS_RE = re.compile(r"([%&#_])")


def escape_outside_math(s: str) -> str:
    """
    Escape LaTeX special chars in text segments only, leaving $...$ blocks untouched.
    Assumes single-line math delimiters and an even number of '$' when used.
    """
    parts = s.split("$")
    if len(parts) == 1:
        return escape_tex(s)
    out_parts: list[str] = []
    for idx, part in enumerate(parts):
        if idx % 2 == 0:
            out_parts.append(escape_tex(part))
        else:
            out_parts.append(part)  # math: do not escape
    return "$".join(out_parts)


def escape_tex(s: str) -> str:
    # Escape common LaTeX special chars, but do NOT touch backslashes.
    # (We want to preserve LaTeX math and commands that already exist.)
    return SPECIAL_CHARS_RE.sub(r"\\\1", s)


def inline_code_to_texttt(line: str) -> str:
    # Replace `code` with \texttt{code}, escaping within.
    def repl(m: re.Match[str]) -> str:
        inner = m.group(1)
        return r"\texttt{" + escape_tex(inner) + "}"

    return re.sub(r"`([^`]+)`", repl, line)


def inline_md_emphasis_to_tex(line: str) -> str:
    # Convert **bold** and *italic* (simple, non-nested) to LaTeX.
    line = re.sub(r"\*\*([^*]+)\*\*", r"\\textbf{\1}", line)
    # Avoid turning list bullets into italics; require non-space around the marker.
    line = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\\emph{\1}", line)
    return line


def strip_md_links(line: str) -> str:
    """
    Convert Markdown links [text](url) -> text (drop URL).
    Keeps the visible anchor text, removes the destination.
    """
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)


def normalize_unicode_to_latex(line: str) -> str:
    """
    Replace common Unicode punctuation/symbols with pdflatex-safe equivalents.
    This runs on text *before* escaping, and should be safe inside math too
    (it mainly targets punctuation).
    """
    replacements = {
        "—": "---",
        "–": "--",
        "−": "-",  # minus sign
        "→": r"$\rightarrow$",
        "←": r"$\leftarrow$",
        "≤": r"$\le$",
        "≥": r"$\ge$",
        "≈": r"$\approx$",
        "≃": r"$\simeq$",
        "×": r"$\times$",
        "ρ": r"$\rho$",
        "γ": r"$\gamma$",
        "λ": r"$\lambda$",
        "η": r"$\eta$",
        "σ": r"$\sigma$",
        "π": r"$\pi$",
        "Δ": r"$\Delta$",
        "τ": r"$\tau$",
        "§": r"\S ",
        "…": r"\ldots{}",
        "“": "``",
        "”": "''",
        "’": "'",
        "•": r"\textbullet{}",
        "°": r"$^\circ$",
        "≠": r"$\ne$",
        "≪": r"$\ll$",
        "ï": r"\"{\i}",  # in naïve
    }
    for k, v in replacements.items():
        line = line.replace(k, v)
    return line


def is_table_header_sep(line: str) -> bool:
    # e.g. |----|-----| or | --- | --- |
    stripped = line.strip()
    if "|" not in stripped:
        return False
    cells = [c.strip() for c in stripped.strip("|").split("|")]
    return len(cells) >= 2 and all(re.fullmatch(r"[:\- ]+", c) for c in cells)


def parse_table(lines: list[str]) -> tuple[list[list[str]], int]:
    """
    Parse a GitHub-style pipe table starting at lines[0].
    Returns (rows, consumed_line_count).
    """
    rows: list[list[str]] = []
    i = 0
    while i < len(lines):
        raw = lines[i].rstrip("\n")
        if "|" not in raw:
            break
        # Stop on blank line.
        if raw.strip() == "":
            break
        # Stop if it looks like a non-table divider.
        if raw.strip().startswith("---") and raw.strip() == "---":
            break
        # Keep line, even header separator; we handle it outside.
        rows.append([c.strip() for c in raw.strip().strip("|").split("|")])
        i += 1
    return rows, i


def table_to_latex(rows: list[list[str]]) -> str:
    # Expect rows like: header row, separator row, body rows...
    if len(rows) < 2:
        return ""
    header = rows[0]
    body = rows[2:] if is_table_header_sep("|" + "|".join(rows[1]) + "|") else rows[1:]

    ncol = len(header)
    colspec = "l" * ncol
    out = []
    out.append(r"\begin{center}")
    out.append(r"\begin{tabular}{" + colspec + r"}")
    out.append(r"\toprule")
    def cell(c: str) -> str:
        c = strip_md_links(c)
        c = normalize_unicode_to_latex(c)
        c = inline_code_to_texttt(inline_md_emphasis_to_tex(c))
        c = escape_outside_math(c)
        # Undo escaping for braces in inserted LaTeX commands.
        c = (
            c.replace(r"\texttt\{", r"\texttt{")
            .replace(r"\textbf\{", r"\textbf{")
            .replace(r"\emph\{", r"\emph{")
        )
        return c

    out.append(" & ".join(cell(c) for c in header) + r" \\")
    out.append(r"\midrule")
    for r in body:
        r = (r + [""] * ncol)[:ncol]
        out.append(" & ".join(cell(c) for c in r) + r" \\")
    out.append(r"\bottomrule")
    out.append(r"\end{tabular}")
    out.append(r"\end{center}")
    return "\n".join(out)


def md_to_tex(md: str, *, title: str) -> str:
    lines = md.splitlines()
    out: list[str] = []

    # Preamble
    out.extend(
        [
            r"\documentclass[11pt]{article}",
            r"\usepackage[margin=1in]{geometry}",
            r"\usepackage[utf8]{inputenc}",
            r"\usepackage[T1]{fontenc}",
            r"\usepackage{lmodern}",
            r"\usepackage{microtype}",
            r"\usepackage{amsmath,amssymb,mathtools}",
            r"\usepackage{booktabs}",
            r"\usepackage[hidelinks]{hyperref}",
            r"\usepackage{xcolor}",
            r"\usepackage{listings}",
            r"\lstdefinestyle{mdstyle}{%",
            r"  basicstyle=\ttfamily\small,",
            r"  breaklines=true,",
            r"  columns=fullflexible,",
            r"  frame=single,",
            r"  rulecolor=\color{black!15},",
            r"  backgroundcolor=\color{black!2},",
            r"  xleftmargin=0.2cm,",
            r"  xrightmargin=0.2cm,",
            r"}",
            r"\title{" + escape_tex(normalize_unicode_to_latex(title)) + r"}",
            r"\author{}",
            r"\date{}",
            r"\begin{document}",
            r"\maketitle",
            "",
        ]
    )

    in_code = False
    in_quote = False
    list_stack: list[str] = []  # "itemize" or "enumerate"

    def unescape_inserted_cmds(s: str) -> str:
        # We escape { } in text, but we also insert LaTeX commands that require braces.
        # Undo escaping for those commands' braces.
        return (
            s.replace(r"\texttt\{", r"\texttt{")
            .replace(r"\textbf\{", r"\textbf{")
            .replace(r"\emph\{", r"\emph{")
        )

    def close_lists():
        nonlocal list_stack
        while list_stack:
            env = list_stack.pop()
            out.append(r"\end{" + env + r"}")

    i = 0
    while i < len(lines):
        line = lines[i]

        # Drop HTML anchors like: <a id="slide-1"></a>
        if re.match(r"^\s*<a\s+id=\"[^\"]+\"\s*>\s*</a>\s*$", line.strip()):
            i += 1
            continue

        # Code fences
        if line.strip().startswith("```"):
            if not in_code:
                close_lists()
                if in_quote:
                    out.append(r"\end{quote}")
                    in_quote = False
                out.append(r"\begin{lstlisting}[style=mdstyle]")
                in_code = True
            else:
                out.append(r"\end{lstlisting}")
                in_code = False
            i += 1
            continue

        if in_code:
            out.append(line.rstrip("\n"))
            i += 1
            continue

        # Horizontal rule
        if line.strip() == "---":
            close_lists()
            if in_quote:
                out.append(r"\end{quote}")
                in_quote = False
            out.append(r"\bigskip\hrule\bigskip")
            i += 1
            continue

        # Tables (pipe tables)
        if "|" in line and i + 1 < len(lines) and is_table_header_sep(lines[i + 1]):
            close_lists()
            rows, consumed = parse_table(lines[i : i + 200])
            out.append(table_to_latex(rows))
            i += consumed
            continue

        # Headings
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            close_lists()
            if in_quote:
                out.append(r"\end{quote}")
                in_quote = False
            level = len(m.group(1))
            raw = m.group(2).strip()
            # Special-case: replace the manual markdown ToC with LaTeX's.
            if raw.lower() == "table of contents":
                out.append(r"\tableofcontents")
                out.append("")
                i += 1
                # Skip the following markdown ToC list (until horizontal rule or next heading).
                while i < len(lines):
                    if lines[i].strip() == "---":
                        break
                    if re.match(r"^(#{1,6})\s+.*$", lines[i]):
                        break
                    i += 1
                continue

            raw = strip_md_links(raw)
            raw = normalize_unicode_to_latex(raw)
            text = inline_code_to_texttt(inline_md_emphasis_to_tex(raw))
            text = escape_outside_math(text)
            text = unescape_inserted_cmds(text)
            if level == 1:
                out.append(r"\section*{" + text + r"}")
            elif level == 2:
                out.append(r"\section{" + text + r"}")
            elif level == 3:
                out.append(r"\subsection{" + text + r"}")
            elif level == 4:
                out.append(r"\subsubsection{" + text + r"}")
            else:
                out.append(r"\paragraph{" + text + r"}")
            out.append("")
            i += 1
            continue

        # Blockquote
        if line.lstrip().startswith(">"):
            close_lists()
            if not in_quote:
                out.append(r"\begin{quote}")
                in_quote = True
            content = line.lstrip()[1:].lstrip()
            content = strip_md_links(content)
            content = normalize_unicode_to_latex(content)
            content = inline_code_to_texttt(inline_md_emphasis_to_tex(content))
            content = escape_outside_math(content)
            content = unescape_inserted_cmds(content)
            out.append(content)
            i += 1
            continue
        else:
            if in_quote:
                out.append(r"\end{quote}")
                in_quote = False

        # Lists
        bullet = re.match(r"^\s*-\s+(.*)$", line)
        numbered = re.match(r"^\s*\d+\.\s+(.*)$", line)
        if bullet or numbered:
            env = "itemize" if bullet else "enumerate"
            if not list_stack or list_stack[-1] != env:
                close_lists()
                out.append(r"\begin{" + env + r"}")
                list_stack.append(env)
            item_text = (bullet or numbered).group(1).strip()
            item_text = strip_md_links(item_text)
            item_text = normalize_unicode_to_latex(item_text)
            item_text = inline_code_to_texttt(inline_md_emphasis_to_tex(item_text))
            item_text = escape_outside_math(item_text)
            item_text = unescape_inserted_cmds(item_text)
            out.append(r"\item " + item_text)
            i += 1
            continue
        else:
            close_lists()

        # Blank lines
        if line.strip() == "":
            out.append("")
            i += 1
            continue

        # Normal paragraph line
        raw = strip_md_links(line.rstrip())
        raw = normalize_unicode_to_latex(raw)
        text = inline_code_to_texttt(inline_md_emphasis_to_tex(raw))
        text = escape_outside_math(text)
        text = unescape_inserted_cmds(text)
        out.append(text)
        i += 1

    close_lists()
    if in_quote:
        out.append(r"\end{quote}")

    out.append(r"\end{document}")
    out.append("")
    return "\n".join(out)


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: md_to_overleaf_tex.py <input.md> <output.tex> [title]", file=sys.stderr)
        return 2

    in_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    title = sys.argv[3] if len(sys.argv) >= 4 else in_path.stem.replace("_", " ")

    md = in_path.read_text(encoding="utf-8")
    tex = md_to_tex(md, title=title)
    out_path.write_text(tex, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

