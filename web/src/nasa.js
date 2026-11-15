// Real NASA pictures, the missions behind each feature, and the evacuation place map.
import { geoMercator, geoPath, geoContains, geoTransform } from "d3-geo";
import { t, dName, monthName } from "./i18n.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDay = (d) => `${Number(d.slice(8, 10))} ${monthName(d.slice(0, 7))}`;
const fmt = fmtDay;
let INDEX = null, day = "2025-11-27";

export async function loadNasa() {
  try { INDEX = await fetch("nasa/index.json").then((r) => (r.ok ? r.json() : null)); } catch { INDEX = null; }
  return INDEX;
}

function figure(im, cap, monthly = false) {
  if (!im) return "";
  const fmt = monthly ? (d) => monthName(d.slice(0, 7)) : fmtDay;
  const layer = im.layer.replaceAll("_", " ");
  return `<figure class="shot"><a href="${esc(im.worldview)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(im.file)}" width="${im.w}" height="${im.h}" alt="${esc(cap)}, ${esc(fmt(im.date))}. NASA ${esc(layer)}"></a>
    <figcaption><b>${esc(cap)}</b> · ${esc(fmt(im.date))}<br><span class="muted">NASA Worldview / GIBS · ${esc(layer)}</span><br><a href="${esc(im.worldview)}" target="_blank" rel="noopener">${esc(t("g_open"))}</a></figcaption></figure>`;
}

export function renderGallery(el) {
  if (!INDEX?.images?.length) { el.hidden = true; return; }
  el.hidden = false;
  const by = (g) => INDEX.images.filter((i) => i.group === g);
  const days = by("ditwah").map((i) => i.date);
  if (!days.includes(day)) day = days[0];
  const pick = (g, d) => by(g).find((i) => i.date === d);
  const now = by("now")[0], nowRain = by("now_rain")[0];
  const flood = by("flood")[0];
  el.innerHTML = `
    <h2>${esc(t("g_title"))}</h2>
    <p class="lede">${esc(t("g_lede"))}</p>
    ${days.length ? `<div class="g-block">
      <h3>${esc(t("g_ditwah"))}</h3><p class="cap">${esc(t("g_ditwah_d"))}</p>
      <div class="seg days" role="group">${days.map((d) => `<button type="button" data-d="${d}" class="${d === day ? "on" : ""}" aria-pressed="${d === day}">${esc(fmt(d))}</button>`).join("")}</div>
      <div class="shots">${figure(pick("ditwah", day), t("g_clouds"))}${figure(pick("ditwah_rain", day), t("g_rain"))}</div>
    </div>` : ""}
    ${now || nowRain ? `<div class="g-block"><h3>${esc(t("g_now"))}</h3><p class="cap">${esc(t("g_now_d"))}</p>
      <div class="shots">${figure(now, t("g_clouds"))}${figure(nowRain, t("g_rain"))}</div></div>` : ""}
    ${by("ndvi").length >= 2 ? `<div class="g-block"><h3>${esc(t("g_green"))}</h3><p class="cap">${esc(t("green_cmp"))}</p>
      <div class="shots tall">${by("ndvi").sort((a, b) => a.date.localeCompare(b.date)).map((im) => figure(im, t("s_green"), true)).join("")}</div></div>` : ""}
    <div class="g-block"><div class="shots tall">
      ${flood ? `<div><h3>${esc(t("g_flood"))}</h3><p class="cap">${esc(t("g_flood_d"))}</p>${figure(flood, t("g_flood"))}</div>` : ""}
      <div><h3>${esc(t("g_terrain"))}</h3><p class="cap">${esc(t("g_terrain_d"))}</p>
        <figure class="shot"><img loading="lazy" src="nasa/terrain.jpg" width="990" height="1600" alt="${esc(t("g_terrain"))}">
        <figcaption><span class="muted">NASA NASADEM (Shuttle Radar Topography Mission), 30 m</span></figcaption></figure></div>
    </div></div>`;
  el.querySelectorAll(".days button").forEach((b) => b.addEventListener("click", () => { day = b.dataset.d; renderGallery(el); }));
}

