import "./style.css";
import { geoArea, geoMercator, geoPath } from "d3-geo";
import * as Plot from "@observablehq/plot";
import { LANGS, t, dName, pName, monthName, getLang, setLang } from "./i18n.js";
import { VIEWS, COASTAL, buildReport, reportHTML, downloadPNG, wireAlerts } from "./simple.js";
import { loadNasa, renderGallery, renderMissions, centreMap } from "./nasa.js";

const WATCH = {
  SlopeWatch: { hex: "#7d2e1c", brand: "SlopeWatch" },
  FloodWatch: { hex: "#2b7c8a", brand: "FloodWatch" },
  DryWatch: { hex: "#d9a441", brand: "DryWatch" },
  Clear: { hex: "#d8ddd6", brand: "" },
};
const ORDER = ["SlopeWatch", "FloodWatch", "DryWatch", "Clear"];
const AMBER = "#b86f12";
const INK = "#16201f";
const GAUGE_HOT = ["alert", "minor flood", "major flood"];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r0 = (v) => (v == null ? "?" : Math.round(v));
const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
const watchLabel = (w) => (w === "Clear" ? t("w_Clear") : `${WATCH[w].brand} · ${t(`w_${w}`)}`);

// d3-geo expects clockwise outer rings; this boundary file uses the opposite order.
function rewind(feature) {
  const g = feature.geometry;
  if (!g) return feature;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const rings of polys) {
    for (let i = 0; i < rings.length; i++) {
      const big = geoArea({ type: "Polygon", coordinates: [rings[i]] }) > 2 * Math.PI;
      if ((i === 0 && big) || (i > 0 && !big)) rings[i].reverse();
    }
  }
  return feature;
}

let SAFE = null, TOWNS = null;
const townOf = {};   // the division picked in each district
let DATA, GEO, FLOOD, current, profileKind = "el_nino", showFlood = false;
let cal = { mode: "fc", level: "district", place: null, type: "after_el_nino" };
let view = "family"; // family, farmer, coast (plain language) or full (all the data)
try { view = localStorage.getItem("biome-view") || "family"; } catch { /* storage blocked */ }
if (!VIEWS.includes(view)) view = "family";
const simple = () => view !== "full";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function load() {
  const [d, g] = await Promise.all([
    fetch("data/biome.json").then((r) => r.json()),
    fetch("data/districts.geojson").then((r) => r.json()),
  ]);
  DATA = d;
  GEO = g;
  GEO.features.forEach((f) => { f.properties.name = f.properties.shapeName.replace(" District", "").trim(); rewind(f); });
  profileKind = DATA.el_nino.profile_shown || "el_nino";
  fetch("data/flood_nov2025.geojson").then((r) => (r.ok ? r.json() : null)).then((fl) => {
    if (fl) { fl.features.forEach(rewind); FLOOD = fl; }
  }).catch(() => {});
  const parts = decodeURIComponent(location.hash.slice(1)).split("/");
  if (VIEWS.includes(parts[0])) view = parts.shift();
  const fromHash = parts[0] || "";
  renderAll();
  // NASA pictures and the evacuation places load after the first paint
  loadNasa().then(() => renderGallery($("#nasa")));
  fetch("data/safe_centres.json").then((r) => (r.ok ? r.json() : null)).then((j) => { SAFE = j; if (current) renderPanel(current); }).catch(() => {});
  fetch("data/towns.geojson").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { j.features.forEach(rewind); TOWNS = j; if (current) renderPanel(current); } }).catch(() => {});
  const names = Object.keys(DATA.districts);
  select(names.find((n) => slug(n) === fromHash) || pickDefault(names), false);
}

function pickDefault(names) {
  if (view === "coast") names = names.filter((n) => COASTAL.has(n));
  for (const w of ORDER.slice(0, 3)) {
    const hit = names.find((n) => DATA.districts[n].watch === w);
    if (hit) return hit;
  }
  return names.includes("Kandy") ? "Kandy" : names[0];
}

function renderAll() {
  document.documentElement.lang = getLang();
  if (DATA.meta.synthetic) $("#test-banner").hidden = false;
  $("#tagline").textContent = t("tagline");
  $("#ov-title").textContent = t("headline");
  $("#how-title").textContent = t("how_title");
  $("#foot-text").textContent = t("foot");
  document.body.dataset.view = view;
  renderLangs();
  renderTabs();
  renderStatus();
  renderMap();
  renderLegend();
  renderPicker();
  renderCalendar();
  renderHow();
  renderGallery($("#nasa"));
  renderMissions($("#missions"));
  if (current) select(current, false);
}

