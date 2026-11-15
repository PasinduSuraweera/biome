// The Sri Lanka map from the classic app: districts coloured by their Watch,
// tap to choose; in Full data, reservoirs, rising rivers and the Ditwah flood.
import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { t, dName } from "@classic/i18n.js";
import { COASTAL } from "@classic/simple.js";
import { WATCH, ORDER, GAUGE_HOT, r0, watchLabel } from "@/lib/biome";
import { cn } from "@/lib/utils";

export function IslandMap({ GEO, DATA, FLOOD, name, onPick, view, full = false, showFlood = false, onFlood, className, compact = false }) {
  const W = 400, H = 560;
  const { path, proj } = useMemo(() => {
    const proj = geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], GEO);
    return { proj, path: geoPath(proj) };
  }, [GEO]);
  const active = GEO.features.find((f) => f.properties.name === name);
  const [lx, ly] = active ? path.centroid(active) : [0, 0];
  const counts = DATA.meta.watch_counts || {};
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className={cn("block h-auto w-full", compact && "max-h-[420px]")} role="img" aria-label={t("choose")}>
        {GEO.features.map((f) => {
          const n = f.properties.name, w = DATA.districts[n]?.watch || "Clear";
          const label = `${dName(n)}: ${full ? watchLabel(w) : t("n_" + w)}`;
          return (
            <path key={n} d={path(f)} fill={w === "Clear" ? "var(--watch-clear)" : WATCH[w].hex} tabIndex={0} role="button" aria-label={label}
              className={cn("cursor-pointer stroke-white outline-none transition-opacity hover:opacity-80 focus:stroke-foreground", view === "coast" && !COASTAL.has(n) && "opacity-30")}
              strokeWidth={n === name ? 2.5 : 1} stroke={n === name ? "hsl(var(--foreground))" : "hsl(var(--card))"}
              onClick={() => onPick(n)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(n); } }}>
              <title>{label}</title>
            </path>
          );
        })}
        {full && showFlood && FLOOD && <path d={path(FLOOD)} fill="#1d4f8c" fillOpacity={0.45} pointerEvents="none" />}
        {full && (DATA.reservoirs?.items || []).map((r) => {
          const [x, y] = proj([r.lon, r.lat]);
          return <circle key={r.name} cx={x} cy={y} r={r.spilling ? 4 : 3} fill={r.spilling ? "#1d4f8c" : "#fff"} stroke={r.spilling ? "#fff" : "#16201f"} strokeWidth={1}><title>{`${r.name}: ${t("full", { p: r0(r.pct_full) })}${r.spilling ? ", " + t("spilling", { c: r0(r.spill_cusec) }) : ""}`}</title></circle>;
        })}
        {full && (DATA.rivers?.items || []).filter((g) => g.lat && GAUGE_HOT.includes(g.status)).map((g) => {
          const [x, y] = proj([g.lon, g.lat]);
          return <path key={g.gauge} d={`M${x} ${y - 6}l5 9h-10z`} fill="#b3261e" stroke="#fff"><title>{`${g.gauge}: ${t("g_" + g.status)}`}</title></path>;
        })}
        {active && <text x={lx} y={ly} dy={4} textAnchor="middle" className="pointer-events-none fill-foreground text-[10px] font-semibold" style={{ paintOrder: "stroke", stroke: "hsl(var(--background) / 0.85)", strokeWidth: 3 }}>{dName(name)}</text>}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {ORDER.map((w) => (
          <li key={w} className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm" style={{ background: w === "Clear" ? "var(--watch-clear)" : WATCH[w].hex }} />
            {full ? <>{w === "Clear" ? t("w_Clear") : WATCH[w].brand} <span className="opacity-70">({counts[w] || 0})</span></> : t("n_" + w)}</li>
        ))}
        {full && <li className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border border-foreground bg-white" />{t("lg_res")}</li>}
        {full && DATA.rivers && <li className="flex items-center gap-1.5"><span className="inline-block size-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-[#b3261e]" />{t("lg_gauge")}</li>}
        {full && FLOOD && <li><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={showFlood} onChange={(e) => onFlood(e.target.checked)} className="accent-[#1d4f8c]" />{t("flood_layer")}</label></li>}
      </ul>
    </div>
  );
}