// the same month a year apart, cut to one district, from NASA's monthly MODIS greenness
export function greenMap(name, GEO) {
  const ims = (INDEX?.images || []).filter((i) => i.group === "ndvi").sort((a, b) => a.date.localeCompare(b.date));
  const f = GEO?.features.find((x) => x.properties.name === name);
  if (!ims.length || !f) return "";
  const panel = (im) => {
    const [w0, s0, e0, n0] = im.bbox, W = im.w, H = im.h;
    const path = geoPath(geoTransform({ point(x, y) { this.stream.point(((x - w0) / (e0 - w0)) * W, ((n0 - y) / (n0 - s0)) * H); } }));
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.12;
    const vb = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad].map((v) => +v.toFixed(1));
    const d = path(f);
    const when = monthName(im.date.slice(0, 7));
    return `<figure class="gshot"><a href="${esc(im.worldview)}" target="_blank" rel="noopener"><svg viewBox="${vb.join(" ")}" role="img" aria-label="${esc(t("s_green"))}: ${esc(dName(name))}, ${esc(when)}">
      <image href="${esc(im.file)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>
      <path class="dim" fill-rule="evenodd" d="M${vb[0]} ${vb[1]}h${vb[2]}v${vb[3]}h${-vb[2]}Z${d}"/>
      <path class="edge" d="${d}" vector-effect="non-scaling-stroke"/></svg></a>
      <figcaption><b>${esc(when)}</b></figcaption></figure>`;
  };
  const wv = ims[ims.length - 1].worldview;
  return `<div class="green">${ims.map(panel).join("")}</div>
    <p class="cap">${esc(t("green_cmp"))}</p>
    <p class="cap muted">${esc(t("green_src"))} · <a href="${esc(wv)}" target="_blank" rel="noopener">${esc(t("g_open"))}</a></p>`;
}

const MISSIONS = [["GPM · IMERG", "ms_gpm"], ["GLDAS · MERRA-2", "ms_gldas"], ["Terra · MODIS", "ms_modis"], ["SRTM · NASADEM", "ms_srtm"], ["Suomi NPP · VIIRS · Worldview", "ms_viirs"]];
export function renderMissions(el) {
  el.innerHTML = `<h2>${esc(t("ms_title"))}</h2><p class="lede">${esc(t("ms_lede"))}</p>
    <div class="ms-grid">${MISSIONS.map(([n, k]) => `<div class="ms"><p class="ms-n">NASA ${esc(n)}</p><p>${esc(t(k))}</p></div>`).join("")}</div>`;
}

// every candidate place in one district, coloured by the ground it stands on;
// with town data, the divisions are shaded by today's level and one can be picked
const LV_FILL = ["#ffffff", "#f6e7a6", "#f0b98a", "#e39a94"];
export function centreMap(name, GEO, SAFE, TOWNS, levels, town) {
  const f = GEO.features.find((x) => x.properties.name === name);
  const tf = (TOWNS?.features || []).filter((x) => x.properties.district === name);
  const focus = town ? tf.find((x) => x.properties.name === town) : null;
  const sp = (focus && SAFE?.towns?.[`${name}|${town}`]) || SAFE?.districts?.[name];
  if (!f || !sp) return "";
  const W = 520, H = 380;
  const proj = geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], focus || f);
  const path = geoPath(proj);
  const area = focus || f;
  const [[x0, y0], [x1, y1]] = geoPath().bounds(area);
  const pts = SAFE.items.filter((c) => c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1 && geoContains(area, [c[0], c[1]]));
  const r = focus ? 3 : 1.8;
  const dots = (ok, cls) => pts.filter((c) => (ok ? c[2] === 0 : c[2] !== 0)).map((c) => { const [x, y] = proj([c[0], c[1]]); return `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`; }).join("");
  const lv = Object.fromEntries((levels || []).map((x) => [x.name, x.level]));
  const shapes = tf.length ? tf.map((x) => `<path class="town${x === focus ? " on" : ""}" data-town="${esc(x.properties.name)}" d="${path(x)}" fill="${LV_FILL[lv[x.properties.name] || 0]}"><title>${esc(x.properties.name)}</title></path>`).join("") : `<path class="outline" d="${path(f)}"/>`;
  const top = sp.top.slice(0, 5).map((c, i) => { const [x, y] = proj([c[0], c[1]]); return `<g class="pick"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${i + 1}</text></g>`; }).join("");
  const bad = focus ? sp.count - sp.safer : sp.steep + sp.flooded;
  return `<figure class="cmap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("s_safe"))}: ${esc(town || dName(name))}">
      ${shapes}${dots(false, "bad")}${dots(true, "ok")}${top}</svg>
    <figcaption><span><i class="dot ok"></i>${esc(t("lg_safe"))} (${sp.safer})</span><span><i class="dot bad"></i>${esc(t("lg_unsafe"))} (${bad})</span>
      ${tf.length ? `<span><i class="sq l1"></i>${esc(t("lvs_1"))}</span><span><i class="sq l2"></i>${esc(t("lvs_2"))}</span><span><i class="sq l3"></i>${esc(t("lvs_3"))}</span>` : ""}</figcaption></figure>`;
}
