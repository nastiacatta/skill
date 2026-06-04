#!/usr/bin/env python3
"""
Generate a single self-contained HTML file that:
- renders a Markdown file to HTML (via marked.js)
- renders LaTeX math ($...$, $$...$$) via MathJax

This avoids LaTeX toolchain/Overleaf issues and gives a clean "paper-like" view.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      :root {{
        --bg: #0b0d12;
        --panel: #0f1420;
        --text: #e9eefc;
        --muted: #b7c2dd;
        --link: #8ab4ff;
        --rule: rgba(255,255,255,.12);
        --code-bg: rgba(255,255,255,.06);
        --code-border: rgba(255,255,255,.10);
      }}
      html, body {{ height: 100%; }}
      body {{
        margin: 0;
        background: radial-gradient(1200px 800px at 15% 10%, rgba(138,180,255,.12), transparent 60%),
                    radial-gradient(1200px 800px at 85% 20%, rgba(150,255,190,.08), transparent 60%),
                    var(--bg);
        color: var(--text);
        font: 16px/1.55 ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
      }}
      .wrap {{
        max-width: 980px;
        margin: 0 auto;
        padding: 56px 22px 80px;
      }}
      .top {{
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 18px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--rule);
        margin-bottom: 22px;
      }}
      .top h1 {{
        font-size: 26px;
        letter-spacing: 0.2px;
        margin: 0;
      }}
      .top .meta {{
        color: var(--muted);
        font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        text-align: right;
        white-space: nowrap;
      }}
      #content {{
        background: rgba(255,255,255,.03);
        border: 1px solid var(--rule);
        border-radius: 16px;
        padding: 26px 26px;
        box-shadow: 0 10px 35px rgba(0,0,0,.35);
      }}
      h1, h2, h3, h4 {{
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        line-height: 1.25;
        margin-top: 1.35em;
      }}
      h1 {{ font-size: 26px; }}
      h2 {{ font-size: 20px; }}
      h3 {{ font-size: 16px; text-transform: none; }}
      h4 {{ font-size: 14px; color: var(--muted); }}
      p {{ margin: 0.7em 0; }}
      a {{ color: var(--link); }}
      hr {{
        border: 0;
        border-top: 1px solid var(--rule);
        margin: 22px 0;
      }}
      blockquote {{
        margin: 16px 0;
        padding: 12px 14px;
        border-left: 3px solid rgba(138,180,255,.5);
        background: rgba(138,180,255,.06);
        border-radius: 10px;
        color: var(--muted);
      }}
      code, pre {{
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }}
      pre {{
        background: var(--code-bg);
        border: 1px solid var(--code-border);
        border-radius: 12px;
        padding: 14px 14px;
        overflow: auto;
      }}
      code {{
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 8px;
        padding: 1px 6px;
      }}
      pre code {{
        background: transparent;
        border: 0;
        padding: 0;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0;
        overflow: hidden;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.10);
      }}
      th, td {{
        border-bottom: 1px solid rgba(255,255,255,.08);
        padding: 10px 10px;
        vertical-align: top;
        font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      }}
      th {{
        background: rgba(255,255,255,.04);
        text-align: left;
      }}
      tr:last-child td {{ border-bottom: 0; }}
      ul, ol {{ padding-left: 1.25em; }}
      .toc {{
        margin-top: 10px;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 12px;
        background: rgba(0,0,0,.15);
        font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        color: var(--muted);
      }}
      .toc a {{ text-decoration: none; }}
      .toc a:hover {{ text-decoration: underline; }}
      .hint {{
        margin-top: 14px;
        color: var(--muted);
        font: 12px/1.45 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      }}
    </style>

    <script>
      // MathJax config: allow $...$ and $$...$$
      window.MathJax = {{
        tex: {{
          inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
          displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
          processEscapes: true,
        }},
        options: {{
          skipHtmlTags: ['script','noscript','style','textarea','pre','code'],
        }}
      }};
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script defer id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  </head>
  <body>
    <div class="wrap">
      <div class="top">
        <h1>{title}</h1>
        <div class="meta">
          Local HTML preview<br/>
          MathJax + Markdown
        </div>
      </div>
      <div id="content">
        <div class="toc" id="toc"></div>
        <div id="errors" style="display:none; margin-top:12px; padding:10px 12px; border:1px solid rgba(255,120,120,.35); background:rgba(255,60,60,.08); border-radius:12px; color:#ffd6d6; font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;"></div>
        <div class="hint">Tip: use browser search (⌘F) and zoom (⌘+).</div>
        <hr/>
        <div id="doc"></div>
      </div>
    </div>

    <script>
      const MD_SOURCE = {md_json};

      function buildToc(container) {{
        const headings = Array.from(document.querySelectorAll('#doc h1, #doc h2, #doc h3'));
        if (!headings.length) {{
          container.textContent = '';
          return;
        }}
        const items = headings.map(h => {{
          if (!h.id) {{
            h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          }}
          const level = h.tagName === 'H1' ? 1 : (h.tagName === 'H2' ? 2 : 3);
          const indent = level === 1 ? 0 : (level === 2 ? 12 : 24);
          return `<div style="margin-left:${{indent}}px"><a href="#${{h.id}}">${{h.textContent}}</a></div>`;
        }}).join('');
        container.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Contents</div>${{items}}`;
      }}

      function showError(err) {{
        const el = document.getElementById('errors');
        el.style.display = 'block';
        el.textContent = String(err && (err.stack || err.message) || err);
      }}

      async function render() {{
        try {{
          if (!window.marked) {{
            throw new Error('marked failed to load (CDN blocked/offline?).');
          }}
          marked.setOptions({{
            gfm: true,
            breaks: false,
            mangle: false,
            headerIds: true,
          }});

          const html = marked.parse(MD_SOURCE);
          const docEl = document.getElementById('doc');
          docEl.innerHTML = html;

          buildToc(document.getElementById('toc'));

          if (window.MathJax && window.MathJax.typesetPromise) {{
            await window.MathJax.typesetPromise();
          }} else {{
            // If MathJax is blocked/offline, still show the content.
          }}
        }} catch (e) {{
          showError(e);
        }}
      }}

      // Wait until scripts are loaded
      window.addEventListener('DOMContentLoaded', () => {{
        setTimeout(() => render(), 0);
      }});
    </script>
  </body>
</html>
"""


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: md_to_mathjax_html.py <input.md> <output.html> [title]", file=sys.stderr)
        return 2

    in_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    title = sys.argv[3] if len(sys.argv) >= 4 else in_path.stem

    md = in_path.read_text(encoding="utf-8")
    md_json = json.dumps(md)
    html = HTML_TEMPLATE.format(title=title.replace("&", "&amp;"), md_json=md_json)
    out_path.write_text(html, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

