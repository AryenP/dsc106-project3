/* Warming by Scenario — D3 v7 only (topojson-client just decodes the land outline). */
(async function () {
  "use strict";

  // ---------- constants ----------
  const SCEN = ["ssp126", "ssp245", "ssp370", "ssp585"];
  const LABEL = { ssp126: "SSP1-2.6", ssp245: "SSP2-4.5", ssp370: "SSP3-7.0", ssp585: "SSP5-8.5" };
  const BLURB = {
    ssp126: "strong mitigation",
    ssp245: "middle of the road",
    ssp370: "regional rivalry",
    ssp585: "fossil-fuelled growth",
  };
  // Ordered low -> high emissions; validated for CVD separation (dataviz validator, light surface).
  const COLOR = { ssp126: "#2f6db5", ssp245: "#d99a1e", ssp370: "#e0522e", ssp585: "#a3243b" };
  const MAX_SEL = 4;
  const fmt = d3.format("+.1f");
  const fmtT = d3.format(".1f");
  const deg = (v) => `${fmt(v)} °C`;

  // ---------- data ----------
  const [D, G, world] = await Promise.all([
    d3.json("data/cities.json"),
    d3.json("data/grid.json"),
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json"),
  ]);
  const land = topojson.feature(world, world.objects.land);
  const cities = D.cities;
  const byName = new Map(cities.map((c) => [c.name, c]));
  const DECADES = D.meta.decades;
  const Y0 = D.meta.years[0];
  const YEARS = d3.range(Y0, D.meta.years[1] + 1);
  const REGIONS = ["All regions", ...Array.from(new Set(cities.map((c) => c.region))).sort()];

  // fixed scales shared across every pathway/decade so encodings stay comparable
  const allDec = cities.flatMap((c) => SCEN.flatMap((s) => c.dec[s].med));
  const rankDomain = [Math.min(0, d3.min(allDec)), Math.ceil(d3.max(allDec))];
  const COLOR_MAX = 9;
  const heat = d3.scaleSequential(d3.interpolateOrRd).domain([0, COLOR_MAX]).clamp(true);

  // ---------- state ----------
  const state = {
    scen: "ssp245",
    dec: 3, // 2050s
    region: REGIONS[0],
    sort: "value",
    selected: ["San Diego", "Delhi", "Yakutsk", "Reykjavík"],
    hover: null,
  };
  const decLabel = (i) => `${DECADES[i]}s`;
  const val = (c, s = state.scen, i = state.dec) => c.dec[s].med[i];
  const visibleCities = () =>
    state.region === REGIONS[0] ? cities : cities.filter((c) => c.region === state.region);

  // ---------- tooltip ----------
  const tip = d3.select("#tooltip");
  function showTip(html, ev) {
    tip.html(html).attr("hidden", null);
    const r = tip.node().getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style("left", `${Math.max(8, x)}px`).style("top", `${Math.max(8, y)}px`);
  }
  const hideTip = () => tip.attr("hidden", true);
  const sw = (s) => `<span class="swatch" style="background:${COLOR[s]}"></span>`;

  function cityTip(c) {
    const rows = SCEN.map(
      (s) => `<div class="tt-row ${s === state.scen ? "cur" : ""}">${sw(s)}${LABEL[s]}&nbsp;&nbsp;${deg(val(c, s))}
        <span class="tt-muted">(${fmt(c.dec[s].lo[state.dec])} to ${fmt(c.dec[s].hi[state.dec])})</span></div>`
    ).join("");
    const now = c.base, then = c.base + val(c);
    return `<b>${c.name}</b>, ${c.country}<br>
      <span class="tt-muted">${decLabel(state.dec)} vs 1995–2014 · median (model range)</span>${rows}
      <div class="tt-muted" style="margin-top:4px">Annual mean ${fmtT(now)} °C → ${fmtT(then)} °C under ${LABEL[state.scen]}</div>
      <div class="tt-muted">${state.selected.includes(c.name) ? "Click to remove from comparison" : "Click to compare"}</div>`;
  }

  // ---------- controls ----------
  const scenSel = d3.select("#scenario");
  scenSel
    .selectAll("button")
    .data(SCEN)
    .join("button")
    .attr("type", "button")
    .attr("role", "radio")
    .attr("title", (s) => BLURB[s])
    .html((s) => `${sw(s)}${LABEL[s]}`)
    .on("click", (_, s) => { state.scen = s; update(); });

  d3.select("#scen-legend")
    .selectAll("span")
    .data(SCEN)
    .join("span")
    .html((s) => `${sw(s)}${LABEL[s]}`);

  const decInput = d3.select("#decade").attr("max", DECADES.length - 1).property("value", state.dec);
  decInput.on("input", function () { state.dec = +this.value; update(); });

  let timer = null;
  const playBtn = d3.select("#play").on("click", () => (timer ? stop() : play()));
  function play() {
    if (state.dec >= DECADES.length - 1) state.dec = 0;
    playBtn.text("❚❚").attr("aria-label", "Pause");
    update();
    timer = d3.interval(() => {
      if (state.dec >= DECADES.length - 1) return stop();
      state.dec += 1;
      update();
    }, 1100);
  }
  function stop() {
    if (timer) timer.stop();
    timer = null;
    playBtn.text("▶").attr("aria-label", "Play through decades");
  }

  d3.select("#region")
    .selectAll("option")
    .data(REGIONS)
    .join("option")
    .text((d) => d);
  d3.select("#region").on("change", function () { state.region = this.value; update(); });

  d3.select("#city-list")
    .selectAll("option")
    .data([...cities].sort((a, b) => d3.ascending(a.name, b.name)))
    .join("option")
    .attr("value", (c) => c.name)
    .text((c) => c.country);
  d3.select("#search").on("change", function () {
    const q = this.value.trim().toLowerCase();
    const c = cities.find((c) => c.name.toLowerCase() === q) || cities.find((c) => c.name.toLowerCase().startsWith(q));
    if (c && q) {
      if (!state.selected.includes(c.name)) select(c.name);
      this.value = "";
    }
  });

  d3.selectAll("#sort button").on("click", function () {
    state.sort = this.dataset.k;
    d3.selectAll("#sort button").attr("aria-pressed", function () { return this.dataset.k === state.sort; });
    updateRank();
  });

  function select(name) {
    const i = state.selected.indexOf(name);
    if (i >= 0) state.selected.splice(i, 1);
    else {
      state.selected.push(name);
      if (state.selected.length > MAX_SEL) state.selected.shift();
    }
    update();
  }
  function setHover(name) {
    state.hover = name;
    mapLayer.selectAll(".city-dot").classed("hl", (c) => c.name === name);
    rankBody.selectAll(".rank-row").classed("hl", (c) => c.name === name);
  }

  // ---------- map ----------
  const mapEl = document.getElementById("map");
  const canvas = d3.select(mapEl).append("canvas").node();
  const ctx = canvas.getContext("2d");
  const svg = d3.select(mapEl).append("svg").attr("role", "img")
    .attr("aria-label", "World map of warming with city markers");
  const mapLayer = svg.append("g");
  const spherePath = mapLayer.append("path").attr("class", "sphere");
  const landPath = mapLayer.append("path").attr("class", "land").attr("vector-effect", "non-scaling-stroke");
  const dotsG = mapLayer.append("g");
  const labelsG = mapLayer.append("g");

  const projection = d3.geoEqualEarth();
  const geoPath = d3.geoPath(projection);
  let W = 0, H = 0, cells = null, zt = d3.zoomIdentity;
  const NLAT = G.lat.length, NLON = G.lon.length, HALF = G.step / 2;

  function layoutMap() {
    W = mapEl.clientWidth;
    H = mapEl.clientHeight;
    projection.fitExtent([[4, 4], [W - 4, H - 4]], { type: "Sphere" });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // Project every 2.5° cell's corners once. In Equal Earth parallels are straight,
    // so a quad of projected corners is an accurate cell outline at this size.
    cells = new Float32Array(NLAT * NLON * 8);
    let k = 0;
    for (let r = 0; r < NLAT; r++) {
      const la = G.lat[r];
      for (let c = 0; c < NLON; c++) {
        let lo = G.lon[c];
        if (lo > 180) lo -= 360;
        const pts = [[lo - HALF, la + HALF], [lo + HALF, la + HALF], [lo + HALF, la - HALF], [lo - HALF, la - HALF]];
        for (const p of pts) {
          const q = projection(p);
          cells[k++] = q[0];
          cells[k++] = q[1];
        }
      }
    }
    spherePath.attr("d", geoPath({ type: "Sphere" }));
    landPath.attr("d", geoPath(land));
    zoom.extent([[0, 0], [W, H]]).translateExtent([[0, 0], [W, H]]);
  }

  function drawRaster() {
    if (!cells) return;
    const dpr = window.devicePixelRatio || 1;
    const vals = G.values[state.scen][state.dec];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * zt.k, 0, 0, dpr * zt.k, dpr * zt.x, dpr * zt.y);
    ctx.save();
    ctx.beginPath();
    d3.geoPath(projection, ctx)({ type: "Sphere" });
    ctx.clip();
    // batch cells by quantised colour (60 bins) to keep redraws fast during zoom/play
    const BINS = 60, paths = Array.from({ length: BINS }, () => new Path2D());
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i] / 10;
      const b = Math.max(0, Math.min(BINS - 1, Math.round((v / COLOR_MAX) * (BINS - 1))));
      const k = i * 8, p = paths[b];
      p.moveTo(cells[k], cells[k + 1]);
      p.lineTo(cells[k + 2], cells[k + 3]);
      p.lineTo(cells[k + 4], cells[k + 5]);
      p.lineTo(cells[k + 6], cells[k + 7]);
      p.closePath();
    }
    for (let b = 0; b < BINS; b++) {
      const col = heat(((b / (BINS - 1)) * COLOR_MAX));
      ctx.fillStyle = col;
      ctx.strokeStyle = col; // hairline stroke hides seams between cells
      ctx.lineWidth = 0.6 / zt.k;
      ctx.fill(paths[b]);
      ctx.stroke(paths[b]);
    }
    ctx.restore();
  }

  function cellAt(lon, lat) {
    const r = Math.round((G.lat[0] - lat) / G.step);
    let l = ((lon % 360) + 360) % 360;
    const c = Math.floor(l / G.step);
    if (r < 0 || r >= NLAT || c < 0 || c >= NLON) return null;
    return G.values[state.scen][state.dec][r * NLON + c] / 10;
  }

  const zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", (ev) => {
    zt = ev.transform;
    mapLayer.attr("transform", zt);
    styleDots();
    drawRaster();
  });
  svg.call(zoom).on("dblclick.zoom", null)
    .on("dblclick", () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));

  svg.on("mousemove", (ev) => {
    if (ev.target.classList.contains("city-dot")) return;
    const [mx, my] = zt.invert(d3.pointer(ev, svg.node()));
    const ll = projection.invert([mx, my]);
    const inside = ll && d3.geoContains({ type: "Sphere" }, ll);
    if (!inside) return hideTip();
    const v = cellAt(ll[0], ll[1]);
    if (v == null) return hideTip();
    const ns = ll[1] >= 0 ? "N" : "S", ew = ll[0] >= 0 ? "E" : "W";
    showTip(`<b>${deg(v)}</b> <span class="tt-muted">grid cell near ${Math.abs(ll[1]).toFixed(0)}°${ns}, ${Math.abs(ll[0]).toFixed(0)}°${ew}</span><br>
      <span class="tt-muted">${LABEL[state.scen]}, ${decLabel(state.dec)} vs 1995–2014</span>`, ev);
  }).on("mouseleave", hideTip);

  function styleDots() {
    const k = zt.k;
    dotsG.selectAll(".city-dot")
      .attr("r", (c) => (state.selected.includes(c.name) ? 6.5 : 4.5) / Math.sqrt(k))
      .attr("stroke-width", (c) => (state.selected.includes(c.name) ? 2.2 : 0.9) / Math.sqrt(k));
    labelsG.selectAll("text")
      .attr("font-size", 11 / Math.sqrt(k))
      .attr("stroke-width", 3 / Math.sqrt(k))
      .attr("dx", 9 / Math.sqrt(k))
      .attr("dy", 4 / Math.sqrt(k));
  }

  function updateMap() {
    drawRaster();
    const vis = new Set(visibleCities().map((c) => c.name));
    const ordered = [...cities].sort((a, b) => state.selected.includes(a.name) - state.selected.includes(b.name));
    dotsG.selectAll(".city-dot")
      .data(ordered, (c) => c.name)
      .join("circle")
      .attr("class", "city-dot")
      .attr("cx", (c) => projection([c.lon, c.lat])[0])
      .attr("cy", (c) => projection([c.lon, c.lat])[1])
      .attr("tabindex", 0)
      .attr("aria-label", (c) => `${c.name}: ${deg(val(c))}`)
      .classed("sel", (c) => state.selected.includes(c.name))
      .classed("dim", (c) => !vis.has(c.name))
      .on("mouseenter mousemove", (ev, c) => { setHover(c.name); showTip(cityTip(c), ev); })
      .on("mouseleave", () => { setHover(null); hideTip(); })
      .on("click", (ev, c) => { ev.stopPropagation(); select(c.name); showTip(cityTip(c), ev); })
      .on("keydown", (ev, c) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(c.name); } })
      .transition().duration(450)
      .attr("fill", (c) => heat(val(c)));
    labelsG.selectAll("text")
      .data(cities.filter((c) => state.selected.includes(c.name)), (c) => c.name)
      .join("text")
      .attr("class", "city-label")
      .attr("x", (c) => projection([c.lon, c.lat])[0])
      .attr("y", (c) => projection([c.lon, c.lat])[1])
      .text((c) => c.name);
    styleDots();
    d3.select("#map-sub").text(
      `${LABEL[state.scen]} · ${decLabel(state.dec)} mean vs 1995–2014 · median of 9 models, 2.5° grid`
    );
  }

  // colour legend
  function drawLegend() {
    const el = d3.select("#map-legend").html("");
    const w = Math.max(120, Math.min(360, mapEl.clientWidth - 20)), h = 10;
    const s = el.append("svg").attr("width", w + 20).attr("height", 40);
    const id = "heat-grad";
    const grad = s.append("defs").append("linearGradient").attr("id", id);
    d3.range(0, 1.0001, 0.1).forEach((t) =>
      grad.append("stop").attr("offset", t).attr("stop-color", heat(t * COLOR_MAX)));
    s.append("text").attr("x", 0).attr("y", 10).attr("font-size", 12).attr("fill", "var(--ink-2)")
      .text("Warming vs 1995–2014 (map shading and city dots)");
    const g = s.append("g").attr("transform", "translate(0,16)");
    g.append("rect").attr("width", w).attr("height", h).attr("rx", 2).attr("fill", `url(#${id})`);
    const x = d3.scaleLinear().domain([0, COLOR_MAX]).range([0, w]);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(3).tickFormat((d) => (d === 0 ? "≤0 °C" : d === COLOR_MAX ? `≥${d}` : `+${d}`)))
      .call((a) => a.select(".domain").remove());
  }

  // ---------- ranking ----------
  const rankEl = document.getElementById("rank");
  const rankAxisSvg = d3.select("#rank-axis").append("svg");
  const rankSvg = d3.select(rankEl).append("svg");
  const rankGrid = rankSvg.append("g");
  const rankGlob = rankSvg.append("g");
  const rankBody = rankSvg.append("g");
  const ROW = 18, ML = 104, MR = 40;
  const xr = d3.scaleLinear().domain(rankDomain);

  function updateRank() {
    const w = rankEl.clientWidth;
    xr.range([ML, w - MR]);
    const list = visibleCities().slice();
    const gap = (c) => val(c, "ssp585") - val(c, "ssp126");
    if (state.sort === "value") list.sort((a, b) => val(b) - val(a));
    else if (state.sort === "gap") list.sort((a, b) => gap(b) - gap(a));
    else list.sort((a, b) => b.lat - a.lat);
    const h = list.length * ROW + 8;
    rankSvg.attr("width", w).attr("height", h);

    // axis header (outside the scroll area so it stays visible)
    rankAxisSvg.attr("width", w).attr("height", 34);
    rankAxisSvg.selectAll(".axis").data([0]).join("g").attr("class", "axis")
      .attr("transform", "translate(0,30)")
      .call(d3.axisTop(xr).ticks(Math.max(3, Math.floor(w / 70))).tickSize(4).tickFormat((d) => (d === 0 ? "0" : `+${d}°`)))
      .call((a) => a.select(".domain").remove());
    const gm = D.global[state.scen].dec[state.dec];
    rankAxisSvg.selectAll(".glob-lab").data([gm]).join("text").attr("class", "glob-lab")
      .attr("x", xr(gm)).attr("y", 9).attr("text-anchor", "middle")
      .attr("font-size", 11).attr("fill", "var(--ink-2)")
      .text(`global avg ${fmt(gm)}°`)
      .transition().duration(450).attr("x", xr(gm));

    rankGrid.selectAll("line").data(xr.ticks(Math.max(3, Math.floor(w / 70))))
      .join("line").attr("class", "gridline")
      .attr("x1", xr).attr("x2", xr).attr("y1", 0).attr("y2", h);
    rankGlob.selectAll("line").data([gm]).join("line")
      .attr("class", "glob").attr("stroke", COLOR[state.scen])
      .attr("y1", 0).attr("y2", h)
      .transition().duration(450).attr("x1", xr).attr("x2", xr);

    const rows = rankBody.selectAll(".rank-row").data(list, (c) => c.name).join(
      (enter) => {
        const g = enter.append("g").attr("class", "rank-row").attr("tabindex", 0)
          .attr("transform", (_, i) => `translate(0,${i * ROW + 4})`).attr("opacity", 0);
        g.append("rect").attr("class", "hit").attr("x", 0).attr("height", ROW).attr("rx", 3);
        g.append("text").attr("class", "name").attr("x", ML - 10).attr("y", ROW / 2 + 4).attr("text-anchor", "end");
        g.append("line").attr("class", "range").attr("stroke", "var(--rule)").attr("stroke-width", 2).attr("y1", ROW / 2).attr("y2", ROW / 2);
        g.selectAll("circle").data(SCEN.map((s) => ({ s }))).join("circle").attr("cy", ROW / 2);
        g.append("text").attr("class", "val").attr("y", ROW / 2 + 4).attr("text-anchor", "end");
        return g;
      },
      (update) => update,
      (exit) => exit.transition().duration(200).attr("opacity", 0).remove()
    );
    rows.classed("sel", (c) => state.selected.includes(c.name))
      .on("mouseenter", (ev, c) => { setHover(c.name); showTip(cityTip(c), ev); })
      .on("mousemove", (ev, c) => showTip(cityTip(c), ev))
      .on("mouseleave", () => { setHover(null); hideTip(); })
      .on("click", (ev, c) => select(c.name))
      .on("keydown", (ev, c) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(c.name); } })
      .attr("aria-label", (c) => `${c.name} ${deg(val(c))}`);
    rows.select(".hit").attr("width", w);
    rows.select(".name").text((c) => c.name);
    rows.transition().duration(550).attr("opacity", 1).attr("transform", (_, i) => `translate(0,${i * ROW + 4})`);
    rows.select(".range").transition().duration(450)
      .attr("x1", (c) => xr(d3.min(SCEN, (s) => val(c, s))))
      .attr("x2", (c) => xr(d3.max(SCEN, (s) => val(c, s))));
    rows.selectAll("circle").data((c) => SCEN.map((s) => ({ c, s })), (d) => d.s)
      .attr("fill", (d) => COLOR[d.s])
      .attr("stroke", (d) => (d.s === state.scen ? "var(--ink)" : "var(--surface)"))
      .attr("stroke-width", (d) => (d.s === state.scen ? 1.5 : 1))
      .sort((a, b) => (a.s === state.scen) - (b.s === state.scen))
      .transition().duration(450)
      .attr("r", (d) => (d.s === state.scen ? 5 : 3.6))
      .attr("cx", (d) => xr(val(d.c, d.s)));
    rows.select(".val").attr("x", w - 4).text((c) => fmt(state.sort === "gap" ? gap(c) : val(c)));

    const what = state.sort === "gap"
      ? `sorted by the SSP5-8.5 minus SSP1-2.6 gap (number at right)`
      : state.sort === "lat" ? "sorted north to south" : `sorted by ${LABEL[state.scen]} warming`;
    d3.select("#rank-sub").text(`${list.length} cities · ${decLabel(state.dec)} vs 1995–2014 · ${what}. Dashed line: global average.`);
  }

  // ---------- compare small multiples ----------
  const cmpEl = d3.select("#compare");
  const CH = 210, CM = { t: 10, r: 46, b: 22, l: 34 };

  function updateCompare() {
    const sel = state.selected.map((n) => byName.get(n));
    cmpEl.selectAll(".cmp-empty").data(sel.length ? [] : [0]).join("p").attr("class", "cmp-empty")
      .text("No cities selected. Click a dot on the map or a row in the ranking to compare it here.");
    // shared y-domain so panels can be compared by position
    const ys = sel.flatMap((c) => SCEN.flatMap((s) => [...c.series[s].lo, ...c.series[s].hi]));
    const yDom = sel.length ? [Math.min(-1, d3.min(ys)), Math.max(2, d3.max(ys))] : [-1, 2];

    const cards = cmpEl.selectAll(".cmp-card").data(sel, (c) => c.name).join((enter) => {
      const d = enter.append("div").attr("class", "cmp-card");
      d.append("h3");
      d.append("p").attr("class", "meta");
      d.append("button").attr("class", "x").attr("type", "button").html("×");
      d.append("svg");
      return d;
    });
    cards.order();
    cards.select("h3").text((c) => c.name);
    cards.select(".meta").text((c) => `${c.country} · 1995–2014 mean ${fmtT(c.base)} °C · ${Math.abs(c.lat).toFixed(1)}°${c.lat >= 0 ? "N" : "S"}`);
    cards.select(".x").attr("aria-label", (c) => `Remove ${c.name}`).on("click", (_, c) => select(c.name));
    cards.each(function (c) { drawCard(d3.select(this).select("svg"), c, yDom); });
  }

  function drawCard(svgSel, c, yDom) {
    const w = svgSel.node().parentNode.clientWidth;
    svgSel.attr("width", w).attr("height", CH);
    const x = d3.scaleLinear().domain([Y0, 2100]).range([CM.l, w - CM.r]);
    const y = d3.scaleLinear().domain(yDom).nice().range([CH - CM.b, CM.t]);
    const yi = (yr) => yr - Y0;
    const line = (arr, from) => d3.line().x((yr) => x(yr)).y((yr) => y(arr[yi(yr)]))(d3.range(from, 2101));

    const root = svgSel.selectAll("g.root").data([0]).join("g").attr("class", "root");
    root.selectAll(".y.axis").data([0]).join("g").attr("class", "y axis")
      .attr("transform", `translate(${CM.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(w - CM.l - CM.r)).tickFormat((d) => (d === 0 ? "0" : `${d > 0 ? "+" : ""}${d}°`)))
      .call((a) => a.select(".domain").remove())
      .call((a) => a.selectAll(".tick line").attr("class", "gridline").attr("stroke-opacity", (d) => (d === 0 ? 0 : 1)));
    root.selectAll(".x.axis").data([0]).join("g").attr("class", "x axis")
      .attr("transform", `translate(0,${CH - CM.b})`)
      .call(d3.axisBottom(x).tickValues([1950, 2000, 2050, 2100]).tickFormat(d3.format("d")).tickSize(3));
    root.selectAll(".zero").data([0]).join("line").attr("class", "zero")
      .attr("x1", CM.l).attr("x2", w - CM.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "var(--ink-3)").attr("stroke-width", 0.8);

    const d0 = DECADES[state.dec];
    root.selectAll(".decade-band").data([d0]).join("rect").attr("class", "decade-band")
      .attr("y", CM.t).attr("height", CH - CM.b - CM.t)
      .transition().duration(400).attr("x", x(d0)).attr("width", x(d0 + 10) - x(d0));

    const s0 = c.series[state.scen];
    const area = d3.area().x((yr) => x(yr)).y0((yr) => y(s0.lo[yi(yr)])).y1((yr) => y(s0.hi[yi(yr)]));
    root.selectAll(".band").data([0]).join("path").attr("class", "band")
      .attr("fill", COLOR[state.scen]).attr("opacity", 0.16)
      .attr("d", area(d3.range(2014, 2101)));

    const gl = D.global[state.scen].med;
    root.selectAll(".glob").data([0]).join("path").attr("class", "glob")
      .attr("stroke", COLOR[state.scen]).attr("d", line(gl, 2014));

    root.selectAll(".line.hist").data([0]).join("path").attr("class", "line hist")
      .attr("d", d3.line().x((yr) => x(yr)).y((yr) => y(c.series.ssp245.med[yi(yr)]))(d3.range(Y0, 2015)));
    const order = SCEN.filter((s) => s !== state.scen).concat(state.scen); // focus drawn last
    root.selectAll(".line.scen").data(order, (s) => s).join("path")
      .attr("class", (s) => `line scen ${s === state.scen ? "focus" : ""}`)
      .attr("stroke", (s) => COLOR[s])
      .attr("stroke-opacity", (s) => (s === state.scen ? 1 : 0.75))
      .attr("d", (s) => line(c.series[s].med, 2014))
      .order();

    // end labels (ink text + colour dot), nudged apart to avoid collisions
    const ends = SCEN.map((s) => ({ s, v: c.series[s].med[yi(2100)], y: y(c.series[s].med[yi(2100)]) }))
      .sort((a, b) => b.y - a.y);
    for (let i = 1; i < ends.length; i++) if (ends[i - 1].y - ends[i].y < 11) ends[i].y = ends[i - 1].y - 11;
    const el = root.selectAll(".end").data(ends, (d) => d.s).join((e) => {
      const g = e.append("g").attr("class", "end");
      g.append("circle").attr("r", 3);
      g.append("text").attr("class", "end-label").attr("x", 6).attr("dy", "0.32em");
      return g;
    });
    el.attr("transform", (d) => `translate(${w - CM.r + 4},${d.y})`);
    el.select("circle").attr("fill", (d) => COLOR[d.s]);
    el.select("text").text((d) => fmt(d.v)).attr("font-weight", (d) => (d.s === state.scen ? 700 : 500));

    // crosshair
    const ch = root.selectAll(".crosshair").data([0]).join("line").attr("class", "crosshair")
      .attr("y1", CM.t).attr("y2", CH - CM.b).attr("opacity", 0);
    root.selectAll(".overlay").data([0]).join("rect").attr("class", "overlay")
      .attr("x", CM.l).attr("y", CM.t).attr("width", w - CM.l - CM.r).attr("height", CH - CM.b - CM.t)
      .attr("fill", "transparent")
      .on("mousemove", (ev) => {
        const yr = Math.max(Y0, Math.min(2100, Math.round(x.invert(d3.pointer(ev)[0]))));
        ch.attr("x1", x(yr)).attr("x2", x(yr)).attr("opacity", 1);
        const i = yi(yr);
        const body = yr < 2015
          ? `<div class="tt-row">Historical&nbsp;&nbsp;${deg(c.series.ssp245.med[i])}</div>`
          : SCEN.slice().reverse().map((s) => `<div class="tt-row ${s === state.scen ? "cur" : ""}">${sw(s)}${LABEL[s]}&nbsp;&nbsp;${deg(c.series[s].med[i])}</div>`).join("");
        showTip(`<b>${c.name}, ${yr}</b> <span class="tt-muted">9-yr mean vs 1995–2014</span>${body}
          <div class="tt-muted" style="margin-top:4px">Global mean (${LABEL[state.scen]}): ${deg(D.global[state.scen].med[i])}</div>`, ev);
      })
      .on("mouseleave", () => { ch.attr("opacity", 0); hideTip(); });
  }

  // ---------- headline ----------
  function updateHeadline() {
    const list = visibleCities();
    const med = (s) => d3.median(list, (c) => val(c, s));
    const g = D.global[state.scen].dec[state.dec];
    const m = med(state.scen);
    const above = list.filter((c) => val(c) > g).length;
    const where = state.region === REGIONS[0] ? "the typical city" : `the typical city in ${state.region}`;
    const lowGap = med("ssp585") - med("ssp126");
    d3.select("#headline").html(
      `In the <b>${decLabel(state.dec)}</b> under <b>${LABEL[state.scen]}</b>, ${where} is <b>${deg(m)}</b> warmer than in 1995–2014, ` +
      `against a global average of ${deg(g)}. ${above} of ${list.length} cities warm faster than the planet. ` +
      `Taking SSP1-2.6 instead of SSP5-8.5 would spare that city <b>${fmtT(lowGap)} °C</b> of warming by then.`
    );
  }

  // ---------- update + resize ----------
  function update() {
    scenSel.selectAll("button")
      .attr("aria-checked", (s) => s === state.scen)
      .attr("aria-pressed", (s) => s === state.scen);
    decInput.property("value", state.dec);
    d3.select("#decade-out").text(`${decLabel(state.dec)}`);
    updateHeadline();
    updateMap();
    updateRank();
    updateCompare();
  }

  d3.select("#model-list").text(D.meta.models.join(", "));

  const zoomInit = () => { layoutMap(); drawLegend(); };
  // first draw happens in the ResizeObserver callback, once the layout has real widths

  let rT;
  new ResizeObserver(() => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      if (!mapEl.clientWidth) return;
      if (mapEl.clientWidth === W && mapEl.clientHeight === H && rankEl.clientWidth === +rankSvg.attr("width")) return updateCompare();
      zoomInit();
      zt = d3.zoomIdentity;
      svg.call(zoom.transform, d3.zoomIdentity);
      update();
    }, W ? 120 : 0);
  }).observe(document.querySelector(".grid"));
})();
