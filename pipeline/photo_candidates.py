"""Finds freely licensed photos of Sri Lanka on Wikimedia Commons, for the website.

    python photo_candidates.py OUTDIR

Saves up to 8 candidates per theme with their licence and author in credits.json.
Only public domain, CC0, CC BY and CC BY-SA files are kept.
"""
import json
import re
import sys
from pathlib import Path

import requests

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "Biome/1.0 (NASA Space Apps 2026, Kandy; https://github.com/PasinduSuraweera/biome)"}
THEMES = {
    "kandy": "Kandy Sri Lanka hills view",
    "tea": "tea plantation Sri Lanka hill country",
    "paddy": "paddy field Sri Lanka",
    "tank": "Anuradhapura tank reservoir",
    "polonnaruwa": "Parakrama Samudra",
    "coast": "Batticaloa lagoon",
    "boats": "fishing boats beach Sri Lanka",
    "flood": "flood Sri Lanka",
    "landslide": "landslide Sri Lanka",
    "drought": "dry tank Sri Lanka drought",
    "monsoon": "monsoon rain Sri Lanka",
}
OK = re.compile(r"^(public domain|pd|cc0|cc by(-sa)? ?\d)", re.I)


def clean(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    credits = {}
    for key, q in THEMES.items():
        r = requests.get(API, headers=UA, timeout=60, params={
            "action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6,
            "gsrlimit": 25, "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1600}).json()
        pages = sorted((r.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
        n = 0
        for p in pages:
            ii = (p.get("imageinfo") or [{}])[0]
            m = ii.get("extmetadata", {})
            lic = clean(m.get("LicenseShortName", {}).get("value"))
            if not OK.match(lic) or ii.get("width", 0) < 1400 or ii.get("width", 0) < ii.get("height", 1):
                continue
            img = requests.get(ii["thumburl"], headers=UA, timeout=120)
            if img.status_code != 200:
                continue
            name = f"{key}-{n}.jpg"
            (out / name).write_bytes(img.content)
            credits[name] = {"title": p["title"], "page": ii.get("descriptionurl"), "license": lic,
                             "artist": clean(m.get("Artist", {}).get("value"))[:120], "desc": clean(m.get("ImageDescription", {}).get("value"))[:200]}
            n += 1
            if n >= 8:
                break
        print(key, n)
    (out / "credits.json").write_text(json.dumps(credits, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
