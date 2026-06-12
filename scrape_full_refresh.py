"""
Full refresh scraper:
1. Re-fetches all 331 question descriptions from LeetDoocs
2. Pre-downloads all question images to .img_cache
3. Reports anything still broken
"""
import json, re, time, requests
from pathlib import Path
from PIL import Image
import io

SCRIPT_DIR = Path(__file__).parent
QS_FILE    = SCRIPT_DIR / 'public/questions_full.json'
DOOCS_CACHE = SCRIPT_DIR / '.doocs_cache.json'
IMG_DIR    = SCRIPT_DIR / '.img_cache'
IMG_DIR.mkdir(exist_ok=True)

H = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}

qs    = json.loads(QS_FILE.read_text())
doocs = json.loads(DOOCS_CACHE.read_text()) if DOOCS_CACHE.exists() else {}

def _img_filename(url):
    import hashlib, os
    name = re.sub(r'[^a-zA-Z0-9._-]', '_', url.split('/')[-1].split('?')[0])[:60]
    h = hashlib.md5(url.encode()).hexdigest()[:8]
    ext = Path(name).suffix or '.jpg'
    return f"{Path(name).stem}_{h}{ext}"

def download_image(url):
    if 'shields.io' in url or 'badge' in url.lower():
        return False
    fpath = IMG_DIR / _img_filename(url)
    if fpath.exists():
        return True
    try:
        r = requests.get(url, headers=H, timeout=12)
        if r.status_code != 200:
            return False
        img = Image.open(io.BytesIO(r.content))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        img.save(str(fpath), 'JPEG', quality=85)
        return True
    except Exception:
        return False

def scrape_doocs(real_id):
    """Fetch via shared scraper — stores description slice only, never sidebar HTML."""
    from generate_patterns_pdf import scrape_doocs_full
    return scrape_doocs_full(real_id)

# Build slug→real_id map (reuse from existing scraper logic)
try:
    from scrape_verified_data import SLUG_TO_LCID
except Exception:
    SLUG_TO_LCID = {}

def real_id(q):
    return SLUG_TO_LCID.get(q['slug'], q['id'])

updated = 0
img_downloaded = 0
img_failed = []

print(f"Processing {len(qs)} questions...")
for i, q in enumerate(qs):
    qid  = q['id']
    rid  = real_id(q)
    
    # Re-scrape if: no entry, or title mismatch (wrong question)
    entry = doocs.get(str(qid), {})
    desc  = entry.get('desc_html', '')
    
    needs_rescrape = False
    if not desc:
        needs_rescrape = True
    elif rid != qid:  # premium/renamed question — always re-verify
        needs_rescrape = True
    else:
        # Quick title check
        m = re.search(r'<h1[^>]*>.*?(\d+)\.\s*([^<\U0001F512]+)', desc)
        if m:
            cached_title = m.group(2).strip().lower()
            our_title    = q['title'].lower().strip()
            if cached_title and our_title[:10] not in cached_title:
                needs_rescrape = True
    
    if needs_rescrape:
        new = scrape_doocs(rid)
        if new and new.get('desc_html'):
            doocs[str(qid)] = new
            updated += 1
            print(f"  [{i+1}/{len(qs)}] Updated #{qid} {q['title']}")
        time.sleep(0.4)
    
    # Pre-download all images for this question
    desc = doocs.get(str(qid), {}).get('desc_html', '')
    urls = re.findall(r'(?:href|src)=["\x27](https?://[^"\x27>\s]+(?:jpg|jpeg|png|gif|webp|svg))["\x27]', desc, re.I)
    # Also check jsDelivr patterns
    urls += re.findall(r'href=["\x27](https://fastly\.jsdelivr[^"\x27>\s]+)["\x27]', desc, re.I)
    for url in set(urls):
        if download_image(url):
            img_downloaded += 1
        else:
            img_failed.append((qid, url))
    
    if (i+1) % 50 == 0:
        print(f"  Progress: {i+1}/{len(qs)} — {updated} updated, {img_downloaded} images")
        DOOCS_CACHE.write_text(json.dumps(doocs, ensure_ascii=False, indent=2))

# Final save
DOOCS_CACHE.write_text(json.dumps(doocs, ensure_ascii=False, indent=2))

print(f"\nDone!")
print(f"  Questions re-scraped: {updated}")
print(f"  Images downloaded: {img_downloaded}")
if img_failed:
    print(f"  Failed images: {len(img_failed)}")
    for qid, url in img_failed[:10]:
        print(f"    #{qid}: {url}")
