import "./style.css";
import { geoArea, geoMercator, geoPath } from "d3-geo";

// d3-geo expects clockwise outer rings; this boundary file uses the opposite
// order, so each polygon would be read as "the whole globe except Sri Lanka".
function rewind(feature) {
  const g = feature.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const rings of polys) {
    for (let i = 0; i < rings.length; i++) {
      const ring = { type: "Polygon", coordinates: [rings[i]] };
      const big = geoArea(ring) > 2 * Math.PI;
      // outer ring (i = 0) must be small; holes must be big
      if ((i === 0 && big) || (i > 0 && !big)) rings[i].reverse();
    }
  }
  return feature;
}
import * as Plot from "@observablehq/plot";

const WATCH = {
  SlopeWatch: { color: "var(--slope)", hex: "#7d2e1c", label: "SlopeWatch", what: "landslide danger" },
  FloodWatch: { color: "var(--flood)", hex: "#2b7c8a", label: "FloodWatch", what: "flood danger" },
  DryWatch: { color: "var(--dry)", hex: "#d9a441", label: "DryWatch", what: "drought" },
  Clear: { color: "var(--clear)", hex: "#d8ddd6", label: "No watch", what: "normal conditions" },
};
const ORDER = ["SlopeWatch", "FloodWatch", "DryWatch", "Clear"];
const AMBER = "#b86f12";
const INK = "#16201f";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const monthName = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};
const pct = (v) => (v == null ? "n/a" : `${Math.round(v)}%`);
const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");

let DATA, GEO, current;

async function load() {
  const [d, g] = await Promise.all([
    fetch("data/biome.json").then((r) => r.json()),
    fetch("data/districts.geojson").then((r) => r.json()),
  ]);
  DATA = d;
  GEO = g;
  GEO.features.forEach((f) => {
    f.properties.name = f.properties.shapeName.replace(" District", "").trim();
    rewind(f);
  });
  if (DATA.meta.synthetic) $("#test-banner").hidden = false;
  renderStatus();
  renderMap();
  renderLegend();
  renderPicker();
  renderHow();
  const fromHash = decodeURIComponent(location.hash.slice(1));
  const names = Object.keys(DATA.districts);
  const start = names.find((n) => slug(n) === fromHash) || pickDefault(names);
  select(start, false);
}

function pickDefault(names) {
  // open on the most serious watch so the first screen tells the story
  for (const w of ORDER) {
    const hit = names.find((n) => DATA.districts[n].watch === w);
    if (hit && w !== "Clear") return hit;
  }
  return names.includes("Kandy") ? "Kandy" : names[0];
}

function renderStatus() {
  const m = DATA.meta;
  const cur = DATA.el_nino.current;
  const so = Object.values(DATA.districts).find((d) => d.so_far)?.so_far;
  const latest = so ? `${monthName(so.month)} (first ${so.days} days, early estimate)` : `${monthName(m.latest_month)} (${m.latest_source})`;
  const nino = cur ? `El Niño ${cur.year0}: ${cur.strength}, peak index ${cur.peak} so far` : "No El Niño under way";
  $("#status").innerHTML = `<b>${esc(nino)}</b> · Latest NASA rain data: ${esc(latest)}`;
  const c = m.watch_counts || {};
  const parts = ["SlopeWatch", "FloodWatch", "DryWatch"].filter((w) => c[w]).map((w) => `${c[w]} on ${w}`);
  $("#lede").textContent = parts.length
    ? `Right now ${parts.join(", ")}. Biome compares each district with what past strong El Niños did there, using 45 years of NASA Earth data. Tap a district.`
    : "Every district is within its normal range right now. Biome compares each district with what past strong El Niños did there, using 45 years of NASA Earth data. Tap a district.";
}

function renderMap() {
  const svg = $("#map");
  const W = 400, H = 560;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const proj = geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], GEO);
  const path = geoPath(proj);
  svg.innerHTML = GEO.features
    .map((f) => {
      const n = f.properties.name;
      const d = DATA.districts[n];
      const w = d ? d.watch : "Clear";
      return `<path class="district" data-name="${esc(n)}" d="${path(f)}" fill="${WATCH[w].hex}" tabindex="0" role="button" aria-label="${esc(n)}: ${esc(WATCH[w].label)}"><title>${esc(n)}: ${esc(WATCH[w].label)}</title></path>`;
    })
    .join("") + `<g id="map-label"></g>`;
  svg.querySelectorAll("path.district").forEach((p) => {
    p.addEventListener("click", () => select(p.dataset.name));
    p.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(p.dataset.name); }
    });
  });
  svg._proj = proj;
  svg._path = path;
}

