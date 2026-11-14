"""Download NASA gridded data for Sri Lanka and reduce it to district averages.

Run on a machine with internet access and an Earthdata Login in ~/.netrc
(or ~/_netrc on Windows):

    python fetch_nasa.py imerg_final
    python fetch_nasa.py imerg_late_daily --start 2026-01-01
    python fetch_nasa.py gldas
    python fetch_nasa.py merra2_flx
    python fetch_nasa.py merra2_lnd
    python fetch_nasa.py all

Each granule is streamed and only the Sri Lanka box is read, then turned into
25 district averages. Results are cached per granule under data/raw/<dataset>/,
so a dropped connection resumes where it stopped. Use --download to fall back
to downloading whole files if streaming fails on your network.
"""
import argparse
import calendar
import json
import sys
import tempfile
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import earthaccess
import numpy as np
import pandas as pd
import xarray as xr

from config import BBOX, COLLECTIONS, PROCESSED, RAW
import districts
from districts import district_means

LON0, LAT0, LON1, LAT1 = BBOX


# ---- per-dataset readers: file -> DataArray (time, lat, lon) in final units ----

def _box(da):
    da = da.sortby("lat").sortby("lon")
    return da.sel(lat=slice(LAT0, LAT1), lon=slice(LON0, LON1))


def _month(v):
    """First day of the month for a time value. IMERG stores time as a Julian
    calendar (cftime) object that pandas cannot convert, so read year and month
    directly whenever the object has them."""
    if hasattr(v, "year") and hasattr(v, "month"):
        return pd.Timestamp(int(v.year), int(v.month), 1)
    t = pd.Timestamp(v)
    return pd.Timestamp(t.year, t.month, 1)


def read_imerg_monthly(f):
    """GPM IMERG Final monthly: mean rate mm/hr -> total mm in the month."""
    ds = xr.open_dataset(f, group="Grid", engine="h5netcdf", decode_times=True)
    da = _box(ds["precipitation"]).load()
    t = _month(da["time"].values[0])
    hours = calendar.monthrange(t.year, t.month)[1] * 24
    da = da * hours
    da = da.assign_coords(time=[t])
    return da.rename("rain_mm")


def read_imerg_daily(f):
    """GPM IMERG Late daily: mm/day for one day (summed to months later)."""
    ds = xr.open_dataset(f, engine="h5netcdf", decode_times=True)
    da = _box(ds["precipitation"]).load()
    return da.rename("rain_mm")


def read_gldas(f):
    """GLDAS Noah monthly: root-zone and top-layer soil moisture (kg/m2)."""
    ds = xr.open_dataset(f, engine="h5netcdf", decode_times=True)
    ds = _box(ds[["RootMoist_inst", "SoilMoi0_10cm_inst", "Rainf_f_tavg", "Evap_tavg"]]).load()
    return ds.assign_coords(time=[_month(ds["time"].values[0])])


def read_merra2_flx(f):
    """MERRA-2 monthly corrected precipitation: kg m-2 s-1 -> mm per month."""
    ds = xr.open_dataset(f, engine="h5netcdf", decode_times=True)
    da = _box(ds["PRECTOTCORR"]).load()
    t = _month(da["time"].values[0])
    secs = calendar.monthrange(t.year, t.month)[1] * 86400
    da = (da * secs).assign_coords(time=[t])
    return da.rename("rain_mm")


def read_merra2_lnd(f):
    """MERRA-2 monthly soil wetness (0 = dry, 1 = saturated)."""
    ds = xr.open_dataset(f, engine="h5netcdf", decode_times=True)
    ds = _box(ds[["GWETROOT", "GWETTOP"]]).load()
    return ds.assign_coords(time=[_month(ds["time"].values[0])])


READERS = {
    "imerg_final": read_imerg_monthly,
    "imerg_late_daily": read_imerg_daily,
    "imerg_late_towns": read_imerg_daily,   # the same files, averaged over 331 divisions
    "gldas": read_gldas,
    "merra2_flx": read_merra2_flx,
    "merra2_lnd": read_merra2_lnd,
}

DEFAULT_RANGES = {
    "imerg_final": ("2000-06-01", None),
    # from mid-2025: IMERG Final V07 monthly currently ends in Sep 2025, so Late fills the months after it
    "imerg_late_daily": ("2025-06-01", None),
    # town level: the Cyclone Ditwah week (for the replay) and everything since
    "imerg_late_towns": ("2025-11-20", None),
    "gldas": ("2000-01-01", None),
    # to 2010 so MERRA-2 has its own 1981-2010 normal for the older El Ninos
    "merra2_flx": ("1980-01-01", "2010-12-31"),
    "merra2_lnd": ("1980-01-01", "2010-12-31"),
}


def to_rows(obj):
    """DataArray/Dataset -> list of {time, var, district: value} rows."""
    rows = []
    items = obj.data_vars.items() if isinstance(obj, xr.Dataset) else [(obj.name, obj)]
    for var, da in items:
        df = district_means(da)
        for t, r in df.iterrows():
            day = pd.Timestamp(int(t.year), int(t.month), int(t.day)) if hasattr(t, "day") and not isinstance(t, pd.Timestamp) else pd.Timestamp(t)
            row = {"time": day.strftime("%Y-%m-%d"), "var": var}
            row.update({k: (None if pd.isna(v) else round(float(v), 4)) for k, v in r.items()})
            rows.append(row)
    return rows


