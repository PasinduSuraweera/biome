"""Terrain from NASA's Shuttle Radar Topography Mission (NASADEM, 30 m), used two ways:

1. Which districts are hill country: the share of each district's land that is
   steep. This replaces a hand-made list with a measurement.
2. Which candidate evacuation centres stand on safer ground: off steep slopes,
   outside the area that flooded in Cyclone Ditwah, and ranked by how far they
   stand above the lowest ground nearby.

    python fetch_dem.py

Needs an Earthdata login (EARTHDATA_USERNAME / EARTHDATA_PASSWORD or ~/.netrc).
Writes data/processed/terrain.json, web/public/data/safe_centres.json and
web/public/nasa/terrain.jpg.
"""
import json
import zipfile
from pathlib import Path

import numpy as np
import shapely

from config import BBOX, PROCESSED, RAW, WEB_DATA
from districts import load_districts

N = 3601
CELL = 30.87          # metres per arc-second of latitude
STEEP = 15.0          # degrees: ground steeper than this is "steep" for the district share
AVOID = 20.0          # degrees: a centre with a slope this steep within 90 m is not recommended
SOURCE = "NASA NASADEM_HGT v001 (Shuttle Radar Topography Mission), 30 m"


def download():
    import earthaccess
    import os
    earthaccess.login(strategy="environment" if os.environ.get("EARTHDATA_USERNAME") else "netrc")
    out = RAW / "nasadem"
    out.mkdir(parents=True, exist_ok=True)
    res = earthaccess.search_data(short_name="NASADEM_HGT", bounding_box=BBOX, count=60)
    have = {p.name for p in out.glob("*.zip")}
    todo = [g for g in res if Path(g.data_links()[0]).name not in have]
    if todo:
        earthaccess.download(todo, str(out))
    return sorted(out.glob("*.zip"))


def read_tile(zpath):
    """(lat0, lon0, elevation[north to south, west to east]) for one 1-degree tile."""
    with zipfile.ZipFile(zpath) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".hgt"))
        raw = z.read(name)
    stem = Path(name).stem.lower()                      # n07e080
    lat0 = int(stem[1:3]) * (1 if stem[0] == "n" else -1)
    lon0 = int(stem[4:7]) * (1 if stem[3] == "e" else -1)
    elev = np.frombuffer(raw, dtype=">i2").reshape(N, N).astype(np.float32)
    elev[elev < -100] = 0                               # voids
    return lat0, lon0, elev


def slope_of(elev, lat0):
    gy, gx = np.gradient(elev, CELL, CELL * np.cos(np.radians(lat0 + 0.5)))
    return np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32)


