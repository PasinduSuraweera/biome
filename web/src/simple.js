// Plain-language views (Families, Farmers, Coast) and their downloadable report.
// One report model feeds both the on-screen panel and the picture download.
import { t, dName, monthName, getLang } from "./i18n.js";

export const VIEWS = ["family", "farmer", "coast", "full"];
export const COASTAL = new Set(["Colombo", "Gampaha", "Kalutara", "Galle", "Matara", "Hambantota", "Ampara", "Batticaloa",
  "Trincomalee", "Mullaitivu", "Jaffna", "Kilinochchi", "Mannar", "Puttalam"]);

const NOW_STYLE = {
  SlopeWatch: { bg: "#7d2e1c", fg: "#ffffff" }, FloodWatch: { bg: "#2b7c8a", fg: "#ffffff" },
  DryWatch: { bg: "#d9a441", fg: "#2a1e05" }, Clear: { bg: "#d8ddd6", fg: "#16201f" },
};
const SIGN_STYLE = { dry: { bg: "#e3b85c", fg: "#2a1e05" }, normal: { bg: "#e4e6e0", fg: "#4a5552" }, wet: { bg: "#23687a", fg: "#ffffff" }, mixed: { bg: "#f1dba6", fg: "#16201f", bg2: "#b9d6dc" } };
const SIGN = { much_drier: "dry", drier: "dry", normal: "normal", wetter: "wet", much_wetter: "wet" };
const GAUGE_HOT = ["alert", "minor flood", "major flood"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const levelOf = (p) => (p == null ? "normal" : p < 60 ? "much_drier" : p < 85 ? "drier" : p <= 115 ? "normal" : p <= 140 ? "wetter" : "much_wetter");
const mLong = (ym) => monthName(ym).replace(/\s*\d{4}$/, "");
const mShort = (ym) => monthName(ym, true);
const span = (months, i, j) => (i === j ? mLong(months[i].month) : t("m_to", { a: mLong(months[i].month), b: mLong(months[j].month) }));

// consecutive months of the same kind (dry, usual, wet), with how often past years agreed
function runs(o, upto) {
  const out = [];
  const w = o.normal_mm || [];
  const evs = Object.values(o.events || {});
  for (let i = 0; i < upto; i++) {
    const sign = SIGN[o.months[i].level] || "normal";
    if (out.length && out[out.length - 1].sign === sign) out[out.length - 1].j = i;
    else out.push({ sign, i, j: i });
  }
  for (const r of out) {
    const total = (vals) => {
      let a = 0, b = 0;
      for (let k = r.i; k <= r.j; k++) { if (vals[k] == null) return null; a += vals[k] * (w[k] ?? 1); b += (w[k] ?? 1); }
      return b ? a / b : null;
    };
    r.pct = total(o.months.map((m) => m.rain_pct));
    r.level = r.sign === "normal" ? "normal" : levelOf(r.pct);
    if (SIGN[r.level] !== r.sign) r.level = r.sign === "dry" ? "drier" : "wetter";
    const tot = evs.map(total).filter((v) => v != null);
    r.n = tot.length;
    r.agree = tot.filter((v) => (r.sign === "dry" ? v < 90 : r.sign === "wet" ? v > 110 : v >= 85 && v <= 115)).length;
  }
  return out;
}

// ---- outlook model (weighted ensemble) ----
const wMedian = (vals, w) => {
  const o = vals.map((v, i) => [v, w[i]]).sort((a, b) => a[0] - b[0]);
  const tot = o.reduce((a, x) => a + x[1], 0);
  let c = 0;
  for (const [v, wi] of o) { c += wi; if (c >= tot / 2) return v; }
  return o[o.length - 1][0];
};
const in10 = (p) => Math.max(1, Math.min(9, Math.round(p * 10)));

function fcMonths(DATA, name) {
  const F = DATA.forecast, x = F?.district?.[name];
  if (!x) return null;
  const sig = F.skill.signal;
  const months = F.months.map((ym, i) => ({
    month: ym, signal: sig[i], median: x.median[i],
    // dry or wet when that is more likely than not; "mixed" when past years split both ways
    sign: !sig[i] ? "normal" : x.p_dry[i] >= 0.5 ? "dry" : x.p_wet[i] >= 0.5 ? "wet" : (1 - x.p_dry[i] - x.p_wet[i]) >= 0.4 ? "normal" : "mixed",
  }));
  return { F, x, months };
}

function fcRuns(fc, upto) {
  const { F, x, months } = fc, out = [];
  for (let i = 0; i < upto; i++) {
    const key = months[i].sign + (months[i].signal ? "" : "?");
    if (out.length && out[out.length - 1].key === key) out[out.length - 1].j = i;
    else out.push({ key, sign: months[i].sign, signal: months[i].signal, i, j: i });
  }
  for (const r of out) {
    const nm = x.normal_mm.slice(r.i, r.j + 1), tot = nm.reduce((a, b) => a + b, 0) || 1;
    const totals = x.members.map((row) => row.slice(r.i, r.j + 1).reduce((a, v, k) => a + v * nm[k], 0) / tot);
    r.pct = wMedian(totals, F.weights);
    r.level = r.sign === "normal" || r.sign === "mixed" ? "normal" : levelOf(r.pct);
    if (r.sign === "dry" && SIGN[r.level] !== "dry") r.level = "drier";
    if (r.sign === "wet" && SIGN[r.level] !== "wet") r.level = "wetter";
    r.pDry = totals.reduce((a, v, k) => a + (v < 85 ? F.weights[k] : 0), 0);
    r.pWet = totals.reduce((a, v, k) => a + (v > 115 ? F.weights[k] : 0), 0);
    r.p = r.sign === "dry" ? r.pDry : r.pWet;
  }
  return out;
}

// a block of forecast months as one: chance of drier or wetter overall, and the worst drought month
function blockOdds(fc, idx) {
  const { F, x, months } = fc;
  const nm = idx.map((i) => x.normal_mm[i]), tot = nm.reduce((a, b) => a + b, 0) || 1;
  const totals = x.members.map((row) => idx.reduce((a, i, k) => a + row[i] * nm[k], 0) / tot);
  const pDry = totals.reduce((a, v, k) => a + (v < 85 ? F.weights[k] : 0), 0);
  const pWet = totals.reduce((a, v, k) => a + (v > 115 ? F.weights[k] : 0), 0);
  const signal = idx.filter((i) => months[i].signal).length * 2 >= idx.length;
  let dw = null;
  for (const i of idx) if (months[i].signal && x.watch.DryWatch[i] >= 0.5 && (!dw || x.watch.DryWatch[i] > dw.p)) dw = { m: months[i].month, p: x.watch.DryWatch[i] };
  return { pDry, pWet, signal, dw };
}

// the coming Maha (Oct-Mar) and Yala (Apr-Sep) seasons inside the 12-month outlook
function seasonsAhead(fc) {
  const out = [];
  let cur = null;
  fc.months.forEach((mo, i) => {
    const m = +mo.month.slice(5, 7), y = +mo.month.slice(0, 4);
    const kind = m >= 10 || m <= 3 ? "maha" : "yala";
    if (cur && cur.kind === kind) cur.idx.push(i);
    else { cur = { kind, idx: [i], y: kind === "maha" && m <= 3 ? y - 1 : y }; out.push(cur); }
  });
  return out.filter((sn) => sn.idx.length >= 3).slice(0, 2);
}

function planting(fc) {
  if (!fc) return [];
  return seasonsAhead(fc).map((sn) => {
    const o = blockOdds(fc, sn.idx);
    const title = sn.kind === "maha" ? t("season_maha", { a: sn.y, b: String(sn.y + 1).slice(2) }) : t("season_yala", { a: sn.y });
    const sign = !o.signal ? "normal" : o.pDry >= 0.5 ? "dry" : o.pWet >= 0.5 ? "wet" : "mixed";
    const lines = [sign === "dry" ? t("pl_dry", { x: in10(o.pDry) }) : sign === "wet" ? t("pl_wet", { x: in10(o.pWet) })
      : sign === "mixed" ? `${t("lv_mixed")}. ${t("mixed_odds", { a: in10(o.pDry), b: in10(o.pWet) })}` : t("pl_unclear")];
    if (o.dw) lines.push(t("pl_drought", { m: mLong(o.dw.m), x: in10(o.dw.p) }));
    const adv = sign === "dry" || (o.dw && sign !== "wet") ? "dry" : sign === "wet" ? "wet" : "normal";
    return { title, range: span(fc.months, sn.idx[0], sn.idx[sn.idx.length - 1]), sign, lines, adv: t(`pl_adv_${adv}`), dry: adv === "dry" };
  });
}

// every past Maha and Yala since 1980, and what followed the strong El Ninos
function yearsOf(d, DATA) {
  if (!d.seasons?.maha?.years?.length) return null;
  const cls = (p) => (p == null ? "normal" : p < 85 ? "dry" : p > 115 ? "wet" : "normal");
  const strong = new Set(DATA.meta?.strong_el_nino_years || []);
  const rows = ["maha", "yala"].map((k) => ({ label: t(`s_${k}`),
    cells: d.seasons[k].years.map((y, i) => ({ y, pct: d.seasons[k].rain_pct[i], sign: cls(d.seasons[k].rain_pct[i]), nino: strong.has(y) })) }));
  const after = d.seasons.maha.years.map((y, i) => [y, d.seasons.maha.rain_pct[i]]).filter(([y]) => strong.has(y));
  const ys = d.seasons.maha.years;
  return { rows, first: ys[0], last: ys[ys.length - 1],
    note: after.length ? t("yr_elnino", { n: after.length, a: after.filter(([, p]) => p < 85).length, b: after.filter(([, p]) => p > 115).length }) : "" };
}

const strip = (o, n) => o.months.slice(0, n).map((m) => ({ lab: mShort(m.month), sign: SIGN[m.level] || "normal" }));

export function buildReport(name, view, DATA, SAFE, townName) {
  const d = DATA.districts[name];
  const o = d.outlook;
  const aud = view === "farmer" ? "farmer" : "family";
  const wetNow = d.watch === "SlopeWatch" || d.watch === "FloodWatch";
  const farmKey = wetNow ? "wet" : d.watch === "DryWatch" ? "dry" : "clear";

  const now = {
    watch: d.watch, ...NOW_STYLE[d.watch],
    title: view === "farmer" ? t(`nf_${farmKey}`) : t(`n_${d.watch}`),
    desc: view === "farmer" && wetNow ? t("nfd_wet") : t(`nd_${d.watch}`),
  };

  let todo;
  if (view === "farmer") todo = farmKey === "clear" ? [t("td_farmer_clear_1"), t("td_again")] : [1, 2, 3].map((i) => t(`td_farmer_${farmKey}_${i}`));
  else todo = d.watch === "Clear" ? [t("td_family_Clear_1"), t("td_again")] : [1, 2, 3].map((i) => t(`td_family_${d.watch}_${i}`));
  if (view === "coast") todo.push(t("td_coast_sea"));

  const periods = [];
  let year = null, basis = t("basis_none");
  const fc = fcMonths(DATA, name);
  if (fc) {
    const { F, x, months } = fc;
    const n = F.train_years[1] - F.train_years[0] + 1;
    const hits = F.skill.like_this_year.hit_rate.filter((_, i) => F.skill.signal[i]);
    basis = hits.length ? t("basis_model", { n, a: in10(hits.reduce((a, b) => a + b, 0) / hits.length) }) : t("basis_weak", { n });
    const stripF = (k) => months.slice(0, k).map((m) => ({ lab: mShort(m.month), sign: m.sign }));
    for (const h of [1, 3, 6]) {
      const rs = fcRuns(fc, h);
      const lines = rs.map((r) => {
        const what = r.sign === "mixed" ? t("lv_mixed") : r.sign === "normal" ? t(r.signal ? "lv_normal" : "lv_unclear") : t(`lv_${r.level}`);
        const head = h === 1 ? `${what}.` : `${what}: ${span(months, r.i, r.j)}.`;
        if (r.sign === "mixed") return `${head} ${t("mixed_odds", { a: in10(r.pDry), b: in10(r.pWet) })}`;
        return r.sign !== "normal" ? `${head} ${t("chance", { x: in10(r.p) })}` : head;
      });
      // a Watch that is more likely than not in these months, such as a drought that carries on
      for (const w of ["SlopeWatch", "FloodWatch", "DryWatch"]) {
        const ms = months.slice(0, h).map((mo, i) => ({ mo, p: x.watch[w][i] })).filter((q) => q.mo.signal && q.p >= 0.5)
          .map((q) => `${mLong(q.mo.month)} (${t("in10", { x: in10(q.p) })})`).join(", ");
        if (ms) lines.push(t(`fc_${w}`, { m: ms }));
      }
      const signs = [...new Set(rs.map((r) => r.sign))].filter((sg) => sg === "dry" || sg === "wet");
      if (!signs.includes("dry") && months.slice(0, h).some((mo, i) => mo.signal && x.watch.DryWatch[i] >= 0.5)) signs.push("dry");
      periods.push({ label: t(`h_${h}`), range: span(months, 0, h - 1), strip: stripF(h), lines, adv: signs.map((sg) => t(`adv_${aud}_${sg}`)) });
    }
    const by = (sign, dir) => months.map((m, i) => ({ m, i })).filter((q) => q.m.sign === sign)
      .sort((a, b) => dir * (a.m.median - b.m.median)).slice(0, 3).sort((a, b) => a.i - b.i).map((q) => mLong(q.m.month)).join(", ");
    const lines = [];
    if (by("dry", 1)) lines.push(t("driest", { m: by("dry", 1) }));
    if (by("wet", -1)) lines.push(t("wettest", { m: by("wet", -1) }));
    for (const w of ["SlopeWatch", "FloodWatch", "DryWatch"]) {
      const ms = months.map((m, i) => ({ m, p: x.watch[w][i] })).filter((q) => q.m.signal && q.p >= 0.4)
        .map((q) => `${mLong(q.m.month)} (${t("in10", { x: in10(q.p) })})`).join(", ");
      if (ms) lines.push(t(`fc_${w}`, { m: ms }));
    }
    year = { label: t("h_12"), range: span(months, 0, 11), strip: stripF(12), lines, adv: [] };
  } else if (o) {
    if (o.basis) basis = t(`basis_${o.basis}`, { n: o.years.length });
    for (const h of [1, 3, 6]) {
      const rs = runs(o, h);
      const lines = rs.map((r) => {
        const head = h === 1 ? `${t(`lv_${r.level}`)}.` : `${t(`lv_${r.level}`)}: ${span(o.months, r.i, r.j)}.`;
        return r.sign !== "normal" && r.n ? `${head} ${t("seen", { a: r.agree, n: r.n })}` : head;
      });
      const signs = [...new Set(rs.map((r) => r.sign))].filter((sg) => sg !== "normal");
      periods.push({ label: t(`h_${h}`), range: span(o.months, 0, h - 1), strip: strip(o, h), lines, adv: signs.map((sg) => t(`adv_${aud}_${sg}`)) });
    }
    year = { label: t("h_12"), range: span(o.months, 0, 11), strip: strip(o, 12), lines: [], adv: [] };
  }

  const extras = [];
  const res = (DATA.reservoirs?.items || []).filter((r) => r.district === name && r.pct_full != null).sort((a, b) => b.pct_full - a.pct_full);
  const gauges = (DATA.rivers?.items || []).filter((g) => g.district === name);
  const hot = gauges.filter((g) => GAUGE_HOT.includes(g.status));
  const riverLines = !gauges.length ? [t("river_none")] : hot.length ? hot.map((g) => t("river_hot", { g: `${g.gauge} (${g.basin})` })) : [t("river_ok")];
  if (view === "farmer") {
    extras.push({ title: t("s_tanks"), lines: res.length ? res.slice(0, 6).map((r) => `${r.name}: ${t(r.spilling ? "tank_spill" : "full", { p: Math.round(r.pct_full) })}`) : [t("res_none")] });
    const g = d.now?.ndvi_anom;
    extras.push({ title: t("s_green"), tag: "NASA Terra MODIS", green: true,
      lines: g != null ? [t(g > 0.03 ? "green_more" : g < -0.03 ? "green_less" : "green_same")] : [] });
  } else if (view === "coast") {
    extras.push({ title: t("s_sea"), lines: [t("coast_sea"), t("coast_rain"), t("coast_next")] });
    extras.push({ title: t("s_rivers"), lines: riverLines });
  } else {
    extras.push({ title: t("s_rivers"), lines: riverLines });
  }

  const towns = DATA.towns?.districts?.[name] || [];
  const tw = towns.find((x) => x.name === townName) || null;
  const lv = tw || d.level || null;
  const dayTxt = lv ? `${Number(lv.day.slice(8, 10))} ${mLong(lv.day.slice(0, 7))}` : "";
  const level = lv ? {
    n: lv.level, title: t(`lvl_${lv.level}`) + (lv.hazard ? ` (${t(`hz_${lv.hazard}`)})` : ""),
    rain: t("lvl_rain", { a: Math.round(lv.rain_1d), b: Math.round(lv.rain_3d), d: dayTxt }), how: t("lvl_how"),
  } : null;
  const sp = (tw && SAFE?.towns?.[`${name}|${tw.name}`]) || SAFE?.districts?.[name];
  if (tw) {
    const fmtDay = (ymd) => `${Number(ymd.slice(8, 10))} ${monthName(ymd.slice(0, 7))}`;
    const lines = [tw.steep_share >= 0.05 ? t("town_steep", { p: Math.round(tw.steep_share * 100) }) : t("town_flat")];
    if (tw.ditwah?.level >= 2) lines.push(t("town_ditwah", { l: t(`lvl_${tw.ditwah.level}`), d: fmtDay(tw.ditwah.day), r: Math.round(tw.ditwah.rain_mm) }));
    lines.push(t("town_note"));
    extras.unshift({ title: tw.name, tag: "NASA GPM IMERG + SRTM", lines });
  }
  if (sp?.top?.length) {
    extras.unshift({ title: t("s_safe"), tag: "NASA SRTM", map: true, lines: [
      ...sp.top.slice(0, 5).map((c, i) => `${i + 1}. ${c[3]} (${t(`kind_${c[2]}`)})`),
      t("safe_count", { a: sp.safer, n: sp.count }), t("safe_note")] });
  }
  const plant = view === "farmer" ? planting(fc) : [];
  const years = yearsOf(d, DATA);
  const qSafe = () => ({ q: t("q_safe"), a: level ? [t(`a_safe_${level.n}`), level.rain, ...(level.n ? [t(`al_do_${level.n}`)] : [])] : [t("lvl_0")] });
  const qGo = () => ({ q: t("q_go"), a: sp?.top?.length
    ? [t("a_go", { p: `${sp.top[0][3]} (${t(`kind_${sp.top[0][2]}`)})`, n: Math.min(sp.top.length, 5) - 1 }), t("safe_note")] : [t("a_go_none")] });
  const q3m = () => ({ q: t("q_3m"), a: periods[1] ? [...periods[1].lines, ...periods[1].adv] : [basis] });
  let ask;
  if (view === "farmer") {
    const avg = res.length ? Math.round(res.reduce((a, r) => a + r.pct_full, 0) / res.length) : null;
    const dry = plant[0]?.dry;
    ask = [
      { q: t("q_plant"), a: plant[0] ? [`${plant[0].title} (${plant[0].range}): ${plant[0].lines.join(" ")}`, plant[0].adv] : [basis] },
      { q: t("q_tank"), a: avg == null ? [t("res_none")] : [t("a_tank", { n: res.length, p: avg }), t(dry ? "a_tank_dry" : "a_tank_ok")] },
      { q: t("q_rain"), a: [...(level ? [level.title, level.rain] : []), ...(periods[0]?.lines || [])] },
    ];
  } else if (view === "coast") {
    const wetNowC = d.watch === "FloodWatch" || d.watch === "SlopeWatch" || (level && level.n >= 2 && lv.hazard !== "drought");
    ask = [{ q: t("q_flood"), a: [t(wetNowC ? "a_flood_yes" : "a_flood_no"), `${now.title}. ${now.desc}`, ...(level ? [level.title, level.rain] : [])] }, qGo(), q3m()];
  } else ask = [qSafe(), qGo(), q3m()];
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return {
    view, name, level, towns: towns.map((x) => ({ name: x.name, level: x.level })), town: tw?.name || "", hazardNow: lv?.hazard || (d.hill ? "landslide" : "flood"), bot: DATA.levels?.bot || null, safeTop: sp?.top || [], aud: t(`for_${view}`), district: tw ? `${tw.name}, ${dName(name)}` : dName(name), when: monthName(d.flag_month), now, todo, basis, periods, year, extras, plant, years, ask,
    emer: t("emer"), disc: t("disc"), nasa: t("rep_nasa"), modelled: !!fc, made: t("rep_made", { d: `${today.getDate()} ${monthName(ym)}` }),
  };
}

const stripHTML = (s) => `<div class="strip n${s.length}">${s.map((m) => `<span class="mo ${m.sign}">${esc(m.lab)}</span>`).join("")}</div>`;
const cardHTML = (p, cls = "") => `
  <div class="period ${cls}">
    <p class="p-k">${esc(p.label)}</p><p class="p-r">${esc(p.range)}</p>
    ${stripHTML(p.strip)}
    ${p.lines.map((l) => `<p class="p-l">${esc(l)}</p>`).join("")}
    ${p.adv.map((a) => `<p class="p-a">${esc(a)}</p>`).join("")}
  </div>`;

// the exact text a registered person receives, in their language
export function alertMessage(m, n) {
  const lines = [`Biome · ${m.district}`, t(`lvl_${n}`) + (m.hazardNow ? ` (${t(`hz_${m.hazardNow}`)})` : ""), m.level.rain, t(`al_do_${n}`)];
  if (n >= 2 && m.safeTop.length) lines.push(`${t("s_safe")}: ${m.safeTop.slice(0, 3).map((c) => c[3]).join("; ")}`);
  lines.push(t("al_official"));
  return lines.join("\n");
}

function alertsHTML(m) {
  return `<div class="alerts" id="alerts">
    <h3>${esc(t("s_alerts", { d: m.district }))}</h3>
    <label class="al-pick">${esc(t("al_from"))}
      <select id="al-level">${[1, 2, 3].map((n) => `<option value="${n}" ${n === 2 ? "selected" : ""}>${esc(t(`lvl_${n}`))}</option>`).join("")}</select></label>
    <p class="p-r">${esc(t("al_preview"))}</p>
    <pre class="al-msg" id="al-msg"></pre>
    ${m.bot ? `<a class="btn primary" id="al-go" target="_blank" rel="noopener" href="#">${esc(t("al_btn"))}</a>` : `<p class="basis">${esc(t("al_soon"))}</p>`}
    <p class="disc">${esc(t("al_note"))}</p>
  </div>`;
}

export function wireAlerts(m) {
  const sel = document.querySelector("#al-level");
  if (!sel) return;
  const upd = () => {
    const n = Number(sel.value);
    document.querySelector("#al-msg").textContent = alertMessage(m, n);
    const go = document.querySelector("#al-go");
    if (go) go.href = `https://t.me/${m.bot}?start=${m.name.toLowerCase().replace(/\s+/g, "-")}-${getLang()}-${n}`;
  };
  sel.addEventListener("change", upd);
  upd();
}

export function reportHTML(m) {
  const key = (m.modelled ? ["dry", "wet", "mixed", "normal"] : ["dry", "normal", "wet"]).map((s) => `<span><i class="mo ${s}"></i>${esc(t(`${m.modelled ? "kf" : "k"}_${s}`))}</span>`).join("");
  const tag = (x) => (x ? ` <span class="nasa-tag">${esc(x)}</span>` : "");
  return `
  <div class="simple" id="report">
    <div class="rep-head"><img src="logo.png" alt="Biome" width="120" height="43"><span>${esc(t("rep_title"))} · ${esc(m.made)}</span></div>
    <p class="aud">${esc(m.aud)}</p>
    <h2>${esc(m.district)}</h2>
    ${m.towns.length ? `<label class="town-pick">${esc(t("s_town"))} <span class="nasa-tag">NASA GPM IMERG + SRTM</span>
      <select id="town-select"><option value="">${esc(t("town_all"))}</option>${m.towns.map((x) => `<option value="${esc(x.name)}" ${x.name === m.town ? "selected" : ""}>${esc(x.name)}${x.level ? ` · ${esc(t(`lvs_${x.level}`))}` : ""}</option>`).join("")}</select></label>` : ""}
    <div class="nowbox" style="background:${m.now.bg};color:${m.now.fg}">
      <p class="k">${esc(t("s_now"))} · ${esc(m.when)} · NASA GPM IMERG</p><p class="v">${esc(m.now.title)}</p><p class="d">${esc(m.now.desc)}</p>
    </div>
    ${m.level ? `<div class="levelbox l${m.level.n}"><p class="k">${esc(t("s_level"))} <span class="nasa-tag">NASA GPM IMERG</span></p>
      <p class="v"><i class="lv-dot"></i>${esc(m.level.title)}</p><p class="d">${esc(m.level.rain)}</p><p class="h">${esc(m.level.how)}</p></div>` : ""}
    ${m.ask?.length ? `<div class="ask"><h3>${esc(t("ask_title"))}</h3><p class="cap">${esc(t("ask_lede"))}</p>
      ${m.ask.map((x) => `<details><summary>${esc(x.q)}</summary>${x.a.map((l) => `<p>${esc(l)}</p>`).join("")}</details>`).join("")}</div>` : ""}
    <h3>${esc(t("s_todo"))}</h3>
    <ul class="todo">${m.todo.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <h3>${esc(t("s_expect"))}${tag("NASA GPM IMERG + MERRA-2")}</h3>
    <p class="basis">${esc(m.basis)}</p>
    <div class="key">${key}</div>
    <div class="periods">${m.periods.map((p) => cardHTML(p)).join("")}</div>
    ${m.year ? cardHTML(m.year, "year") : ""}
    ${m.plant?.length ? `<h3>${esc(t("s_plant"))}${tag("NASA GPM IMERG + MERRA-2")}</h3><div class="periods plant">${m.plant.map((p) => `
      <div class="period pl-${p.sign}"><p class="p-k">${esc(p.title)}</p><p class="p-r">${esc(p.range)}</p>
      ${p.lines.map((l) => `<p class="p-l">${esc(l)}</p>`).join("")}<p class="p-a">${esc(p.adv)}</p></div>`).join("")}</div>
      <p class="cap">${esc(t("pl_note"))}</p>` : ""}
    ${m.extras.map((e) => `<h3>${esc(e.title)}${tag(e.tag)}</h3>${e.map ? '<div id="cmap-slot"></div>' : ""}${e.green ? '<div id="green-slot"></div>' : ""}<ul class="plain${e.map ? " nomark" : ""}">${e.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`).join("")}
    ${m.years ? `<h3>${esc(t("s_years"))}${tag("NASA MERRA-2 + GPM IMERG")}</h3><div class="years">
      ${m.years.rows.map((r) => `<div class="yr-row"><span class="yr-l">${esc(r.label)}</span><div class="yr-cells" style="grid-template-columns:repeat(${r.cells.length},1fr)">${r.cells.map((c) => `<i class="yc ${c.sign}${c.nino ? " nino" : ""}" title="${c.y}: ${c.pct ?? "?"}%"></i>`).join("")}</div></div>`).join("")}
      <div class="yr-row yr-axis"><span class="yr-l"></span><div><span>${m.years.first}</span><span>${m.years.last}</span></div></div></div>
      <p class="cap">${esc(t("yr_cap"))}</p>${m.years.note ? `<p class="p-l"><b>${esc(m.years.note)}</b></p>` : ""}<p class="cap muted">${esc(t("yr_src"))}</p>` : ""}
    <p class="emer">${esc(m.emer)}</p>
    <p class="disc">${esc(m.disc)}</p>
    <p class="disc nasa-line">${esc(m.nasa)}</p>
  </div>
  ${m.level ? alertsHTML(m) : ""}
  <div class="actions">
    <button type="button" class="btn primary" id="dl-png">${esc(t("dl_png"))}</button>
    <button type="button" class="btn" id="dl-pdf">${esc(t("dl_pdf"))}</button>
  </div>`;
}

// ---- picture download: the same report drawn on a canvas, so it saves as one image to share ----

const BODY = '"Inter", "Noto Sans Sinhala", "Noto Sans Tamil", system-ui, sans-serif';
const HEAD = '"Space Grotesk", "Noto Sans Sinhala", "Noto Sans Tamil", system-ui, sans-serif';

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(trial).width > maxW) { lines.push(line); line = w; } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function draw(m, logo, dry) {
  const W = 1080, P = 60, CW = W - 2 * P;
  const c = document.createElement("canvas");
  c.width = W; c.height = dry;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f5f3ee"; ctx.fillRect(0, 0, W, c.height);
  ctx.textBaseline = "top";
  let y = P;
  // a block of wrapped text; returns the y below it
  const text = (s, font, color, x = P, maxW = CW, lh = 1.4) => {
    ctx.font = font; ctx.fillStyle = color;
    const size = parseFloat(font.match(/(\d+)px/)[1]);
    for (const line of wrap(ctx, s, maxW)) { ctx.fillText(line, x, y); y += size * lh; }
  };
  const measure = (s, font, maxW, lh = 1.4) => { ctx.font = font; return wrap(ctx, s, maxW).length * parseFloat(font.match(/(\d+)px/)[1]) * lh; };

  if (logo) ctx.drawImage(logo, P, y, 200, 200 * logo.height / logo.width);
  ctx.font = `500 24px ${BODY}`; ctx.fillStyle = "#6b7470"; ctx.textAlign = "right";
  ctx.fillText(t("rep_title"), W - P, y + 8); ctx.fillText(m.made, W - P, y + 42); ctx.textAlign = "left";
  y += 110;
  text(m.aud, `600 28px ${BODY}`, "#b86f12");
  y += 4;
  text(m.district, `700 72px ${HEAD}`, "#16201f", P, CW, 1.15);
  y += 20;

  // right now
  const nf = [`500 26px ${BODY}`, `700 48px ${HEAD}`, `400 30px ${BODY}`];
  const nh = 36 + 26 * 1.4 + measure(m.now.title, nf[1], CW - 72, 1.2) + 8 + measure(m.now.desc, nf[2], CW - 72) + 30;
  rounded(ctx, P, y, CW, nh, 24, m.now.bg);
  y += 36;
  text(`${t("s_now")} · ${m.when}`, nf[0], m.now.fg, P + 36, CW - 72);
  text(m.now.title, nf[1], m.now.fg, P + 36, CW - 72, 1.2);
  y += 8;
  text(m.now.desc, nf[2], m.now.fg, P + 36, CW - 72);
  y += 30 + 40;

  if (m.level) {
    const LC = ["#6b7470", "#c79a1b", "#d2691e", "#b3261e"][m.level.n];
    y -= 16;
    ctx.fillStyle = LC; ctx.beginPath(); ctx.arc(P + 16, y + 22, 14, 0, 2 * Math.PI); ctx.fill();
    text(m.level.title, `700 32px ${HEAD}`, "#16201f", P + 44, CW - 44, 1.3);
    text(m.level.rain, `400 26px ${BODY}`, "#4a5552");
    y += 28;
  }
  const heading = (s) => { text(s, `700 40px ${HEAD}`, "#16201f", P, CW, 1.25); y += 10; };
  const bullets = (items) => {
    for (const it of items) {
      ctx.fillStyle = "#b86f12"; ctx.beginPath(); ctx.arc(P + 10, y + 21, 7, 0, 2 * Math.PI); ctx.fill();
      text(it, `400 30px ${BODY}`, "#16201f", P + 36, CW - 36);
      y += 8;
    }
    y += 24;
  };
  heading(t("s_todo"));
  bullets(m.todo);

  heading(t("s_expect"));
  text(m.basis, `400 26px ${BODY}`, "#4a5552");
  y += 12;
  // colour key
  const box = (st, x, yy, w, h, r) => {
    rounded(ctx, x, yy, w, h, r, st.bg);
    if (st.bg2) { ctx.save(); ctx.beginPath(); ctx.moveTo(x + w, yy); ctx.lineTo(x + w, yy + h); ctx.lineTo(x, yy + h); ctx.closePath(); ctx.clip(); rounded(ctx, x, yy, w, h, r, st.bg2); ctx.restore(); }
  };
  let kx = P;
  for (const s of (m.modelled ? ["dry", "wet", "mixed", "normal"] : ["dry", "normal", "wet"])) {
    const kl = t(`${m.modelled ? "kf" : "k"}_${s}`);
    ctx.font = `500 26px ${BODY}`;
    const kw = 40 + ctx.measureText(kl).width + 30;
    if (kx + kw > W - P && kx > P) { kx = P; y += 44; }
    box(SIGN_STYLE[s], kx, y + 4, 30, 30, 6);
    ctx.fillStyle = "#16201f";
    ctx.fillText(kl, kx + 40, y + 2);
    kx += kw;
  }
  y += 56;

  const card = (p) => {
    const IW = CW - 64, lf = `400 30px ${BODY}`, af = `600 30px ${BODY}`;
    const h = 28 + 34 * 1.3 + 28 * 1.4 + 12 + 56 + 20 + p.lines.reduce((a, l) => a + measure(l, lf, IW) + 6, 0)
      + p.adv.reduce((a, l) => a + measure(l, af, IW) + 6, 0) + 22;
    rounded(ctx, P, y, CW, h, 20, "#ffffff", "#d6d1c5");
    const top = y;
    y += 28;
    text(p.label, `700 34px ${HEAD}`, "#16201f", P + 32, IW, 1.3);
    text(p.range, `400 28px ${BODY}`, "#6b7470", P + 32, IW);
    y += 12;
    const n = p.strip.length, gap = 6, bw = Math.min(150, (IW - gap * (n - 1)) / n);
    p.strip.forEach((s, i) => {
      const st = SIGN_STYLE[s.sign], bx = P + 32 + i * (bw + gap);
      box(st, bx, y, bw, 56, 8);
      ctx.font = `600 24px ${BODY}`; ctx.fillStyle = st.fg; ctx.textAlign = "center";
      ctx.fillText(s.lab, bx + bw / 2, y + 14); ctx.textAlign = "left";
    });
    y += 56 + 20;
    for (const l of p.lines) { text(l, lf, "#16201f", P + 32, IW); y += 6; }
    for (const l of p.adv) { text(l, af, "#16201f", P + 32, IW); y += 6; }
    y = top + h + 20;
  };
  m.periods.forEach(card);
  if (m.year) card(m.year);
  y += 20;

  for (const e of m.extras) { heading(e.title); bullets(e.lines); }

  const eh = measure(m.emer, `600 30px ${BODY}`, CW - 64) + 48;
  rounded(ctx, P, y, CW, eh, 20, "#16201f");
  y += 24;
  text(m.emer, `600 30px ${BODY}`, "#f5f3ee", P + 32, CW - 64);
  y += 24 + 28;
  text(m.disc, `400 24px ${BODY}`, "#6b7470");
  y += 12;
  text(m.nasa, `600 24px ${BODY}`, "#4a5552");
  y += P;
  return { canvas: c, height: Math.ceil(y) };
}

export async function downloadPNG(m) {
  const sample = `${m.district} ${m.now.title} ${m.aud}`;
  try {
    await Promise.all([
      document.fonts.load(`700 40px "Space Grotesk"`), document.fonts.load(`400 30px "Inter"`), document.fonts.load(`600 30px "Inter"`),
      ...(getLang() === "si" ? [document.fonts.load(`400 30px "Noto Sans Sinhala"`, sample), document.fonts.load(`600 30px "Noto Sans Sinhala"`, sample)] : []),
      ...(getLang() === "ta" ? [document.fonts.load(`400 30px "Noto Sans Tamil"`, sample), document.fonts.load(`600 30px "Noto Sans Tamil"`, sample)] : []),
    ]);
  } catch { /* fall back to system fonts */ }
  const logo = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "logo.png"; });
  const first = draw(m, logo, 6000);          // measure
  const { canvas } = draw(m, logo, first.height); // draw at the exact height
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `biome-${m.name.toLowerCase().replace(/\s+/g, "-")}-${m.view}-${getLang()}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return canvas;
}
