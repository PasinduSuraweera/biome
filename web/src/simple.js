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
const SIGN_STYLE = { dry: { bg: "#e3b85c", fg: "#2a1e05" }, normal: { bg: "#e4e6e0", fg: "#4a5552" }, wet: { bg: "#23687a", fg: "#ffffff" } };
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

const strip = (o, n) => o.months.slice(0, n).map((m) => ({ lab: mShort(m.month), sign: SIGN[m.level] || "normal" }));

export function buildReport(name, view, DATA) {
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
  if (o) {
    if (o.basis) basis = t(`basis_${o.basis}`, { n: o.years.length });
    for (const h of [1, 3, 6]) {
      const rs = runs(o, h);
      const lines = rs.map((r) => {
        const head = h === 1 ? `${t(`lv_${r.level}`)}.` : `${t(`lv_${r.level}`)}: ${span(o.months, r.i, r.j)}.`;
        return r.sign !== "normal" && r.n ? `${head} ${t("seen", { a: r.agree, n: r.n })}` : head;
      });
      const signs = [...new Set(rs.map((r) => r.sign))].filter((s) => s !== "normal");
      periods.push({ label: t(`h_${h}`), range: span(o.months, 0, h - 1), strip: strip(o, h), lines, adv: signs.map((s) => t(`adv_${aud}_${s}`)) });
    }
    const by = (sign, dir) => o.months.map((m, i) => ({ m, i })).filter((x) => SIGN[x.m.level] === sign && x.m.rain_pct != null)
      .sort((a, b) => dir * (a.m.rain_pct - b.m.rain_pct)).slice(0, 3).sort((a, b) => a.i - b.i).map((x) => mLong(x.m.month)).join(", ");
    const lines = [];
    if (by("dry", 1)) lines.push(t("driest", { m: by("dry", 1) }));
    if (by("wet", -1)) lines.push(t("wettest", { m: by("wet", -1) }));
    for (const w of ["SlopeWatch", "FloodWatch", "DryWatch"]) {
      const ms = o.months.filter((m) => m.risk_years && m.risk[w] >= 2 && m.risk[w] / m.risk_years >= 1 / 3).map((m) => mLong(m.month)).join(", ");
      if (ms) lines.push(t(`risk_${w}`, { m: ms }));
    }
    year = { label: t("h_12"), range: span(o.months, 0, 11), strip: strip(o, 12), lines, adv: [] };
  }

  const extras = [];
  const res = (DATA.reservoirs?.items || []).filter((r) => r.district === name && r.pct_full != null).sort((a, b) => b.pct_full - a.pct_full);
  const gauges = (DATA.rivers?.items || []).filter((g) => g.district === name);
  const hot = gauges.filter((g) => GAUGE_HOT.includes(g.status));
  const riverLines = !gauges.length ? [t("river_none")] : hot.length ? hot.map((g) => t("river_hot", { g: `${g.gauge} (${g.basin})` })) : [t("river_ok")];
  if (view === "farmer") {
    extras.push({ title: t("s_tanks"), lines: res.length ? res.slice(0, 6).map((r) => `${r.name}: ${t(r.spilling ? "tank_spill" : "full", { p: Math.round(r.pct_full) })}`) : [t("res_none")] });
    const g = d.now?.ndvi_anom;
    if (g != null) extras.push({ title: t("s_green"), lines: [t(g > 0.03 ? "green_more" : g < -0.03 ? "green_less" : "green_same")] });
  } else if (view === "coast") {
    extras.push({ title: t("s_sea"), lines: [t("coast_sea"), t("coast_rain"), t("coast_next")] });
    extras.push({ title: t("s_rivers"), lines: riverLines });
  } else {
    extras.push({ title: t("s_rivers"), lines: riverLines });
  }

  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return {
    view, name, aud: t(`for_${view}`), district: dName(name), when: monthName(d.flag_month), now, todo, basis, periods, year, extras,
    emer: t("emer"), disc: t("disc"), made: t("rep_made", { d: `${today.getDate()} ${monthName(ym)}` }),
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

export function reportHTML(m) {
  const key = ["dry", "normal", "wet"].map((s) => `<span><i class="mo ${s}"></i>${esc(t(`k_${s}`))}</span>`).join("");
  return `
  <div class="simple" id="report">
    <div class="rep-head"><img src="logo.png" alt="Biome" width="120" height="43"><span>${esc(t("rep_title"))} · ${esc(m.made)}</span></div>
    <p class="aud">${esc(m.aud)}</p>
    <h2>${esc(m.district)}</h2>
    <div class="nowbox" style="background:${m.now.bg};color:${m.now.fg}">
      <p class="k">${esc(t("s_now"))} · ${esc(m.when)}</p><p class="v">${esc(m.now.title)}</p><p class="d">${esc(m.now.desc)}</p>
    </div>
    <h3>${esc(t("s_todo"))}</h3>
    <ul class="todo">${m.todo.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <h3>${esc(t("s_expect"))}</h3>
    <p class="basis">${esc(m.basis)}</p>
    <div class="key">${key}</div>
    <div class="periods">${m.periods.map((p) => cardHTML(p)).join("")}</div>
    ${m.year ? cardHTML(m.year, "year") : ""}
    ${m.extras.map((e) => `<h3>${esc(e.title)}</h3><ul class="plain">${e.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`).join("")}
    <p class="emer">${esc(m.emer)}</p>
    <p class="disc">${esc(m.disc)}</p>
  </div>
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
  let kx = P;
  for (const s of ["dry", "normal", "wet"]) {
    rounded(ctx, kx, y + 4, 30, 30, 6, SIGN_STYLE[s].bg);
    ctx.font = `500 26px ${BODY}`; ctx.fillStyle = "#16201f";
    ctx.fillText(t(`k_${s}`), kx + 40, y + 2);
    kx += 40 + ctx.measureText(t(`k_${s}`)).width + 36;
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
      rounded(ctx, bx, y, bw, 56, 8, st.bg);
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