function renderLangs() {
  $("#langs").innerHTML = Object.entries(LANGS).map(([k, label]) =>
    `<button type="button" class="lang ${k === getLang() ? "on" : ""}" data-l="${k}" lang="${k}" aria-pressed="${k === getLang()}">${label}</button>`).join("");
  $("#langs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.l); renderAll(); }));
}

function renderTabs() {
  const el = $("#tabs");
  el.setAttribute("aria-label", t("tabs_label"));
  el.innerHTML = VIEWS.map((v) => `<button type="button" class="tab ${v === view ? "on" : ""}" data-v="${v}" aria-pressed="${v === view}">${esc(t("tab_" + v))}</button>`).join("");
  el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
}

function setView(v) {
  view = v;
  try { localStorage.setItem("biome-view", v); } catch { /* storage blocked */ }
  if (v === "coast" && current && !COASTAL.has(current)) current = pickDefault(Object.keys(DATA.districts));
  renderAll();
  if (current) select(current);
}

function renderStatus() {
  const m = DATA.meta, cur = DATA.el_nino.current;
  const so = Object.values(DATA.districts).find((d) => d.so_far)?.so_far;
  const latest = so ? `${monthName(so.month)} (${t("early", { n: so.days })})` : monthName(m.latest_month);
  const nino = cur ? t(cur.kind === "la_nina" ? "nina" : "nino", { y: cur.year0, s: t(cur.strength), v: cur.peak }) : t("neutral");
  $("#status").innerHTML = `<b>${esc(nino)}</b> · ${esc(t("latest", { m: latest }))}`;
  const c = m.watch_counts || {};
  const parts = ["SlopeWatch", "FloodWatch", "DryWatch"].filter((w) => c[w]).map((w) => t("count", { n: c[w], w: WATCH[w].brand }));
  $("#lede").textContent = simple() ? t("simple_lede") : parts.length ? t("lede", { list: parts.join(", ") }) : t("lede_none");
}

function renderMap() {
  const svg = $("#map");
  const W = 400, H = 560;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const proj = geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], GEO);
  const path = geoPath(proj);
  const districts = GEO.features.map((f) => {
    const n = f.properties.name, w = DATA.districts[n]?.watch || "Clear";
    const label = `${dName(n)}: ${simple() ? t("n_" + w) : watchLabel(w)}`;
    return `<path class="district${view === "coast" && !COASTAL.has(n) ? " dim" : ""}" data-name="${esc(n)}" d="${path(f)}" fill="${WATCH[w].hex}" tabindex="0" role="button" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
  }).join("");
  const flood = showFlood && FLOOD ? `<path class="flood" d="${path(FLOOD)}"/>` : "";
  const res = (DATA.reservoirs?.items || []).map((r) => {
    const [x, y] = proj([r.lon, r.lat]);
    return `<circle class="res ${r.spilling ? "spill" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.spilling ? 4 : 3}"><title>${esc(r.name)}: ${esc(t("full", { p: r0(r.pct_full) }))}${r.spilling ? ", " + esc(t("spilling", { c: r0(r.spill_cusec) })) : ""}</title></circle>`;
  }).join("");
  const gauges = (DATA.rivers?.items || []).filter((g) => g.lat && GAUGE_HOT.includes(g.status)).map((g) => {
    const [x, y] = proj([g.lon, g.lat]);
    return `<path class="gauge" d="M${x.toFixed(1)} ${(y - 6).toFixed(1)}l5 9h-10z"><title>${esc(g.gauge)}: ${esc(t("g_" + g.status))}</title></path>`;
  }).join("");
  svg.innerHTML = districts + (simple() ? "" : flood + `<g>${res}${gauges}</g>`) + `<g id="map-label"></g>`;
  svg.querySelectorAll("path.district").forEach((p) => {
    p.addEventListener("click", () => select(p.dataset.name));
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(p.dataset.name); } });
  });
  svg._path = path;
}

function renderLegend() {
  const c = DATA.meta.watch_counts || {};
  if (simple()) {
    $("#legend").innerHTML = ORDER.map((w) => `<li><span class="sw" style="background:${WATCH[w].hex}"></span>${esc(t("n_" + w))}</li>`).join("");
    return;
  }
  $("#legend").innerHTML = ORDER.map((w) => `<li><span class="sw" style="background:${WATCH[w].hex}"></span>${esc(w === "Clear" ? t("w_Clear") : WATCH[w].brand)} <span class="muted">(${c[w] || 0})</span></li>`).join("")
    + `<li><span class="sw dot"></span>${esc(t("lg_res"))}</li>`
    + (DATA.rivers ? `<li><span class="sw tri"></span>${esc(t("lg_gauge"))}</li>` : "")
    + (FLOOD ? `<li><label class="chk"><input type="checkbox" id="flood-toggle" ${showFlood ? "checked" : ""}> ${esc(t("flood_layer"))}</label></li>` : "");
  $("#flood-toggle")?.addEventListener("change", (e) => { showFlood = e.target.checked; renderMap(); if (current) select(current, false); });
  if (!FLOOD) setTimeout(() => FLOOD && renderLegend(), 1500);
}

function renderPicker() {
  $("#picker-label").textContent = t("choose");
  const sel = $("#district-select");
  sel.innerHTML = Object.keys(DATA.districts).sort((a, b) => dName(a).localeCompare(dName(b))).map((n) => `<option value="${esc(n)}">${esc(dName(n))}</option>`).join("");
  sel.onchange = () => select(sel.value);
}

function select(name, push = true) {
  current = name;
  $("#district-select").value = name;
  document.querySelectorAll("#map path.district").forEach((p) => p.classList.toggle("active", p.dataset.name === name));
  const f = GEO.features.find((x) => x.properties.name === name);
  if (f) {
    const [x, y] = $("#map")._path.centroid(f);
    $("#map-label").innerHTML = `<text x="${x}" y="${y}" text-anchor="middle" dy="4">${esc(dName(name))}</text>`;
  }
  if (push) history.replaceState(null, "", `#${view}/${slug(name)}`);
  if (cal.level === "district") { cal.place = name; renderCalendar(); }
  renderPanel(name);
}

function reasonText(d) {
  const v = d.flag_values || {};
  return t(`r_${d.watch}`, { s: r0(v.soil_pct), r: r0(v.rain_pct), r3: r0(v.rain3_pct), d: r0(100 - (v.soil_pct ?? 0)) });
}

function renderSimple(name) {
  if (view === "coast" && !COASTAL.has(name)) {
    $("#panel").innerHTML = `<div class="simple"><p class="aud">${esc(t("for_coast"))}</p><h2>${esc(dName(name))}</h2><p class="basis">${esc(t("coast_not", { d: dName(name) }))}</p></div>`;
    return;
  }
  const model = buildReport(name, view, DATA, SAFE, townOf[name]);
  $("#panel").innerHTML = reportHTML(model);
  const pick = (tn) => { townOf[name] = tn; renderSimple(name); };
  if ($("#cmap-slot")) {
    $("#cmap-slot").innerHTML = centreMap(name, GEO, SAFE, TOWNS, DATA.towns?.districts?.[name], townOf[name]);
    $("#cmap-slot").querySelectorAll("path.town").forEach((p) => p.addEventListener("click", () => pick(p.dataset.town === townOf[name] ? "" : p.dataset.town)));
  }
  $("#town-select")?.addEventListener("change", (e) => pick(e.target.value));
  wireAlerts(model);
  $("#dl-png").addEventListener("click", () => downloadPNG(model));
  $("#dl-pdf").addEventListener("click", () => window.print());
}

function renderPanel(name) {
  if (simple()) return renderSimple(name);
  const d = DATA.districts[name];
  const early = d.so_far ? ` (${t("early", { n: d.so_far.days })})` : "";
  const soilNote = d.flag_values?.wet_source === "rain3" ? t("wet_from_rain") + " "
    : d.now.soil_month && d.now.soil_month !== d.flag_month ? t("soil_from", { m: monthName(d.now.soil_month) }) + " " : "";
  const hasLN = !!d.profiles?.la_nina;
  const yr = DATA.el_nino.current?.year0 ?? "";
  $("#panel").innerHTML = `
    <h2>${esc(dName(name))}</h2>
    <p class="sub">${esc(d.hill ? t("hill") : t("district"))} · ${esc(monthName(d.flag_month))}${esc(early)}</p>
    <span class="badge ${d.watch}">${esc(watchLabel(d.watch))}</span>
    ${d.level ? `<p class="lv-line l${d.level.level}"><i class="lv-dot"></i><b>${esc(t("lvl_" + d.level.level))}</b>${d.level.hazard ? ` (${esc(t("hz_" + d.level.hazard))})` : ""} · ${esc(t("lvl_rain", { a: r0(d.level.rain_1d), b: r0(d.level.rain_3d), d: d.level.day }))}</p>` : ""}
    <p class="reason">${esc(reasonText(d))}</p>
    ${d.next ? `<p class="next">${esc(t("next", { n: d.next.months.length, p: r0(d.next.rain_pct) }))}</p>` : ""}
    <p class="meta-line">${esc(soilNote)}${esc(t("not_forecast"))}</p>
    <div id="live"></div>
    <div id="safe-full"></div>
    <div class="figure">
      <div class="fig-head"><h3>${esc(t("swing_title"))}</h3>
        ${hasLN ? `<div class="seg" role="group">${["el_nino", "la_nina"].map((k) => `<button type="button" data-k="${k}" class="${k === profileKind ? "on" : ""}" aria-pressed="${k === profileKind}">${esc(t("t_" + k))}</button>`).join("")}</div>` : ""}
      </div>
      <p class="cap">${esc(t("swing_cap", { y: yr }))}</p>
      <div class="chart" id="chart-rain"></div>
    </div>
    <div class="figure">
      <h3>${esc(t("soil_title"))}</h3>
      <p class="cap">${esc(t("soil_cap"))}</p>
      <div class="chart" id="chart-soil"></div>
    </div>
    <div class="facts">${factCards(d)}</div>
    <div class="story"><h3>${esc(t("story_title", { d: dName(name) }))}</h3>${story(name, d).map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
  $("#panel").querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => { profileKind = b.dataset.k; renderPanel(name); }));
  const prof = (d.profiles && d.profiles[profileKind]) || d.profile;
  const showNow = profileKind === (DATA.el_nino.profile_shown || "el_nino");
  drawSwing("#chart-rain", prof?.rain_pct, showNow ? d.this_event?.rain_pct : null, 100, t("y_rain"));
  drawSwing("#chart-soil", prof?.soil_pct, showNow ? d.this_event?.soil_pct : null, 50, t("y_soil"), [0, 100]);
  renderLive(name);
  const sp = SAFE?.districts?.[name];
  const tws = DATA.towns?.districts?.[name] || [];
  const townTable = tws.length ? `<div class="live"><h3>${esc(t("s_towns"))} <span class="nasa-tag">NASA GPM IMERG + SRTM</span></h3>
    <div class="table-wrap"><table class="towns"><tr><th>${esc(t("th_town"))}</th><th>${esc(t("th_today"))}</th><th>${esc(t("th_rain"))}</th><th>${esc(t("th_steep"))}</th><th>${esc(t("th_ditwah"))}</th></tr>
    ${tws.map((x) => `<tr><td>${esc(x.name)}</td><td class="l${x.level}"><i class="lv-dot"></i> ${esc(t("lvs_" + x.level))}</td><td>${r0(x.rain_1d)} mm</td><td>${x.steep_share == null ? "" : Math.round(x.steep_share * 100) + "%"}</td><td class="l${x.ditwah?.level || 0}">${x.ditwah ? `<i class="lv-dot"></i> ${esc(t("lvs_" + x.ditwah.level))}, ${r0(x.ditwah.rain_mm)} mm` : ""}</td></tr>`).join("")}</table></div>
    <p class="cap">${esc(t("town_note"))}</p></div>` : "";
  if (sp) $("#safe-full").innerHTML = `${townTable}<div class="live"><h3>${esc(t("s_safe"))} <span class="nasa-tag">NASA SRTM</span></h3>${centreMap(name, GEO, SAFE, TOWNS, tws)}
    <ol class="picks">${sp.top.slice(0, 5).map((c) => `<li>${esc(c[3])} <span class="muted">(${esc(t("kind_" + c[2]))}, ${c[4]} m)</span></li>`).join("")}</ol>
    <p class="cap">${esc(t("safe_count", { a: sp.safer, n: sp.count }))} ${esc(t("safe_note"))}</p></div>`;
}

function renderLive(name) {
  const res = (DATA.reservoirs?.items || []).filter((r) => r.district === name).sort((a, b) => (b.pct_full ?? 0) - (a.pct_full ?? 0));
  const gauges = (DATA.rivers?.items || []).filter((g) => g.district === name);
  if (!DATA.reservoirs && !DATA.rivers) return;
  const release = res.some((r) => r.spilling) && gauges.some((g) => GAUGE_HOT.includes(g.status));
  const when = [DATA.reservoirs?.date, DATA.rivers?.latest].filter(Boolean).join(" · ");
  $("#live").innerHTML = `
    <div class="live">
      <h3>${esc(t("live_title"))}</h3>
      ${release ? `<p class="release">${esc(t("release"))}</p>` : ""}
      <ul class="rows">
        ${res.length ? res.map((r) => `<li><span class="nm">${esc(r.name)}</span><span>${esc(t("full", { p: r0(r.pct_full) }))}</span><span class="${r.spilling ? "hot" : "muted"}">${esc(r.spilling ? t("spilling", { c: r0(r.spill_cusec) }) : t("not_spilling"))}</span></li>`).join("") : `<li class="muted">${esc(t("res_none"))}</li>`}
      </ul>
      <ul class="rows">
        ${gauges.length ? gauges.map((g) => `<li><span class="nm">${esc(g.gauge)}</span><span>${esc(t("level", { l: g.level_m, a: g.alert_m }))}</span><span class="${GAUGE_HOT.includes(g.status) ? "hot" : "muted"}">${esc(t("g_" + g.status))}</span></li>`).join("") : `<li class="muted">${esc(t("gauges_none"))}</li>`}
      </ul>
      <p class="cap">${esc(t("live_src", { t: when }))}</p>
    </div>`;
}

function drawSwing(sel, prof, now, ref, label, domain) {
  const el = $(sel);
  if (!prof) { el.innerHTML = ""; return; }
  const L = DATA.meta.lag_labels.map((_, i) => monthName(`${2001 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, true) + (i >= 12 ? "+1" : ""));
  const rows = L.map((lab, i) => ({ i, lab, mean: prof.mean[i], lo: prof.min[i], hi: prof.max[i], now: now ? now[i] : null }));
  const nowRows = rows.filter((r) => r.now != null);
  const chart = Plot.plot({
    width: Math.min(760, el.clientWidth || 640), height: 260, marginLeft: 48, marginRight: 16,
    style: { fontFamily: "inherit", fontSize: "12px", color: INK, background: "transparent" },
    x: { domain: [0, L.length - 1], ticks: L.map((_, i) => i).filter((i) => i % 2 === 0), tickFormat: (i) => L[i], label: null },
    y: { label, grid: true, domain, nice: true },
    marks: [
      Plot.areaY(rows.filter((r) => r.lo != null && r.hi != null), { x: "i", y1: "lo", y2: "hi", fill: "#9aa39e", fillOpacity: 0.25, curve: "monotone-x" }),
      Plot.ruleY([ref], { stroke: "#6b7470", strokeDasharray: "4 4" }),
      Plot.line(rows.filter((r) => r.mean != null), { x: "i", y: "mean", stroke: INK, strokeWidth: 2, curve: "monotone-x" }),
      Plot.line(nowRows, { x: "i", y: "now", stroke: AMBER, strokeWidth: 3, curve: "monotone-x" }),
      Plot.dot(nowRows.slice(-1), { x: "i", y: "now", fill: AMBER, r: 5 }),
      Plot.text(nowRows.slice(-1), { x: "i", y: "now", text: (r) => `${Math.round(r.now)}`, dy: -12, fill: AMBER, fontWeight: 600 }),
      Plot.tip(rows, Plot.pointerX({ x: "i", y: "mean", title: (r) => `${r.lab}\n${t("past_avg")}: ${r0(r.mean)}\n${t("range")}: ${r0(r.lo)}–${r0(r.hi)}${r.now != null ? `\n${t("this_year")}: ${r0(r.now)}` : ""}` })),
    ],
  });
  el.replaceChildren(chart);
}

