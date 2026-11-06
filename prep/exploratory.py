"""Static exploratory graphs (checkpoint). Writes PNGs to exploratory/.
Run:  .venv/bin/python prep/exploratory.py
"""
import json, os, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.dirname(__file__))
from fetch import MODELS, CACHE

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "exploratory")
os.makedirs(OUT, exist_ok=True)
D = json.load(open(os.path.join(ROOT, "data", "cities.json")))
G = json.load(open(os.path.join(ROOT, "data", "grid.json")))
SC = D["meta"]["scenarios"]
LAB = {"ssp126": "SSP1-2.6", "ssp245": "SSP2-4.5", "ssp370": "SSP3-7.0", "ssp585": "SSP5-8.5"}
COL = {"ssp126": "#2f6db5", "ssp245": "#d99a1e", "ssp370": "#e0522e", "ssp585": "#a3243b"}
YRS = np.arange(D["meta"]["years"][0], D["meta"]["years"][1] + 1)
plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
cities = D["cities"]


def save(fig, name):
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, name), dpi=150)
    plt.close(fig)


# 1 global mean anomaly by scenario
fig, ax = plt.subplots(figsize=(8, 4.5))
for s in SC:
    g = D["global"][s]
    ax.fill_between(YRS, g["lo"], g["hi"], color=COL[s], alpha=.15, lw=0)
    ax.plot(YRS, g["med"], color=COL[s], lw=2, label=LAB[s])
ax.axhline(0, color="#999", lw=.8)
ax.set(title="1. Global-mean warming vs 1995–2014 (9-model median, min–max band)", ylabel="°C")
ax.legend(frameon=False)
save(fig, "01_global_by_scenario.png")

# 2 & 3 maps
lat, lon = np.array(G["lat"]), np.array(G["lon"])
shape = (len(lat), len(lon))
def grid(s, k=-1):
    return np.array(G["values"][s][k]).reshape(shape) / 10
ext = [0, 360, lat[-1] - 1.25, lat[0] + 1.25]
fig, ax = plt.subplots(figsize=(9, 4.5))
im = ax.imshow(grid("ssp585"), extent=ext, cmap="YlOrRd", vmin=0, vmax=10, aspect="auto")
fig.colorbar(im, ax=ax, label="°C")
ax.set(title="2. SSP5-8.5: 2090s warming vs 1995–2014 (ensemble median)", xlabel="lon (°E)", ylabel="lat")
save(fig, "02_map_ssp585_2090s.png")

fig, ax = plt.subplots(figsize=(9, 4.5))
im = ax.imshow(grid("ssp585") - grid("ssp126"), extent=ext, cmap="Reds", vmin=0, vmax=8, aspect="auto")
fig.colorbar(im, ax=ax, label="°C")
ax.set(title="3. Extra 2090s warming from choosing SSP5-8.5 over SSP1-2.6", xlabel="lon (°E)", ylabel="lat")
save(fig, "03_map_pathway_gap.png")

# 4 dumbbell of cities
order = sorted(cities, key=lambda c: c["dec"]["ssp585"]["med"][-1])
fig, ax = plt.subplots(figsize=(7, 12))
for i, c in enumerate(order):
    v = [c["dec"][s]["med"][-1] for s in SC]
    ax.plot([min(v), max(v)], [i, i], color="#ccc", lw=1, zorder=1)
    for s, x in zip(SC, v):
        ax.scatter(x, i, color=COL[s], s=14, zorder=2, label=LAB[s] if i == 0 else None)
ax.set_yticks(range(len(order)), [c["name"] for c in order], fontsize=7)
ax.set(title="4. City warming in the 2090s by scenario", xlabel="°C vs 1995–2014")
ax.legend(frameon=False, loc="lower right")
save(fig, "04_city_dumbbell_2090s.png")

# 5 warming vs latitude
fig, ax = plt.subplots(figsize=(7, 4.5))
for s in ["ssp126", "ssp585"]:
    ax.scatter([c["lat"] for c in cities], [c["dec"][s]["med"][-1] for c in cities], color=COL[s], s=16, label=LAB[s])
    ax.axhline(D["global"][s]["dec"][-1], color=COL[s], ls="--", lw=1)
ax.set(title="5. City warming (2090s) vs latitude; dashed = global mean", xlabel="latitude", ylabel="°C")
ax.legend(frameon=False)
save(fig, "05_warming_vs_latitude.png")

# 6 model spread for three cities, SSP5-8.5 (raw per-model annual anomalies)
names = ["San Diego", "Delhi", "Moscow"]
idx = [next(i for i, c in enumerate(cities) if c["name"] == n) for n in names]
fig, axes = plt.subplots(1, 3, figsize=(11, 3.6), sharey=True)
for ax, n, ci in zip(axes, names, idx):
    for m in MODELS:
        h, f = np.load(f"{CACHE}/{m}_historical.npz"), np.load(f"{CACHE}/{m}_ssp585.npz")
        a = np.concatenate([h["city"][ci], f["city"][ci]])
        base = h["city"][ci][(h["years"] >= 1995)].mean()
        ax.plot(YRS, a - base, lw=.7, alpha=.8, label=m)
    ax.set(title=n)
axes[0].set_ylabel("°C vs 1995–2014")
axes[-1].legend(fontsize=6, frameon=False)
fig.suptitle("6. Model disagreement: each of 9 models, SSP5-8.5, annual (unsmoothed)")
save(fig, "06_model_spread_cities.png")
print(sorted(os.listdir(OUT)))
