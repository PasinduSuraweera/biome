"""Biome analysis: from district time series to the Watch flags in the app.

    python analysis.py

Reads data/processed/*.csv (made by the fetch scripts) and writes
web/public/data/biome.json. Every number in the app comes from here.

Steps
  1. Normal: each district's usual rain, soil moisture and greenness per
     calendar month (2001-2025 for the NASA satellite era, 1981-2010 for
     MERRA-2, which we only use for the older El Ninos).
  2. Anomalies: every month compared with that normal.
  3. El Nino years from NOAA's official Oceanic Nino Index (ONI).
  4. Whiplash profile: the average anomaly path, January of the El Nino year
     to June of the next, across past strong events, with the spread.
  5. Significance: is rain in El Nino seasons really different from other
     years? Permutation test against every year in the record.
  6. Long-term trend: Seasonal Mann-Kendall test and Sen's slope, 2001-2025.
  7. 2026: placed on the profile; Watch flag from the latest months.
  8. Trust checks: satellite rain against rain gauges; backtest on known events.
"""
import json
import os
import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import pymannkendall as mk

from config import CLIM_END, CLIM_START, HILL_DISTRICTS, HILL_STEEP_SHARE, PROCESSED, TERRAIN, WEB_DATA

RNG = np.random.default_rng(42)
LAGS = 18  # Jan of El Nino year (lag 0) to Jun of the following year (lag 17)
LAG_LABELS = [pd.Timestamp(2000 + (i // 12), i % 12 + 1, 1).strftime("%b") + ("" if i < 12 else "+1")
              for i in range(LAGS)]

# Watch rules, in plain words in the app's "how we know" panel
RULES = {
    "DryWatch": "3-month rain at or below 75% of normal and soil moisture in the driest 25% for this month",
    "FloodWatch": "rain at or above 150% of normal this month on soil already in the wettest 25%",
    "SlopeWatch": "a hill district (10% or more of its land steeper than 15 degrees in NASA SRTM elevation data) where soil is in the wettest 25% and rain is at or above 130% of normal",
    "ground_wetness": "GLDAS root-zone soil moisture when it is no more than a month old; GLDAS runs about 3 months "
                      "behind, so for recent months the rank of the last 3 months of rain against the same months in "
                      "2001-2025 stands in for it",
}

# Known events for the backtest. Each must be checked against a source before
# the result is shown or pitched (sources listed in docs/backtest_sources.md).
BACKTEST_EVENTS = [
    {"date": "2016-05", "district": "Kegalle", "type": "SlopeWatch", "event": "Aranayake landslide, May 2016"},
    {"date": "2017-05", "district": "Ratnapura", "type": "FloodWatch", "event": "Southwest floods and landslides, May 2017"},
    {"date": "2025-11", "district": "Kandy", "type": "SlopeWatch", "event": "Cyclone Ditwah, Nov 2025"},
]


# ------------------------------------------------------------------ loading

def wide(key, var, value="value"):
    """Long CSV -> wide DataFrame (time x district) for one variable."""
    p = PROCESSED / f"{key}.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p, parse_dates=["time"])
    df = df[df["var"] == var]
    if df.empty:
        return None
    return df.pivot_table(index="time", columns="district", values=value).sort_index()


GAP_FILLS = {}  # dataset -> {district: neighbour used}, reported in meta


def fill_from_neighbour(df, key, districts):
    """Give a district with no values in a dataset the values of its nearest
    neighbour (by centroid). GLDAS treats most of the Jaffna peninsula as water,
    so Jaffna borrows Kilinochchi's soil moisture; the swap is listed in meta."""
    if df is None:
        return None
    missing = [d for d in districts if d not in df.columns or df[d].isna().all()]
    if not missing:
        return df.reindex(columns=districts)
    from districts import load_districts
    cent = {n: g.centroid for n, g in load_districts().items()}
    df = df.copy()
    for d in missing:
        have = [n for n in df.columns if n != d and df[n].notna().any() and n in cent]
        near = min(have, key=lambda n: cent[n].distance(cent[d]))
        df[d] = df[near]
        GAP_FILLS.setdefault(key, {})[d] = near
    return df.reindex(columns=districts)


def load_rain():
    """IMERG Final, extended with IMERG Late (early estimate) for recent months."""
    final = wide("imerg_final", "rain_mm")
    late = wide("imerg_late_daily", "rain_mm")
    days = wide("imerg_late_daily", "rain_mm", value="days")
    source = pd.Series("IMERG Final", index=final.index)
    partial = None
    if late is not None:
        late = late[late.index > final.index.max()]
        days = days.loc[late.index]
        full = days.min(axis=1) >= late.index.days_in_month
        if (~full).any():  # the month in progress: keep separately, scaled to a full month
            last = late.index[~full][-1]
            n = int(days.loc[last].min())
            partial = {"month": last, "days": n,
                       "rain_mm": late.loc[last] * last.days_in_month / max(n, 1)}
        late = late[full]
        final = pd.concat([final, late])
        source = pd.concat([source, pd.Series("IMERG Late (early estimate)", index=late.index)])
    # a calendar gap would make the 3-month sums skip months, so keep every month (NaN if missing)
    final = final.reindex(pd.date_range(final.index.min(), final.index.max(), freq="MS"))
    return final, source, partial


# ------------------------------------------------------------------ anomalies

def normal_of(df, start=CLIM_START, end=CLIM_END):
    ref = df[(df.index.year >= start) & (df.index.year <= end)]
    return ref.groupby(ref.index.month).mean()


def pct_of_normal(df, normal):
    n = normal.reindex(df.index.month).set_index(df.index)
    return 100 * df / n.replace(0, np.nan)


def rolling_pct(df, normal, k=3):
    """k-month rain total as % of the normal k-month total ending that month."""
    n = normal.reindex(df.index.month).set_index(df.index)
    return 100 * df.rolling(k).sum() / n.rolling(k).sum()


def percentile_of(df, start=CLIM_START, end=CLIM_END):
    """Each value's percentile among the same calendar month in the normal period."""
    out = pd.DataFrame(index=df.index, columns=df.columns, dtype=float)
    ref = df[(df.index.year >= start) & (df.index.year <= end)]
    for m in range(1, 13):
        r = ref[ref.index.month == m]
        rows = df.index.month == m
        for c in df.columns:
            base = np.sort(r[c].dropna().values)
            if base.size:
                out.loc[rows, c] = 100 * np.searchsorted(base, df.loc[rows, c].values, side="right") / base.size
    return out


# ------------------------------------------------------------------ El Nino

def el_nino_events(oni_path=PROCESSED / "oni.csv", kind="el_nino"):
    """NOAA rule: 5+ overlapping seasons with ONI >= 0.5 (El Nino) or <= -0.5 (La Nina).

    Year 0 = the calendar year in which the event builds towards its peak.
    """
    oni = pd.read_csv(oni_path, parse_dates=["time"]).set_index("time")["oni"]
    sign = 1 if kind == "el_nino" else -1
    s = oni * sign  # La Nina becomes positive so one code path handles both
    warm = s >= 0.5
    events, run = [], []
    for t, w in warm.items():
        if w:
            run.append(t)
        else:
            if len(run) >= 5:
                events.append(run)
            run = []
    current_run = None
    if len(run) >= 3:  # an event still building at the end of the record counts as current
        events.append(run)
        current_run = run
    out = []
    for r in events:
        peak_t = s.loc[r].idxmax()
        peak = float(s.loc[r].max())
        y0 = peak_t.year if peak_t.month >= 6 else peak_t.year - 1
        out.append({"kind": kind, "year0": int(y0), "start": r[0].strftime("%Y-%m"), "end": r[-1].strftime("%Y-%m"),
                    "peak": round(sign * peak, 2), "peak_season": peak_t.strftime("%Y-%m"),
                    "strength": "very strong" if peak >= 2.0 else "strong" if peak >= 1.5
                    else "moderate" if peak >= 1.0 else "weak",
                    "ongoing": r is current_run})
    return out, oni


def window(df, y0):
    """Rows Jan(y0)..Jun(y0+1), re-indexed by lag 0..17 (NaN where missing)."""
    idx = pd.date_range(f"{y0}-01-01", periods=LAGS, freq="MS")
    return df.reindex(idx).set_axis(range(LAGS))


def profile(anom_sources, events):
    """Mean / min / max anomaly path across events.

    anom_sources: list of (DataFrame, first_year, last_year): the anomaly table to
    use for events whose year0 falls in that range (IMERG era, MERRA-2 era).
    """
    paths = []
    used = []
    for ev in events:
        for df, y_first, y_last in anom_sources:
            if df is not None and y_first <= ev["year0"] <= y_last:
                w = window(df, ev["year0"])
                if w.notna().sum().sum() > 0:
                    paths.append(w)
                    used.append(ev["year0"])
                break
    if not paths:
        return None, []
    # MERRA-2 masks the ocean, so a small coastal district can be missing from
    # the older events: line every event up on the same districts (NaN if absent)
    cols = sorted(set().union(*[p.columns for p in paths]))
    paths = [p.reindex(columns=cols) for p in paths]
    stack = np.stack([p.values for p in paths])  # (event, lag, district)
    with np.errstate(all="ignore"):
        mean = pd.DataFrame(np.nanmean(stack, axis=0), columns=cols)
        lo = pd.DataFrame(np.nanmin(stack, axis=0), columns=cols)
        hi = pd.DataFrame(np.nanmax(stack, axis=0), columns=cols)
    return {"mean": mean, "min": lo, "max": hi, "paths": dict(zip(used, paths))}, used


SEASONS = {  # lag months
    "Southwest monsoon (May-Sep)": list(range(4, 9)),
    "Northeast monsoon onset (Oct-Dec)": list(range(9, 12)),
    "Following Jan-Mar": list(range(12, 15)),
}


def season_significance(rain_pct_all, event_years, n_perm=5000):
    """Permutation test per district and season.

    Compares the average rain (% of normal) in strong El Nino years with the
    average from the same number of years drawn at random from every year in
    the record. p = share of random draws at least as far from 100% as observed.
    """
    years = sorted(set(rain_pct_all.index.year))
    out = {}
    for season, lags in SEASONS.items():
        per_year = {}
        for y in years:
            idx = [pd.Timestamp(y, 1, 1) + pd.DateOffset(months=l) for l in lags]
            block = rain_pct_all.reindex(idx)
            if block.notna().all(axis=None):
                per_year[y] = block.mean()
        if not per_year:
            continue
        tab = pd.DataFrame(per_year).T  # year x district
        ev = [y for y in event_years if y in tab.index]
        if len(ev) < 2:
            continue
        obs = tab.loc[ev].mean()
        draws = np.stack([tab.sample(len(ev), random_state=int(RNG.integers(1e9))).mean().values
                          for _ in range(n_perm)])
        dev_obs = np.abs(obs.values - 100)
        p = ((np.abs(draws - 100) >= dev_obs).sum(axis=0) + 1) / (n_perm + 1)
        out[season] = {d: {"pct_of_normal": round(float(obs[d]), 1), "p": round(float(pv), 4),
                           "n_events": len(ev), "n_years": len(tab)}
                       for d, pv in zip(tab.columns, p)}
    return out


# ------------------------------------------------------------------ trends

def trends(df, label, start=CLIM_START, end=CLIM_END, pct_base=None):
    """Seasonal Mann-Kendall + Sen's slope per district on monthly data."""
    ref = df[(df.index.year >= start) & (df.index.year <= end)]
    out = {}
    for c in ref.columns:
        s = ref[c].dropna()
        if len(s) < 120:
            continue
        r = mk.seasonal_test(s.values, period=12)
        slope_decade = r.slope * 10  # Sen's slope is per year for seasonal data
        base = float(s.mean()) if pct_base is None else pct_base
        out[c] = {"trend": r.trend, "p": round(float(r.p), 4),
                  "slope_per_decade": round(float(slope_decade), 4),
                  "pct_per_decade": round(100 * float(slope_decade) / base, 2) if base else None,
                  "significant": bool(r.p < 0.05), "years": f"{start}-{end}", "var": label}
    # Benjamini-Hochberg across districts so 25 tests do not inflate false alarms
    ps = sorted((v["p"], k) for k, v in out.items())
    m = len(ps)
    passed = set()
    for i, (p, k) in enumerate(ps, 1):
        if p <= 0.05 * i / m:
            passed = {kk for _, kk in ps[:i]}
    for k in out:
        out[k]["significant_fdr"] = k in passed
    return out


# ------------------------------------------------------------------ watch flags

def flag_for(district, rain1, rain3, smp, ndvi_anom=None, wet_src="soil"):
    """Return (watch, reason) for one district-month.

    smp is how wet the ground is, as a percentile against the same month in
    past years: GLDAS soil moisture when it is current, otherwise (GLDAS runs
    about 3 months behind) the rank of the last 3 months of rain, which is how
    much water the ground has been given (wet_src="rain3")."""
    hill = district in HILL_DISTRICTS
    if wet_src == "rain3":
        wet = lambda p: f"ground wetter than {p:.0f}% of past years (from 3 months of rain)"
        dry = lambda p: f"ground drier than {100 - p:.0f}% of past years (from 3 months of rain)"
    else:
        wet = lambda p: f"soil wetter than {p:.0f}% of past years"
        dry = lambda p: f"soil drier than {100 - p:.0f}% of past years"
    if hill and _ok(smp) and _ok(rain1) and smp >= 75 and rain1 >= 130:
        return "SlopeWatch", f"Rain {rain1:.0f}% of normal on hill country, {wet(smp)}"
    if _ok(smp) and _ok(rain1) and smp >= 75 and rain1 >= 150:
        return "FloodWatch", f"Rain {rain1:.0f}% of normal, {wet(smp)}"
    if _ok(rain3) and _ok(smp) and rain3 <= 75 and smp <= 25:
        extra = f", plants {abs(ndvi_anom):.2f} NDVI below normal" if _ok(ndvi_anom) and ndvi_anom < 0 else ""
        return "DryWatch", f"Three months of rain at {rain3:.0f}% of normal, {dry(smp)}{extra}"
    return "Clear", "Rain and ground wetness are within the normal range for this month"


def level_of(p):
    """Plain-language rain level for a % of normal."""
    if not _ok(p):
        return None
    return ("much_drier" if p < 60 else "drier" if p < 85 else "normal" if p <= 115
            else "wetter" if p <= 140 else "much_wetter")


def outlook(d, rain_all, rnorm, analog_years, y0_now, start, cal_d, kind):
    """What the next 12 months looked like in past years of the same kind.

    For each coming month, take the same calendar month at the same point of
    each past event (a strong El Nino or a La Nina) and average its rain as %
    of normal. Horizons (1, 3, 6, 12 months) compare total rain with the normal
    total, event by event, and count how many events went the same way. Risk
    shares come from the risk calendar for that kind of year. This is a pattern
    from past years, not a weather forecast.
    """
    months = pd.date_range(start, periods=12, freq="MS")
    per_event = {}
    for y in analog_years or []:
        vals = []
        for t in months:
            ts = pd.Timestamp(y + (t.year - y0_now), t.month, 1)
            vals.append(rain_all.at[ts, d] if ts in rain_all.index and d in rain_all else np.nan)
        vals = np.array(vals, float)
        if np.isfinite(vals).sum() >= 6:
            per_event[int(y)] = vals
    w = np.array([rnorm.at[t.month, d] for t in months], float)

    def ytype(t):
        if kind == "el_nino":
            return "el_nino" if t.year == y0_now else "after_el_nino" if t.year == y0_now + 1 else "all"
        if kind == "la_nina":
            return "la_nina" if t.year == y0_now else "all"
        return "neutral"

    rows = []
    for i, t in enumerate(months):
        v = np.array([p[i] for p in per_event.values()], float)
        v = v[np.isfinite(v)]
        c = (cal_d or {}).get(ytype(t)) or (cal_d or {}).get("all")
        mean = float(v.mean()) if v.size else np.nan
        rows.append({"month": t.strftime("%Y-%m"), "rain_pct": _r(mean), "level": level_of(mean) or "normal",
                     "n": int(v.size),
                     "risk": {wn: (c[wn][t.month - 1] if c else 0) for wn in WATCHES},
                     "risk_years": c["years"] if c else 0})
    horizons = {}
    for h in (1, 3, 6, 12):
        tot = [float((p[:h] * w[:h]).sum() / w[:h].sum()) for p in per_event.values() if np.isfinite(p[:h]).all()]
        if tot:
            mean = float(np.mean(tot))
            lvl = level_of(mean)
            agree = sum((v < 90) if lvl in ("drier", "much_drier") else (v > 110) if lvl in ("wetter", "much_wetter")
                        else (85 <= v <= 115) for v in tot)
            horizons[str(h)] = {"rain_pct": _r(mean), "level": lvl, "agree": int(agree), "n": len(tot)}
        else:
            horizons[str(h)] = {"rain_pct": None, "level": "normal", "agree": 0, "n": 0}
        horizons[str(h)]["months"] = [months[0].strftime("%Y-%m"), months[h - 1].strftime("%Y-%m")]
    return {"start": months[0].strftime("%Y-%m"), "basis": kind if per_event else None,
            "years": sorted(per_event), "months": rows, "horizons": horizons,
            "normal_mm": [_r(v) for v in w],
            "events": {str(y): [_r(v) for v in p] for y, p in sorted(per_event.items())}}


LEVEL_RULE = {
    "source": "NASA GPM IMERG Late daily rain, averaged over each district, with NBRO's 24-hour rainfall steps (75, 100, 150 mm)",
    "1": "Yellow, be aware: 75 mm or more in the last day, or the district is on SlopeWatch or FloodWatch",
    "2": "Amber, be ready: 100 mm or more in the last day, or 75 mm on ground that is already soaked (a Watch is on)",
    "3": "Red, act now: 150 mm or more in the last day, or 100 mm on ground that is already soaked",
    "drought": "DryWatch is shown as Level 1 (save water)",
}


def risk_level(r1, watch, hill):
    """Daily risk level 0-3 from the last day's rain and whether the ground is already soaked."""
    wet = watch in ("SlopeWatch", "FloodWatch")
    r1 = r1 if _ok(r1) else 0.0
    lvl = 3 if (r1 >= 150 or (r1 >= 100 and wet)) else 2 if (r1 >= 100 or (r1 >= 75 and wet)) else 1 if (r1 >= 75 or wet) else 0
    if lvl == 0 and watch == "DryWatch":
        return 1, "drought"
    return lvl, (("landslide" if hill else "flood") if lvl else None)


def daily_levels(districts, rain1, rain3, wet3):
    """Today's level for every district, and a day-by-day replay of the Cyclone Ditwah week."""
    path = PROCESSED / "imerg_late_daily_days.csv"
    if not path.exists():
        return None
    days = pd.read_csv(path, parse_dates=["time"]).pivot_table(index="time", columns="district", values="value")
    days = days.dropna(how="all")
    last = days.index.max()
    for d, v in districts.items():
        if d not in days:
            continue
        r1, r3 = float(days[d].iloc[-1]), float(days[d].iloc[-3:].sum())
        lvl, hazard = risk_level(r1, v["watch"], v["hill"])
        v["level"] = {"level": lvl, "hazard": hazard, "rain_1d": _r(r1), "rain_3d": _r(r3), "day": last.strftime("%Y-%m-%d")}
    # replay: what the same rule showed each day of Ditwah, using the Watch of the month before (known at the time)
    replay = []
    prev = pd.Timestamp("2025-10-01")
    for t in pd.date_range("2025-11-24", "2025-11-29"):
        if t not in days.index or prev not in rain1.index:
            continue
        row = {"day": t.strftime("%Y-%m-%d"), "districts": {}}
        for d in districts:
            if d not in days or d not in rain1:
                continue
            w, _ = flag_for(d, rain1.at[prev, d], rain3.at[prev, d], wet3.at[prev, d], None, "rain3")
            lvl, _h = risk_level(days.at[t, d], w, districts[d]["hill"])
            if lvl:
                row["districts"][d] = {"level": lvl, "rain_mm": _r(days.at[t, d])}
        row["counts"] = {str(k): sum(1 for x in row["districts"].values() if x["level"] == k) for k in (1, 2, 3)}
        replay.append(row)
    counts = pd.Series([v.get("level", {}).get("level", 0) for v in districts.values()]).value_counts().to_dict()
    return {"rule": LEVEL_RULE, "day": last.strftime("%Y-%m-%d"), "counts": {str(k): int(n) for k, n in counts.items()},
            "ditwah_replay": replay, "bot": os.environ.get("BIOME_BOT") or "biomealertsbot"}


def _ok(x):
    return x is not None and not (isinstance(x, float) and math.isnan(x))


# ------------------------------------------------------------------ trust checks

def station_check(rain, rain_pct):
    st_p, sr_p = PROCESSED / "stations.csv", PROCESSED / "station_rain.csv"
    if not (st_p.exists() and sr_p.exists()):
        return []
    import shapely
    from districts import load_districts
    st = pd.read_csv(st_p)
    sr = pd.read_csv(sr_p, parse_dates=["time"])
    geoms = load_districts()
    out = []
    for s in st.itertuples():
        d = next((n for n, g in geoms.items() if shapely.contains_xy(g, s.lon, s.lat)), None)
        if d is None or d not in rain:
            continue
        g = sr[sr["id"] == s.id].set_index("time")["rain_mm"]
        both = pd.concat([g, rain[d]], axis=1, keys=["station", "sat"]).dropna()
        both = both[both.index.year >= 2001]
        if len(both) < 36:
            continue
        clim = both.groupby(both.index.month).transform("mean")
        anom = both - clim
        out.append({"station": s.name, "district": d, "months": int(len(both)),
                    "r_monthly": round(float(both["station"].corr(both["sat"])), 3),
                    "r_anomaly": round(float(anom["station"].corr(anom["sat"])), 3),
                    "bias_pct": round(float(100 * (both["sat"].sum() / both["station"].sum() - 1)), 1),
                    "from": both.index.min().strftime("%Y-%m"), "to": both.index.max().strftime("%Y-%m")})
    return sorted(out, key=lambda x: -x["months"])


def backtest(rain1, rain3, smp, wet3):
    """What Biome would have said for known disasters. 'month_of' uses the
    real-time rule (ground wetness from the rank of 3-month rain, because GLDAS
    is not out yet when the rain falls); 'gldas' repeats it with GLDAS soil."""
    out = []
    for ev in BACKTEST_EVENTS:
        t = pd.Timestamp(ev["date"] + "-01")
        before = t - pd.DateOffset(months=1)
        d = ev["district"]
        row = {**ev}
        for label, when in (("month_of", t), ("month_before", before)):
            if when in rain1.index and d in rain1 and _ok(rain1.at[when, d]):
                w, why = flag_for(d, rain1.at[when, d], rain3.at[when, d], wet3.at[when, d], None, "rain3")
                g = smp.at[when, d] if when in smp.index else np.nan
                wg, _ = flag_for(d, rain1.at[when, d], rain3.at[when, d], g)
                row[label] = {"watch": w, "reason": why, "rain_pct": _r(rain1.at[when, d]),
                              "rain3_pct": _r(rain3.at[when, d]), "wet_pct": _r(wet3.at[when, d]),
                              "gldas": {"watch": wg, "soil_pct": _r(g)}}
        row["caught"] = row.get("month_of", {}).get("watch") not in (None, "Clear")
        out.append(row)
    return out


def _r(x, n=1):
    return None if not _ok(x) else round(float(x), n)


# ------------------------------------------------------------------ reservoirs (supporting data)

def _num(s):
    return pd.to_numeric(s.astype(str).str.replace(",", "", regex=False).str.strip(), errors="coerce")


def reservoir_history():
    """Irrigation Department season sheets -> long table (reservoir, date, storage_acft).

    Maha sheet: one row per calendar day (dated in the current season) and one
    column per season (ES_20_21_Acft = Maha 2020/21). Yala sheet: one column
    per year. Days from September on belong to the season's first year.
    """
    rows = []
    for name in ("reservoirs_maha", "reservoirs_yala"):
        p = PROCESSED / f"{name}.csv"
        if not p.exists():
            continue
        df = pd.read_csv(p, dtype=str)
        date_col = next(c for c in df.columns if "DATE" in c.upper())
        res_col = next(c for c in df.columns if c.upper() == "RESERVOIR")
        day = pd.to_datetime(df[date_col], errors="coerce", format="mixed")
        for c in df.columns:
            cu = c.upper()
            if name.endswith("maha") and cu.startswith("ES_"):
                y1 = 2000 + int(cu.split("_")[1])
                years = np.where(day.dt.month >= 9, y1, y1 + 1)
            elif name.endswith("yala") and "EFFECTIVE" in cu and cu[-4:].isdigit():
                years = np.full(len(df), int(cu[-4:]))
            else:
                continue
            dates = pd.to_datetime(dict(year=years, month=day.dt.month, day=day.dt.day), errors="coerce")
            rows.append(pd.DataFrame({"reservoir": df[res_col].str.strip(), "date": dates,
                                      "storage_acft": _num(df[c]),
                                      "active_acft": _num(df[next(x for x in df.columns if "ACTIVE" in x.upper())])}))
    if not rows:
        return None
    h = pd.concat(rows).dropna(subset=["date", "storage_acft"])
    h = h[h["date"] <= pd.Timestamp.today()]
    return h.drop_duplicates(["reservoir", "date"])


def reservoirs(rain1):
    """Today's status per reservoir, its district, monthly history and its link to NASA rain."""
    p = PROCESSED / "reservoirs_today.csv"
    if not p.exists():
        return None
    import shapely
    from districts import load_districts
    geoms = load_districts()
    today = pd.read_csv(p, dtype=str)
    hist = reservoir_history()
    out = []
    for r in today.itertuples():
        lat, lon = float(r.Latitude), float(r.Longitude)
        d = next((n for n, g in geoms.items() if shapely.contains_xy(g, lon, lat)), None)
        active = float(_num(pd.Series([r.Active_Storage_Acft])).iloc[0] or np.nan)
        item = {"name": r.Reservoir.strip(), "district": d, "lat": round(lat, 4), "lon": round(lon, 4),
                "range": r.Range, "pct_full": _r(float(_num(pd.Series([r.Effective_Storage_per])).iloc[0])),
                "spilling": str(r.Spilling).strip().lower() == "yes",
                "spill_cusec": _r(float(_num(pd.Series([r.Spilling_Cusec])).iloc[0]), 0),
                "rain_yesterday_mm": _r(float(_num(pd.Series([r.Rainfall_Preceding_Day_mm])).iloc[0])),
                "date": r.Update_Date}
        if hist is not None and d in rain1:
            h = hist[hist["reservoir"].str.lower() == item["name"].lower()]
            if len(h) > 60 and active > 0:
                m = h.set_index("date")["storage_acft"].resample("MS").mean() / active * 100
                change = m.diff()
                both = pd.concat([change, rain1[d]], axis=1, keys=["change", "rain"]).dropna()
                item["history"] = {"months": [t.strftime("%Y-%m") for t in m.index],
                                   "pct_full": [_r(v) for v in m.values]}
                if len(both) >= 12:
                    item["r_rain_vs_storage_change"] = _r(both["change"].corr(both["rain"]), 2)
                    item["months_compared"] = int(len(both))
        out.append(item)
    rs = [x["r_rain_vs_storage_change"] for x in out if x.get("r_rain_vs_storage_change") is not None]
    return {"date": today["Update_Date"].iloc[0] if len(today) else None,
            "count": len(out), "spilling": sum(x["spilling"] for x in out),
            "median_r_rain_vs_storage": _r(float(np.median(rs)), 2) if rs else None,
            "items": out}


def river_gauges():
    """Latest reading per river gauge with its flood thresholds and location."""
    g_p, s_p = PROCESSED / "river_gauges_7d.csv", PROCESSED / "hydrostations.csv"
    if not (g_p.exists() and s_p.exists()):
        return None
    import shapely
    from districts import load_districts
    geoms = load_districts()
    g = pd.read_csv(g_p)
    g["CreationDate"] = pd.to_datetime(g["CreationDate"], errors="coerce", utc=True)
    st = pd.read_csv(s_p)
    latest = g.sort_values("CreationDate").groupby("gauge").tail(1)
    out = []
    for r in latest.itertuples():
        s = st[st["station"].astype(str).str.strip().str.lower() == str(r.gauge).strip().lower()]
        lat = float(s["latitude"].iloc[0]) if len(s) else None
        lon = float(s["longitude"].iloc[0]) if len(s) else None
        d = next((n for n, gm in geoms.items() if lat and shapely.contains_xy(gm, lon, lat)), None)
        lvl = r.water_level
        status = ("major flood" if lvl >= r.majorpull else "minor flood" if lvl >= r.minorpull
                  else "alert" if lvl >= r.alertpull else "normal")
        out.append({"gauge": r.gauge, "basin": r.basin, "district": d, "lat": lat, "lon": lon,
                    "level_m": _r(lvl, 2), "alert_m": _r(r.alertpull, 2), "minor_m": _r(r.minorpull, 2),
                    "major_m": _r(r.majorpull, 2), "status": status,
                    "time": r.CreationDate.tz_convert("Asia/Colombo").strftime("%Y-%m-%d %H:%M")})
    return {"latest": max(x["time"] for x in out) if out else None, "items": out}


# ------------------------------------------------------------------ risk calendar

PROVINCES = {
    "Western": ["Colombo", "Gampaha", "Kalutara"],
    "Central": ["Kandy", "Matale", "Nuwara Eliya"],
    "Southern": ["Galle", "Matara", "Hambantota"],
    "Northern": ["Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu"],
    "Eastern": ["Batticaloa", "Ampara", "Trincomalee"],
    "North Western": ["Kurunegala", "Puttalam"],
    "North Central": ["Anuradhapura", "Polonnaruwa"],
    "Uva": ["Badulla", "Monaragala"],
    "Sabaragamuwa": ["Ratnapura", "Kegalle"],
}
WATCHES = ["DryWatch", "FloodWatch", "SlopeWatch"]


def year_types(el_ninos, la_ninas, years):
    """Label each calendar year: el_nino (building), after_el_nino, la_nina, neutral."""
    t = {y: "neutral" for y in years}
    for e in la_ninas:
        t[e["year0"]] = "la_nina"
    for e in el_ninos:
        if e["year0"] in t:
            t[e["year0"]] = "el_nino"
        if e["year0"] + 1 in t:
            t[e["year0"] + 1] = "after_el_nino"
    return t


def risk_calendar(rain1, rain3, smp, types):
    """How many years each Watch was on, per place and calendar month.

    Returns {"district": {...}, "province": {...}, "country": {...}}; each place
    maps year type ("all" plus each type) -> {watch: [count Jan..Dec], "years": n}.
    A province or the country counts a year when any of its districts was on watch.
    """
    years = sorted(set(rain1.index.year) & set(types))
    flags = {}  # (district, year, month) -> watch
    for d in rain1.columns:
        for y in years:
            for m in range(1, 13):
                t = pd.Timestamp(y, m, 1)
                if t not in rain1.index or t not in smp.index:
                    continue
                w, _ = flag_for(d, rain1.at[t, d], rain3.at[t, d], smp.at[t, d])
                if _ok(rain1.at[t, d]) and _ok(smp.at[t, d]):
                    flags[(d, y, m)] = w
    places = {"district": {d: [d] for d in rain1.columns},
              "province": {p: [d for d in ds if d in rain1.columns] for p, ds in PROVINCES.items()},
              "country": {"Sri Lanka": list(rain1.columns)}}
    out = {}
    for level, groups in places.items():
        out[level] = {}
        for name, members in groups.items():
            res = {}
            for ytype in ["all", "el_nino", "after_el_nino", "la_nina", "neutral"]:
                ys = [y for y in years if ytype == "all" or types[y] == ytype]
                counts = {w: [0] * 12 for w in WATCHES}
                n_years = 0
                for y in ys:
                    seen = any((d, y, m) in flags for d in members for m in range(1, 13))
                    if not seen:
                        continue
                    n_years += 1
                    for m in range(1, 13):
                        on = {flags.get((d, y, m)) for d in members}
                        for w in WATCHES:
                            counts[w][m - 1] += int(w in on)
                res[ytype] = {**counts, "years": n_years}
            out[level][name] = res
    return out


# ------------------------------------------------------------------ main

def main():
    rain, rain_source, partial = load_rain()
    rnorm = normal_of(rain)
    rain1 = pct_of_normal(rain, rnorm)
    rain3 = rolling_pct(rain, rnorm, 3)

    soil = fill_from_neighbour(wide("gldas", "RootMoist_inst"), "gldas_soil", list(rain.columns))
    wet3 = percentile_of(rain3)  # ground-wetness stand-in while GLDAS catches up
    smp = percentile_of(soil) if soil is not None else pd.DataFrame(index=rain.index, columns=rain.columns)

    ndvi = fill_from_neighbour(wide("modis_ndvi", "ndvi"), "modis_ndvi", list(rain.columns))
    ndvi_anom = ndvi - normal_of(ndvi).reindex(ndvi.index.month).set_index(ndvi.index) if ndvi is not None else None

    # MERRA-2 for the El Ninos before the satellite era, against its own 1981-2010 normal
    m_rain = wide("merra2_flx", "rain_mm")
    m_pct = pct_of_normal(m_rain, normal_of(m_rain, 1981, 2010)) if m_rain is not None else None
    m_soil = fill_from_neighbour(wide("merra2_lnd", "GWETROOT"), "merra2_soil", list(rain.columns))
    m_smp = percentile_of(m_soil, 1981, 2010) if m_soil is not None else None

    events, oni = el_nino_events(kind="el_nino")
    ln_events, _ = el_nino_events(kind="la_nina")
    strong = [e for e in events if e["strength"] in ("strong", "very strong") and not e["ongoing"]]
    la_nina = [e for e in ln_events if e["strength"] != "weak" and not e["ongoing"]]
    current = next((e for e in events + ln_events if e["ongoing"]), None)

    sources_rain = [(rain1, 2001, 2100), (m_pct, 1980, 2000)]
    sources_soil = [(smp, 2001, 2100), (m_smp, 1980, 2000)]
    rain_prof, rain_events = profile(sources_rain, strong)
    soil_prof, _ = profile(sources_soil, strong)
    ln_rain_prof, ln_used = profile(sources_rain, la_nina)
    ln_soil_prof, _ = profile(sources_soil, la_nina)
    # show the profile of this year's type; El Nino if the year is neutral
    if current and current["kind"] == "la_nina" and ln_rain_prof is not None:
        main_rain, main_soil, main_label = ln_rain_prof, ln_soil_prof, "la_nina"
    else:
        main_rain, main_soil, main_label = rain_prof, soil_prof, "el_nino"

    # one combined rain-% table for significance: MERRA-2 before 2001, IMERG after
    rain_all = (pd.concat([m_pct[m_pct.index.year < 2001], rain1[rain1.index.year >= 2001]])
                if m_pct is not None else rain1)
    sig = season_significance(rain_all, [e["year0"] for e in strong])

    tr_rain = trends(rain, "rain_mm")
    tr_soil = trends(soil, "root_zone_soil_moisture") if soil is not None else {}

    y0_now = current["year0"] if current else pd.Timestamp.today().year
    latest = rain1.index.max()
    lag_now = (latest.year - y0_now) * 12 + latest.month - 1

    def last_value(df, d, upto, max_lag=3):
        """Most recent value at or before `upto`, within max_lag months (soil and NDVI lag rain)."""
        if df is None or d not in df:
            return np.nan, None
        s = df[d].loc[:upto].dropna()
        if s.empty or (upto.year - s.index[-1].year) * 12 + upto.month - s.index[-1].month > max_lag:
            return np.nan, None
        return s.iloc[-1], s.index[-1].strftime("%Y-%m")

    districts = {}
    for d in rain.columns:
        sm_now, sm_month = last_value(smp, d, latest, max_lag=1)
        wet_src = "soil"
        if not _ok(sm_now):  # GLDAS is months behind: use the rank of 3-month rain
            sm_now, sm_month, wet_src = wet3.at[latest, d], latest.strftime("%Y-%m"), "rain3"
        gl_now, gl_month = last_value(smp, d, latest, max_lag=6)
        nd_now, _ = last_value(ndvi_anom, d, latest)
        watch, why = flag_for(d, rain1.at[latest, d], rain3.at[latest, d], sm_now, nd_now, wet_src)
        flag_month = latest.strftime("%Y-%m")

        # the month in progress (IMERG Late, first N days), if at least a week is in
        so_far = None
        if partial is not None and partial["days"] >= 7:
            pm = partial["month"]
            p1 = 100 * partial["rain_mm"][d] / rnorm.at[pm.month, d]
            prev2 = rain[d].iloc[-2:].sum() + partial["rain_mm"][d]
            normal3 = sum(rnorm.at[(pm - pd.DateOffset(months=k)).month, d] for k in range(3))
            p3 = 100 * prev2 / normal3
            hist = rain3[rain3.index.month == pm.month][d]
            hist = hist[(hist.index.year >= CLIM_START) & (hist.index.year <= CLIM_END)].dropna().values
            w3 = 100 * np.searchsorted(np.sort(hist), p3, side="right") / hist.size if hist.size else np.nan
            w2, why2 = flag_for(d, p1, p3, w3, nd_now, "rain3")
            sm_now, sm_month, wet_src = w3, pm.strftime("%Y-%m"), "rain3"
            so_far = {"month": pm.strftime("%Y-%m"), "days": partial["days"], "rain_pct": _r(p1),
                      "rain3_pct": _r(p3), "wet_pct": _r(w3), "watch": w2, "reason": why2}
            watch, why, flag_month = w2, why2, pm.strftime("%Y-%m")

        nxt = None
        if main_rain is not None and 0 <= lag_now < LAGS - 1:
            ahead = list(range(lag_now + 1, min(lag_now + 4, LAGS)))
            vals = main_rain["mean"].loc[ahead, d]
            nxt = {"months": [LAG_LABELS[i] for i in ahead], "lags": ahead, "rain_pct": _r(vals.mean()),
                   "text": (f"In past strong El Ninos, the next {len(ahead)} months here brought "
                            f"{vals.mean():.0f}% of normal rain")}

        def prof_json(rp, sp):
            if rp is None:
                return None
            return {"rain_pct": {k: [_r(v) for v in rp[k][d]] for k in ("mean", "min", "max")},
                    "soil_pct": None if sp is None else {k: [_r(v) for v in sp[k][d]] for k in ("mean", "min", "max")},
                    "events": {str(y): [_r(v) for v in p[d]] for y, p in rp["paths"].items()}}

        last24 = rain1.index[-24:]
        districts[d] = {
            "hill": d in HILL_DISTRICTS, "terrain": TERRAIN.get("districts", {}).get(d),
            "watch": watch, "reason": why, "flag_month": flag_month, "next": nxt,
            "now": {"month": latest.strftime("%Y-%m"), "source": rain_source.get(latest, "IMERG Final"),
                    "rain_mm": _r(rain.at[latest, d]), "rain_pct": _r(rain1.at[latest, d]),
                    "rain3_pct": _r(rain3.at[latest, d]), "soil_pct": _r(gl_now), "soil_month": gl_month,
                    "wet_pct": _r(sm_now), "wet_source": wet_src,
                    "ndvi_anom": _r(nd_now, 3)},
            "so_far": so_far,
            "flag_values": {"rain_pct": _r(so_far["rain_pct"] if so_far else rain1.at[latest, d]),
                            "rain3_pct": _r(so_far["rain3_pct"] if so_far else rain3.at[latest, d]),
                            "soil_pct": _r(sm_now), "wet_source": wet_src, "ndvi_anom": _r(nd_now, 3)},
            "profile": prof_json(main_rain, main_soil),
            "profiles": {"el_nino": prof_json(rain_prof, soil_prof), "la_nina": prof_json(ln_rain_prof, ln_soil_prof)},
            "this_event": {"rain_pct": [_r(v) for v in window(rain1, y0_now)[d]],
                           "soil_pct": [_r(v) for v in window(smp, y0_now)[d]]},
            "recent": {"months": [t.strftime("%Y-%m") for t in last24],
                       "rain_pct": [_r(v) for v in rain1.loc[last24, d]],
                       "soil_pct": [_r(smp.at[t, d]) if t in smp.index else None for t in last24]},
            "normal_rain_mm": [_r(v) for v in rnorm[d]],
            "significance": {s: v.get(d) for s, v in sig.items()},
            "trend": {"rain": tr_rain.get(d), "soil": tr_soil.get(d)},
        }

    # risk calendar over the longest record: MERRA-2 for 1981-2000, NASA satellites from 2001
    if m_rain is not None and m_smp is not None:
        m_norm = normal_of(m_rain, 1981, 2010)
        m_rain3 = rolling_pct(m_rain, m_norm, 3)
        cut = lambda a, b: pd.concat([a[(a.index.year >= 1981) & (a.index.year < 2001)], b[b.index.year >= 2001]])
        cal_r1, cal_r3, cal_sm = cut(m_pct, rain1), cut(m_rain3, rain3), cut(m_smp, smp)
    else:
        cal_r1, cal_r3, cal_sm = rain1, rain3, smp
    full_years = [y for y in sorted(set(cal_r1.index.year)) if (cal_r1.index.year == y).sum() == 12 and y <= CLIM_END]
    types = year_types([e for e in events if e["strength"] in ("strong", "very strong")], la_nina, full_years)
    calendar = risk_calendar(cal_r1, cal_r3, cal_sm, types)

    # plain-language outlook for the next 12 months, from past years of the same kind
    kind_now = current["kind"] if current else None
    analog = (ln_used if kind_now == "la_nina" else rain_events) if kind_now else []
    first_flag = next(iter(districts.values()))["flag_month"]
    start = pd.Timestamp(first_flag + "-01") + pd.DateOffset(months=1)
    for d in districts:
        districts[d]["outlook"] = outlook(d, rain_all, rnorm, analog, y0_now, start,
                                          calendar["district"].get(d), kind_now)

    levels = _safe(daily_levels, districts, rain1, rain3, wet3)

    # ensemble outlook model: chance of each Watch for every month of the coming year
    import forecast as fc
    prev = {}
    for d in districts:
        sf = districts[d]["so_far"]
        last = [rain1[d].iloc[-2], rain1[d].iloc[-1]] if not sf else [rain1[d].iloc[-1], sf["rain_pct"]]
        prev[d] = [float(v) if _ok(v) else 100.0 for v in last]
    forecast = _safe(fc.build, rain_all, oni, start, rnorm, rain3, prev, flag_for, HILL_DISTRICTS, PROVINCES)

    counts = pd.Series([v["watch"] for v in districts.values()]).value_counts().to_dict()
    out = {
        "meta": {
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "latest_month": latest.strftime("%Y-%m"),
            "latest_source": rain_source.get(latest, "IMERG Final"),
            "normal_period": f"{CLIM_START}-{CLIM_END}",
            "lag_labels": LAG_LABELS, "lag_now": int(lag_now),
            "rules": RULES, "watch_counts": counts, "gap_fills": GAP_FILLS,
            "hill_rule": {"source": TERRAIN.get("source"), "steep_degrees": TERRAIN.get("steep_degrees"),
                          "min_share": HILL_STEEP_SHARE, "districts": sorted(HILL_DISTRICTS)},
            "data_ranges": {k: _range(v) for k, v in
                            {"rain": rain, "soil": soil, "ndvi": ndvi, "merra2_rain": m_rain}.items()},
        },
        "el_nino": {"events": events, "la_nina_events": ln_events, "strong_used": rain_events,
                    "la_nina_used": ln_used, "current": current, "profile_shown": main_label,
                    "oni_recent": [{"month": t.strftime("%Y-%m"), "oni": float(v)} for t, v in oni.iloc[-24:].items()]},
        "districts": districts,
        "calendar": {"years": [full_years[0], full_years[-1]] if full_years else None,
                     "year_types": {str(y): t for y, t in types.items()},
                     "provinces": PROVINCES, **calendar},
        "levels": levels,
        "forecast": forecast,
        "reservoirs": _safe(reservoirs, rain1),
        "rivers": _safe(river_gauges),
        "validation": {"stations": station_check(rain, rain1)},
        "backtest": backtest(rain1, rain3, smp, wet3),
    }
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    path = WEB_DATA / "biome.json"
    path.write_text(json.dumps(out, separators=(",", ":"), allow_nan=False, default=_json_default))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB), latest month {latest:%Y-%m}")
    print("watch counts:", counts)
    return out


def _safe(fn, *args):
    """Supporting data must never stop the NASA analysis from publishing."""
    try:
        return fn(*args)
    except Exception as e:  # noqa: BLE001
        print(f"warning: {fn.__name__} skipped: {e}")
        return None


def _range(df):
    if df is None or df.empty:
        return None
    return [df.index.min().strftime("%Y-%m"), df.index.max().strftime("%Y-%m")]


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return str(o)


if __name__ == "__main__":
    main()
