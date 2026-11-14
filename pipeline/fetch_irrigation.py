"""Sri Lanka Irrigation Department data: reservoirs, river gauges, Ditwah flood extent.

    python fetch_irrigation.py

No login needed. These are the public feeds behind the department's own
reservoir and river dashboards (slirrigation.maps.arcgis.com).

Writes:
  data/processed/reservoirs_today.csv    74 major reservoirs, latest daily report
  data/processed/reservoirs_maha.csv     daily storage per Maha season, 2020/21 onward
  data/processed/reservoirs_yala.csv     daily storage per Yala season, 2022 onward
  data/processed/hydrostations.csv       river gauge stations with flood thresholds
  data/processed/river_gauges_7d.csv     gauge readings, last 7 days (append-only archive)
  web/public/data/flood_nov2025.geojson  area flooded in Cyclone Ditwah
"""
import io

import pandas as pd
import requests

from config import PROCESSED, RAW, WEB_DATA

RAW_FLOOD = RAW / "flood_nov2025_full.geojson"

SHEET = ("https://docs.google.com/spreadsheets/d/e/2PACX-1vTcSGhi9RESl7CMCl1TQnrKe07Gx5Q696YiSB9jneIHqIP9lifpqSErgI3D5k9KtQXSdW5JpycIIr5e"
         "/pub?gid={gid}&single=true&output=csv")
TABS = {"reservoirs_today": 1238978530, "reservoirs_maha": 673998835, "reservoirs_yala": 1244158041}

ARC = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services"
GAUGES = f"{ARC}/gauges_2_view/FeatureServer/0/query"
STATIONS = f"{ARC}/hydrostations/FeatureServer/0/query"
FLOOD_2025 = "https://www.arcgis.com/sharing/rest/content/items/caa8b55bba6b4468af00f19927c3223c/data"


def numeric(df):
    """'32,414' -> 32414; leaves text columns alone."""
    for c in df.columns:
        if df[c].dtype == object:
            s = df[c].astype(str).str.replace(",", "", regex=False).str.strip()
            conv = pd.to_numeric(s, errors="coerce")
            if conv.notna().mean() > 0.8:
                df[c] = conv
    return df


def sheets():
    for name, gid in TABS.items():
        r = requests.get(SHEET.format(gid=gid), timeout=120)
        r.raise_for_status()
        df = numeric(pd.read_csv(io.StringIO(r.text)))
        df.columns = [c.strip().replace(" ", "_") for c in df.columns]
        df.to_csv(PROCESSED / f"{name}.csv", index=False)
        print(f"{name}: {len(df)} rows")


def arcgis_all(url, where="1=1"):
    """Page through an ArcGIS feature layer and return a DataFrame of attributes."""
    rows, offset = [], 0
    while True:
        r = requests.get(url, params={"f": "json", "where": where, "outFields": "*",
                                      "resultOffset": offset, "orderByFields": "objectid"}, timeout=120)
        r.raise_for_status()
        js = r.json()
        feats = js.get("features", [])
        rows += [f["attributes"] for f in feats]
        # the server caps each page (1,000 here) and says when more remain
        if not feats or not js.get("exceededTransferLimit"):
            break
        offset += len(feats)
    return pd.DataFrame(rows)


def gauges():
    st = arcgis_all(STATIONS)
    st.to_csv(PROCESSED / "hydrostations.csv", index=False)
    g = arcgis_all(GAUGES)
    for c in ("CreationDate", "EditDate"):
        if c in g:
            g[c] = pd.to_datetime(g[c], unit="ms", utc=True).dt.tz_convert("Asia/Colombo")
    out = PROCESSED / "river_gauges_7d.csv"
    if out.exists():  # the feed keeps only 7 days, so keep our own archive
        old = pd.read_csv(out)
        g = pd.concat([old, g.astype(str)]).drop_duplicates(subset=["globalid"])
    g.to_csv(out, index=False)
    print(f"stations: {len(st)}, gauge readings archived: {len(g)}")


def flood_extent():
    """Ditwah flood extent, simplified from ~75 MB to a size a phone can load."""
    import json
    import shapely
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union

    raw = RAW_FLOOD
    if not raw.exists():
        r = requests.get(FLOOD_2025, timeout=600)
        r.raise_for_status()
        raw.write_bytes(r.content)
    gj = json.loads(raw.read_text())
    geoms = [shapely.make_valid(shape(f["geometry"])) for f in gj["features"] if f.get("geometry")]
    merged = unary_union(geoms).buffer(0.0005).buffer(-0.0005)  # close hairline gaps
    simple = merged.simplify(0.002, preserve_topology=True)      # about 200 m
    simple = shapely.set_precision(simple, 0.0001)
    out = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"name": "Flooded area, Cyclone Ditwah, Nov 2025",
                                          "source": "Sri Lanka Irrigation Department"},
        "geometry": mapping(simple)}]}
    path = WEB_DATA / "flood_nov2025.geojson"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"flood extent Nov 2025: {len(gj['features'])} shapes, "
          f"{raw.stat().st_size / 1e6:.0f} MB -> {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    sheets()
    gauges()
    flood_extent()
