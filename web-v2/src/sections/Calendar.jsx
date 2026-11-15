// Risk calendar, as in the classic app: the outlook model's chance of each Watch
// for the coming 12 months (or how often each Watch came in past years), for a
// district, a province or the whole country, with a CSV for planners.
import { useState } from "react";
import { Download } from "lucide-react";
import { t, dName, pName, monthName } from "@classic/i18n.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WATCH } from "@/lib/biome";
import { cn } from "@/lib/utils";

const shadeStyle = (a, hex) => ({ background: `color-mix(in srgb, ${hex} ${Math.round(Math.min(1, a) * 85)}%, hsl(var(--card)))` });

function Pick({ label, value, onChange, items }) {
  return (
    <label className="grid gap-1.5 text-sm text-muted-foreground">{label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 min-w-44"><SelectValue /></SelectTrigger>
        <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}

export function Calendar({ DATA, current }) {
  const C = DATA.calendar, F = DATA.forecast;
  const [mode, setMode] = useState(F ? "fc" : "hist");
  const [level, setLevel] = useState("district");
  const [placeSel, setPlace] = useState(null);
  const [type, setType] = useState("after_el_nino");
  if (!C) return null;
  const places = { country: ["Sri Lanka"], province: Object.keys(C.provinces), district: Object.keys(C.district).sort() };
  const place = placeSel && C[level][placeSel] ? placeSel : level === "district" ? (current || places.district[0]) : places[level][0];
  const nm = (p) => (level === "district" ? dName(p) : pName(p));
  const fc = mode === "fc";
  const nYears = F ? F.train_years[1] - F.train_years[0] + 1 : 0;
  const watchHead = (w) => <th className="whitespace-nowrap px-3 py-2 text-left text-sm font-semibold">{WATCH[w].brand}<span className="font-normal text-muted-foreground"> · {t("w_" + w)}</span></th>;
  const csv = () => {
    const sig = F.skill.signal;
    const lines = ["district,month,rain_median_pct_of_usual,rain_low_pct,rain_high_pct,chance_drier,chance_wetter,chance_DryWatch,chance_FloodWatch,chance_SlopeWatch,model_check"];
    for (const [d, x] of Object.entries(F.district)) F.months.forEach((ym, i) => lines.push([d, ym, x.median[i], x.lo[i], x.hi[i], x.p_dry[i], x.p_wet[i], x.watch.DryWatch[i], x.watch.FloodWatch[i], x.watch.SlopeWatch[i], sig[i] ? "passed" : "no skill"].join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `biome-risk-calendar-${F.months[0]}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  let table;
  if (fc) {
    const node = F[level][place], sig = F.skill.signal;
    const hits = F.skill.like_this_year.hit_rate.filter((_, i) => sig[i]);
    const a = hits.length ? Math.round(10 * hits.reduce((x, y) => x + y, 0) / hits.length) : 3;
    table = (
      <>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead><tr className="border-b bg-muted/50"><th />{F.months.map((ym) => <th key={ym} className="px-2 py-2 text-center font-semibold">{monthName(ym, true)}<br /><span className="text-xs font-normal text-muted-foreground">{ym.slice(2, 4)}</span></th>)}</tr></thead>
            <tbody>
              {level === "district" && <tr className="border-b"><th className="px-3 py-2 text-left text-sm font-semibold">{t("cal_row_rain")}</th>{node.median.map((v, i) => <td key={i} title={`${node.lo[i]} to ${node.hi[i]}%`} className={cn("px-2 py-2 text-center font-semibold", sig[i] && v < 85 && "bg-[#f1dba6] dark:bg-[#4a3f1c]", sig[i] && v > 115 && "bg-[#b9d6dc] dark:bg-[#1d4049]")}>{v}</td>)}</tr>}
              {["DryWatch", "FloodWatch", "SlopeWatch"].map((w) => <tr key={w} className="border-b">{watchHead(w)}{node.watch[w].map((p, i) => <td key={i} title={t("cal_cell_fc", { p: Math.round(p * 100) })} className="px-2 py-2 text-center font-semibold" style={shadeStyle(p, WATCH[w].hex)}>{Math.round(p * 100)}%</td>)}</tr>)}
              <tr><th className="px-3 py-2 text-left text-sm font-semibold">{t("cal_row_conf")}</th>{sig.map((ok, i) => <td key={i} className={cn("px-2 py-2 text-center text-xs", ok ? "font-bold text-[#1f6b3f] dark:text-[#6fcf97]" : "text-muted-foreground")}>{t(ok ? "cal_conf_yes" : "cal_conf_no")}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{t("basis_model", { n: nYears, a })}<Badge variant="outline" className="normal-case tracking-normal">NASA GPM IMERG + MERRA-2</Badge></p>
        <div><Button variant="outline" onClick={csv}><Download />{t("cal_csv")}</Button></div>
      </>
    );
  } else {
    const rec = C[level][place][type], tot = rec.years;
    const months = Array.from({ length: 12 }, (_, i) => monthName(`2001-${String(i + 1).padStart(2, "0")}`, true));
    table = (
      <>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead><tr className="border-b bg-muted/50"><th />{months.map((m) => <th key={m} className="px-2 py-2 text-center font-semibold">{m}</th>)}</tr></thead>
            <tbody>{["DryWatch", "FloodWatch", "SlopeWatch"].map((w) => <tr key={w} className="border-b">{watchHead(w)}{rec[w].map((n, i) => <td key={i} title={t("cal_cell", { n, t: tot })} className="px-2 py-2 text-center font-semibold" style={shadeStyle(tot ? n / tot : 0, WATCH[w].hex)}>{n}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">{t("cal_cell", { n: "n", t: tot })}</p>
      </>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-2xl">{t("cal_title")}</CardTitle><CardDescription className="text-base">{fc ? t("cal_fc_lede", { n: nYears }) : t("cal_lede", { a: C.years?.[0], b: C.years?.[1] })}</CardDescription></CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-3">
          {F && <Pick label={t("cal_mode")} value={mode} onChange={setMode} items={[["fc", t("cal_mode_fc")], ["hist", t("cal_mode_hist")]]} />}
          <Pick label={t("cal_level")} value={level} onChange={(v) => { setLevel(v); setPlace(null); }} items={["country", "province", "district"].map((l) => [l, t("lvl_" + l)])} />
          <Pick label=" " value={place} onChange={setPlace} items={places[level].map((p) => [p, nm(p)])} />
          {!fc && <Pick label={t("cal_type")} value={type} onChange={setType} items={["after_el_nino", "all", "el_nino", "la_nina", "neutral"].map((ty) => [ty, t("ty_" + ty)])} />}
        </div>
        {table}
      </CardContent>
    </Card>
  );
}
