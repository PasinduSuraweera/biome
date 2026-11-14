"""Download the El Nino index and Sri Lankan rain-gauge records (no login needed).

    python fetch_ground.py

Writes:
  data/processed/oni.csv              NOAA Oceanic Nino Index, one row per 3-month season
  data/processed/stations.csv         Sri Lankan GHCN-Daily stations and their coverage
  data/processed/station_rain.csv     monthly rain totals (mm) per station, complete months only
"""
import io

import pandas as pd
import requests

from config import GHCN_STATION_CSV, GHCN_STATIONS_URL, ONI_URL, PROCESSED

SEASON_MID = {"DJF": 1, "JFM": 2, "FMA": 3, "MAM": 4, "AMJ": 5, "MJJ": 6,
              "JJA": 7, "JAS": 8, "ASO": 9, "SON": 10, "OND": 11, "NDJ": 12}


def fetch_oni():
    txt = requests.get(ONI_URL, timeout=60).text
    df = pd.read_csv(io.StringIO(txt), sep=r"\s+")
    df.columns = [c.upper() for c in df.columns]
    df["month"] = df["SEAS"].map(SEASON_MID)
    df["time"] = pd.to_datetime(dict(year=df["YR"], month=df["month"], day=1))
    out = df[["time", "SEAS", "ANOM"]].rename(columns={"ANOM": "oni", "SEAS": "season"})
    out.to_csv(PROCESSED / "oni.csv", index=False)
    print(f"ONI: {len(out)} seasons, latest {out['season'].iloc[-1]} {out['time'].iloc[-1]:%Y} = {out['oni'].iloc[-1]}")


def fetch_stations(min_years=10):
    txt = requests.get(GHCN_STATIONS_URL, timeout=120).text
    rows = []
    for line in txt.splitlines():
        if line.startswith("CE"):  # CE = Sri Lanka in GHCN's country codes
            rows.append({
                "id": line[0:11].strip(),
                "lat": float(line[12:20]),
                "lon": float(line[21:30]),
                "elev_m": float(line[31:37]),
                "name": line[41:71].strip().title(),
            })
    st = pd.DataFrame(rows)
    print(f"{len(st)} Sri Lankan stations listed")

    monthly, cover = [], []
    for s in st.itertuples():
        r = requests.get(GHCN_STATION_CSV.format(id=s.id), timeout=120)
        if r.status_code != 200:
            cover.append({"id": s.id, "months_complete": 0})
            continue
        d = pd.read_csv(io.StringIO(r.text), usecols=lambda c: c in ("DATE", "PRCP"), low_memory=False)
        if "PRCP" not in d:
            cover.append({"id": s.id, "months_complete": 0})
            continue
        d["DATE"] = pd.to_datetime(d["DATE"])
        d = d.dropna(subset=["PRCP"])
        # GHCN-Daily stores precipitation in tenths of a millimetre
        d["mm"] = d["PRCP"] / 10.0
        d["month"] = d["DATE"].dt.to_period("M").dt.to_timestamp()
        g = d.groupby("month")["mm"]
        m = pd.DataFrame({"rain_mm": g.sum(), "days": g.count()})
        m["days_in_month"] = m.index.days_in_month
        m = m[m["days"] >= m["days_in_month"] - 3]  # keep near-complete months only
        m = m.reset_index().rename(columns={"month": "time"})
        m["id"] = s.id
        monthly.append(m[["id", "time", "rain_mm", "days"]])
        cover.append({"id": s.id, "months_complete": len(m),
                      "first": m["time"].min(), "last": m["time"].max(),
                      "since_2001": int((m["time"] >= "2001-01-01").sum())})
        print(f"  {s.name:<24} {len(m):>4} complete months"
              f" ({int((m['time'] >= '2001-01-01').sum())} since 2001)")
    st = st.merge(pd.DataFrame(cover), on="id", how="left")
    st.to_csv(PROCESSED / "stations.csv", index=False)
    if monthly:
        pd.concat(monthly).to_csv(PROCESSED / "station_rain.csv", index=False)
    good = st[st["since_2001"].fillna(0) >= min_years * 12 * 0.5]
    print(f"{len(good)} stations usable for checking satellite rain since 2001")


if __name__ == "__main__":
    fetch_oni()
    fetch_stations()
