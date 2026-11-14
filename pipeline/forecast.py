"""Seasonal outlook model: a weighted analog ensemble for the next 12 months in every district.

How it works, in plain words:
1. The predictor is the state of the Pacific Ocean now: the latest NOAA Oceanic
   Nino Index (ONI).
2. Every past year since 1980 is one possible future (an ensemble member): the
   rain that really fell in each district over the same 12 calendar months that
   followed (NASA MERRA-2 before 2001, NASA GPM IMERG after).
3. Members are weighted by how close their ocean state was to today's (a
   Gaussian kernel on ONI). Years like this one count most; unlike years count
   little. The kernel width is chosen by cross-validation, not by hand.
4. The Watch rules are applied to every member. The weighted share of members on
   a Watch is the chance shown in the risk calendar.
5. Skill is measured by leaving each past year out, forecasting it from the
   others and scoring the forecast against what happened (ranked probability
   skill score against equal odds). Months without skill are labelled "no clear
   signal" instead of being given a confident number.

This is a statistical outlook, not a weather forecast.
"""
import numpy as np
import pandas as pd

WATCHES = ["DryWatch", "FloodWatch", "SlopeWatch"]
WIDTHS = [0.5, 0.75, 1.0, 1.5]


def _targets(pct, start, issue, years):
    """Table (year x 12 leads) of rain % for the 12 months from `start`, for each issue year."""
    months = pd.date_range(start, periods=12, freq="MS")
    shift = [(t.year - issue.year, t.month) for t in months]
    out = np.full((len(years), 12), np.nan)
    for r, y in enumerate(years):
        for i, (dy, m) in enumerate(shift):
            ts = pd.Timestamp(y + dy, m, 1)
            if ts in pct.index:
                out[r, i] = pct.at[ts]
    return out


def _weights(x, x0, h):
    w = np.exp(-0.5 * ((x - x0) / h) ** 2)
    return w / w.sum()


def _hindcast(Y, x, h, select=None):
    """Leave-one-year-out score. Y is district x year x lead. Returns per lead:
    ranked probability skill score against equal odds, hit rate of the most
    likely tercile, and the number of year-district cases."""
    rps, ref, hit, n = np.zeros(12), np.zeros(12), np.zeros(12), np.zeros(12)
    ks = range(len(x)) if select is None else select
    cum_ref = np.cumsum([1 / 3] * 3)
    for di in range(Y.shape[0]):
        for i in range(12):
            y = Y[di, :, i]
            ok = np.isfinite(y)
            for k in ks:
                if not ok[k]:
                    continue
                keep = ok.copy()
                keep[k] = False
                lo, hi = np.percentile(y[keep], [33.3, 66.7])
                w = _weights(x[keep], x[k], h)
                yy = y[keep]
                p = np.array([w[yy < lo].sum(), w[(yy >= lo) & (yy <= hi)].sum(), w[yy > hi].sum()])
                o = np.array([y[k] < lo, lo <= y[k] <= hi, y[k] > hi], float)
                rps[i] += ((np.cumsum(p) - np.cumsum(o)) ** 2).sum()
                ref[i] += ((cum_ref - np.cumsum(o)) ** 2).sum()
                hit[i] += p.argmax() == o.argmax()
                n[i] += 1
    with np.errstate(all="ignore"):
        return 1 - rps / ref, hit / n, n


def _wq(v, w, q):
    """Weighted quantile."""
    o = np.argsort(v)
    c = np.cumsum(w[o])
    return float(v[o][min(np.searchsorted(c, q * c[-1]), len(v) - 1)])