function factCards(d) {
  const sig = d.significance || {}, out = [];
  const card = (k, v, dsc) => `<div class="fact"><p class="k">${esc(k)}</p><p class="v">${esc(v)}</p><p class="d">${esc(dsc)}</p></div>`;
  const chance = (s) => t(s.p < 0.05 ? "f_not_chance" : "f_chance", { p: s.p });
  const sw = sig["Southwest monsoon (May-Sep)"], ond = sig["Northeast monsoon onset (Oct-Dec)"];
  if (sw) out.push(card(t("f_sw"), t("f_of_normal", { p: r0(sw.pct_of_normal) }), chance(sw)));
  if (ond) out.push(card(t("f_ond"), t("f_of_normal", { p: r0(ond.pct_of_normal) }), chance(ond)));
  const tr = d.trend?.rain;
  if (tr) out.push(card(t("f_trend"), t("f_per_decade", { p: (tr.pct_per_decade > 0 ? "+" : "") + tr.pct_per_decade }), tr.significant_fdr ? t("f_sig") : t("f_notsig", { p: tr.p })));
  return out.join("");
}

function story(name, d) {
  const out = [], used = DATA.el_nino.strong_used || [], sig = d.significance || {};
  const sw = sig["Southwest monsoon (May-Sep)"], ond = sig["Northeast monsoon onset (Oct-Dec)"];
  if (sw && ond && used.length) out.push(t("story_swing", { n: used.length, y: Math.min(...used), d: dName(name), a: r0(sw.pct_of_normal), b: r0(ond.pct_of_normal) }));
  if (d.so_far) out.push(t("story_sofar", { m: monthName(d.so_far.month), n: d.so_far.days, p: r0(d.so_far.rain_pct) }));
  const tr = d.trend?.rain;
  if (tr) out.push(tr.significant_fdr ? t("story_trend_yes", { p: tr.pct_per_decade }) : t("story_trend_no"));
  return out;
}

