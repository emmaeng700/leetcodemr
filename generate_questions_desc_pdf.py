#!/usr/bin/env python3
"""
LeetMastery - Questions-only PDF (problem statement + examples + constraints).
Same 21-pattern grouping as the full By-Pattern PDF; no solutions or code.
Includes clickable TOC, per-question links, and Back to Contents on each page block.

Usage:
  python3 generate_questions_desc_pdf.py
  python3 generate_questions_desc_pdf.py --out ~/Desktop/LeetMastery_Questions_Descriptions.pdf
  python3 generate_questions_desc_pdf.py --split
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
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
    LC_CACHE,
    MAX_W,
    PATTERN_DISPLAY_ORDER,
    PRINT_BANNER_BG,
    QUESTIONS,
    PatternMarker,
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
TOC_ANCHOR = "contents"
LINK_COLOR = "#1D4ED8"
LINK_COLOR_PRINT = "#0000EE"

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


def slugify(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").lower()


def anchor_pat(pat_name: str) -> str:
    return f"pat_{slugify(pat_name)}"


def anchor_q(qid: int) -> str:
    return f"q_{qid}"


def link_to(href: str, label: str, *, bold: bool = False) -> str:
    col = LINK_COLOR_PRINT
    text = safe_xml(label)
    if bold:
        return f'<link href="#{href}" color="{col}"><b>{text}</b></link>'
    return f'<link href="#{href}" color="{col}">{text}</link>'


def anchor_tag(name: str) -> str:
    return f'<a name="{name}"/>'


class PdfBookmark(Flowable):
    """PDF sidebar outline entry at the current page."""

    def __init__(self, key: str, title: str, level: int = 0):
        super().__init__()
        self.key = key
        self.title = title
        self.level = level

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        canv = self.canv
        canv.bookmarkPage(self.key)
        canv.addOutlineEntry(self.title, self.key, level=self.level, closed=0)


def trim_desc_html(desc_html: str) -> str:
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
    return (q.get("description") or "").strip()


def _anchor_para(name: str) -> Paragraph:
    return Paragraph(
        anchor_tag(name),
        ParagraphStyle("anch", fontSize=1, leading=1, spaceBefore=0, spaceAfter=0),
    )


def _back_link_para(href: str = TOC_ANCHOR) -> Paragraph:
    return Paragraph(
        link_to(href, "<< Contents"),
        ParagraphStyle(
            "back", fontSize=9, fontName="LG-Bold", textColor=HexColor(LINK_COLOR_PRINT),
            spaceAfter=4, alignment=TA_LEFT,
        ),
    )


def build_toc(groups: list, styles: dict, *, full_doc: bool) -> list:
    """Clickable table of contents (patterns + questions)."""
    story: list = []
    story.append(_anchor_para(TOC_ANCHOR))
    story.append(PdfBookmark(TOC_ANCHOR, "Table of Contents", level=0))
    story.append(
        Paragraph(
            "<b>Table of Contents</b>",
            ParagraphStyle(
                "toc_h", fontSize=16, fontName="LG-Bold", textColor=HexColor("#111827"),
                spaceAfter=10, spaceBefore=0,
            ),
        )
    )
    story.append(
        Paragraph(
            "Click a pattern or question to jump. Use <b>&lt;&lt; Contents</b> on each page to return here.",
            ParagraphStyle(
                "toc_hint", fontSize=9, fontName="LG", textColor=HexColor("#6B7280"),
                spaceAfter=12, leading=13,
            ),
        )
    )

    pat_style = ParagraphStyle(
        "toc_pat", fontSize=11, fontName="LG-Bold", spaceBefore=8, spaceAfter=3, leading=14,
    )
    q_style = ParagraphStyle(
        "toc_q", fontSize=9.5, fontName="LG", leftIndent=16, spaceAfter=2, leading=13,
    )

    for rank, (pat, qs) in enumerate((g for g in groups if g[1]), start=1):
        if not qs:
            continue
        pa = anchor_pat(pat["name"])
        pat_label = f"{rank}. {pat['name']} ({len(qs)})"
        if full_doc:
            story.append(Paragraph(link_to(pa, pat_label, bold=True), pat_style))
        for q in qs:
            qa = anchor_q(q["id"])
            diff = q.get("difficulty", "")[:1].upper() if q.get("difficulty") else "?"
            label = f"#{q['id']} {q['title']} [{diff}]"
            story.append(Paragraph(link_to(qa, label), q_style))

    story.append(PageBreak())
    return story


def build_desc_question_block(
    q,
    styles,
    doocs_cache,
    lc_cache,
    *,
    printable=True,
    show_back: bool = True,
):
    story = []
    qid = q["id"]
    slug = q.get("slug", "")
    qa = anchor_q(qid)

    story.append(PdfBookmark(qa, f"#{qid} {q['title']}", level=1))
    story.append(_anchor_para(qa))
    if show_back:
        story.append(_back_link_para(TOC_ANCHOR))

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

    ext_links = [
        f'<a href="https://leetcode.com/problems/{slug}/" color="#000000">LeetCode</a>',
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#000000">Doocs</a>',
    ]
    story.append(
        Paragraph(
            "  |  ".join(ext_links),
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


def pattern_banner(pat: dict, qs: list, *, show_back: bool, pat_anchor: str):
    back_cell = ""
    if show_back:
        back_cell = link_to(TOC_ANCHOR, "<< Contents")

    tbl = Table(
        [[
            Paragraph(
                f"<font color='#111827'><b>{pat['name']}</b>"
                f"  <font size='11'>- {len(qs)} questions</font></font>",
                ParagraphStyle("bshp", fontSize=18, fontName="LG-Bold", textColor=HexColor("#111827")),
            ),
            Paragraph(
                back_cell,
                ParagraphStyle("bb", fontSize=9, fontName="LG-Bold", alignment=TA_LEFT),
            ) if show_back else Paragraph("", ParagraphStyle("bb", fontSize=9)),
        ]],
        colWidths=[5.2 * inch, 1.8 * inch],
    )
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PRINT_BANNER_BG),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#9CA3AF")),
        ])
    )
    story = [
        PdfBookmark(pat_anchor, pat["name"], level=0),
        _anchor_para(pat_anchor),
        tbl,
    ]
    return story


def build_pdf(
    questions: list,
    doocs_cache: dict,
    lc_cache: dict,
    output: Path,
    *,
    title: str = "LeetMastery - Question Descriptions",
    include_toc: bool = True,
) -> None:
    groups = build_groups(questions)
    _disp_idx = {n: i for i, n in enumerate(PATTERN_DISPLAY_ORDER)}
    groups.sort(key=lambda g: _disp_idx.get(g[0]["name"], 99))
    styles = build_styles(printable=True)
    printable = True
    n_pat_sections = sum(1 for _, qs in groups if qs)
    full_doc = include_toc and n_pat_sections > 1

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

    pat_list = "  |  ".join(p["name"] for p, qs in groups if qs)
    story = [
        PatternMarker("Cover"),
        Spacer(1, 1.8 * inch),
        Paragraph("LeetMastery", styles["cover_title"]),
        Paragraph("Question Descriptions", styles["cover_sub"]),
        Paragraph("Problem statements, examples, constraints", styles["cover_sub"]),
        Paragraph(
            link_to(TOC_ANCHOR, "Open Table of Contents"),
            ParagraphStyle(
                "coverlnk", fontSize=12, fontName="LG-Bold", textColor=HexColor(LINK_COLOR_PRINT),
                alignment=TA_CENTER, spaceBefore=16, spaceAfter=8,
            ),
        ),
        Spacer(1, 0.15 * inch),
        Paragraph(pat_list, ParagraphStyle(
            "pl", fontSize=9, textColor=HexColor("#6B7280"),
            alignment=TA_CENTER, fontName="LG", leading=15, spaceBefore=6,
        )),
        Paragraph(f"{len(questions)} questions", styles["cover_sub"]),
        PageBreak(),
    ]

    if include_toc:
        story += build_toc(groups, styles, full_doc=full_doc)

    show_back = include_toc
    for pat, qs in groups:
        if not qs:
            continue
        pa = anchor_pat(pat["name"])
        story.append(PageBreak())
        story.append(PatternMarker(pat["name"]))
        story += pattern_banner(pat, qs, show_back=show_back, pat_anchor=pa)
        story.append(Spacer(1, 12))
        for q in qs:
            story += build_desc_question_block(
                q, styles, doocs_cache, lc_cache,
                printable=printable, show_back=show_back,
            )

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("LG-Bold", 7.5)
        canvas.setFillColor(HexColor("#6B7280"))
        w, _h = doc.pagesize
        pn = canvas.getPageNumber()
        pat = getattr(canvas, "_lm_pattern_name", "")
        left = f"{pat}  |  {title}" if pat else title
        canvas.drawString(0.75 * inch, 0.38 * inch, left[:90])
        canvas.drawCentredString(w / 2, 0.38 * inch, f"- {pn} -")
        # Footer link to contents (clickable annotation)
        if include_toc and pn > 2:
            toc_w = canvas.stringWidth("Contents", "LG-Bold", 7.5)
            x0 = w - 0.75 * inch - toc_w - 52
            y0 = 0.38 * inch
            canvas.linkURL(
                f"#{TOC_ANCHOR}",
                (x0, y0, x0 + toc_w + 4, y0 + 10),
                relative=1,
                thickness=0,
                color=None,
            )
            canvas.setFillColor(HexColor(LINK_COLOR_PRINT))
            canvas.drawString(x0, y0, "Contents")
            canvas.setFillColor(HexColor("#6B7280"))
            canvas.drawRightString(w - 0.75 * inch, 0.38 * inch, "LeetMastery")
        else:
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
    ap.add_argument("--no-toc", action="store_true", help="Skip TOC and internal links")
    args = ap.parse_args()

    print("Loading questions and caches...")
    questions = json.loads(QUESTIONS.read_text())
    doocs_cache = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    lc_cache = json.loads(LC_CACHE.read_text()) if LC_CACHE.exists() else {}
    n_desc = sum(1 for v in doocs_cache.values() if v.get("desc_html"))
    print(f"  {len(questions)} questions, {n_desc} Doocs descriptions")

    include_toc = not args.no_toc
    print("\nBuilding combined PDF...")
    build_pdf(questions, doocs_cache, lc_cache, args.out, include_toc=include_toc)

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
                include_toc=include_toc,
            )

    print("\nDone. Files on Desktop:")
    print(f"  {args.out}")
    if args.split:
        print(f"  {args.split_dir}/ (21 pattern PDFs)")


if __name__ == "__main__":
    main()
