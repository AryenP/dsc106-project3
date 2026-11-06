"""Combine the per-(model, experiment) caches from fetch.py into the two static
files the web page loads.

Transformations (also described on the page):
  1. Anomaly: each model's tas minus THAT model's own 1995-2014 mean at the same
     place. This removes each model's fixed warm/cold bias so models can be pooled.
  2. Historical (1950-2014) is joined to each scenario (2015-2100) per model.
  3. Line series: 9-year centred running mean per model (window shrinks at the
     ends), then ensemble median and min/max across the 9 models.
  4. Map / ranking: decade mean (2020s..2090s) of the unsmoothed anomaly per
     model, then ensemble median (and min/max for cities).

Run:  .venv/bin/python prep/build.py
"""
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from cities import CITIES
from fetch import MODELS, CACHE, TLAT, TLON, DECADES

SCEN = ["ssp126", "ssp245", "ssp370", "ssp585"]
ROOT = os.path.join(os.path.dirname(__file__), "..")
YEARS = np.arange(1950, 2101)

REGION = {  # coarse grouping for the region filter
    "USA": "North America", "Canada": "North America", "Mexico": "North America", "Cuba": "North America",
    "Colombia": "South America", "Peru": "South America", "Brazil": "South America",
    "Argentina": "South America", "Chile": "South America",
    "Iceland": "Europe", "UK": "Europe", "France": "Europe", "Spain": "Europe", "Italy": "Europe",
    "Germany": "Europe", "Sweden": "Europe", "Poland": "Europe", "Greece": "Europe", "Türkiye": "Europe",
    "Egypt": "Africa", "Nigeria": "Africa", "DR Congo": "Africa", "Kenya": "Africa", "Ethiopia": "Africa",
    "South Africa": "Africa", "Morocco": "Africa", "Senegal": "Africa",
    "Saudi Arabia": "West & South Asia", "UAE": "West & South Asia", "Iran": "West & South Asia",
    "Pakistan": "West & South Asia", "India": "West & South Asia", "Bangladesh": "West & South Asia",
    "Kazakhstan": "West & South Asia",
    "Thailand": "East & Southeast Asia", "Singapore": "East & Southeast Asia", "Indonesia": "East & Southeast Asia",
    "Philippines": "East & Southeast Asia", "Vietnam": "East & Southeast Asia", "China": "East & Southeast Asia",
    "South Korea": "East & Southeast Asia", "Japan": "East & Southeast Asia", "Mongolia": "East & Southeast Asia",
    "Australia": "Oceania", "New Zealand": "Oceania",
}
REGION["Russia"] = "Europe"  # Moscow, Murmansk; Siberian cities overridden below


def load(model, exp):
    return np.load(os.path.join(CACHE, f"{model}_{exp}.npz"))


def running_mean(a, w=9):
    """Centred running mean along the last axis; window shrinks at the edges."""
    h = w // 2
    out = np.empty_like(a)
    n = a.shape[-1]
    for i in range(n):
        out[..., i] = a[..., max(0, i - h): min(n, i + h + 1)].mean(-1)
    return out


def r1(x):
    return np.round(np.asarray(x, dtype=float), 1).tolist()


def main():
    nC = len(CITIES)
    # anom[scen] -> (model, city, year) ; ganom[scen] -> (model, year)
    anom = {s: [] for s in SCEN}
    ganom = {s: [] for s in SCEN}
    grid_anom = {s: [] for s in SCEN}       # (model, decade, lat, lon)
    base_abs = []                            # (model, city) absolute 1995-2014 degC
    for m in MODELS:
        h = load(m, "historical")
        bmask = (h["years"] >= 1995) & (h["years"] <= 2014)
        cbase = h["city"][:, bmask].mean(1)
        gbase = h["glob"][bmask].mean()
        grbase = h["grid"][0]
        base_abs.append(cbase)
        for s in SCEN:
            f = load(m, s)
            yrs = np.concatenate([h["years"], f["years"]])
            assert (yrs == YEARS).all(), (m, s, yrs[[0, -1]])
            anom[s].append(np.concatenate([h["city"], f["city"]], 1) - cbase[:, None])
            ganom[s].append(np.concatenate([h["glob"], f["glob"]]) - gbase)
            grid_anom[s].append(f["grid"] - grbase[None])

    dec_idx = [(YEARS >= d) & (YEARS <= d + 9) for d in DECADES]
    cities = []
    for ci, (name, country, lat, lon) in enumerate(CITIES):
        region = REGION[country]
        if name in ("Novosibirsk", "Yakutsk"):
            region = "Northern Asia"
        rec = {"name": name, "country": country, "lat": lat, "lon": lon, "region": region,
               "base": round(float(np.median([b[ci] for b in base_abs])), 1), "series": {}, "dec": {}}
        for s in SCEN:
            a = np.stack(anom[s])[:, ci, :]                     # (model, year)
            sm = running_mean(a)
            rec["series"][s] = {"med": r1(np.median(sm, 0)), "lo": r1(sm.min(0)), "hi": r1(sm.max(0))}
            d = np.stack([a[:, k].mean(1) for k in dec_idx], 1)  # (model, decade)
            rec["dec"][s] = {"med": r1(np.median(d, 0)), "lo": r1(d.min(0)), "hi": r1(d.max(0))}
        cities.append(rec)

    glob = {}
    for s in SCEN:
        a = np.stack(ganom[s])
        sm = running_mean(a)
        d = np.stack([a[:, k].mean(1) for k in dec_idx], 1)
        glob[s] = {"med": r1(np.median(sm, 0)), "lo": r1(sm.min(0)), "hi": r1(sm.max(0)),
                   "dec": r1(np.median(d, 0))}

    meta = {"models": MODELS, "member": "r1i1p1f1", "scenarios": SCEN,
            "years": [int(YEARS[0]), int(YEARS[-1])], "decades": DECADES, "baseline": [1995, 2014],
            "smoothing": 9}
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "cities.json"), "w") as fh:
        json.dump({"meta": meta, "global": glob, "cities": cities}, fh, ensure_ascii=False, separators=(",", ":"))

    # Grid: ensemble median decade anomaly, integer tenths of a degree, row-major lat (N->S) x lon
    grid = {"lat": TLAT[::-1].tolist(), "lon": TLON.tolist(), "decades": DECADES, "step": 2.5, "values": {}}
    for s in SCEN:
        med = np.median(np.stack(grid_anom[s]), 0)[:, ::-1, :]   # (decade, lat N->S, lon)
        grid["values"][s] = [np.round(med[k] * 10).astype(int).ravel().tolist() for k in range(len(DECADES))]
    with open(os.path.join(ROOT, "data", "grid.json"), "w") as fh:
        json.dump(grid, fh, separators=(",", ":"))

    # quick sanity print
    for s in SCEN:
        print(s, "global 2090s", glob[s]["dec"][-1],
              "| hottest city", max(cities, key=lambda c: c["dec"][s]["med"][-1])["name"],
              max(c["dec"][s]["med"][-1] for c in cities))


if __name__ == "__main__":
    main()
