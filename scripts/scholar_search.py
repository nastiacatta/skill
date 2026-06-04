#!/usr/bin/env python3
"""Scholar search helper for thesis reference lookups.

Wraps two public APIs (arXiv and Semantic Scholar). No API key required.
Use this script to look up references by keyword or arXiv identifier.

Note: Semantic Scholar without an API key is rate-limited (HTTP 429).
For reliable lookups, prefer ``--source arxiv``. The S2
branch is kept here as a best-effort fallback.

Usage
-----
    python3 scripts/scholar_search.py "lambert 2008 wagering mechanism"
    python3 scripts/scholar_search.py --source arxiv "wagering mechanism"
    python3 scripts/scholar_search.py --source s2 "isotonic recalibration"
    python3 scripts/scholar_search.py --abs "1807.00263"        # arXiv abstract
    python3 scripts/scholar_search.py --paper-id "2510.13385"   # arXiv id

Output is plain text (title / authors / year / abstract / url), trimmed
to keep below the per-source 30-word verbatim limit. Pretty-printed for
readability.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "Mozilla/5.0 (compatible; thesis-review/1.0)"
TIMEOUT = 20


def _http_get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _truncate_words(text: str, max_words: int = 30) -> str:
    """Keep below a single-source 30-word verbatim limit."""
    if not text:
        return ""
    words = re.split(r"\s+", text.strip())
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]) + " ..."


def search_arxiv(query: str, n: int = 8) -> list[dict]:
    base = "http://export.arxiv.org/api/query"
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": n,
        "sortBy": "relevance",
    }
    url = base + "?" + urllib.parse.urlencode(params)
    body = _http_get(url)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(body)
    out = []
    for entry in root.findall("atom:entry", ns):
        title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
        summary = (entry.findtext("atom:summary", default="", namespaces=ns) or "").strip()
        published = (entry.findtext("atom:published", default="", namespaces=ns) or "").strip()
        link = (entry.findtext("atom:id", default="", namespaces=ns) or "").strip()
        authors = []
        for a in entry.findall("atom:author/atom:name", ns):
            if a.text:
                authors.append(a.text.strip())
        year = published[:4] if published else ""
        out.append({
            "source": "arxiv",
            "title": re.sub(r"\s+", " ", title),
            "authors": authors,
            "year": year,
            "abstract": _truncate_words(re.sub(r"\s+", " ", summary), 30),
            "url": link,
        })
    return out


def search_s2(query: str, n: int = 8) -> list[dict]:
    base = "https://api.semanticscholar.org/graph/v1/paper/search"
    fields = "title,authors,year,abstract,externalIds,citationCount,url"
    params = {"query": query, "limit": n, "fields": fields}
    url = base + "?" + urllib.parse.urlencode(params)
    try:
        body = _http_get(url)
    except Exception as exc:
        return [{"error": f"semanticscholar request failed: {exc}"}]
    try:
        data = json.loads(body)
    except Exception as exc:
        return [{"error": f"semanticscholar json decode failed: {exc}"}]
    out = []
    for paper in (data or {}).get("data", []) or []:
        authors = [a.get("name", "") for a in (paper.get("authors") or [])]
        ext = paper.get("externalIds") or {}
        out.append({
            "source": "semanticscholar",
            "title": paper.get("title") or "",
            "authors": authors,
            "year": str(paper.get("year") or ""),
            "abstract": _truncate_words(paper.get("abstract") or "", 30),
            "citations": paper.get("citationCount"),
            "url": paper.get("url") or "",
            "doi": ext.get("DOI", ""),
            "arxiv": ext.get("ArXiv", ""),
        })
    return out


def fetch_arxiv_paper(arxiv_id: str) -> list[dict]:
    aid = arxiv_id.replace("arxiv:", "").strip()
    base = "http://export.arxiv.org/api/query"
    params = {"id_list": aid, "max_results": 1}
    url = base + "?" + urllib.parse.urlencode(params)
    body = _http_get(url)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(body)
    entry = root.find("atom:entry", ns)
    if entry is None:
        return [{"error": f"no arxiv entry found for {aid}"}]
    title = (entry.findtext("atom:title", default="", namespaces=ns) or "").strip()
    summary = (entry.findtext("atom:summary", default="", namespaces=ns) or "").strip()
    published = (entry.findtext("atom:published", default="", namespaces=ns) or "").strip()
    link = (entry.findtext("atom:id", default="", namespaces=ns) or "").strip()
    authors = [a.text.strip() for a in entry.findall("atom:author/atom:name", ns) if a.text]
    return [{
        "source": "arxiv",
        "title": re.sub(r"\s+", " ", title),
        "authors": authors,
        "year": published[:4] if published else "",
        "abstract": _truncate_words(re.sub(r"\s+", " ", summary), 60),
        "url": link,
    }]


def render(items: list[dict]) -> str:
    lines = []
    for i, it in enumerate(items, 1):
        if "error" in it:
            lines.append(f"[error] {it['error']}")
            continue
        authors = ", ".join((it.get("authors") or [])[:6])
        if len(it.get("authors") or []) > 6:
            authors += ", ..."
        head = f"[{i}] {it.get('title', '')}"
        meta = []
        if it.get("year"):
            meta.append(it["year"])
        if it.get("source"):
            meta.append(it["source"])
        if it.get("citations") is not None:
            meta.append(f"{it['citations']} cites")
        if it.get("doi"):
            meta.append(f"doi:{it['doi']}")
        if it.get("arxiv"):
            meta.append(f"arxiv:{it['arxiv']}")
        meta_str = " | ".join(meta)
        lines.append(head)
        if authors:
            lines.append(f"    {authors}")
        if meta_str:
            lines.append(f"    {meta_str}")
        if it.get("abstract"):
            lines.append(f"    {it['abstract']}")
        if it.get("url"):
            lines.append(f"    {it['url']}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Scholar search helper")
    p.add_argument("query", nargs="*", help="Search query")
    p.add_argument("--source", choices=["arxiv", "s2", "both"], default="both")
    p.add_argument("--n", type=int, default=8, help="Results per source")
    p.add_argument("--paper-id", dest="paper_id", default=None,
                   help="Fetch a specific arXiv paper by id (e.g. 2510.13385)")
    p.add_argument("--abs", dest="abs_id", default=None,
                   help="Alias for --paper-id")
    p.add_argument("--json", action="store_true",
                   help="Emit raw JSON instead of pretty text")
    args = p.parse_args(argv)

    if args.paper_id or args.abs_id:
        results = fetch_arxiv_paper(args.paper_id or args.abs_id)
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print(render(results))
        return 0

    if not args.query:
        p.error("query required (or use --paper-id)")

    query = " ".join(args.query)
    results: list[dict] = []
    if args.source in ("arxiv", "both"):
        try:
            results += search_arxiv(query, args.n)
        except Exception as exc:
            results.append({"error": f"arxiv search failed: {exc}"})
    if args.source in ("s2", "both"):
        try:
            results += search_s2(query, args.n)
        except Exception as exc:
            results.append({"error": f"semanticscholar search failed: {exc}"})

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(render(results))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
