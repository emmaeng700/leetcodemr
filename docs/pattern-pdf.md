# Pattern PDF (LeetMastery by pattern)

## Generator script

| File | Role |
|------|------|
| [`generate_patterns_pdf.py`](../generate_patterns_pdf.py) | Builds the PDF(s): fetches/scrapes sources, groups by pattern, renders with ReportLab + Pygments. |

## Data inputs (repo)

| Path | Role |
|------|------|
| [`public/questions_full.json`](../public/questions_full.json) | Canonical question list (ids, slugs, tags, difficulty, starters, stored solutions). |

## Caches (generated; optional but speeds reruns)

| Path | Role |
|------|------|
| [`.doocs_cache.json`](../.doocs_cache.json) | Per-question Doocs HTML (description + code blocks). |
| [`.full_langs_cache.json`](../.full_langs_cache.json) | SimplyLeet / WalkCC / LeetCode.ca blocks (keyed by slug). |
| [`.lc_content_cache.json`](../.lc_content_cache.json) | Extra LeetCode editorial/desc content when populated. |
| [`.img_cache/`](../.img_cache/) | Downloaded images embedded in descriptions. |

## Outputs

| File | Command | Notes |
|------|---------|--------|
| `LeetMastery_By_Pattern.pdf` | `python3 generate_patterns_pdf.py` | Default: dark code panels, syntax colors (screen-oriented). |
| `LeetMastery_By_Pattern_Print.pdf` | `python3 generate_patterns_pdf.py --printable` | Light gray code boxes, **monochrome** tokens, gray section banners — better on B/W or home printers. |
| Both | `python3 generate_patterns_pdf.py --both` | One fetch pass, then two PDF builds. |

Optional: `-o /path/to/out.pdf` to override the output path (ignored when using `--both`).

## Dependencies

Python packages used by the script (install with pip): `Pillow`, `Pygments`, `reportlab`.

## Print vs screen

The **print** edition turns off the One Dark palette and dark `#282C34` code backgrounds so faint colored tokens are not lost when printed. Site/pattern banners use light gray + black text instead of saturated fills.
