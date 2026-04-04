"""
Screenshot all 329 questions from leetcode.doocs.org
Saves question-only (no solutions) JPEG images to frontend/public/question-images/
"""
import asyncio, json, os, io, time
from playwright.async_api import async_playwright
from PIL import Image

OUT_DIR = "../frontend/public/question-images"
os.makedirs(OUT_DIR, exist_ok=True)

with open("../data/questions_full.json") as f:
    QUESTIONS = json.load(f)

async def screenshot_one(page, qid):
    out_path = f"{OUT_DIR}/{qid}.jpg"
    if os.path.exists(out_path):
        return "skip"
    try:
        await page.goto(f"https://leetcode.doocs.org/en/lc/{qid}/", timeout=25000)
        await page.wait_for_selector("h1, article, .md-content__inner", timeout=10000)
        await page.wait_for_timeout(2000)
        await page.evaluate("""
            ['header','footer','.md-header','.md-footer','.md-sidebar',
             'nav','#gitalk-container','.utterances','.md-source']
            .forEach(s => document.querySelectorAll(s)
            .forEach(el => el.style.display='none'));
            let found=false;
            [...document.querySelectorAll('h2,h3')].forEach(h=>{
                if(found||h.textContent.toLowerCase().includes('solution')){
                    found=true; let el=h;
                    while(el){el.style.display='none';el=el.nextElementSibling;}
                }
            });
        """)
        await page.wait_for_timeout(300)
        el = await page.query_selector(".md-content__inner, article")
        png = await el.screenshot() if el else await page.screenshot()
        img = Image.open(io.BytesIO(png)).convert("RGB")
        img.save(out_path, "JPEG", quality=75, optimize=True)
        return os.path.getsize(out_path)
    except Exception as e:
        print(f"  ERROR #{qid}: {e}")
        return None

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 900, "height": 900})
        total = len(QUESTIONS)
        sizes = []
        for i, q in enumerate(QUESTIONS, 1):
            qid = q["id"]
            result = await screenshot_one(page, qid)
            if result == "skip":
                print(f"[{i}/{total}] #{qid} {q['title']} — skipped (cached)")
            elif result:
                sizes.append(result)
                print(f"[{i}/{total}] #{qid} {q['title']} — {result/1024:.0f}KB")
            else:
                print(f"[{i}/{total}] #{qid} {q['title']} — FAILED")
            await asyncio.sleep(1.2)
        await browser.close()
        if sizes:
            total_mb = sum(sizes) / 1024 / 1024
            print(f"\n✅ Done! {len(sizes)} images | avg {sum(sizes)/len(sizes)/1024:.0f}KB | total {total_mb:.1f}MB")

asyncio.run(run())
