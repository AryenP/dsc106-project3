# Warming by Scenario

DSC 106 Project 3: an interactive D3 visualization of how much hotter 68 cities get under each CMIP6 SSP pathway.

- `index.html`, `style.css`, `js/main.js`: the visualization (D3 v7; topojson-client is used only to decode the land outline)
- `data/`: static JSON built from CMIP6
- `prep/`: Python preprocessing (`fetch.py` pulls from the public CMIP6 bucket, `build.py` writes `data/`, `exploratory.py` makes the checkpoint graphs)
- `exploratory/`: static exploratory graphs

Rebuild data: `python3 -m venv .venv && .venv/bin/pip install xarray zarr gcsfs dask scipy bottleneck pandas matplotlib`,
download `https://storage.googleapis.com/cmip6/cmip6-zarr-consolidated-stores.csv` to `prep/catalog.csv`, then
`.venv/bin/python prep/fetch.py && .venv/bin/python prep/build.py`.
