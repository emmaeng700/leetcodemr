#!/bin/bash
# Rebuild ultimate_1up.pdf with your latest LeetCode solutions.
#
# Usage:
#   ./rebuild_pdf.sh            — fast rebuild using cached solutions
#   ./rebuild_pdf.sh --refresh  — re-fetch ALL your LC solutions then rebuild
#                                 (use when session refreshed or lots of new solves)

set -e
cd "$(dirname "$0")"

if [[ "$1" == "--refresh" ]]; then
    echo "Re-fetching all LeetCode solutions and rebuilding PDF…"
    python3 generate_better_pdf.py --all --refresh-solutions
else
    echo "Rebuilding ultimate_1up.pdf (cached solutions for new solves only)…"
    python3 generate_better_pdf.py --all
fi

echo ""
echo "Done! → $(pwd)/ultimate_1up.pdf"
cp ultimate_1up.pdf ~/Desktop/ultimate_1up.pdf
echo "Saved copy → ~/Desktop/ultimate_1up.pdf"
open ultimate_1up.pdf 2>/dev/null || true
