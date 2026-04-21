"""
LeetMastery — Individual Pattern PDFs
Generates one PDF per pattern (21 total) using the same content, caches, and
rendering logic as generate_patterns_pdf.py.

Usage:
  python3 generate_individual_pattern_pdfs.py              # screen colors
  python3 generate_individual_pattern_pdfs.py --printable  # print-friendly
  python3 generate_individual_pattern_pdfs.py --pattern "Sliding Window"  # one pattern only
  python3 generate_individual_pattern_pdfs.py --both       # screen + print editions

Output: pattern_pdfs/LeetMastery_01_Bit_Manipulation.pdf … LeetMastery_21_Arrays_and_Hashing.pdf
"""

import argparse, json, os, re
from pathlib import Path

# ── Import everything from the main generator ──────────────────────────────────
from generate_patterns_pdf import (
    # paths / caches
    QUESTIONS, IMG_DIR, LC_CACHE,
    DOOCS_CACHE, SITES_CACHE,
    PRINT_BANNER_BG,
    # colors
    INDIGO, GRAY_500, GRAY_700, GRAY_100,
    # dimensions
    MAX_W,
    # pattern list (defines the canonical order)
    QUICK_PATTERNS,
    # rendering helpers
    build_groups, build_styles, build_question_block,
    diff_badge, safe_xml,
    # fetchers
    fetch_doocs, fetch_all_sites,
    # utilities
    _load,
)

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle,
)
from reportlab.lib.enums import TA_CENTER

SCRIPT_DIR  = Path(__file__).parent
OUTPUT_DIR  = SCRIPT_DIR / "pattern_pdfs"


# ── Filename sanitiser ─────────────────────────────────────────────────────────
def safe_name(s: str) -> str:
    """Convert a pattern name to a safe filename segment."""
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")


