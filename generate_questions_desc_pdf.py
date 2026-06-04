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
    PRINT_BANNER_BG,
    QUESTIONS,
    PatternMarker,
    build_groups,
    build_styles,
    desc_to_flowables,
    diff_badge,
    safe_xml,
)
from generate_study_order_pdf import PRIORITY_COLORS, build_rounds

DIFF_EMOJI = {"Easy": "E", "Medium": "M", "Hard": "H"}
DIFF_EMOJI_VIS = {"Easy": "\U0001f7e2", "Medium": "\U0001f7e1", "Hard": "\U0001f534"}

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


def anchor_round(round_num: int) -> str:
    return f"round_{round_num}"


class FooterLabel(Flowable):
    """Sets footer text for the current page (round / pattern context)."""

    def __init__(self, label: str):
        super().__init__()
        self.label = label

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        setattr(self.canv, "_lm_footer_label", self.label)


class NamedDest(Flowable):
    """Reliable PDF named destination for internal links (footer + << Contents)."""

    def __init__(self, name: str):
        super().__init__()
        self.name = name

    def wrap(self, availWidth, availHeight):
        return 0, 0

    def draw(self):
        canv = self.canv
        x, y = canv.absolutePosition(0, 0)
        canv.bookmarkHorizontal(self.name, x, y)


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


def _anchor_para(name: str) -> list:
    """Named destination + legacy anchor tag for Platypus <link href=\"#...\">."""
    return [
        NamedDest(name),
        Paragraph(
            anchor_tag(name),
            ParagraphStyle("anch", fontSize=1, leading=1, spaceBefore=0, spaceAfter=0),
        ),
    ]


def _back_link_para(href: str = TOC_ANCHOR) -> Paragraph:
    return Paragraph(
        link_to(href, "<< Contents"),
        ParagraphStyle(
            "back", fontSize=9, fontName="LG-Bold", textColor=HexColor(LINK_COLOR_PRINT),
            spaceAfter=4, alignment=TA_LEFT,
        ),
    )


def round_label(round_num: int, priority: str, difficulty: str) -> str:
    dot = DIFF_EMOJI_VIS.get(difficulty, "")
    return f"Round {round_num}  |  {priority}  |  {dot} {difficulty}"


def count_round_questions(pattern_groups: list) -> int:
    return sum(len(qs) for _, qs in pattern_groups)


def build_toc(rounds: list) -> list:
    """TOC in study order: 9 rounds (High Easy -> Low Hard), then patterns, then questions."""
    story: list = []
    story += _anchor_para(TOC_ANCHOR)
    story.append(PdfBookmark("toc_outline", "Table of Contents", level=0))
    story.append(
        Paragraph(
            "<b>Table of Contents</b>",
            ParagraphStyle(
                "toc_h", fontSize=16, fontName="LG-Bold", textColor=HexColor("#111827"),
                spaceAfter=8, spaceBefore=0,
            ),
        )
    )
    story.append(
        Paragraph(
            "Study order: <b>High Easy</b> &rarr; <b>High Med</b> &rarr; <b>High Hard</b> "
            "&rarr; Mid &rarr; Low. Click to jump; <b>&lt;&lt; Contents</b> returns here.",
            ParagraphStyle(
                "toc_hint", fontSize=9, fontName="LG", textColor=HexColor("#6B7280"),
                spaceAfter=12, leading=13,
            ),
        )
    )

    round_style = ParagraphStyle(
        "toc_rnd", fontSize=11, fontName="LG-Bold", spaceBefore=10, spaceAfter=2, leading=14,
    )
    pat_style = ParagraphStyle(
        "toc_pat", fontSize=10, fontName="LG-Bold", leftIndent=14, spaceAfter=2, leading=13,
    )
    q_style = ParagraphStyle(
        "toc_q", fontSize=9.5, fontName="LG", leftIndent=28, spaceAfter=1, leading=12,
    )

    for round_num, priority, difficulty, pattern_groups in rounds:
        n_q = count_round_questions(pattern_groups)
        if n_q == 0:
            continue
        ra = anchor_round(round_num)
        rnd_text = f"{round_label(round_num, priority, difficulty)}  ({n_q})"
        story.append(Paragraph(link_to(ra, rnd_text, bold=True), round_style))
        for pat, qs in pattern_groups:
            pa = anchor_pat(pat["name"])
            story.append(
                Paragraph(link_to(pa, f"{pat['name']} ({len(qs)})", bold=True), pat_style)
            )
            for q in qs:
                qa = anchor_q(q["id"])
                label = f"#{q['id']} {q['title']}"
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

    story.append(PdfBookmark(qa, f"#{qid} {q['title']}", level=2))
    story += _anchor_para(qa)
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


