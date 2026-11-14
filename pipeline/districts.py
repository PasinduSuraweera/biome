"""District geometry: turn any lat/lon grid into 25 district averages.

Each grid cell is split into sub-points; a district's weight for a cell is the
share of those sub-points that fall inside the district. This handles coarse
grids (MERRA-2 cells are bigger than some districts) and fine grids alike.
"""
import json
from functools import lru_cache

import numpy as np
import shapely
from shapely.geometry import shape

from config import DISTRICTS_GEOJSON, TOWNS_GEOJSON

UNITS = "districts"   # set to "towns" to average over Divisional Secretariat divisions instead
_WEIGHTS = {}


@lru_cache(maxsize=1)
def load_districts():
    """Return {name: shapely geometry}, names without the word 'District'."""
    gj = json.loads(DISTRICTS_GEOJSON.read_text())
    out = {}
    for f in gj["features"]:
        name = f["properties"]["shapeName"].replace(" District", "").strip()
        out[name] = shapely.make_valid(shape(f["geometry"]))
    return dict(sorted(out.items()))


@lru_cache(maxsize=1)
def load_towns():
    """Return {"District|Division": shapely geometry} for the town level."""
    gj = json.loads(TOWNS_GEOJSON.read_text())
    return {f["properties"]["key"]: shapely.make_valid(shape(f["geometry"])) for f in gj["features"]}


def load_units():
    return load_towns() if UNITS == "towns" else load_districts()


def district_weights(lats, lons, sub=6):
    """Weights {district: 2-D array (lat, lon)} that each sum to 1.

    lats, lons are 1-D cell-centre coordinates of a regular grid.
    """
    lats = np.asarray(lats, dtype=float)
    lons = np.asarray(lons, dtype=float)
    sig = (UNITS, lats.size, lons.size, float(lats[0]), float(lats[-1]), float(lons[0]), float(lons[-1]), sub)
    if sig in _WEIGHTS:  # every file of a dataset shares one grid
        return _WEIGHTS[sig]
    dlat = abs(lats[1] - lats[0]) if lats.size > 1 else 0.1
    dlon = abs(lons[1] - lons[0]) if lons.size > 1 else 0.1
    offs = (np.arange(sub) + 0.5) / sub - 0.5
    # sub-points for every cell: shape (nlat, nlon, sub, sub)
    la = lats[:, None, None, None] + offs[None, None, :, None] * dlat
    lo = lons[None, :, None, None] + offs[None, None, None, :] * dlon
    la, lo = np.broadcast_arrays(la, lo)
    # weight by cos(lat) so cells keep their true area
    area = np.cos(np.deg2rad(lats))[:, None]
    weights = {}
    for name, geom in load_units().items():
        minx, miny, maxx, maxy = geom.bounds
        frac = np.zeros((lats.size, lons.size))
        ii = np.where((lats >= miny - dlat) & (lats <= maxy + dlat))[0]
        jj = np.where((lons >= minx - dlon) & (lons <= maxx + dlon))[0]
        if ii.size and jj.size:
            sl = np.ix_(ii, jj)
            inside = shapely.contains_xy(geom, lo[sl].ravel(), la[sl].ravel()).reshape(la[sl].shape)
            frac[sl] = inside.mean(axis=(2, 3)) * area[ii]
        total = frac.sum()
        if total > 0:
            weights[name] = frac / total
        elif UNITS == "towns":  # smaller than the sampling: use the cell that holds it
            p = geom.representative_point()
            frac[np.abs(lats - p.y).argmin(), np.abs(lons - p.x).argmin()] = 1.0
            weights[name] = frac
    _WEIGHTS[sig] = weights
    return weights


def district_means(da, lat="lat", lon="lon"):
    """Area-weighted district means of an xarray DataArray with lat/lon dims.

    Returns a pandas DataFrame indexed by the remaining dimension (usually
    time), one column per district. Missing cells (NaN) are ignored and the
    weights renormalised, so cloud gaps in MODIS do not bias the average.
    """
    import pandas as pd

    da = da.transpose(..., lat, lon)
    w = district_weights(da[lat].values, da[lon].values)
    vals = da.values.astype(float)  # (..., nlat, nlon)
    flat = vals.reshape(-1, vals.shape[-2], vals.shape[-1])
    cols = {}
    for name, wt in w.items():
        valid = ~np.isnan(flat)
        num = np.nansum(np.where(valid, flat, 0) * wt, axis=(1, 2))
        den = np.sum(valid * wt, axis=(1, 2))
        with np.errstate(invalid="ignore", divide="ignore"):
            cols[name] = np.where(den > 0.5, num / den, np.nan)
    other = [d for d in da.dims if d not in (lat, lon)]
    index = da[other[0]].to_index() if other else pd.RangeIndex(1)
    return pd.DataFrame(cols, index=index)
