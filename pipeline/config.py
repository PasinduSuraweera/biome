"""Shared settings for the Biome pipeline."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("BIOME_DATA", ROOT / "data"))
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
WEB_DATA = Path(os.environ.get("BIOME_WEB_DATA", ROOT / "web" / "public" / "data"))
DISTRICTS_GEOJSON = ROOT / "data" / "districts.geojson"
TOWNS_GEOJSON = DISTRICTS_GEOJSON.parent / "towns.geojson"  # Divisional Secretariat divisions

# Sri Lanka bounding box with a small margin (lon_min, lat_min, lon_max, lat_max)
BBOX = (79.4, 5.8, 82.0, 10.0)

# Normal ("climatology") period: full years inside the satellite record
CLIM_START, CLIM_END = 2001, 2025

# Hill country, measured: a district counts as hill country when at least 10% of its
# land is steeper than 15 degrees in NASA's Shuttle Radar elevation data (NASADEM, 30 m;
# see fetch_dem.py). The fixed list below is only the fallback until that file exists.
HILL_STEEP_SHARE = 0.10
HILL_DISTRICTS = {
    "Badulla", "Nuwara Eliya", "Kandy", "Matale", "Kegalle",
    "Ratnapura", "Kalutara", "Galle", "Matara", "Monaragala",
}
TERRAIN = {}
_terrain_file = PROCESSED / "terrain.json"
if _terrain_file.exists():
    import json as _json
    TERRAIN = _json.loads(_terrain_file.read_text())
    HILL_DISTRICTS = {d for d, v in TERRAIN["districts"].items() if (v.get("steep_share") or 0) >= HILL_STEEP_SHARE}

# NASA collections (short name, version) used by the fetch scripts
COLLECTIONS = {
    "imerg_final": ("GPM_3IMERGM", "07"),     # monthly rain, Jun 2000 onward, ~3.5 month lag
    "imerg_late_daily": ("GPM_3IMERGDL", "07"),  # daily early-estimate rain, fills the recent months
    "imerg_late_towns": ("GPM_3IMERGDL", "07"),
    "gldas": ("GLDAS_NOAH025_M", "2.1"),      # monthly soil moisture, 2000 onward
    "merra2_flx": ("M2TMNXFLX", "5.12.4"),    # monthly rain, 1980 onward (older El Ninos)
    "merra2_lnd": ("M2TMNXLND", "5.12.4"),    # monthly soil wetness, 1980 onward
    "modis_ndvi": ("MOD13C2", "061"),         # monthly greenness, 0.05 deg, 2000 onward
}

# NOAA Climate Prediction Center Oceanic Nino Index (official El Nino record)
ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"

# NOAA GHCN-Daily, no token needed
GHCN_STATIONS_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt"
GHCN_STATION_CSV = "https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/{id}.csv"

for p in (RAW, PROCESSED, WEB_DATA):
    p.mkdir(parents=True, exist_ok=True)
