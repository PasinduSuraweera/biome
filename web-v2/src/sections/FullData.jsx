// Full data for one district, everything the classic "Full data" tab shows:
// the Watch and why, today's level, live reservoirs and rivers, every division,
// safer places with their height, the El Niño and La Niña swing, soil wetness,
// the season tests and the district's story.
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { Droplets, MapPin, Waves } from "lucide-react";
import { t, dName, monthName } from "@classic/i18n.js";
import { centreMap } from "@classic/nasa.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { WATCH, GAUGE_HOT, AMBER, LEVEL_DOT, r0, watchLabel } from "@/lib/biome";
import { cn } from "@/lib/utils";

function reasonText(d) {
  const v = d.flag_values || {};
  return t(`r_${d.watch}`, { s: r0(v.soil_pct), r: r0(v.rain_pct), r3: r0(v.rain3_pct), d: r0(100 - (v.soil_pct ?? 0)) });
}

function Swing({ DATA, prof, now, ref0, label, domain }) {
  if (!prof) return null;
  const L = DATA.meta.lag_labels.map((_, i) => monthName(`${2001 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, true) + (i >= 12 ? "+1" : ""));
  const rows = L.map((lab, i) => {
    const mean = prof.mean[i], lo = prof.min[i], hi = prof.max[i], nw = now ? now[i] : null;
    return { lab, mean, band: lo != null && hi != null ? [lo, hi] : null, now: nw, title: lab,
      tip: [`${t("past_avg")}: ${r0(mean)}`, `${t("range")}: ${r0(lo)}–${r0(hi)}`, ...(nw != null ? [`${t("this_year")}: ${r0(nw)}`] : [])] };
  });
  return (
    <ChartContainer className="aspect-auto h-64">
      <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="lab" tickLine={false} axisLine={false} interval={1} tickMargin={6} />
        <YAxis tickLine={false} axisLine={false} width={44} domain={domain || ["auto", "auto"]} label={{ value: label, angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
        <ReferenceLine y={ref0} strokeDasharray="4 4" />
        <Area dataKey="band" type="monotone" stroke="none" fill="#9aa39e" fillOpacity={0.25} isAnimationActive={false} />
        <Line dataKey="mean" type="monotone" stroke="#16201f" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="now" type="monotone" stroke={AMBER} strokeWidth={3} dot={{ r: 2, fill: AMBER }} connectNulls={false} isAnimationActive={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
      </ComposedChart>
    </ChartContainer>
  );
}

export function FullData({ DATA, GEO, SAFE, TOWNS, name }) {
  const d = DATA.districts[name];
  const [kind, setKind] = useState(DATA.el_nino.profile_shown || "el_nino");
  const early = d.so_far ? ` (${t("early", { n: d.so_far.days })})` : "";
  const soilNote = d.flag_values?.wet_source === "rain3" ? t("wet_from_rain") + " "
    : d.now.soil_month && d.now.soil_month !== d.flag_month ? t("soil_from", { m: monthName(d.now.soil_month) }) + " " : "";
  const hasLN = !!d.profiles?.la_nina;
  const yr = DATA.el_nino.current?.year0 ?? "";
  const prof = (d.profiles && d.profiles[kind]) || d.profile;
  const showNow = kind === (DATA.el_nino.profile_shown || "el_nino");
  const res = (DATA.reservoirs?.items || []).filter((r) => r.district === name).sort((a, b) => (b.pct_full ?? 0) - (a.pct_full ?? 0));
  const gauges = (DATA.rivers?.items || []).filter((g) => g.district === name);
  const release = res.some((r) => r.spilling) && gauges.some((g) => GAUGE_HOT.includes(g.status));
  const when = [DATA.reservoirs?.date, DATA.rivers?.latest].filter(Boolean).join(" · ");
  const tws = DATA.towns?.districts?.[name] || [];
  const sp = SAFE?.districts?.[name];
  const sig = d.significance || {};
  const sw = sig["Southwest monsoon (May-Sep)"], ond = sig["Northeast monsoon onset (Oct-Dec)"], tr = d.trend?.rain;
  const chance = (s) => t(s.p < 0.05 ? "f_not_chance" : "f_chance", { p: s.p });
  const facts = [
    sw && [t("f_sw"), t("f_of_normal", { p: r0(sw.pct_of_normal) }), chance(sw)],
    ond && [t("f_ond"), t("f_of_normal", { p: r0(ond.pct_of_normal) }), chance(ond)],
    tr && [t("f_trend"), t("f_per_decade", { p: (tr.pct_per_decade > 0 ? "+" : "") + tr.pct_per_decade }), tr.significant_fdr ? t("f_sig") : t("f_notsig", { p: tr.p })],
  ].filter(Boolean);
  const used = DATA.el_nino.strong_used || [];
  const story = [
    sw && ond && used.length && t("story_swing", { n: used.length, y: Math.min(...used), d: dName(name), a: r0(sw.pct_of_normal), b: r0(ond.pct_of_normal) }),
    d.so_far && t("story_sofar", { m: monthName(d.so_far.month), n: d.so_far.days, p: r0(d.so_far.rain_pct) }),
    tr && (tr.significant_fdr ? t("story_trend_yes", { p: tr.pct_per_decade }) : t("story_trend_no")),
  ].filter(Boolean);
  return (
    <div className="grid gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardDescription>{d.hill ? t("hill") : t("district")} · {monthName(d.flag_month)}{early}</CardDescription>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md px-3 py-1 text-sm font-semibold" style={{ background: WATCH[d.watch].hex, color: d.watch === "DryWatch" || d.watch === "Clear" ? "#16201f" : "#fff" }}>{watchLabel(d.watch)}</span>
            {d.level && <span className="flex items-center gap-2 text-sm"><span className={cn("size-3 rounded-full", LEVEL_DOT[d.level.level])} /><b>{t("lvl_" + d.level.level)}</b>{d.level.hazard ? ` (${t("hz_" + d.level.hazard)})` : ""}</span>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-[15px]">
          {d.level && <p>{t("lvl_rain", { a: r0(d.level.rain_1d), b: r0(d.level.rain_3d), d: d.level.day })}</p>}
          <p>{reasonText(d)}</p>
          {d.next && <p>{t("next", { n: d.next.months.length, p: r0(d.next.rain_pct) })}</p>}
          <p className="text-sm text-muted-foreground">{soilNote}{t("not_forecast")}</p>
        </CardContent>
      </Card>

      {(DATA.reservoirs || DATA.rivers) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="size-5 text-brand" />{t("live_title")}</CardTitle><CardDescription>{t("live_src", { t: when })}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {release && <p className="rounded-md bg-[#f6d3cf] p-3 font-medium md:col-span-2">{t("release")}</p>}
            <Table><TableBody>
              {res.length ? res.map((r) => <TableRow key={r.name}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{t("full", { p: r0(r.pct_full) })}</TableCell><TableCell className={r.spilling ? "font-semibold text-[#b3261e]" : "text-muted-foreground"}>{r.spilling ? t("spilling", { c: r0(r.spill_cusec) }) : t("not_spilling")}</TableCell></TableRow>)
                : <TableRow><TableCell className="text-muted-foreground">{t("res_none")}</TableCell></TableRow>}
            </TableBody></Table>
            <Table><TableBody>
              {gauges.length ? gauges.map((g) => <TableRow key={g.gauge}><TableCell className="font-medium">{g.gauge}</TableCell><TableCell>{t("level", { l: g.level_m, a: g.alert_m })}</TableCell><TableCell className={GAUGE_HOT.includes(g.status) ? "font-semibold text-[#b3261e]" : "text-muted-foreground"}>{t("g_" + g.status)}</TableCell></TableRow>)
                : <TableRow><TableCell className="text-muted-foreground">{t("gauges_none")}</TableCell></TableRow>}
            </TableBody></Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("swing_title")}</CardTitle>
              {hasLN && <Tabs value={kind} onValueChange={setKind}><TabsList>{["el_nino", "la_nina"].map((k) => <TabsTrigger key={k} value={k}>{t("t_" + k)}</TabsTrigger>)}</TabsList></Tabs>}
            </div>
            <CardDescription>{t("swing_cap", { y: yr })}</CardDescription>
          </CardHeader>
          <CardContent><Swing DATA={DATA} prof={prof?.rain_pct} now={showNow ? d.this_event?.rain_pct : null} ref0={100} label={t("y_rain")} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("soil_title")}</CardTitle><CardDescription>{t("soil_cap")}</CardDescription></CardHeader>
          <CardContent><Swing DATA={DATA} prof={prof?.soil_pct} now={showNow ? d.this_event?.soil_pct : null} ref0={50} label={t("y_soil")} domain={[0, 100]} /></CardContent>
        </Card>
      </div>

      {facts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {facts.map(([k, v, dsc]) => <Card key={k}><CardHeader className="pb-2"><CardDescription className="font-medium">{k}</CardDescription></CardHeader><CardContent><p className="font-display text-2xl font-bold">{v}</p><p className="mt-1 text-sm text-muted-foreground">{dsc}</p></CardContent></Card>)}
        </div>
      )}

      {tws.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><Waves className="size-5 text-brand" />{t("s_towns")}<Badge variant="outline" className="normal-case tracking-normal">NASA GPM IMERG + SRTM</Badge></CardTitle><CardDescription>{t("town_note")}</CardDescription></CardHeader>
          <CardContent className="max-h-[520px] overflow-auto px-2 sm:px-5">
            <Table>
              <TableHeader><TableRow><TableHead>{t("th_town")}</TableHead><TableHead>{t("th_today")}</TableHead><TableHead className="text-right">{t("th_rain")}</TableHead><TableHead className="text-right">{t("th_steep")}</TableHead><TableHead>{t("th_ditwah")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {tws.map((x) => (
                  <TableRow key={x.name}>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell><span className="flex items-center gap-2 whitespace-nowrap"><span className={cn("size-2.5 rounded-full", LEVEL_DOT[x.level])} />{t("lvs_" + x.level)}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{r0(x.rain_1d)} mm</TableCell>
                    <TableCell className="text-right tabular-nums">{x.steep_share == null ? "" : Math.round(x.steep_share * 100) + "%"}</TableCell>
                    <TableCell>{x.ditwah && <span className="flex items-center gap-2 whitespace-nowrap"><span className={cn("size-2.5 rounded-full", LEVEL_DOT[x.ditwah.level || 0])} />{t("lvs_" + x.ditwah.level)}, {r0(x.ditwah.rain_mm)} mm</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {sp && (
        <Card>
          <CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><MapPin className="size-5 text-brand" />{t("s_safe")}<Badge variant="outline" className="normal-case tracking-normal">NASA SRTM</Badge></CardTitle><CardDescription>{t("safe_count", { a: sp.safer, n: sp.count })} {t("safe_note")}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            {GEO && <div className="rounded-md bg-secondary/60 p-2" dangerouslySetInnerHTML={{ __html: centreMap(name, GEO, SAFE, TOWNS, tws) }} />}
            <Table><TableBody>
              {sp.top.slice(0, 5).map((c, i) => <TableRow key={i}><TableCell className="w-8 font-semibold">{i + 1}</TableCell><TableCell>{c[3]}<p className="text-xs text-muted-foreground">{t("kind_" + c[2])}, {c[4]} m</p></TableCell></TableRow>)}
            </TableBody></Table>
          </CardContent>
        </Card>
      )}

      {story.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("story_title", { d: dName(name) })}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-[15px]">{story.map((p, i) => <p key={i}>{p}</p>)}</CardContent>
        </Card>
      )}
    </div>
  );
}
