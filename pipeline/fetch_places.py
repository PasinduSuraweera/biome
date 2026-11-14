"""Candidate evacuation centres from OpenStreetMap, checked against the Ditwah flood map.

    python fetch_places.py

There is no public list of official safe centres, so Biome maps buildings that
are commonly used as relief centres in Sri Lanka (schools, temples, churches,
mosques, kovils, community and town halls) and marks those that flooded in
Cyclone Ditwah. Divisional Secretariats confirm which are safe.

Writes web/public/data/centres.json:
  {"source": ..., "fields": [...], "items": [[lon, lat, kind, name, district, flooded], ...]}
"""
import json

import requests
import shapely
from shapely.geometry import shape

from config import RAW, WEB_DATA
from districts import load_districts

OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = """
[out:json][timeout:300];
area["ISO3166-1"="LK"][admin_level=2]->.lk;
(
  nwr["amenity"="school"](area.lk);
  nwr["amenity"="place_of_worship"](area.lk);
  nwr["amenity"~"community_centre|townhall"](area.lk);
);
out center tags;
"""
KIND = {"school": "school", "place_of_worship": "worship", "community_centre": "hall", "townhall": "hall"}


def main():
    r = requests.post(OVERPASS, data={"data": QUERY}, timeout=400,
                      headers={"User-Agent": "Biome (NASA Space Apps 2026 project)"})
    r.raise_for_status()
    elements = r.json()["elements"]

    flood = None
    fp = WEB_DATA / "flood_nov2025.geojson"
    if fp.exists():
        gj = json.loads(fp.read_text())
        flood = shapely.union_all([shape(f["geometry"]) for f in gj["features"]])
        shapely.prepare(flood)
    geoms = load_districts()

    items = []
    for e in elements:
        lon = e.get("lon", e.get("center", {}).get("lon"))
        lat = e.get("lat", e.get("center", {}).get("lat"))
        if lon is None:
            continue
        tags = e.get("tags", {})
        kind = KIND.get(tags.get("amenity"), "other")
        name = tags.get("name:en") or tags.get("name") or ""
        d = next((n for n, g in geoms.items() if shapely.contains_xy(g, lon, lat)), None)
        if d is None:
            continue
        flooded = bool(flood is not None and shapely.contains_xy(flood, lon, lat))
        items.append([round(lon, 5), round(lat, 5), kind, name[:60], d, int(flooded)])

    out = {"source": "OpenStreetMap contributors (ODbL), flood extent from the Sri Lanka Irrigation Department",
           "fields": ["lon", "lat", "kind", "name", "district", "flooded_in_ditwah"], "items": items}
    (WEB_DATA / "centres.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    n_fl = sum(i[5] for i in items)
    print(f"{len(items)} candidate centres, {n_fl} inside the Ditwah flood extent")


if __name__ == "__main__":
    main()
