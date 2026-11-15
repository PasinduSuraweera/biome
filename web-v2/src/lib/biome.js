// Shared constants and helpers for the dashboard (same values as the classic app).
import { geoArea } from "d3-geo";
import { t } from "@classic/i18n.js";

export const WATCH = {
  SlopeWatch: { hex: "#7d2e1c", brand: "SlopeWatch" },
  FloodWatch: { hex: "#2b7c8a", brand: "FloodWatch" },
  DryWatch: { hex: "#d9a441", brand: "DryWatch" },
  Clear: { hex: "#d8ddd6", brand: "" },
};
export const ORDER = ["SlopeWatch", "FloodWatch", "DryWatch", "Clear"];
export const GAUGE_HOT = ["alert", "minor flood", "major flood"];
export const AMBER = "#b86f12";
export const r0 = (v) => (v == null ? "?" : Math.round(v));
export const slug = (n) => n.toLowerCase().replace(/\s+/g, "-");
export const watchLabel = (w) => (w === "Clear" ? t("w_Clear") : `${WATCH[w].brand} · ${t(`w_${w}`)}`);
export const LEVEL_DOT = ["bg-[#9aa39e]", "bg-[#e0b422]", "bg-[#d2691e]", "bg-[#b3261e]"];
export const LEVEL_FILL = ["#c9cec9", "#e0b422", "#d2691e", "#b3261e"];

export function rewind(feature) {
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