function renderLegend() {
  const c = DATA.meta.watch_counts || {};
  $("#legend").innerHTML = ORDER.map(
    (w) => `<li><span class="sw" style="background:${WATCH[w].hex}"></span>${esc(WATCH[w].label)} <span style="color:var(--ink-3)">(${c[w] || 0})</span></li>`
  ).join("");
}

function renderPicker() {
  const sel = $("#district-select");
  sel.innerHTML = Object.keys(DATA.districts).sort().map((n) => `<option>${esc(n)}</option>`).join("");
  sel.addEventListener("change", () => select(sel.value));
}

function select(name, push = true) {
  current = name;
  $("#district-select").value = name;
  document.querySelectorAll("#map path.district").forEach((p) => p.classList.toggle("active", p.dataset.name === name));
  const svg = $("#map");
  const f = GEO.features.find((x) => x.properties.name === name);
  if (f) {
    const [x, y] = svg._path.centroid(f);
    $("#map-label").innerHTML = `<text x="${x}" y="${y}" text-anchor="middle" dy="4">${esc(name)}</text>`;
  }
  if (push) history.replaceState(null, "", `#${slug(name)}`);
  renderPanel(name);
}

function renderPanel(name) {
  const d = DATA.districts[name];
  const m = DATA.meta;
  const w = WATCH[d.watch];
  const flagMonth = monthName(d.flag_month);
  const early = d.so_far ? ` (first ${d.so_far.days} days, NASA early estimate)` : d.now.source.includes("Late") ? " (NASA early estimate)" : "";
  const soilNote = d.now.soil_month && d.now.soil_month !== d.flag_month ? ` Soil moisture is from ${monthName(d.now.soil_month)}, the latest NASA month.` : "";

  $("#panel").innerHTML = `
    <h2>${esc(name)}</h2>
    <p class="sub">${d.hill ? "Hill country district" : "District"} · ${esc(flagMonth)}${esc(early)}</p>
    <span class="badge ${d.watch}">${esc(w.label)}</span>
    <p class="reason">${esc(d.reason)}.</p>
    ${d.next ? `<p class="next">What usually comes next: ${esc(d.next.text)} (${esc(d.next.months.join(", "))}).</p>` : ""}
    <p class="meta-line">${esc(soilNote)} Biome is not a forecast. For warnings, follow the Met Department, NBRO and the DMC.</p>

    <div class="figure">
      <h3>The swing: rain in strong El Niño years</h3>
      <p class="cap">Rain as % of ${esc(name)}'s normal, January of an El Niño year to June of the next. Grey band: range of past strong El Niños. Dark line: their average. <span style="color:${AMBER};font-weight:600">Amber: ${esc(DATA.el_nino.current?.year0 ?? "this year")} so far.</span></p>
      <div class="chart" id="chart-rain"></div>
    </div>

    <div class="figure">
      <h3>How wet the ground is</h3>
      <p class="cap">Root-zone soil moisture, ranked against the same month in 2001 to 2025 (0 = driest on record, 100 = wettest).</p>
      <div class="chart" id="chart-soil"></div>
    </div>

    <div class="facts">${factCards(d)}</div>

    <div class="story">
      <h3>Biome Story: ${esc(name)}</h3>
      ${story(name, d).map((p) => `<p>${esc(p)}</p>`).join("")}
    </div>
  `;
  drawSwing("#chart-rain", d.profile?.rain_pct, d.this_event?.rain_pct, 100, "% of normal rain");
  drawSwing("#chart-soil", d.profile?.soil_pct, d.this_event?.soil_pct, 50, "soil moisture rank", [0, 100]);
}

function drawSwing(sel, prof, now, ref, label, domain) {
  const el = $(sel);
  if (!prof) { el.innerHTML = "<p>Not enough data yet.</p>"; return; }
  const L = DATA.meta.lag_labels;
  const rows = L.map((lab, i) => ({ i, lab, mean: prof.mean[i], lo: prof.min[i], hi: prof.max[i], now: now ? now[i] : null }));
  const nowRows = rows.filter((r) => r.now != null);
  const width = Math.min(760, el.clientWidth || 640);
  const chart = Plot.plot({
    width, height: 260, marginLeft: 48, marginRight: 16,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px", color: INK, background: "transparent" },
    x: { domain: [0, L.length - 1], ticks: L.map((_, i) => i).filter((i) => i % 2 === 0), tickFormat: (i) => L[i], label: null },
    y: { label, grid: true, domain, nice: true },
    marks: [
      Plot.areaY(rows.filter((r) => r.lo != null && r.hi != null), { x: "i", y1: "lo", y2: "hi", fill: "#9aa39e", fillOpacity: 0.25, curve: "monotone-x" }),
      Plot.ruleY([ref], { stroke: "#6b7470", strokeDasharray: "4 4" }),
      Plot.line(rows.filter((r) => r.mean != null), { x: "i", y: "mean", stroke: INK, strokeWidth: 2, curve: "monotone-x" }),
      Plot.line(nowRows, { x: "i", y: "now", stroke: AMBER, strokeWidth: 3, curve: "monotone-x" }),
      Plot.dot(nowRows.slice(-1), { x: "i", y: "now", fill: AMBER, r: 5 }),
      Plot.text(nowRows.slice(-1), { x: "i", y: "now", text: (r) => `${Math.round(r.now)}`, dy: -12, fill: AMBER, fontWeight: 600 }),
      Plot.tip(rows, Plot.pointerX({ x: "i", y: "mean", title: (r) => `${r.lab}\npast average: ${pct(r.mean)}\nrange: ${pct(r.lo)} to ${pct(r.hi)}${r.now != null ? `\nthis year: ${pct(r.now)}` : ""}` })),
    ],
  });
  el.replaceChildren(chart);
}