def main():
    tiles = {}
    for zp in download():
        lat0, lon0, elev = read_tile(zp)
        tiles[(lat0, lon0)] = (elev, slope_of(elev, lat0))
    print(len(tiles), "NASADEM tiles")
    geoms = load_districts()
    for g in geoms.values():
        shapely.prepare(g)

    # 1. district terrain, sampling every 8th cell (about 250 m)
    acc = {d: {"n": 0, "steep": 0, "sum": 0.0, "max": 0.0} for d in geoms}
    step = 8
    for (lat0, lon0), (elev, slope) in tiles.items():
        rows = np.arange(0, N, step)
        lat = lat0 + 1 - rows / 3600
        lon = lon0 + rows / 3600
        LON, LAT = np.meshgrid(lon, lat)
        E, S = elev[::step, ::step], slope[::step, ::step]
        for d, g in geoms.items():
            minx, miny, maxx, maxy = g.bounds
            if maxx < lon0 or minx > lon0 + 1 or maxy < lat0 or miny > lat0 + 1:
                continue
            inside = shapely.contains_xy(g, LON, LAT)
            if inside.any():
                a = acc[d]
                a["n"] += int(inside.sum()); a["steep"] += int((S[inside] >= STEEP).sum())
                a["sum"] += float(E[inside].sum()); a["max"] = max(a["max"], float(E[inside].max()))
    terrain = {d: {"steep_share": round(a["steep"] / a["n"], 3) if a["n"] else None,
                   "mean_elev_m": round(a["sum"] / a["n"]) if a["n"] else None, "max_elev_m": round(a["max"])}
               for d, a in acc.items()}
    for d, v in sorted(terrain.items(), key=lambda kv: -(kv[1]["steep_share"] or 0)):
        print(f"  {d:14} steep {v['steep_share']}  mean {v['mean_elev_m']} m  max {v['max_elev_m']} m")
    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "terrain.json").write_text(json.dumps(
        {"source": SOURCE, "steep_degrees": STEEP, "districts": terrain}, indent=1))

    # 2. evacuation centre candidates on safer ground
    cp = WEB_DATA / "centres.json"
    if cp.exists():
        items = json.loads(cp.read_text())["items"]
        out, per = [], {}
        for lon, lat, kind, name, d, flooded in items:
            t = tiles.get((int(np.floor(lat)), int(np.floor(lon))))
            if t is None:
                continue
            elev, slope = t
            r = min(N - 1, max(0, round((np.floor(lat) + 1 - lat) * 3600)))
            c = min(N - 1, max(0, round((lon - np.floor(lon)) * 3600)))
            near = slope[max(0, r - 3):r + 4, max(0, c - 3):c + 4]          # about 90 m around
            wide = elev[max(0, r - 17):r + 18, max(0, c - 17):c + 18]       # about 500 m around
            e, s, rel = float(elev[r, c]), float(near.max()), float(elev[r, c] - wide.min())
            grade = 1 if flooded else 2 if s >= AVOID else 0             # 0 safer ground, 1 flooded in Ditwah, 2 steep
            out.append([lon, lat, kind, name, d, grade, round(e), round(s), round(rel)])
            p = per.setdefault(d, {"count": 0, "safer": 0, "flooded": 0, "steep": 0, "top": []})
            p["count"] += 1
            p[["safer", "flooded", "steep"][grade]] += 1
        for d, p in per.items():
            ok = [x for x in out if x[4] == d and x[5] == 0 and x[3]]
            # bigger public buildings first, then the ground standing highest above its surroundings
            ok.sort(key=lambda x: ({"school": 0, "hall": 0}.get(x[2], 1), -x[8]))
            p["top"] = [[x[0], x[1], x[2], x[3], x[6], x[8]] for x in ok[:8]]
        (WEB_DATA / "safe_centres.json").write_text(json.dumps({
            "source": f"Buildings: OpenStreetMap contributors (ODbL). Ground: {SOURCE}. Flood: Irrigation Department, Nov 2025.",
            "rules": {"safer": f"not flooded in Cyclone Ditwah and no slope of {AVOID:.0f} degrees or more within 90 m",
                      "ranking": "schools and halls first, then height above the lowest ground within 500 m"},
            "fields": ["lon", "lat", "kind", "name", "district", "grade (0 safer, 1 flooded in Ditwah, 2 steep)",
                       "elevation_m", "steepest_slope_deg_within_90m", "height_above_lowest_ground_500m"],
            "districts": per,
            "items": [[x[0], x[1], x[5]] for x in out],
        }, ensure_ascii=False, separators=(",", ":")))
        tot = {k: sum(p[k] for p in per.values()) for k in ("count", "safer", "flooded", "steep")}
        print("centres:", tot)

    # 3. a picture of the terrain: steep ground in colour over shaded relief
    try:
        from PIL import Image
        lats = sorted({k[0] for k in tiles}, reverse=True)
        lons = sorted({k[1] for k in tiles})
        k = 6
        n = N // k
        img = np.zeros((len(lats) * n, len(lons) * n, 3), np.uint8)
        img[:] = (16, 35, 42)
        for (lat0, lon0), (elev, slope) in tiles.items():
            e, s = elev[:n * k:k, :n * k:k], slope[:n * k:k, :n * k:k]
            gy, gx = np.gradient(e)
            shade = np.clip(0.75 - 0.012 * (gx - gy), 0.35, 1.0)
            rgb = np.stack([np.full_like(e, 226), np.full_like(e, 229), np.full_like(e, 220)], -1)
            rgb[s >= 8] = (233, 204, 138)
            rgb[s >= STEEP] = (219, 116, 71)
            rgb[s >= 25] = (125, 46, 28)
            rgb = (rgb * shade[..., None]).astype(np.uint8)
            rgb[e <= 0] = (16, 35, 42)
            y, x = lats.index(lat0) * n, lons.index(lon0) * n
            img[y:y + n, x:x + n] = rgb
        top, left = lats[0] + 1, lons[0]
        x0, x1 = int((79.4 - left) * n), int((82.1 - left) * n)
        y0, y1 = int((top - 10.0) * n), int((top - 5.8) * n)
        out_img = Image.fromarray(img[y0:y1, x0:x1])
        out_img.thumbnail((1000, 1600))
        (WEB_DATA.parent / "nasa").mkdir(parents=True, exist_ok=True)
        out_img.save(WEB_DATA.parent / "nasa" / "terrain.jpg", quality=88)
        print("terrain.jpg", out_img.size)
    except Exception as e:  # noqa: BLE001
        print("terrain picture skipped:", e)


if __name__ == "__main__":
    main()
