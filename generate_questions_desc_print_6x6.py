# -*- coding: utf-8 -*-
"""
LeetMastery - Questions Descriptions - 6x6 Print Edition
========================================================
Print-friendly portrait sheets: 6 cols x 6 rows = 36 mini-pages per letter page.
Black bold text on white - problem statements only (no solutions/code).

Outputs:
  ~/Desktop/LeetMastery_Questions_Descriptions_6x6_Portrait.pdf   (all rounds)
  ~/Desktop/splits/questions_6x6_print/01_High_Easy.pdf ...       (9 round splits)

Usage:
  python3 generate_questions_desc_print_6x6.py
  python3 generate_questions_desc_print_6x6.py --combined-only
  python3 generate_questions_desc_print_6x6.py --splits-only
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Default portrait mini-pages (204x264) - not 2x1 / 4x4 / etc.
sys.argv = [sys.argv[0]]

import generate_study_order_pdf as G
from generate_questions_desc_pdf import (
    get_desc_html,
    predownload_desc_images,
    purge_legacy_img_collisions,
)
from generate_print_splits import _add_checkboxes_print, impose_6x6_portrait
from generate_patterns_pdf import (
    DOOCS_CACHE,
    LC_CACHE,
    QUESTIONS,
    is_html_description,
    is_premium_question,
    plain_desc_to_paragraphs,
    premium_question_prefix,
    premium_question_suffix,
    premium_star_markup,
    repair_doocs_cache,
    safe_xml,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

SCRIPT_DIR = Path(__file__).parent
INNER_TMP = SCRIPT_DIR / "_questions_desc_6x6_inner.pdf"
DESKTOP = Path.home() / "Desktop"
COMBINED_OUT = DESKTOP / "LeetMastery_Questions_Descriptions_6x6_Portrait.pdf"
SPLITS_DIR = DESKTOP / "splits" / "questions_6x6_print"

ROUND_NAMES = {
    (1, "High", "Easy"): "01_High_Easy",
    (2, "High", "Medium"): "02_High_Medium",
    (3, "High", "Hard"): "03_High_Hard",
    (4, "Mid", "Easy"): "04_Mid_Easy",
    (5, "Mid", "Medium"): "05_Mid_Medium",
    (6, "Mid", "Hard"): "06_Mid_Hard",
    (7, "Low", "Easy"): "07_Low_Easy",
    (8, "Low", "Medium"): "08_Low_Medium",
    (9, "Low", "Hard"): "09_Low_Hard",
}

_PRINT_SIZES = {
    "title": (10.5, 13.0),
    "body": (9.0, 11.0),
    "body_sm": (8.5, 10.5),
    "code": (7.75, 9.4),
    "head2": (9.5, 12.0),
    "toc": (9.5, 12.0),
    "cover_title": (16.0, 19.0),
    "cover_sub": (9.5, 12.0),
}
for _k, _st in G.S.items():
    if getattr(_st, "fontName", "") == "LG":
        _st.fontName = "LG-Bold"
    if _k in _PRINT_SIZES:
        _st.fontSize, _st.leading = _PRINT_SIZES[_k]

from reportlab.lib.styles import ParagraphStyle as _RL_PS

_orig_ps_init = _RL_PS.__init__


def _bold_ps_init(self, name, parent=None, **kw):
    if kw.get("fontName") in ("LG", "LG-Bold"):
        kw["fontName"] = "LG-Bold"
    _orig_ps_init(self, name, parent=parent, **kw)


_RL_PS.__init__ = _bold_ps_init

_orig_desc = G.desc_to_mini_flowables


def _desc_print(desc_html: str) -> list:
    def _clip_pre(m):
        inner = m.group(1)
        lines = inner.split("\n")
        clipped = [line[:70] for line in lines[:5]]
        return f'<pre>{"".join(clipped)}</pre>'

    clipped_html = re.sub(
        r"<pre[^>]*>([\s\S]*?)</pre>", _clip_pre, desc_html, flags=re.I
    )
    return _orig_desc(clipped_html)


G.desc_to_mini_flowables = _desc_print


def _inner_ps(name: str, style_key: str, **kw) -> ParagraphStyle:
    base = G.S[style_key]
    return ParagraphStyle(name, parent=base, **kw)


def build_desc_question_block(
    q: dict,
    doocs_cache: dict,
    lc_cache: dict,
    pattern_name: str,
) -> list:
    items: list = []
    qid = q["id"]
    diff_key = q.get("difficulty", "Easy")
    bg, fg = G.DIFF_COLORS_PILL.get(diff_key, (G.GRAY_100, G.BLACK))

    items.append(G.cat_bar(pattern_name))
    items.append(Spacer(1, 2))

    pill = Table(
        [[Paragraph(
            f'<font color="{fg.hexval()}"><b>{diff_key[:3].upper()}</b></font>',
            ParagraphStyle(
                "pill",
                fontName="LG-Bold",
                fontSize=G.S["body"].fontSize,
                textColor=fg,
            ),
        )]],
        colWidths=[0.34 * 72],
    )
    pill.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ])
    )
    title_tbl = Table(
        [[
            Paragraph(
                f"<b>{premium_question_prefix(q)}#{qid} {safe_xml(q['title'])}{premium_question_suffix(q)}</b>",
                G.S["title"],
            ),
            pill,
        ]],
        colWidths=[G.USE_W - 0.38 * 72, 0.38 * 72],
    )
    title_tbl.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    items.append(title_tbl)
    items.append(Spacer(1, 2))
    items.append(G.hr(G.GRAY_300, 0.3))

    slug = q.get("slug", "")
    links = (
        f'<a href="https://leetcode.com/problems/{slug}/" color="#000000">LeetCode</a>  |  '
        f'<a href="https://leetcode.doocs.org/en/lc/{qid}/" color="#000000">Doocs</a>'
    )
    items.append(
        Paragraph(
            links,
            ParagraphStyle(
                "lnk",
                fontName="LG-Bold",
                fontSize=G.S["body_sm"].fontSize,
                textColor=G.BLACK,
                leading=G.S["body_sm"].leading,
                spaceAfter=2,
            ),
        )
    )

    source = q.get("source", [])
    if source:
        lists = "  |  ".join(safe_xml(s) for s in source)
        if is_premium_question(q):
            lists = f"{premium_star_markup()} Premium  |  {lists}"
        items.append(
            Paragraph(
                f"Lists: {lists}",
                ParagraphStyle(
                    "src",
                    fontName="LG-Bold",
                    fontSize=G.S["body_sm"].fontSize,
                    textColor=G.BLACK,
                    leading=G.S["body_sm"].leading,
                    spaceAfter=2,
                ),
            )
        )

    desc_html = get_desc_html(q, doocs_cache, lc_cache)
    if desc_html:
        items.append(Spacer(1, 2))
        items.append(Paragraph("<b>Problem</b>", G.S["head2"]))
        if is_html_description(desc_html):
            items += G.desc_to_mini_flowables(desc_html)
        else:
            items += plain_desc_to_paragraphs(desc_html, G.S["body"])
        items.append(Spacer(1, 2))
    else:
        items.append(Paragraph("<i>No description in cache.</i>", G.S["body_sm"]))

    items.append(
        HRFlowable(width="100%", thickness=0.3, color=G.GRAY_300, spaceAfter=2)
    )
    return items


def build_desc_inner_pdf(
    rounds: list,
    doocs_cache: dict,
    lc_cache: dict,
    inner_path: Path,
) -> int:
    counter = G.PageCounter()
    total_qs = sum(len(qs) for _, _, _, pgs in rounds for _, qs in pgs)

    doc = SimpleDocTemplate(
        str(inner_path),
        pagesize=(G.MP_W, G.MP_H),
        rightMargin=G.MG,
        leftMargin=G.MG,
        topMargin=G.MG,
        bottomMargin=G.MG + 5,
    )
    story: list = []

    story.append(Spacer(1, 28))
    story.append(
        Paragraph("LeetMastery", _inner_ps("brand", "cover_title", alignment=TA_CENTER))
    )
    story.append(Spacer(1, 4))
    story.append(Paragraph("Question Descriptions", G.S["cover_title"]))
    story.append(
        Paragraph(
            "Print Edition  |  6x6 Portrait  |  Bold Black on White",
            _inner_ps("sub2", "cover_sub", alignment=TA_CENTER),
        )
    )
    story.append(Spacer(1, 8))
    story.append(G.hr())
    story.append(Spacer(1, 5))
    story.append(
        Paragraph(
            f"{total_qs} questions  |  9 rounds  |  statements + examples + constraints",
            _inner_ps("ci", "body", alignment=TA_CENTER),
        )
    )
    story.append(
        Paragraph(
            "High Easy -> High Med -> High Hard -> Mid -> Low",
            _inner_ps("ci2", "body", alignment=TA_CENTER),
        )
    )
    story.append(PageBreak())

    story.append(
        Paragraph("<b>Contents</b>", _inner_ps("toch", "title", spaceAfter=4))
    )
    story.append(
        Paragraph(
            f"<b>{premium_star_markup()} = LeetCode Premium</b>",
            _inner_ps("tochint", "body", spaceAfter=3),
        )
    )
    story.append(G.hr())

    q_left = G.TOC_CB_PT + G.TOC_CB_GAP + 4
    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue
        n_q = len(all_qs_in_round)
        pri_c = G.PRIORITY_COLORS[priority]
        rnd_label = G.round_toc_label(round_num, priority, difficulty, n_q)
        row = Table(
            [[Paragraph(rnd_label, _inner_ps("toch2", "title"))]],
            colWidths=[G.USE_W],
        )
        row.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), pri_c["pill_bg"]),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(row)
        pat_st = ParagraphStyle(
            "tocpat",
            fontName="LG-Bold",
            fontSize=G.S["toc"].fontSize,
            textColor=G.BLACK,
            leading=G.S["toc"].leading,
            spaceAfter=2,
            leftIndent=14,
        )
        for pat, qs in pattern_groups:
            story.append(
                Paragraph(f'<b>{safe_xml(pat["name"])} ({len(qs)})</b>', pat_st)
            )
            for q in qs:
                label = f"{premium_question_prefix(q)}#{q['id']} {safe_xml(q['title'])}"
                story.append(
                    Paragraph(
                        f"<b>{label}</b>",
                        ParagraphStyle(
                            "tqe",
                            fontName="LG-Bold",
                            fontSize=G.S["toc"].fontSize,
                            textColor=G.BLACK,
                            leading=G.S["toc"].leading,
                            spaceAfter=3,
                            alignment=TA_LEFT,
                            leftIndent=q_left,
                        ),
                    )
                )
    story.append(PageBreak())

    round_page_registry: dict[int, int] = {}
    pat_page_registry: dict[tuple[int, str], int] = {}

    for round_num, priority, difficulty, pattern_groups in rounds:
        all_qs_in_round = [(pat, q) for pat, qs in pattern_groups for q in qs]
        if not all_qs_in_round:
            continue

        pri_c = G.PRIORITY_COLORS[priority]
        diff_dot = {"Easy": "E", "Medium": "M", "Hard": "H"}.get(difficulty, "")
        round_label = f"Round {round_num}  |  {priority} | {difficulty}"
        story.append(G.SetRound(round_label))

        story.append(G.RoundPageMark(round_num, round_page_registry))
        story += G._anchor_para(G.anchor_round(round_num))
        story.append(Spacer(1, G.USE_H * 0.12))
        banner = Table(
            [[Paragraph(
                f"<b>Round {round_num}</b>",
                _inner_ps("rnum", "title", alignment=TA_CENTER, fontSize=13, leading=16),
            )]],
            colWidths=[G.USE_W],
        )
        banner.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), pri_c["pill_bg"]),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 1.0, pri_c["bar"]),
            ])
        )
        story.append(banner)
        story.append(Spacer(1, 5))
        story.append(
            Paragraph(
                f"<b>{priority} Priority  |  {diff_dot} {difficulty}</b>",
                _inner_ps("rlab", "title", alignment=TA_CENTER, fontSize=10, leading=13),
            )
        )
        story.append(Spacer(1, 3))
        story.append(
            Paragraph(
                f'{len(all_qs_in_round)} question{"s" if len(all_qs_in_round) != 1 else ""}  |  '
                f"descriptions only",
                _inner_ps("rct", "body", alignment=TA_CENTER),
            )
        )
        story.append(PageBreak())

        for pat, qs in pattern_groups:
            story.append(G.PatPageMark(round_num, pat["name"], pat_page_registry))
            story += G._anchor_para(G.anchor_pat(pat["name"]))
            story.append(Spacer(1, G.USE_H * 0.15))
            pat_banner = Table(
                [[Paragraph(
                    f"<b>{safe_xml(pat['name'])}</b>",
                    _inner_ps("pbnr", "title", alignment=TA_CENTER, fontSize=10, leading=13),
                )]],
                colWidths=[G.USE_W],
            )
            pat_banner.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), G.GRAY_100),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("BOX", (0, 0), (-1, -1), 0.5, G.GRAY_300),
                ])
            )
            story.append(pat_banner)
            story.append(Spacer(1, 3))
            story.append(
                Paragraph(
                    f"Round {round_num}  |  {priority} | {difficulty}  |  {len(qs)} q",
                    _inner_ps("psub", "body", alignment=TA_CENTER),
                )
            )
            story.append(PageBreak())

            for q in qs:
                story += build_desc_question_block(q, doocs_cache, lc_cache, pat["name"])

    doc.build(story, onFirstPage=counter.on_page, onLaterPages=counter.on_page)
    print(f"  Inner pages: {counter.n}")
    return counter.n


def impose_and_link(inner_path: Path, out_path: Path, rounds: list) -> None:
    page_types, qid_first_page, toc_link_rects, _ = G._analyze_inner_for_links(
        inner_path, rounds
    )
    impose_6x6_portrait(inner_path, out_path)
    _add_checkboxes_print(
        out_path,
        page_types,
        toc_link_rects,
        qid_first_page,
        cols=6,
        rows=6,
        src_w=204.0,
        src_h=264.0,
        L_W=612.0,
        L_H=792.0,
        GAP=1.5,
    )


def load_data():
    questions = json.loads(QUESTIONS.read_text())
    doocs_cache = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}
    lc_cache = json.loads(LC_CACHE.read_text()) if LC_CACHE.exists() else {}
    n_fixed = repair_doocs_cache(doocs_cache)
    if n_fixed:
        DOOCS_CACHE.write_text(json.dumps(doocs_cache, ensure_ascii=False, indent=2))
        print(f"  Repaired {n_fixed} poisoned Doocs cache entries")
    removed = purge_legacy_img_collisions()
    if removed:
        print(f"  Purged {removed} legacy image-cache collision file(s)")
    n_imgs = predownload_desc_images(doocs_cache, questions, lc_cache)
    print(f"  Pre-downloaded {n_imgs} description images")
    return questions, doocs_cache, lc_cache


def main():
    combined_only = "--combined-only" in sys.argv
    splits_only = "--splits-only" in sys.argv

    print("Loading data...")
    questions, doocs_cache, lc_cache = load_data()
    print(f"  {len(questions)} questions")

    all_rounds = G.build_rounds(questions)

    if not splits_only:
        print(f"\nBuilding combined 6x6 PDF -> {COMBINED_OUT.name}...")
        build_desc_inner_pdf(all_rounds, doocs_cache, lc_cache, INNER_TMP)
        impose_and_link(INNER_TMP, COMBINED_OUT, all_rounds)
        INNER_TMP.unlink(missing_ok=True)
        kb = COMBINED_OUT.stat().st_size // 1024
        print(f"  -> {COMBINED_OUT}  ({kb:,} KB)")

    if not combined_only:
        SPLITS_DIR.mkdir(parents=True, exist_ok=True)
        print(f"\nBuilding 9 round splits -> {SPLITS_DIR}/...")
        for round_num, priority, difficulty, pattern_groups in all_rounds:
            all_qs = [(pat, q) for pat, qs in pattern_groups for q in qs]
            if not all_qs:
                continue
            name = ROUND_NAMES.get(
                (round_num, priority, difficulty),
                f"{round_num:02d}_{priority}_{difficulty}",
            )
            out_path = SPLITS_DIR / f"{name}.pdf"
            this_rounds = [(round_num, priority, difficulty, pattern_groups)]
            print(f"\n  [{name}]  {len(all_qs)} questions...")
            build_desc_inner_pdf(this_rounds, doocs_cache, lc_cache, INNER_TMP)
            impose_and_link(INNER_TMP, out_path, this_rounds)
            INNER_TMP.unlink(missing_ok=True)
            kb = out_path.stat().st_size // 1024
            print(f"  -> {out_path.name}  ({kb:,} KB)")

    print("\nDone.")
    if not splits_only:
        print(f"  Combined: {COMBINED_OUT}")
    if not combined_only:
        print(f"  Splits:   {SPLITS_DIR}/")


if __name__ == "__main__":
    main()