function factCards(d) {
  const cards = [];
  const sig = d.significance || {};
  const ond = sig["Northeast monsoon onset (Oct-Dec)"];
  const sw = sig["Southwest monsoon (May-Sep)"];
  if (sw) cards.push(card("May to Sep in strong El Niños", pct(sw.pct_of_normal) + " of normal rain", sigText(sw)));
  if (ond) cards.push(card("Oct to Dec in strong El Niños", pct(ond.pct_of_normal) + " of normal rain", sigText(ond)));
  const tr = d.trend?.rain;
  if (tr) cards.push(card("Rain trend, 2001 to 2025", `${tr.pct_per_decade > 0 ? "+" : ""}${tr.pct_per_decade}% per decade`,
    tr.significant_fdr ? "Statistically significant (Mann-Kendall, p < 0.05 after correction)" : `Not statistically significant (p = ${tr.p})`));
  const ts = d.trend?.soil;
  if (ts) cards.push(card("Soil moisture trend, 2001 to 2025", ts.trend === "no trend" ? "No clear trend" : ts.trend,
    ts.significant_fdr ? "Statistically significant after correction" : `Not significant (p = ${ts.p})`));
  return cards.join("");
}
const card = (k, v, dsc) => `<div class="fact"><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p><p class="d">${esc(dsc)}</p></div>`;
const sigText = (s) => s.p < 0.05
  ? `Unlikely to be chance (p = ${s.p}, ${s.n_events} events vs ${s.n_years} years)`
  : `Could be chance (p = ${s.p}, ${s.n_events} events vs ${s.n_years} years)`;

function story(name, d) {
  const out = [];
  const used = DATA.el_nino.strong_used || [];
  const sig = d.significance || {};
  const sw = sig["Southwest monsoon (May-Sep)"], ond = sig["Northeast monsoon onset (Oct-Dec)"];
  if (sw && ond) {
    out.push(`Biome looked at ${used.length} strong El Niños since ${Math.min(...used)}. In those years, ${name} received ${pct(sw.pct_of_normal)} of its normal rain from May to September, then ${pct(ond.pct_of_normal)} from October to December.`);
  }
  const ev = d.this_event?.rain_pct || [];
  const lastI = ev.reduce((a, v, i) => (v != null ? i : a), -1);
  if (lastI >= 0) {
    out.push(`In ${DATA.el_nino.current?.year0 ?? "this year"}, the latest full month (${DATA.meta.lag_labels[lastI].replace("+1", "")}) brought ${pct(ev[lastI])} of normal rain.`);
  }
  if (d.so_far) out.push(`${monthName(d.so_far.month)} so far (${d.so_far.days} days) is on pace for ${pct(d.so_far.rain_pct)} of a normal month.`);
  const tr = d.trend?.rain;
  if (tr) out.push(tr.significant_fdr
    ? `Over 2001 to 2025, rain here changed by ${tr.pct_per_decade}% per decade, a trend unlikely to be chance.`
    : `Over 2001 to 2025, rain here shows no trend that stands out from natural ups and downs.`);
  return out;
}

