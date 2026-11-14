"""Download real NASA satellite images of Sri Lanka from NASA GIBS (the service behind NASA Worldview).

    python fetch_nasa_images.py            # fetch every image in WANTED
    python fetch_nasa_images.py --layers   # only list matching GIBS layers

GIBS is public: no login needed. Each image is one WMS GetMap request for a
bounding box and a date. Images are saved in web/public/nasa/ with an index
(index.json) holding the layer, date and a NASA Worldview link for each, so
anyone can open the same view on NASA's own site.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from pathlib import Path

import requests

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "nasa"
ISLAND = (78.9, 5.4, 82.6, 10.3)    # Sri Lanka
WIDE = (72.0, 0.0, 92.0, 16.0)      # Sri Lanka and the Bay of Bengal
INTEREST = re.compile(r"IMERG|Precip|NDVI|Soil_Moisture|Root_Zone|Flood|Landslide|TrueColor|Coastlines|Reference_|BlueMarble|Night", re.I)


def capabilities():
    r = requests.get(WMS, params={"SERVICE": "WMS", "REQUEST": "GetCapabilities", "VERSION": "1.1.1"}, timeout=180)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    layers = {}
    for lyr in root.iter("Layer"):
        name = lyr.findtext("Name")
        if not name:
            continue
        ext = next((e.text or "" for e in lyr.findall("Extent") if e.get("name") == "time"), "")
        layers[name] = {"title": lyr.findtext("Title") or name, "time": ext.strip()}
    return layers


def pick(layers, candidates):
    return next((c for c in candidates if c in layers), None)


def get_map(layer_list, bbox, when, width, path, fmt="image/jpeg"):
    h = round(width * (bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))
    params = {"SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap", "LAYERS": ",".join(layer_list),
              "STYLES": "", "FORMAT": fmt, "SRS": "EPSG:4326", "BBOX": ",".join(map(str, bbox)),
              "WIDTH": width, "HEIGHT": h, "TIME": when}
    r = requests.get(WMS, params=params, timeout=180)
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image"):
        print(f"  FAILED {path.name}: {r.status_code} {r.text[:300]}")
        return None
    path.write_bytes(r.content)
    print(f"  saved {path.name} {len(r.content) // 1024} KB ({width}x{h})")
    return {"w": width, "h": h}


def worldview(layer_list, bbox, when):
    return (f"https://worldview.earthdata.nasa.gov/?v={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
            f"&l={','.join(reversed(layer_list))}&t={when[:10]}")


TRUE = ["VIIRS_SNPP_CorrectedReflectance_TrueColor", "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
        "MODIS_Terra_CorrectedReflectance_TrueColor"]
BASE = ["BlueMarble_ShadedRelief_Bathymetry", "BlueMarble_NextGeneration"]
COAST = ["Coastlines_15m", "Reference_Features_15m"]


def wanted():
    today = date.today()
    out = []
    for d in ["2025-11-26", "2025-11-27", "2025-11-28", "2025-11-29"]:
        out.append({"id": f"ditwah-{d}", "group": "ditwah", "date": d, "bbox": WIDE, "width": 1200,
                    "layers": [TRUE, COAST]})
        out.append({"id": f"ditwah-rain-{d}", "group": "ditwah_rain", "date": d, "bbox": WIDE, "width": 1200,
                    "layers": [BASE, ["IMERG_Precipitation_Rate", "IMERG_Precipitation_Rate_30min"], COAST]})
    for k in (1, 2, 3):
        d = (today - timedelta(days=k)).isoformat()
        out.append({"id": f"now-{k}", "group": "now", "date": d, "bbox": WIDE, "width": 1200, "layers": [TRUE, COAST]})
        out.append({"id": f"now-rain-{k}", "group": "now_rain", "date": d, "bbox": WIDE, "width": 1200,
                    "layers": [BASE, ["IMERG_Precipitation_Rate", "IMERG_Precipitation_Rate_30min"], COAST]})
    for d in ["2025-12-02", "2025-12-04"]:
        out.append({"id": f"flood-{d}", "group": "flood", "date": d, "bbox": ISLAND, "width": 900,
                    "layers": [BASE, ["MODIS_Combined_Flood_3-Day", "MODIS_Combined_Flood_2-Day", "VIIRS_Combined_Flood_3-Day"], COAST]})
    for d in ["2025-08-15", "2026-08-15"]:
        out.append({"id": f"ndvi-{d}", "group": "ndvi", "date": d, "bbox": ISLAND, "width": 900,
                    "layers": [["MODIS_Terra_NDVI_8Day", "MODIS_Terra_L3_NDVI_16Day", "MODIS_Terra_L3_NDVI_Monthly"], COAST]})
    for d in ["2025-11-29", "2026-08-15"]:
        out.append({"id": f"soil-{d}", "group": "soil", "date": d, "bbox": ISLAND, "width": 900,
                    "layers": [["SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", "SMAP_L4_Analyzed_Surface_Soil_Moisture"], COAST]})
    return out


def main():
    layers = capabilities()
    print(len(layers), "GIBS layers")
    for n in sorted(layers):
        if INTEREST.search(n):
            print(f"LAYER {n} | {layers[n]['title']} | {layers[n]['time'][:140]}")
    if "--layers" in sys.argv:
        return
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for w in wanted():
        chosen = [pick(layers, c) for c in w["layers"]]
        if chosen[-2 if len(chosen) > 1 else 0] is None or None in chosen[:-1]:
            print(f"  no layer for {w['id']}: {w['layers']}")
            continue
        chosen = [c for c in chosen if c]
        data_fmt = "image/jpeg"
        size = get_map(chosen, w["bbox"], w["date"], w["width"], OUT / f"{w['id']}.jpg", data_fmt)
        if size:
            main_layer = chosen[0] if len(chosen) < 3 else chosen[1]
            index.append({"id": w["id"], "group": w["group"], "date": w["date"], "file": f"nasa/{w['id']}.jpg", **size,
                          "layer": main_layer, "title": layers[main_layer]["title"], "bbox": w["bbox"],
                          "worldview": worldview(chosen, w["bbox"], w["date"])})
    (OUT / "index.json").write_text(json.dumps({"source": "NASA GIBS / Worldview", "images": index}, indent=1))
    print(len(index), "images")


if __name__ == "__main__":
    main()