def build(rain_pct, oni, start, rnorm, rain3_hist, prev_pct, flag_for, hill, provinces):
    """Return the forecast block for biome.json.

    rain_pct   monthly rain as % of normal, long record (DataFrame time x district)
    oni        monthly ONI (Series)
    start      first month to forecast (Timestamp)
    rnorm      normal rain in mm (DataFrame calendar month x district)
    rain3_hist 3-month rain as % of normal over the satellite era (for wetness ranks)
    prev_pct   {district: [rain % two months before start, rain % one month before start]}
    """
    issue = oni.dropna().index.max()
    x_now = float(oni.loc[issue])
    years = [y for y in sorted(set(rain_pct.index.year)) if pd.Timestamp(y, issue.month, 1) in oni.index and y < issue.year]
    x = np.array([oni.loc[pd.Timestamp(y, issue.month, 1)] for y in years], float)
    months = pd.date_range(start, periods=12, freq="MS")
    cal = [t.month for t in months]
    names = list(rain_pct.columns)
    Y = np.stack([_targets(rain_pct[d], start, issue, years) for d in names])   # district x year x lead

    # kernel width by cross-validation over all years
    scores = {h: float(np.nanmean(_hindcast(Y, x, h)[0])) for h in WIDTHS}
    h = max(scores, key=scores.get)
    rpss_all, hit_all, _ = _hindcast(Y, x, h)
    # skill in years of the same kind as this one: where the forecast is meant to be used
    if x_now >= 1.4:
        kind, sel = "strong El Nino years", [k for k, v in enumerate(x) if v >= 1.4]
    elif x_now <= -1.0:
        kind, sel = "La Nina years", [k for k, v in enumerate(x) if v <= -1.0]
    else:
        kind, sel = "all years", list(range(len(x)))
    rpss_kind, hit_kind, n_kind = _hindcast(Y, x, h, sel)
    signal = [bool(np.isfinite(r) and r >= 0.05) for r in rpss_kind]

    full = np.isfinite(Y).all(axis=(0, 2))
    myears = [y for y, f in zip(years, full) if f]
    w = _weights(x[full], x_now, h)
    out_d, member_watch = {}, {}
    for di, d in enumerate(names):
        members = Y[di][full]                                   # member x lead
        norm = np.array([rnorm.at[m, d] for m in cal], float)
        prev_t = [start - pd.DateOffset(months=2), start - pd.DateOffset(months=1)]
        prev_norm = np.array([rnorm.at[t.month, d] for t in prev_t], float)
        pp = np.array(prev_pct.get(d, [100, 100]), float)
        pp = np.where(np.isfinite(pp), pp, 100)
        mm = np.hstack([np.tile(pp * prev_norm / 100, (len(members), 1)), members * norm / 100])
        nn = np.concatenate([prev_norm, norm])
        r3 = np.stack([100 * mm[:, i:i + 3].sum(axis=1) / nn[i:i + 3].sum() for i in range(12)], axis=1)
        hist = {m: np.sort(rain3_hist[d][rain3_hist.index.month == m].dropna().values) for m in set(cal)}
        wet = np.stack([100 * np.searchsorted(hist[m], r3[:, i], side="right") / max(hist[m].size, 1)
                        for i, m in enumerate(cal)], axis=1)
        flags = np.empty(members.shape, dtype=object)
        for k in range(members.shape[0]):
            for i in range(12):
                flags[k, i] = flag_for(d, members[k, i], r3[k, i], wet[k, i], None, "rain3")[0]
        member_watch[d] = flags
        out_d[d] = {
            "median": [round(_wq(members[:, i], w, 0.5)) for i in range(12)],
            "lo": [round(_wq(members[:, i], w, 0.1)) for i in range(12)],
            "hi": [round(_wq(members[:, i], w, 0.9)) for i in range(12)],
            "p_dry": [round(float(w[members[:, i] < 85].sum()), 2) for i in range(12)],
            "p_wet": [round(float(w[members[:, i] > 115].sum()), 2) for i in range(12)],
            "watch": {wn: [round(float(w[flags[:, i] == wn].sum()), 2) for i in range(12)] for wn in WATCHES},
            "members": [[int(round(v)) for v in row] for row in members],
            "normal_mm": [round(float(v), 1) for v in norm],
        }

    def group(group_names):
        group_names = [n for n in group_names if n in member_watch]
        res = {}
        for wn in WATCHES:
            res[wn] = []
            for i in range(12):
                on = np.any(np.stack([member_watch[n][:, i] == wn for n in group_names]), axis=0) if group_names else np.zeros(len(w), bool)
                res[wn].append(round(float(w[on].sum()), 2))
        return {"watch": res}

    rnd = lambda a: [None if not np.isfinite(v) else round(float(v), 2) for v in a]
    top = np.argsort(-w)[:8]
    return {
        "issue_month": issue.strftime("%Y-%m"), "oni": round(x_now, 2),
        "months": [t.strftime("%Y-%m") for t in months],
        "train_years": [years[0], years[-1]], "member_years": myears, "weights": [round(float(v), 4) for v in w],
        "kernel_width": h, "width_scores": {str(k): round(v, 4) for k, v in scores.items()},
        "effective_members": round(float(1 / (w ** 2).sum()), 1),
        "closest_years": [{"year": int(myears[k]), "weight": round(float(w[k]), 2)} for k in top],
        "skill": {"all_years": {"rpss": rnd(rpss_all), "hit_rate": rnd(hit_all)},
                  "like_this_year": {"kind": kind, "years": [int(years[k]) for k in sel], "rpss": rnd(rpss_kind),
                                     "hit_rate": rnd(hit_kind), "cases": int(n_kind.max())},
                  "chance_hit_rate": 0.33, "signal": signal},
        "district": out_d,
        "province": {p: group(ds) for p, ds in provinces.items()},
        "country": {"Sri Lanka": group(names)},
    }