function renderCalendar() {
  const C = DATA.calendar, F = DATA.forecast;
  if (!C) { $("#calendar").hidden = true; return; }
  if (!F) cal.mode = "hist";
  const places = { country: ["Sri Lanka"], province: Object.keys(C.provinces), district: Object.keys(C.district).sort() };
  if (!cal.place || !C[cal.level][cal.place]) cal.place = cal.level === "district" ? (current || places.district[0]) : places[cal.level][0];
  const nm = (p) => (cal.level === "district" ? dName(p) : pName(p));
  const types = ["after_el_nino", "all", "el_nino", "la_nina", "neutral"];
  const fcMode = cal.mode === "fc";
  $("#cal-title").textContent = t("cal_title");
  const nYears = F ? F.train_years[1] - F.train_years[0] + 1 : 0;
  $("#cal-lede").textContent = fcMode ? t("cal_fc_lede", { n: nYears }) : t("cal_lede", { a: C.years?.[0], b: C.years?.[1] });
  $("#cal-controls").innerHTML = `
    ${F ? `<label>${esc(t("cal_mode"))}<select id="cal-mode"><option value="fc" ${fcMode ? "selected" : ""}>${esc(t("cal_mode_fc"))}</option><option value="hist" ${fcMode ? "" : "selected"}>${esc(t("cal_mode_hist"))}</option></select></label>` : ""}
    <label>${esc(t("cal_level"))}<select id="cal-level">${["country", "province", "district"].map((l) => `<option value="${l}" ${l === cal.level ? "selected" : ""}>${esc(t("lvl_" + l))}</option>`).join("")}</select></label>
    <label>&nbsp;<select id="cal-place">${places[cal.level].map((p) => `<option value="${esc(p)}" ${p === cal.place ? "selected" : ""}>${esc(nm(p))}</option>`).join("")}</select></label>
    ${fcMode ? "" : `<label>${esc(t("cal_type"))}<select id="cal-type">${types.map((ty) => `<option value="${ty}" ${ty === cal.type ? "selected" : ""}>${esc(t("ty_" + ty))}</option>`).join("")}</select></label>`}`;
  if ($("#cal-mode")) $("#cal-mode").onchange = (e) => { cal.mode = e.target.value; renderCalendar(); };
  $("#cal-level").onchange = (e) => { cal.level = e.target.value; cal.place = null; renderCalendar(); };
  $("#cal-place").onchange = (e) => { cal.place = e.target.value; renderCalendar(); };
  if ($("#cal-type")) $("#cal-type").onchange = (e) => { cal.type = e.target.value; renderCalendar(); };
  const watchHead = (w) => `<th>${esc(WATCH[w].brand)}<span class="muted"> · ${esc(t("w_" + w))}</span></th>`;

  if (fcMode) {
    const node = F[cal.level][cal.place], sig = F.skill.signal;
    const head = F.months.map((ym) => `<th>${esc(monthName(ym, true))}<br><span class="muted">${ym.slice(2, 4)}</span></th>`).join("");
    const rain = cal.level === "district" ? `<tr><th>${esc(t("cal_row_rain"))}</th>${node.median.map((v, i) => `<td class="rain ${!sig[i] ? "" : v < 85 ? "dry" : v > 115 ? "wet" : ""}" title="${node.lo[i]} to ${node.hi[i]}%">${v}</td>`).join("")}</tr>` : "";
    const rows = ["DryWatch", "FloodWatch", "SlopeWatch"].map((w) => `<tr>${watchHead(w)}${node.watch[w].map((p) => `<td style="--a:${Math.min(1, p)};--c:${WATCH[w].hex}" title="${esc(t("cal_cell_fc", { p: Math.round(p * 100) }))}">${Math.round(p * 100)}%</td>`).join("")}</tr>`).join("");
    const conf = `<tr><th>${esc(t("cal_row_conf"))}</th>${sig.map((ok) => `<td class="conf ${ok ? "yes" : "no"}">${esc(t(ok ? "cal_conf_yes" : "cal_conf_no"))}</td>`).join("")}</tr>`;
    const hits = F.skill.like_this_year.hit_rate.filter((_, i) => sig[i]);
    const a = hits.length ? Math.round(10 * hits.reduce((x, y) => x + y, 0) / hits.length) : 3;
    $("#cal-table").innerHTML = `<table class="cal"><tr><th></th>${head}</tr>${rain}${rows}${conf}</table>
      <p class="cap">${esc(t("basis_model", { n: nYears, a }))} <span class="nasa-tag">NASA GPM IMERG + MERRA-2</span></p>
      <p><button type="button" class="btn" id="cal-csv">${esc(t("cal_csv"))}</button></p>`;
    $("#cal-csv").onclick = () => {
      const lines = ["district,month,rain_median_pct_of_usual,rain_low_pct,rain_high_pct,chance_drier,chance_wetter,chance_DryWatch,chance_FloodWatch,chance_SlopeWatch,model_check"];
      for (const [d, x] of Object.entries(F.district)) F.months.forEach((ym, i) => lines.push([d, ym, x.median[i], x.lo[i], x.hi[i], x.p_dry[i], x.p_wet[i], x.watch.DryWatch[i], x.watch.FloodWatch[i], x.watch.SlopeWatch[i], sig[i] ? "passed" : "no skill"].join(",")));
      const a2 = document.createElement("a");
      a2.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a2.download = `biome-risk-calendar-${F.months[0]}.csv`;
      document.body.appendChild(a2); a2.click(); a2.remove();
    };
    return;
  }
  const rec = C[cal.level][cal.place][cal.type];
  const months = Array.from({ length: 12 }, (_, i) => monthName(`2001-${String(i + 1).padStart(2, "0")}`, true));
  const shade = (n, tot) => (tot ? Math.min(1, n / tot) : 0);
  const tot = rec.years;
  $("#cal-table").innerHTML = `<table class="cal"><tr><th></th>${months.map((m) => `<th>${esc(m)}</th>`).join("")}</tr>
    ${["DryWatch", "FloodWatch", "SlopeWatch"].map((w) => `<tr>${watchHead(w)}${rec[w].map((n) => `<td style="--a:${shade(n, tot)};--c:${WATCH[w].hex}" title="${esc(t("cal_cell", { n, t: tot }))}">${n}</td>`).join("")}</tr>`).join("")}
    </table><p class="cap">${esc(t("cal_cell", { n: "n", t: tot }))}</p>`;
}