# ── Single-pattern PDF ─────────────────────────────────────────────────────────
def generate_pattern_pdf(
    pat, qs,
    number: int,
    questions,
    doocs_cache, sites_cache, lc_cache,
    output: Path,
    printable: bool = False,
    code_size: float = None,
    bold: bool = False,
):
    """Generate a single PDF for one pattern."""
    styles = build_styles(printable, code_size=code_size, bold=bold)

    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"LeetMastery — {pat['name']}",
        author="Emmanuel Oppong",
    )

    pat_hex   = pat.get("hex", "#6366F1")
    pat_color = pat.get("color", HexColor(pat_hex))
    n_qs      = len(qs)
    HF        = "Helvetica-Bold" if bold else "Helvetica"
    # For printable: everything pure black; for screen: use brand colours
    BLK       = "#000000"
    cvr_hex   = BLK if printable else pat_hex
    cvr_col   = HexColor(BLK) if printable else GRAY_500

    # ── Cover page ────────────────────────────────────────────────────────────
    story = [
        Spacer(1, 1.5 * inch),
    ]

    # Pattern number badge
    badge_p = Paragraph(
        f'<font color="{cvr_hex}"><b>Pattern {number} of 21</b></font>',
        ParagraphStyle("pn", fontSize=13, fontName="Helvetica-Bold",
                       textColor=HexColor(cvr_hex), alignment=TA_CENTER, spaceAfter=8),
    )
    story.append(badge_p)

    # Pattern name
    story.append(Paragraph(
        f'<font color="{cvr_hex}"><b>{safe_xml(pat["name"])}</b></font>',
        ParagraphStyle("cn", fontSize=36, fontName="Helvetica-Bold",
                       textColor=HexColor(cvr_hex), alignment=TA_CENTER, spaceAfter=10),
    ))

    # Subtitle
    story.append(Paragraph(
        "LeetMastery Study Guide",
        ParagraphStyle("cs", fontSize=13, textColor=cvr_col,
                       alignment=TA_CENTER, spaceAfter=6, fontName=HF),
    ))
    story.append(Paragraph(
        f"{n_qs} question{'s' if n_qs != 1 else ''} — Easy → Medium → Hard",
        ParagraphStyle("qs", fontSize=11, textColor=cvr_col,
                       alignment=TA_CENTER, spaceAfter=4, fontName=HF),
    ))

    diff_counts = {
        "Easy":   sum(1 for q in qs if q.get("difficulty") == "Easy"),
        "Medium": sum(1 for q in qs if q.get("difficulty") == "Medium"),
        "Hard":   sum(1 for q in qs if q.get("difficulty") == "Hard"),
    }
    story.append(Paragraph(
        f"Easy: {diff_counts['Easy']}  ·  Medium: {diff_counts['Medium']}  ·  Hard: {diff_counts['Hard']}",
        ParagraphStyle("dc", fontSize=10, textColor=cvr_col,
                       alignment=TA_CENTER, spaceAfter=8, fontName=HF),
    ))

    # Source sites line
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(
        "LeetDoocs  ·  SimplyLeet  ·  WalkCC  ·  LeetCode.ca",
        ParagraphStyle("src", fontSize=10, textColor=cvr_col,
                       alignment=TA_CENTER, spaceAfter=4, fontName=HF),
    ))

    if printable:
        pe_font = "Helvetica-BoldOblique" if bold else "Helvetica-Oblique"
        story.append(Paragraph(
            "Print edition — bold black text, white code backgrounds",
            ParagraphStyle("pe", fontSize=9, textColor=HexColor(BLK),
                           alignment=TA_CENTER, spaceAfter=10,
                           fontName=pe_font),
        ))

    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    story.append(Paragraph(
        "<b>Table of Contents</b>",
        ParagraphStyle("th", fontSize=16, fontName="Helvetica-Bold",
                       textColor=HexColor(cvr_hex), spaceAfter=12),
    ))

    # For printable: all text black; for screen: coloured difficulty tags
    dc_map = {} if printable else {"Easy": "#16A34A", "Medium": "#D97706", "Hard": "#DC2626"}
    for q in qs:
        dc       = dc_map.get(q.get("difficulty", ""), BLK)
        id_col   = BLK if printable else "#9CA3AF"
        diff_tag = q.get("difficulty", "")
        toc_col  = HexColor(BLK) if printable else GRAY_700
        story.append(Paragraph(
            f"<font color='{id_col}'>#{q['id']}</font>  {safe_xml(q['title'])}  "
            f"<font color='{dc}'>[{diff_tag}]</font>",
            ParagraphStyle("te", fontSize=9.5, fontName=HF,
                           textColor=toc_col, spaceAfter=2, leading=13),
        ))

    story.append(PageBreak())

    # ── Pattern header banner ─────────────────────────────────────────────────
    if printable:
        banner = Table([[Paragraph(
            f"<font color='#000000'><b>{safe_xml(pat['name'])}</b>  "
            f"<font size='11'>— {n_qs} questions</font></font>",
            ParagraphStyle("bshp", fontSize=20, fontName="Helvetica-Bold",
                           textColor=HexColor("#000000")),
        )]], colWidths=[MAX_W])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), PRINT_BANNER_BG),
            ("TOPPADDING",    (0, 0), (-1, -1), 18),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
            ("LEFTPADDING",   (0, 0), (-1, -1), 16),
            ("BOX",           (0, 0), (-1, -1), 0.75, HexColor("#9CA3AF")),
        ]))
    else:
        banner = Table([[Paragraph(
            f"<font color='white'><b>{safe_xml(pat['name'])}</b>  "
            f"<font size='11'>— {n_qs} questions</font></font>",
            ParagraphStyle("bsh", fontSize=20, fontName="Helvetica-Bold",
                           textColor=white),
        )]], colWidths=[MAX_W])
        banner.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), pat_color),
            ("TOPPADDING",    (0, 0), (-1, -1), 18),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
            ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ]))

    story += [banner, Spacer(1, 16)]

    # ── Question blocks ───────────────────────────────────────────────────────
    for i, q in enumerate(qs, 1):
        story += build_question_block(
            q, styles, doocs_cache, sites_cache, lc_cache,
            pattern=pat, printable=printable, bold=bold,
        )
        if i % 5 == 0:
            print(f"      {i}/{n_qs} questions rendered…")

    # ── Page-number footer ────────────────────────────────────────────────────
    _fn  = "Helvetica-Bold" if bold else "Helvetica"
    _blk = HexColor("#000000") if printable else HexColor("#6B7280")
    _pat = pat["name"]

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(_fn, 7.5)
        canvas.setFillColor(_blk)
        w, h = doc.pagesize
        pn = canvas.getPageNumber()
        # left: pattern name  |  centre: page number  |  right: total marker
        canvas.drawString(0.75 * inch, 0.38 * inch, _pat)
        canvas.drawCentredString(w / 2, 0.38 * inch, f"— {pn} —")
        canvas.drawRightString(w - 0.75 * inch, 0.38 * inch, "LeetMastery")
        canvas.restoreState()

    print(f"    Writing PDF…")
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    kb = os.path.getsize(output) // 1024
    print(f"    ✅  {output.name}  ({kb:,} KB)")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Generate 21 individual pattern PDFs.")
    ap.add_argument(
        "--printable", "-p",
        action="store_true",
        help="Build print-friendly edition (light bg, monochrome syntax)",
    )
    ap.add_argument(
        "--both", "-b",
        action="store_true",
        help="Build both screen and print editions (doubles output count)",
    )
    ap.add_argument(
        "--pattern",
        type=str,
        default=None,
        metavar="NAME",
        help='Only generate the PDF for a specific pattern, e.g. "Sliding Window"',
    )
    ap.add_argument(
        "--code-size",
        type=float,
        default=None,
        metavar="PT",
        help="Override code font size in points, e.g. 9 or 9.5 (printable default: 8.5)",
    )
    ap.add_argument(
        "--bold",
        action="store_true",
        help="Use bold fonts throughout (Courier-Bold for code, Helvetica-Bold for body)",
    )
    args = ap.parse_args()
    code_size = args.code_size
    bold      = args.bold

    if not QUESTIONS.exists():
        raise SystemExit(f"✗ Not found: {QUESTIONS}")

    with open(QUESTIONS) as f:
        questions = json.load(f)
    print(f"Loaded {len(questions)} questions.\n")

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)
    suffix_dir = OUTPUT_DIR / "print" if args.printable and not args.both else OUTPUT_DIR
    if args.both:
        (OUTPUT_DIR / "screen").mkdir(exist_ok=True)
        (OUTPUT_DIR / "print").mkdir(exist_ok=True)

    print("Step 1/3 — Doocs (descriptions + solutions)…")
    doocs_cache = fetch_doocs(questions)

    print("\nStep 2/3 — SimplyLeet, WalkCC, LeetCode.ca…")
    sites_cache = fetch_all_sites(questions, doocs_cache)

    print("\nStep 3/3 — Building individual pattern PDFs…")
    lc_cache = _load(LC_CACHE)

    # Get all groups in canonical QUICK_PATTERNS order
    groups = build_groups(questions)

    # Filter to 21 named patterns only (skip "Other" if it exists)
    named = [(pat, qs) for pat, qs in groups if pat["name"] != "Other" and qs]

    # Filter to a single pattern if --pattern was specified
    if args.pattern:
        target = args.pattern.strip().lower()
        named = [(p, q) for p, q in named if p["name"].lower() == target]
        if not named:
            available = [p["name"] for p, _ in groups if p["name"] != "Other"]
            raise SystemExit(
                f"✗ Pattern '{args.pattern}' not found.\n"
                f"  Available: {', '.join(available)}"
            )

    total = len(named)
    print(f"  Generating {total} PDF(s) into {OUTPUT_DIR}/\n")

    for i, (pat, qs) in enumerate(named, 1):
        num_str  = f"{i:02d}"
        slug_str = safe_name(pat["name"])
        base     = f"LeetMastery_{num_str}_{slug_str}"

        print(f"[{i:2d}/{total}] {pat['name']}  ({len(qs)} questions)")

        if args.both:
            screen_path = OUTPUT_DIR / "screen" / f"{base}.pdf"
            print_path  = OUTPUT_DIR / "print"  / f"{base}_Print.pdf"
            generate_pattern_pdf(
                pat, qs, i, questions, doocs_cache, sites_cache, lc_cache,
                screen_path, printable=False, code_size=code_size, bold=bold,
            )
            generate_pattern_pdf(
                pat, qs, i, questions, doocs_cache, sites_cache, lc_cache,
                print_path, printable=True, code_size=code_size, bold=bold,
            )
        elif args.printable:
            out = OUTPUT_DIR / "print" / f"{base}_Print.pdf"
            out.parent.mkdir(exist_ok=True)
            generate_pattern_pdf(
                pat, qs, i, questions, doocs_cache, sites_cache, lc_cache,
                out, printable=True, code_size=code_size, bold=bold,
            )
        else:
            out = OUTPUT_DIR / f"{base}.pdf"
            generate_pattern_pdf(
                pat, qs, i, questions, doocs_cache, sites_cache, lc_cache,
                out, printable=False, code_size=code_size, bold=bold,
            )

    print(f"\n🎉  Done! All {total} PDFs written to {OUTPUT_DIR}/")
    print("\n📊 Summary:")
    for i, (pat, qs) in enumerate(named, 1):
        e = sum(1 for q in qs if q.get("difficulty") == "Easy")
        m = sum(1 for q in qs if q.get("difficulty") == "Medium")
        h = sum(1 for q in qs if q.get("difficulty") == "Hard")
        print(f"  {i:2d}. {pat['name']:30s}  {len(qs):3d} qs  E:{e} M:{m} H:{h}")


if __name__ == "__main__":
    main()
