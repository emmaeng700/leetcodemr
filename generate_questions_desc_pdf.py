#!/usr/bin/env python3
"""
LeetMastery - Questions-only PDF (problem statement + examples + constraints).
Same 21-pattern grouping as the full By-Pattern PDF; no solutions or code.

Usage:
  python3 generate_questions_desc_pdf.py
  python3 generate_questions_desc_pdf.py --out ~/Desktop/LeetMastery_Questions_Descriptions.pdf
  python3 generate_questions_desc_pdf.py --split   # also write one PDF per pattern on Desktop
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from generate_patterns_pdf import (
    DOOCS_CACHE,
    GRAY_500,
    LC_CACHE,
    MAX_W,
    PATTERN_DISPLAY_ORDER,
    PRINT_BANNER_BG,
    QUESTIONS,
    PatternMarker,
    QUICK_PATTERNS,
    build_groups,
    build_styles,
    desc_to_flowables,
    diff_badge,
    safe_xml,
)

SCRIPT_DIR = Path(__file__).parent
DEFAULT_DESKTOP = Path.home() / "Desktop"
DEFAULT_OUT = DEFAULT_DESKTOP / "LeetMastery_Questions_Descriptions.pdf"
DEFAULT_SPLIT_DIR = DEFAULT_DESKTOP / "LeetMastery_Question_Descriptions_by_Pattern"

# Stop parsing description HTML after these section headings (solutions / meta).
_STOP_HEADING = re.compile(
    r"^(follow[- ]?up|companies?|hints?|solution|approach|complexity|"
    r"related|submission|interview|references?|video|editorial|discussion|"
    r"topics?|similar|code snippet|implementation|java implementation|"
    r"python implementation|c\+\+ implementation)\b",
    re.I,
)
_KEEP_HEADING = re.compile(
    r"^(description|problem|examples?|constraints?|input|output|notes?)\b",
    re.I,
)


def trim_desc_html(desc_html: str) -> str:
    """Keep problem / examples / constraints; drop solution sections if present."""
    if not desc_html:
        return ""
    desc_html = desc_html.replace("\r\n", "\n").replace("\r", "\n")
    block_re = re.compile(
        r"(<(?:a[^>]+)?(?:glightbox)[^>]*>[\s\S]*?</a>)|"
        r"(<img[^>]*/?>)|"
        r"(<pre[^>]*>)([\s\S]*?)(</pre>)|"
        r"(<ul[^>]*>)([\s\S]*?)(</ul>)|"
        r"(<ol[^>]*>)([\s\S]*?)(</ol>)|"
        r"(<p[^>]*>)([\s\S]*?)(</p>)|"
        r"(<h[2-6][^>]*>)([\s\S]*?)(</h[2-6]>)",
        re.I,
    )
    chunks: list[str] = []
    stop = False
    for m in block_re.finditer(desc_html):
        if stop:
            break
        if m.group(15) is not None:
            inner = re.sub(r"<[^>]+>", "", m.group(16) or "").strip()
            if inner and not _KEEP_HEADING.search(inner) and _STOP_HEADING.search(inner):
                stop = True
                continue
        chunks.append(m.group(0))
    return "".join(chunks) if chunks else desc_html


def get_desc_html(q: dict, doocs_cache: dict, lc_cache: dict) -> str:
    qid = str(q["id"])
    slug = q.get("slug", "")
    doocs = doocs_cache.get(qid, {})
    lc = lc_cache.get(slug, {})
    html = doocs.get("desc_html") or lc.get("desc_html") or ""
    if html:
        return trim_desc_html(html)
    stored = (q.get("description") or "").strip()
    return stored


def build_desc_question_block(q, styles, doocs_cache, lc_cache, printable=True):
    story = []
    qid = q["id"]
    slug = q.get("slug", "")

    meta = Table(
        [[
            Paragraph(
                f"<font color='#6B7280'>#{qid}</font>",
                ParagraphStyle("mn", fontSize=10, fontName="LG-Bold"),
            ),
            diff_badge(q.get("difficulty", ""), printable=printable),
            Paragraph("", ParagraphStyle("sp", fontSize=10, fontName="LG-Bold")),
        ]],
        colWidths=[0.7 * inch, 0.85 * inch, 5.45 * inch],
    )
    meta.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(meta)
    story.append(Paragraph(safe_xml(q["title"]), styles["q_title"]))

    links = [
        f'<a href="https://leetcode.com/problems/{slug}/" color="#000000">LeetCode</a>',
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#000000">Doocs</a>',
    ]
    story.append(
        Paragraph(
            "    ".join(links),
            ParagraphStyle("lnk", fontSize=8, fontName="LG-Bold", spaceAfter=6),
        )
    )

    desc_html = get_desc_html(q, doocs_cache, lc_cache)
    if desc_html and "<" in desc_html:
        story += desc_to_flowables(desc_html, styles, printable=printable, bold=False)
    elif desc_html:
        story.append(Paragraph(safe_xml(desc_html), styles["body"]))
    else:
        story.append(
            Paragraph(
                "<i>No description in cache - run generate_patterns_pdf.py once to refresh .doocs_cache.json</i>",
                styles["body"],
            )
        )

    story.append(HRFlowable(width="100%", thickness=0.4, color=HexColor("#E5E7EB"), spaceBefore=8, spaceAfter=4))
    return story


def pattern_banner(pat: dict, qs: list, printable: bool = True):
    tbl = Table(
        [[Paragraph(
            f"<font color='#111827'><b>{pat['name']}</b>"
            f"  <font size='11'>- {len(qs)} questions  descriptions only</font></font>",
            ParagraphStyle("bshp", fontSize=18, fontName="LG-Bold", textColor=HexColor("#111827")),
        )]],
        colWidths=[MAX_W],
    )
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PRINT_BANNER_BG),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#9CA3AF")),
        ])
    )
    return tbl


def build_pdf(
    questions: list,
    doocs_cache: dict,
    lc_cache: dict,
    output: Path,
    *,
    title: str = "LeetMastery - Question Descriptions",
) -> None:
    groups = build_groups(questions)
    _disp_idx = {n: i for i, n in enumerate(PATTERN_DISPLAY_ORDER)}
    groups.sort(key=lambda g: _disp_idx.get(g[0]["name"], 99))
    styles = build_styles(printable=True)
    printable = True

    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=title,
        author="Emmanuel Oppong",
    )

    pat_list = "    ".join(p["name"] for p, qs in groups if qs)
    story = [
        PatternMarker("Cover"),
        Spacer(1, 1.8 * inch),
        Paragraph("LeetMastery", styles["cover_title"]),
        Paragraph("Question Descriptions", styles["cover_sub"]),
        Paragraph("Problem statements  examples  constraints only", styles["cover_sub"]),
        Paragraph("No solutions  no community code", styles["cover_sub"]),
        Spacer(1, 0.2 * inch),
        Paragraph(pat_list, ParagraphStyle(
            "pl", fontSize=9, textColor=HexColor("#6B7280"),
            alignment=TA_CENTER, fontName="LG", leading=15, spaceBefore=10,
        )),
        Paragraph(f"{len(questions)} questions  21 patterns", styles["cover_sub"]),
        PageBreak(),
    ]

    for pat, qs in groups:
        if not qs:
            continue
        story.append(PageBreak())
        story.append(PatternMarker(pat["name"]))
        story += [pattern_banner(pat, qs, printable), Spacer(1, 12)]
        for q in qs:
            story += build_desc_question_block(q, styles, doocs_cache, lc_cache, printable)

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG-Bold", 7.5)
        canvas.setFillColor(HexColor("#6B7280"))
        w, _h = doc.pagesize
        pn = canvas.getPageNumber()
        pat = getattr(canvas, "_lm_pattern_name", "")
        left = f"{pat}    {title}" if pat else title
        canvas.drawString(0.75 * inch, 0.38 * inch, left[:90])
        canvas.drawCentredString(w / 2, 0.38 * inch, f"- {pn} -")
        canvas.drawRightString(w - 0.75 * inch, 0.38 * inch, "LeetMastery")
        canvas.restoreState()

    output.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    kb = os.path.getsize(output) // 1024
    print(f"  Wrote {output} ({kb} KB)")


def slugify_pattern(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")


def main():
    ap = argparse.ArgumentParser(description="Build description-only LeetMastery PDFs.")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Combined PDF path")
    ap.add_argument(
        "--split",
        action="store_true",
        help=f"Also write 21 per-pattern PDFs under {DEFAULT_SPLIT_DIR.name}/",
    )
    ap.add_argument("--split-dir", type=Path, default=DEFAULT_SPLIT_DIR)
    args = ap.parse_args()

    print("Loading questions and caches...")
    questions = json.loads(QUESTIONS.read_text())
    doocs_cache = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    lc_cache = json.loads(LC_CACHE.read_text()) if LC_CACHE.exists() else {}
    print(f"  {len(questions)} questions, {sum(1 for v in doocs_cache.values() if v.get('desc_html'))} Doocs descriptions")

    print("\nBuilding combined PDF...")
    build_pdf(questions, doocs_cache, lc_cache, args.out)

    if args.split:
        groups = build_groups(questions)
        _disp_idx = {n: i for i, n in enumerate(PATTERN_DISPLAY_ORDER)}
        groups.sort(key=lambda g: _disp_idx.get(g[0]["name"], 99))
        args.split_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nBuilding per-pattern PDFs in {args.split_dir}...")
        for rank, (pat, qs) in enumerate((g for g in groups if g[1]), start=1):
            if not qs:
                continue
            fname = f"LeetMastery_{rank:02d}_{slugify_pattern(pat['name'])}_Descriptions.pdf"
            out = args.split_dir / fname
            build_pdf(
                qs,
                doocs_cache,
                lc_cache,
                out,
                title=f"LeetMastery - {pat['name']} (descriptions)",
            )

    print(f"\nDone. Files on Desktop:")
    print(f"  {args.out}")
    if args.split:
        print(f"  {args.split_dir}/ (21 pattern PDFs)")


if __name__ == "__main__":
    main()