function renderHow() {
  const m = DATA.meta, v = DATA.validation, b = DATA.backtest, e = DATA.el_nino, R = DATA.reservoirs;
  const rng = (r) => (r ? `${r[0]} to ${r[1]}` : "not loaded");
  const rules = Object.entries(m.rules).map(([k, txt]) => `<li><b>${esc(k)}:</b> ${esc(txt)}.</li>`).join("");
  const evRows = [...e.events.filter((x) => x.strength === "strong" || x.strength === "very strong"), ...(e.la_nina_events || []).filter((x) => x.strength !== "weak")]
    .filter((x) => x.year0 >= 1980)
    .sort((a, c) => a.year0 - c.year0)
    .map((x) => `<tr><td>${x.kind === "la_nina" ? "La Niña" : "El Niño"} ${x.year0} to ${x.year0 + 1}</td><td>${esc(x.strength)}</td><td>${x.peak}</td><td>${x.ongoing ? "this year" : (e.strong_used || []).includes(x.year0) || (e.la_nina_used || []).includes(x.year0) ? "in the profile" : "outside data"}</td></tr>`).join("");
  const stRows = (v.stations || []).map((s) => `<tr><td>${esc(s.station)}</td><td>${esc(s.district)}</td><td>${s.months}</td><td>${s.r_monthly}</td><td>${s.r_anomaly}</td><td>${s.bias_pct > 0 ? "+" : ""}${s.bias_pct}%</td></tr>`).join("");
  const btRows = (b || []).map((x) => `<tr><td>${esc(x.event)}</td><td>${esc(x.district)}</td><td>${esc(x.month_before?.watch ?? "n/a")} (ground wetness rank ${x.month_before?.wet_pct ?? "n/a"})</td><td>${esc(x.month_of?.watch ?? "n/a")}</td></tr>`).join("");
  $("#how-body").innerHTML = `
    ${getLang() !== "en" ? `<p class="muted">${esc(t("how_note"))}</p>` : ""}
    <p>Biome is a trend detective, not a weather forecast. It learns what is normal for each district, looks at how past El Niños and La Niñas hit it, and places this year inside that pattern. Every number on this page is computed from the public data below, with code you can rerun.</p>
    <h3>NASA and partner data</h3>
    <div class="table-wrap"><table>
      <tr><th>What</th><th>Dataset</th><th>Period used</th></tr>
      <tr><td>Rain</td><td>NASA GPM IMERG Final, monthly 0.1° (V07); IMERG Late daily for the latest months</td><td>${esc(rng(m.data_ranges.rain))}</td></tr>
      <tr><td>Soil moisture</td><td>NASA GLDAS Noah, monthly 0.25° (V2.1), root zone</td><td>${esc(rng(m.data_ranges.soil))}</td></tr>
      <tr><td>Plant greenness</td><td>NASA MODIS Terra NDVI, monthly 1 km (MOD13A3 v061)</td><td>${esc(rng(m.data_ranges.ndvi))}</td></tr>
      <tr><td>Older years</td><td>NASA MERRA-2 reanalysis, monthly rain and soil wetness</td><td>${esc(rng(m.data_ranges.merra2_rain))}</td></tr>
      <tr><td>El Niño and La Niña years</td><td>NOAA Oceanic Niño Index (official definition)</td><td>1950 to now</td></tr>
      <tr><td>Ground truth</td><td>NOAA GHCN-Daily rain gauges in Sri Lanka</td><td>see check below</td></tr>
      <tr><td>Reservoirs and rivers</td><td>Sri Lanka Irrigation Department: daily reservoir storage and spilling, live river gauges with flood levels, Nov 2025 flood extent</td><td>${R ? `${R.count} reservoirs, ${esc(R.date)}` : "not loaded"}</td></tr>
    </table></div>
    <h3>The Watch rules</h3><ul>${rules}</ul>
    <h3>Method</h3>
    <ol>
      <li>District averages for every month, weighting each satellite grid cell by how much of it lies in the district.</li>
      <li>Normal for each district and calendar month over ${esc(m.normal_period)}; rain as % of normal, soil moisture as a rank against the same month in other years.</li>
      <li>El Niño and La Niña years chosen by NOAA's rule (strong El Niño: peak index 1.5 or more; La Niña: moderate or stronger), not by us.</li>
      <li>Significance: El Niño seasons compared with 5,000 random sets of years from the whole record (permutation test).</li>
      <li>Long-term trend: Seasonal Mann-Kendall test with Sen's slope, corrected for testing 25 districts at once (Benjamini-Hochberg).</li>
      <li>Risk calendar: the Watch rules applied to every month from ${esc(DATA.calendar?.years?.[0] ?? "")} (MERRA-2 before 2001, NASA satellites after).</li>
      <li>Reservoirs: each reservoir's monthly change in storage compared with NASA rain over its district${R?.median_r_rain_vs_storage != null ? ` (median correlation ${R.median_r_rain_vs_storage})` : ""}.</li>
    </ol>
    ${DATA.forecast ? `<h3>The outlook model and risk calendar</h3>
    <p>The outlook is a weighted analog ensemble. Every year from ${DATA.forecast.train_years[0]} to ${DATA.forecast.train_years[1]} is one possible future: the rain that really fell over the following 12 months (NASA MERRA-2 before 2001, NASA GPM IMERG after). Each year is weighted by how close its ocean state (NOAA ONI in ${esc(monthName(DATA.forecast.issue_month))}) was to today's ${DATA.forecast.oni}, with a Gaussian kernel whose width (${DATA.forecast.kernel_width}) is chosen by cross-validation. The Watch rules run on every member; the weighted share on a Watch is the chance in the calendar. The years that count most now: ${DATA.forecast.closest_years.slice(0, 5).map((y) => `${y.year} (${Math.round(y.weight * 100)}%)`).join(", ")}; the weights are worth about ${DATA.forecast.effective_members} equally weighted years.</p>
    <p>Skill is measured by leaving each year out, forecasting it from the others and scoring the three-category forecast (drier, usual, wetter) with the ranked probability skill score against equal odds. Over all years the ocean says little about Sri Lanka's monthly rain, and the model says so. In ${esc(DATA.forecast.skill.like_this_year.kind)} (${DATA.forecast.skill.like_this_year.years.join(", ")}) it has real skill for some months. Only months with a score of 0.05 or more are shown as a signal.</p>
    <div class="table-wrap"><table><tr><th>Month ahead</th>${DATA.forecast.months.map((ym) => `<th>${esc(monthName(ym, true))}</th>`).join("")}</tr>
      <tr><td>Skill score, years like this one</td>${DATA.forecast.skill.like_this_year.rpss.map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>
      <tr><td>Right category, years like this one</td>${DATA.forecast.skill.like_this_year.hit_rate.map((v) => `<td>${v == null ? "" : Math.round(v * 100) + "%"}</td>`).join("")}</tr>
      <tr><td>Skill score, all years</td>${DATA.forecast.skill.all_years.rpss.map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>
      <tr><td>Shown as a signal</td>${DATA.forecast.skill.signal.map((v) => `<td>${v ? "yes" : "no"}</td>`).join("")}</tr></table></div>
    <p class="muted">Guessing gets the right category 33% of the time. The years like this one are few (${DATA.forecast.skill.like_this_year.years.length}) and neighbouring districts are not independent, so treat the scores as a guide.</p>` : ""}
    ${DATA.levels ? `<h3>Daily risk levels</h3>
    <ul>${["1", "2", "3", "drought"].map((k) => `<li>${esc(DATA.levels.rule[k])}.</li>`).join("")}</ul>
    <p>${esc(DATA.levels.rule.source)}. Replayed on the week of Cyclone Ditwah, using only what was known at the time:</p>
    <div class="table-wrap"><table><tr><th>Day of rain</th><th>Yellow</th><th>Amber</th><th>Red</th><th>Amber and Red districts (district rain, mm)</th></tr>
      ${DATA.levels.ditwah_replay.map((r) => `<tr><td>${esc(r.day)}</td><td>${r.counts["1"]}</td><td>${r.counts["2"]}</td><td>${r.counts["3"]}</td><td>${esc(Object.entries(r.districts).filter(([, x]) => x.level >= 2).sort((a, c) => c[1].level - a[1].level).map(([n, x]) => `${n} ${x.level === 3 ? "Red" : "Amber"} (${Math.round(x.rain_mm)})`).join(", "))}</td></tr>`).join("")}</table></div>
    <p class="muted">NASA's Late rain product arrives about 14 hours after the day ends, so a level reflects yesterday's rain. It is a nowcast, not a forecast.</p>` : ""}
    ${m.hill_rule?.source ? `<h3>Hill districts and safer places</h3>
    <p>A district is hill country, and can get SlopeWatch, when ${Math.round(m.hill_rule.min_share * 100)}% or more of its land is steeper than ${m.hill_rule.steep_degrees} degrees in ${esc(m.hill_rule.source)}: ${esc(m.hill_rule.districts.join(", "))}. The same elevation data checks ${SAFE ? Object.values(SAFE.districts).reduce((a, x) => a + x.count, 0).toLocaleString() : "about 15,000"} schools, places of worship and halls from OpenStreetMap: a place is marked safer when it did not flood in Cyclone Ditwah and has no slope of 20 degrees or more within 90 m. Places are ranked by building type and by height above the lowest ground within 500 m. They are candidates for officers to confirm, not an official list.</p>` : ""}
    <h3>El Niño and La Niña in the record</h3>
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
      <li>Reservoir and river readings are the Irrigation Department's; Biome shows them as published.</li>
    </ul>`;
}

load().catch((err) => {
  $("#status").textContent = "Could not load the data.";
  console.error(err);
});