function renderHow() {
  const m = DATA.meta, v = DATA.validation, b = DATA.backtest, e = DATA.el_nino;
  const rng = (r) => (r ? `${monthName(r[0])} to ${monthName(r[1])}` : "not loaded");
  const rules = Object.entries(m.rules).map(([k, t]) => `<li><b>${esc(k)}:</b> ${esc(t)}.</li>`).join("");
  const evRows = e.events.filter((x) => x.strength === "strong" || x.strength === "very strong")
    .map((x) => `<tr><td>${x.year0} to ${x.year0 + 1}</td><td>${esc(x.strength)}</td><td>${x.peak}</td><td>${x.ongoing ? "this year, shown in amber" : e.strong_used.includes(x.year0) ? "in the profile" : "outside data"}</td></tr>`).join("");
  const stRows = (v.stations || []).map((s) => `<tr><td>${esc(s.station)}</td><td>${esc(s.district)}</td><td>${s.months}</td><td>${s.r_monthly}</td><td>${s.r_anomaly}</td><td>${s.bias_pct > 0 ? "+" : ""}${s.bias_pct}%</td></tr>`).join("");
  const btRows = (b || []).map((x) => `<tr><td>${esc(x.event)}</td><td>${esc(x.district)}</td><td>${esc(x.month_before?.watch ?? "n/a")} (soil rank ${x.month_before?.soil_pct ?? "n/a"})</td><td>${esc(x.month_of?.watch ?? "n/a")}</td></tr>`).join("");
  $("#how-body").innerHTML = `
    <p>Biome is a trend detective, not a weather forecast. It learns what is normal for each district, looks at how past strong El Niños hit it, and places this year inside that pattern. Every number on this page is computed from the public data below, with code you can rerun.</p>
    <h3>NASA and partner data</h3>
    <div class="table-wrap"><table>
      <tr><th>What</th><th>Dataset</th><th>Period used</th></tr>
      <tr><td>Rain</td><td>NASA GPM IMERG Final, monthly 0.1° (V07); IMERG Late daily for the latest months</td><td>${esc(rng(m.data_ranges.rain))}</td></tr>
      <tr><td>Soil moisture</td><td>NASA GLDAS Noah, monthly 0.25° (V2.1), root zone</td><td>${esc(rng(m.data_ranges.soil))}</td></tr>
      <tr><td>Plant greenness</td><td>NASA MODIS Terra NDVI, monthly 1 km (MOD13A3 v061)</td><td>${esc(rng(m.data_ranges.ndvi))}</td></tr>
      <tr><td>Older El Niños</td><td>NASA MERRA-2 reanalysis, monthly rain and soil wetness</td><td>${esc(rng(m.data_ranges.merra2_rain))}</td></tr>
      <tr><td>El Niño years</td><td>NOAA Oceanic Niño Index (official definition)</td><td>1950 to now</td></tr>
      <tr><td>Ground truth</td><td>NOAA GHCN-Daily rain gauges in Sri Lanka</td><td>see check below</td></tr>
    </table></div>
    <h3>The Watch rules</h3><ul>${rules}</ul>
    <h3>Method</h3>
    <ol>
      <li>District averages for every month, weighting each satellite grid cell by how much of it lies in the district.</li>
      <li>Normal for each district and calendar month over ${esc(m.normal_period)}; rain as % of normal, soil moisture as a rank against the same month in other years.</li>
      <li>Strong El Niños (peak index 1.5 or more) chosen by NOAA's rule, not by us.</li>
      <li>Significance: El Niño seasons compared with 5,000 random sets of years from the whole record (permutation test).</li>
      <li>Long-term trend: Seasonal Mann-Kendall test with Sen's slope, corrected for testing 25 districts at once (Benjamini-Hochberg).</li>
    </ol>
    <h3>Strong El Niños in the record</h3>
    <div class="table-wrap"><table><tr><th>Event</th><th>Strength</th><th>Peak index</th><th>Use</th></tr>${evRows}</table></div>
    <h3>Check against rain gauges</h3>
    <p>Satellite rain for the district compared with NOAA station records, month by month. "Anomaly r" removes the seasons first, so it shows whether the satellite catches unusual months, not just the monsoon.</p>
    <div class="table-wrap"><table><tr><th>Station</th><th>District</th><th>Months</th><th>r (monthly)</th><th>r (anomaly)</th><th>Satellite bias</th></tr>${stRows || '<tr><td colspan="6">Station check not run yet.</td></tr>'}</table></div>
    <h3>Backtest on known disasters</h3>
    <p>What the Watch rules showed in the month before and the month of past disasters.</p>
    <div class="table-wrap"><table><tr><th>Event</th><th>District</th><th>Month before</th><th>Month of</th></tr>${btRows}</table></div>
    <h3>Limits</h3>
    <ul>
      <li>Only a handful of strong El Niños fall in the record, so the profile is a pattern, not a certainty.</li>
      <li>Satellite rain smooths out local cloudbursts; a district average can hide a village-scale downpour.</li>
      <li>The latest months use NASA's early estimates, which are revised later.</li>
      <li>MODIS Terra has drifted in orbit since 2022; greenness is used only as supporting evidence.</li>
    </ul>`;
}

load().catch((err) => {
  $("#status").textContent = "Could not load the data.";
  console.error(err);
});
