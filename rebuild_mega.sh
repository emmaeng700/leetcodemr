#!/bin/bash
# Rebuild 00 ALL Splits.pdf and 00 ALL Packs.pdf fresh from latest editorials.
#
# Usage (from leetcodemr folder):
#   ./rebuild_mega.sh

set -e
cd "$(dirname "$0")"

SPLITS_OUT="$HOME/Desktop/pdf study splits/Study Splits/00 ALL Splits.pdf"
LTS_OUT="$HOME/Desktop/pdf study splits/Study Splits/00 ALL Splits LtS.pdf"
PACKS_OUT="$HOME/Desktop/pdf study splits/Priority Packs/00 ALL Packs.pdf"

echo "📎 Closing PDFs if open in Preview…"
osascript -e '
  tell application "Preview"
    if it is running then
      set docNames to {"00 ALL Splits.pdf", "00 ALL Splits LtS.pdf", "00 ALL Packs.pdf"}
      repeat with docName in docNames
        try
          close (documents whose name is docName) saving no
        end try
      end repeat
    end if
  end tell
' 2>/dev/null || true

echo "🗑  Removing old mega PDFs…"
rm -f "$SPLITS_OUT" "$LTS_OUT" "$PACKS_OUT"

echo ""
echo "📚 Building 00 ALL Splits.pdf (study order)…"
python3 generate_mega_splits.py

echo ""
echo "📚 Building 00 ALL Splits LtS.pdf (large → small)…"
python3 generate_mega_splits_lts.py

echo ""
echo "📦 Building 00 ALL Packs.pdf…"
python3 generate_mega_packs.py --mega-only

echo ""
echo "✅ Done!"
echo "   Splits (study order) → $SPLITS_OUT"
echo "   Splits (large→small) → $LTS_OUT"
echo "   Packs                → $PACKS_OUT"
