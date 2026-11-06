"""Pull CMIP6 monthly near-surface air temperature (tas, Amon) from the public
Google Cloud bucket and reduce it to small per-(model, experiment) caches:

  city   : annual-mean tas at each city (bilinear interpolation of the model grid)
  glob   : annual-mean area-weighted global-mean tas
  grid   : annual-mean tas regridded to a common 2.5-degree grid, averaged by decade
           (historical: one 1995-2014 baseline field instead)

Run:  .venv/bin/python prep/fetch.py
"""
import os, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
import xarray as xr

sys.path.insert(0, os.path.dirname(__file__))
from cities import CITIES

HERE = os.path.dirname(__file__)
CACHE = os.path.join(HERE, "cache")
os.makedirs(CACHE, exist_ok=True)

MODELS = ["ACCESS-CM2", "CanESM5", "CMCC-ESM2", "GFDL-ESM4", "IPSL-CM6A-LR",
          "MIROC6", "MPI-ESM1-2-LR", "MRI-ESM2-0", "NorESM2-LM"]
EXPS = ["historical", "ssp126", "ssp245", "ssp370", "ssp585"]
MEMBER = "r1i1p1f1"

TLAT = np.arange(-88.75, 90, 2.5)
TLON = np.arange(1.25, 360, 2.5)
DECADES = list(range(2020, 2100, 10))  # 2020s .. 2090s

cat = pd.read_csv(os.path.join(HERE, "catalog.csv"))
cat = cat[(cat.table_id == "Amon") & (cat.variable_id == "tas") & (cat.member_id == MEMBER)]


def store(model, exp):
    rows = cat[(cat.source_id == model) & (cat.experiment_id == exp)].sort_values("version")
    if rows.empty:
        raise RuntimeError(f"no store for {model} {exp}")
    return rows.zstore.iloc[-1]  # newest version


def wrap_lon(da):
    """Normalise lon to [0, 360) and pad one column on each side so linear
    interpolation works across the dateline / prime meridian."""
    da = da.assign_coords(lon=(da.lon % 360)).sortby("lon")
    left = da.isel(lon=-1).assign_coords(lon=da.lon[-1].item() - 360)
    right = da.isel(lon=0).assign_coords(lon=da.lon[0].item() + 360)
    return xr.concat([left, da, right], dim="lon")


def run(model, exp):
    out = os.path.join(CACHE, f"{model}_{exp}.npz")
    if os.path.exists(out):
        return out, "cached"
    ds = xr.open_zarr(store(model, exp), consolidated=True,
                      storage_options={"token": "anon"}, decode_times=xr.coders.CFDatetimeCoder(use_cftime=True))
    tas = ds["tas"]
    if "height" in tas.coords:
        tas = tas.drop_vars("height")
    tas = tas.drop_duplicates("time").sortby("time")  # some stores have overlapping chunks
    years = (1950, 2014) if exp == "historical" else (2015, 2100)
    tas = tas.sel(time=slice(f"{years[0]}-01-01", f"{years[1]}-12-31"))
    ann = tas.groupby("time.year").mean("time").load() - 273.15  # degC
    ann = ann.where(ann.year <= years[1], drop=True)

    w = np.cos(np.deg2rad(ann.lat))
    glob = ann.weighted(w).mean(("lat", "lon")).values

    wr = wrap_lon(ann)
    lats = xr.DataArray([c[2] for c in CITIES], dims="city")
    lons = xr.DataArray([c[3] % 360 for c in CITIES], dims="city")
    city = wr.interp(lat=lats, lon=lons).transpose("city", "year").values

    g = wr.interp(lat=TLAT, lon=TLON)
    g = g.ffill("lat").bfill("lat")  # polar rows outside the model's lat range
    if exp == "historical":
        grid = g.sel(year=slice(1995, 2014)).mean("year").values[None]
    else:
        grid = np.stack([g.sel(year=slice(d, d + 9)).mean("year").values for d in DECADES])

    np.savez_compressed(out, years=ann.year.values, city=city.astype("f4"),
                        glob=glob.astype("f4"), grid=grid.astype("f4"))
    return out, "ok"


if __name__ == "__main__":
    jobs = [(m, e) for m in MODELS for e in EXPS]
    with ThreadPoolExecutor(6) as ex:
        futs = {ex.submit(run, m, e): (m, e) for m, e in jobs}
        for f in as_completed(futs):
            m, e = futs[f]
            try:
                print(m, e, f.result()[1], flush=True)
            except Exception as err:  # keep going; report at the end
                print(m, e, "FAILED", repr(err)[:300], flush=True)
