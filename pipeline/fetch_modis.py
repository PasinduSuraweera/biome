"""Vegetation greenness (MODIS NDVI) for Sri Lanka through NASA AppEEARS.

AppEEARS cuts the Sri Lanka box out on NASA's side, so we download megabytes,
not the gigabytes of global files. It takes a while to process, so:

    python fetch_modis.py submit     # sends the request, prints a task id
    python fetch_modis.py status     # check progress (often 30-90 minutes)
    python fetch_modis.py get        # download and turn into district averages

Uses the Earthdata Login stored in your .netrc file.
"""
import json
import netrc
import sys

import pandas as pd
import requests
import xarray as xr

from config import BBOX, PROCESSED, RAW
from districts import district_means

API = "https://appeears.earthdatacloud.nasa.gov/api"
TASK_FILE = RAW / "appeears_task.json"
PRODUCT, LAYER = "MOD13A3.061", "_1_km_monthly_NDVI"


def token():
    import os
    if "EARTHDATA_USERNAME" in os.environ:  # GitHub Actions secrets
        login, password = os.environ["EARTHDATA_USERNAME"], os.environ["EARTHDATA_PASSWORD"]
    else:
        login, _, password = netrc.netrc().authenticators("urs.earthdata.nasa.gov")
    r = requests.post(f"{API}/login", auth=(login, password), timeout=60)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['token']}"}


def submit():
    lon0, lat0, lon1, lat1 = BBOX
    box = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {},
        "geometry": {"type": "Polygon", "coordinates": [[
            [lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]]},
    }]}
    end = pd.Timestamp.today().strftime("%m-%d-%Y")
    task = {
        "task_type": "area",
        "task_name": "biome_sri_lanka_ndvi",
        "params": {
            "dates": [{"startDate": "02-01-2000", "endDate": end}],
            "layers": [{"product": PRODUCT, "layer": LAYER}],
            "geo": box,
            "output": {"format": {"type": "netcdf4"}, "projection": "geographic"},
        },
    }
    r = requests.post(f"{API}/task", json=task, headers=token(), timeout=60)
    r.raise_for_status()
    TASK_FILE.write_text(json.dumps(r.json()))
    print("submitted:", r.json())


def status():
    tid = json.loads(TASK_FILE.read_text())["task_id"]
    r = requests.get(f"{API}/task/{tid}", headers=token(), timeout=60)
    print(r.json().get("status"), r.json().get("progress", ""))
    return r.json().get("status")


def get():
    tid = json.loads(TASK_FILE.read_text())["task_id"]
    h = token()
    files = requests.get(f"{API}/bundle/{tid}", headers=h, timeout=60).json()["files"]
    nc = [f for f in files if f["file_name"].endswith(".nc")]
    if not nc:
        sys.exit("No netCDF in the bundle yet. Run `status` first.")
    path = RAW / "modis_ndvi.nc"
    with requests.get(f"{API}/bundle/{tid}/{nc[0]['file_id']}", headers=h, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(path, "wb") as fh:
            for chunk in r.iter_content(1 << 20):
                fh.write(chunk)
    ds = xr.open_dataset(path)
    da = ds[LAYER]
    da = da.where((da >= -0.2) & (da <= 1.0))  # drop fill values and bad pixels
    df = district_means(da)
    # AppEEARS writes a Julian calendar, which pandas cannot convert directly
    df.index = pd.DatetimeIndex([
        pd.Timestamp(int(t.year), int(t.month), 1) if hasattr(t, "year")
        else pd.Timestamp(t).to_period("M").to_timestamp()
        for t in df.index], name="time")
    long = df.reset_index().melt(id_vars="time", var_name="district", value_name="value")
    long["var"] = "ndvi"
    long.to_csv(PROCESSED / "modis_ndvi.csv", index=False)
    print(f"wrote {PROCESSED / 'modis_ndvi.csv'} ({long['time'].min():%Y-%m} to {long['time'].max():%Y-%m})")


def wait(max_minutes=170):
    """Submit, poll every 2 minutes until AppEEARS is done, then download."""
    import time
    from pathlib import Path
    # Reuse a finished AppEEARS request if its id is pinned in the repo, so a
    # rerun downloads in minutes instead of waiting for NASA to process again.
    seed = Path(__file__).resolve().parent.parent / ".github" / "appeears-task.txt"
    if not TASK_FILE.exists() and seed.exists() and seed.read_text().strip():
        TASK_FILE.parent.mkdir(parents=True, exist_ok=True)
        TASK_FILE.write_text(json.dumps({"task_id": seed.read_text().strip()}))
    if not TASK_FILE.exists():
        submit()
    for _ in range(max_minutes // 2):
        if status() == "done":
            return get()
        time.sleep(120)
    sys.exit("AppEEARS still processing; run `python fetch_modis.py get` later.")


if __name__ == "__main__":
    {"submit": submit, "status": status, "get": get, "wait": wait}[sys.argv[1] if len(sys.argv) > 1 else "status"]()
