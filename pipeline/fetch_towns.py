"""Town-level boundaries: Sri Lanka's Divisional Secretariat divisions (the level NBRO warns at).

    python fetch_towns.py

Downloads the open geoBoundaries ADM3 layer for Sri Lanka (CC BY 4.0), works
out which district each division is in, and writes a light copy for the
pipeline (data/towns.geojson) and the site (web/public/data/towns.geojson).
"""
import json

import requests
import shapely
from shapely.geometry import mapping, shape

from config import TOWNS_GEOJSON, WEB_DATA
from districts import load_districts

API = "https://www.geoboundaries.org/api/current/gbOpen/LKA/ADM3/"


def main():
    meta = requests.get(API, timeout=120).json()
    url = meta.get("simplifiedGeometryGeoJSON") or meta["gjDownloadURL"]
    gj = requests.get(url, timeout=300).json()
    districts = load_districts()
    feats, seen = [], set()
    for f in gj["features"]:
        g = shapely.make_valid(shape(f["geometry"]))
        if g.is_empty:
            continue
        p = g.representative_point()
        d = next((n for n, dg in districts.items() if dg.contains(p)), None)
        if d is None:  # a sliver on the coast: take the nearest district
            d = min(districts, key=lambda n: districts[n].distance(p))
        name = " ".join(str(f["properties"].get("shapeName", "")).split()).strip() or "Unnamed"
        key = f"{d}|{name}"
        while key in seen:
            key += " 2"
        seen.add(key)
        g = g.simplify(0.0015, preserve_topology=True)
        feats.append({"type": "Feature", "properties": {"key": key, "name": key.split("|")[1], "district": d},
                      "geometry": mapping(shapely.set_precision(g, 0.0001))})
    out = {"type": "FeatureCollection", "source": "geoBoundaries LKA ADM3 (CC BY 4.0)", "features": feats}
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    TOWNS_GEOJSON.write_text(text)
    (WEB_DATA / "towns.geojson").write_text(text)
    per = {}
    for f in feats:
        per[f["properties"]["district"]] = per.get(f["properties"]["district"], 0) + 1
    print(len(feats), "divisions,", len(text) // 1024, "KB", per)


if __name__ == "__main__":
    main()