def build_round_banner(
    round_num: int,
    priority: str,
    difficulty: str,
    q_count: int,
    *,
    show_back: bool,
) -> list:
    ra = anchor_round(round_num)
    pri_c = PRIORITY_COLORS[priority]
    dot = DIFF_EMOJI_VIS.get(difficulty, "")
    back_cell = link_to(TOC_ANCHOR, "<< Contents") if show_back else ""

    tbl = Table(
        [[
            Paragraph(
                f"<font color='#111827'><b>Round {round_num}</b>"
                f"  <font size='12'>|  {priority} Priority  |  {dot} {difficulty}"
                f"  <font size='10'> ({q_count} questions)</font></font></font>",
                ParagraphStyle("rb", fontSize=16, fontName="LG-Bold", textColor=HexColor("#111827")),
            ),
            Paragraph(back_cell, ParagraphStyle("bb", fontSize=9, fontName="LG-Bold")),
        ]],
        colWidths=[5.2 * inch, 1.8 * inch],
    )
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), pri_c["pill_bg"]),
            ("TOPPADDING", (0, 0), (-1, -1), 16),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 1.0, pri_c["bar"]),
        ])
    )
    return [
        PdfBookmark(ra, round_label(round_num, priority, difficulty), level=0),
        *_anchor_para(ra),
        FooterLabel(round_label(round_num, priority, difficulty)),
        tbl,
    ]


def build_pattern_subhead(pat: dict, n_q: int) -> list:
    pa = anchor_pat(pat["name"])
    tbl = Table(
        [[Paragraph(
            f"<font color='#374151'><b>{pat['name']}</b>"
            f"  <font size='10'> ({n_q})</font></font>",
            ParagraphStyle("psh", fontSize=12, fontName="LG-Bold", textColor=HexColor("#374151")),
        )]],
        colWidths=[MAX_W],
    )
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PRINT_BANNER_BG),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#D1D5DB")),
        ])
    )
    return [
        PdfBookmark(pa, pat["name"], level=1),
        *_anchor_para(pa),
        FooterLabel(pat["name"]),
        Spacer(1, 4),
        tbl,
        Spacer(1, 8),
    ]


def build_pdf(
    questions: list,
    doocs_cache: dict,
    lc_cache: dict,
    output: Path,
    *,
    title: str = "LeetMastery - Question Descriptions",
    include_toc: bool = True,
) -> None:
    rounds = build_rounds(questions)
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

    round_order = "  |  ".join(
        f"R{n}" for n, pr, di, pg in rounds if count_round_questions(pg) > 0
    )
    story = [
        PatternMarker("Cover"),
        Spacer(1, 1.6 * inch),
        Paragraph("LeetMastery", styles["cover_title"]),
        Paragraph("Question Descriptions", styles["cover_sub"]),
        Paragraph("Study order: High Easy to Low Hard (9 rounds)", styles["cover_sub"]),
        Paragraph("Problem statements, examples, constraints", styles["cover_sub"]),
        Paragraph(
            link_to(TOC_ANCHOR, "Open Table of Contents"),
            ParagraphStyle(
                "coverlnk", fontSize=12, fontName="LG-Bold", textColor=HexColor(LINK_COLOR_PRINT),
                alignment=TA_CENTER, spaceBefore=14, spaceAfter=8,
            ),
        ),
        Spacer(1, 0.1 * inch),
        Paragraph(round_order, ParagraphStyle(
            "pl", fontSize=8, textColor=HexColor("#6B7280"),
            alignment=TA_CENTER, fontName="LG", leading=14, spaceBefore=4,
        )),
        Paragraph(f"{len(questions)} questions", styles["cover_sub"]),
        PageBreak(),
    ]

    if include_toc:
        story += build_toc(rounds)

    show_back = include_toc
    for round_num, priority, difficulty, pattern_groups in rounds:
        n_q = count_round_questions(pattern_groups)
        if n_q == 0:
            continue
        story.append(PageBreak())
        story.append(PatternMarker(round_label(round_num, priority, difficulty)))
        story += build_round_banner(
            round_num, priority, difficulty, n_q, show_back=show_back,
        )
        story.append(Spacer(1, 10))
        for pat, qs in pattern_groups:
            story += build_pattern_subhead(pat, len(qs))
            for q in qs:
                story += build_desc_question_block(
                    q, styles, doocs_cache, lc_cache,
                    printable=printable, show_back=show_back,
                )

    def _footer(canvas, doc):
        canvas.saveState()
        font, size = "LG-Bold", 7.5
        canvas.setFont(font, size)
        w, _h = doc.pagesize
        pn = canvas.getPageNumber()
        y0 = 0.38 * inch
        footer = getattr(canvas, "_lm_footer_label", None) or getattr(canvas, "_lm_pattern_name", "")
        left = f"{footer}  |  {title}" if footer else title
        canvas.setFillColor(HexColor("#6B7280"))
        canvas.drawString(0.75 * inch, y0, left[:90])
        canvas.drawCentredString(w / 2, y0, f"- {pn} -")

        right_margin = 0.75 * inch
        brand = "LeetMastery"
        brand_w = canvas.stringWidth(brand, font, size)
        brand_x = w - right_margin - brand_w

        if include_toc and pn >= 3:
            label = "Contents"
            label_w = canvas.stringWidth(label, font, size)
            gap = 10
            label_x = brand_x - gap - label_w
            canvas.linkAbsolute(
                "",
                TOC_ANCHOR,
                (label_x, y0 - 1, label_x + label_w + 2, y0 + size + 1),
            )
            canvas.setFillColor(HexColor(LINK_COLOR_PRINT))
            canvas.drawString(label_x, y0, label)
            canvas.setFillColor(HexColor("#6B7280"))
            canvas.drawString(brand_x, y0, brand)
        else:
            canvas.drawString(brand_x, y0, brand)
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
        args.split_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nBuilding per-pattern PDFs in {args.split_dir}...")
        for rank, (pat, qs) in enumerate((g for g in build_groups(questions) if g[1]), start=1):
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