def process(key, granule, fileobj, cache_dir):
    name = granule["umm"].get("GranuleUR") or granule["meta"]["native-id"]
    out = cache_dir / (Path(str(name)).name + ".json")
    if out.exists():
        return out, "cached"
    obj = READERS[key](fileobj)
    out.write_text(json.dumps(to_rows(obj)))
    return out, "ok"


def run(key, start=None, end=None, download=False, workers=6):
    short, version = COLLECTIONS[key]
    s0, e0 = DEFAULT_RANGES[key]
    start, end = start or s0, end or e0 or pd.Timestamp.today().strftime("%Y-%m-%d")
    print(f"[{key}] searching {short} v{version} {start} to {end}")
    granules = earthaccess.search_data(
        short_name=short, version=version,
        bounding_box=BBOX, temporal=(start, end),
    )
    print(f"[{key}] {len(granules)} granules found")
    if not granules:
        return
    cache_dir = RAW / key
    cache_dir.mkdir(parents=True, exist_ok=True)

    failures = 0
    if download:
        with tempfile.TemporaryDirectory() as tmp:
            for i, g in enumerate(granules, 1):
                name = g["umm"].get("GranuleUR") or g["meta"]["native-id"]
                if (cache_dir / (Path(str(name)).name + ".json")).exists():
                    continue
                try:
                    paths = earthaccess.download([g], tmp)
                    process(key, g, paths[0], cache_dir)
                    Path(paths[0]).unlink(missing_ok=True)
                except Exception:
                    failures += 1
                    traceback.print_exc()
                if i % 20 == 0 or i == len(granules):
                    print(f"[{key}] {i}/{len(granules)} done, {failures} failed")
    else:
        files = earthaccess.open(granules)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {pool.submit(process, key, g, f, cache_dir): g for g, f in zip(granules, files)}
            for n, fut in enumerate(as_completed(futs), 1):
                try:
                    fut.result()
                except Exception as e:
                    failures += 1
                    print(f"[{key}] failed: {e}", file=sys.stderr)
                if n % 20 == 0 or n == len(futs):
                    print(f"[{key}] {n}/{len(futs)} done, {failures} failed")
    combine(key)
    if failures:
        print(f"[{key}] {failures} granules failed. Rerun the same command to retry them"
              f" (finished ones are cached), or add --download.")


def combine(key):
    """Merge cached granule results into data/processed/<key>.csv (long format)."""
    rows = []
    for p in sorted((RAW / key).glob("*.json")):
        rows.extend(json.loads(p.read_text()))
    if not rows:
        return
    df = pd.DataFrame(rows)
    df["time"] = pd.to_datetime(df["time"])
    long = df.melt(id_vars=["time", "var"], var_name="district", value_name="value")
    if key == "imerg_late_towns":  # keep the Ditwah week and the last three weeks, by day
        cut = long["time"].max() - pd.Timedelta(days=21)
        keep = long[(long["time"] >= cut) | ((long["time"] >= "2025-11-22") & (long["time"] <= "2025-11-30"))]
        keep = keep.dropna(subset=["value"]).sort_values(["district", "time"])
        keep["value"] = keep["value"].round(1)
        keep.to_csv(PROCESSED / f"{key}.csv", index=False)
        print(f"[{key}] wrote {len(keep)} rows for {keep['district'].nunique()} divisions")
        return
    if key == "imerg_late_daily":  # keep the days (for daily risk levels), then daily -> monthly totals
        days = long.sort_values(["district", "time"])
        days.to_csv(PROCESSED / f"{key}_days.csv", index=False)
        long["month"] = long["time"].dt.to_period("M").dt.to_timestamp()
        g = long.groupby(["month", "var", "district"])["value"]
        long = g.sum(min_count=1).to_frame("value").join(g.count().to_frame("days")).reset_index()
        long = long.rename(columns={"month": "time"})
    long = long.sort_values(["var", "district", "time"])
    out = PROCESSED / f"{key}.csv"
    long.to_csv(out, index=False)
    print(f"[{key}] wrote {out} ({long['time'].min():%Y-%m} to {long['time'].max():%Y-%m})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("dataset", choices=list(READERS) + ["all"])
    ap.add_argument("--start")
    ap.add_argument("--end")
    ap.add_argument("--download", action="store_true", help="download whole files instead of streaming")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    # environment variables (GitHub Actions secrets) first, then ~/.netrc
    earthaccess.login(strategy="environment" if "EARTHDATA_USERNAME" in __import__("os").environ else "netrc")
    keys = [k for k in READERS if k != "imerg_late_towns"] if a.dataset == "all" else [a.dataset]
    for k in keys:
        districts.UNITS = "towns" if k.endswith("_towns") else "districts"
        run(k, a.start, a.end, a.download, a.workers)
