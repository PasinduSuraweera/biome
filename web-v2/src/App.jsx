// Biome, new design: a dashboard built with shadcn/ui (Radix, Tailwind, Recharts).
// The report itself (what it says, the numbers, the translations) comes from the
// classic app's code in ../web/src, so both versions always agree.
import { useCallback, useEffect, useMemo, useState } from "react";
import { geoArea } from "d3-geo";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, Bell, Menu, BookOpen, CalendarDays, CheckCircle2, CloudRain, Database, Download, Droplets, Home, Image, LayoutDashboard, Leaf, MapPin,
  MessageCircleQuestion, Mountain, Printer, Satellite, Sprout, Users, Waves,
} from "lucide-react";
import { IslandMap } from "@/sections/IslandMap";
import { Gallery } from "@/sections/Gallery";
import { FullData } from "@/sections/FullData";
import { Calendar } from "@/sections/Calendar";
import { How } from "@/sections/How";
import { Landing } from "@/sections/Landing";
import { Logo, ThemeToggle, useTheme } from "@/lib/theme";
import { YearPlan } from "@/sections/YearPlan";
import { NasaTag, OutlookCard, YearsCard, AskCard, PlantCard, AlertsCard, mapsLink } from "@/sections/cards";
import { t, dName, getLang, setLang, LANGS, monthName } from "@classic/i18n.js";
import { buildReport, alertMessage, downloadPNG, COASTAL } from "@classic/simple.js";
import { loadNasa, centreMap, greenMap } from "@classic/nasa.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const NAV = [
  { v: "home", icon: Home }, { v: "overview", icon: LayoutDashboard }, { v: "family", icon: Users }, { v: "farmer", icon: Sprout },
  { v: "coast", icon: Waves }, { v: "full", icon: Database }, { v: "nasa", icon: Image }, { v: "calendar", icon: CalendarDays }, { v: "how", icon: BookOpen },
];
const VIEWS = NAV.map((n) => n.v);
const DISTRICT_VIEWS = ["family", "farmer", "coast", "full"];
const BOTTOM = ["overview", "family", "farmer", "coast"];
import { L, UI, ui, slug, in10, LEVEL_TONE, LEVEL_DOT, LEVEL_FILL, SIGN_FILL, SIGN_CLS, narrow, WATCH_ICON, monthSigns } from "@/lib/ui";
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
const navLabel = (v) => (["home", "overview", "nasa"].includes(v) ? ui(v) : v === "calendar" ? t("cal_title") : v === "how" ? t("how_title") : t(`tab_${v}`));
const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
function readHash() {
  const [v, d] = decodeURIComponent(location.hash.slice(1)).split("/");
  return { view: VIEWS.includes(v) ? v : "home", d: d || "" };
}
export default function App() {
  const [lang, setL] = useState(getLang());
  const [theme, toggleTheme] = useTheme();
  const [{ view, d: hashD }, setRoute] = useState(readHash);
  const [DATA, setData] = useState(null);
  const [GEO, setGeo] = useState(null);
  const [SAFE, setSafe] = useState(null);
  const [TOWNS, setTowns] = useState(null);
  const [nasaReady, setNasaReady] = useState(false);
  const [INDEX, setIndex] = useState(null);
  const [FLOOD, setFlood] = useState(null);
  const [showFlood, setShowFlood] = useState(false);
  const [town, setTown] = useState("");
  const [alertLv, setAlertLv] = useState("2");

  useEffect(() => {
    getJSON("data/biome.json").then(setData);
    getJSON("data/districts.geojson").then((g) => {
      if (!g) return;
      g.features.forEach((f) => { f.properties.name = f.properties.shapeName.replace(" District", "").trim(); rewind(f); });
      setGeo(g);
    });
    getJSON("data/safe_centres.json").then(setSafe);
    getJSON("data/towns.geojson").then((j) => { if (j) { j.features.forEach(rewind); setTowns(j); } });
    loadNasa().then((ix) => { setIndex(ix); setNasaReady(true); });
    getJSON("data/flood_nov2025.geojson").then((fl) => { if (fl) { fl.features.forEach(rewind); setFlood(fl); } });
    const onHash = () => setRoute(readHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const names = useMemo(() => (DATA ? Object.keys(DATA.districts).sort() : []), [DATA]);
  const allowed = view === "coast" ? names.filter((n) => COASTAL.has(n)) : names;
  const name = allowed.find((n) => slug(n) === hashD) || (allowed.includes("Kandy") ? "Kandy" : allowed[0]);
  const go = useCallback((v, n) => { location.hash = n ? `${v}/${slug(n)}` : v === "home" ? "" : v; setTown(""); window.scrollTo(0, 0); }, []);
  const pickView = (v) => go(v, !DISTRICT_VIEWS.includes(v) ? "" : v === "coast" && !COASTAL.has(name) ? "Colombo" : name);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [view]);
  const m = useMemo(() => (DATA && name && DISTRICT_VIEWS.includes(view) ? buildReport(name, view === "full" ? "family" : view, DATA, SAFE, town) : null),
    [DATA, SAFE, name, view, town, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeLang = (l) => { setLang(l); setL(l); document.documentElement.lang = l; };

  if (!DATA) return <div className="grid min-h-screen place-items-center text-muted-foreground">{ui("loading")}</div>;
  if (view === "home") return <Landing DATA={DATA} SAFE={SAFE} GEO={GEO} INDEX={INDEX} lang={lang} changeLang={changeLang} go={go} theme={theme} toggleTheme={toggleTheme} />;
  const title = navLabel(view);
  const isDistrict = DISTRICT_VIEWS.includes(view);

  return (
    <>
    {m && view !== "full" && <YearPlan m={m} name={name} view={view} DATA={DATA} SAFE={SAFE} town={town} />}
    <div className="flex min-h-screen print:hidden">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center px-5"><Logo className="h-8 w-auto" /></div>
        <p className="px-5 pb-4 text-xs text-muted-foreground">{t("tagline")}</p>
        <nav className="grid gap-1 px-3">
          {NAV.map(({ v, icon: I }) => (
            <button key={v} type="button" onClick={() => pickView(v)}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                v === view ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}>
              <I className="size-4" />{navLabel(v)}
            </button>
          ))}
        </nav>
        <Separator className="my-4" />
        <div className="grid gap-2 px-5 text-xs text-muted-foreground">
          <p className="font-semibold uppercase tracking-wide">NASA</p>
          {["GPM IMERG", "GLDAS", "MERRA-2", "MODIS", "NASADEM (SRTM)", "VIIRS · Worldview"].map((x) => <p key={x} className="flex items-center gap-2"><Satellite className="size-3.5" />{x}</p>)}
        </div>
        <div className="mt-auto grid gap-3 p-4">
          <div className="flex items-center gap-1">
            {Object.entries(LANGS).map(([k, label]) => (
              <Button key={k} size="sm" variant={k === lang ? "secondary" : "ghost"} className="flex-1 px-2" onClick={() => changeLang(k)} aria-pressed={k === lang}>{label}</Button>
            ))}
            <ThemeToggle theme={theme} toggle={toggleTheme} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 md:px-6">
            <div className="order-first flex w-full items-center gap-1 lg:hidden">
              <a href={`${import.meta.env.BASE_URL}#`} className="mr-auto"><Logo className="h-7 w-auto" /></a>
              <ThemeToggle theme={theme} toggle={toggleTheme} />
              {Object.entries(LANGS).map(([k, label]) => (
                <Button key={k} size="sm" variant={k === lang ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => changeLang(k)}>{label}</Button>
              ))}
            </div>
            <div className="mr-auto min-w-0">
              <p className="text-xs text-muted-foreground">Biome / {title}</p>
              <h1 className="truncate font-display text-xl font-semibold">{isDistrict ? (m?.district || dName(name)) : view === "overview" ? ui("allSL") : title}</h1>
            </div>
            {isDistrict && (
              <div className="flex w-full gap-2 sm:w-auto">
                <Select value={name} onValueChange={(n) => go(view, n)}>
                  <SelectTrigger className="h-10 sm:w-48" aria-label={ui("district")}><SelectValue /></SelectTrigger>
                  <SelectContent>{allowed.map((n) => <SelectItem key={n} value={n}>{dName(n)}</SelectItem>)}</SelectContent>
                </Select>
                {view !== "full" && m?.towns.length > 0 && (
                  <Select value={town || "__all"} onValueChange={(v) => setTown(v === "__all" ? "" : v)}>
                    <SelectTrigger className="h-10 sm:w-52" aria-label={t("s_town")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">{t("town_all")}</SelectItem>
                      {m.towns.map((x) => <SelectItem key={x.name} value={x.name}>{x.name}{x.level ? ` · ${t(`lvs_${x.level}`)}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="grid gap-4 p-4 pb-28 md:gap-6 md:p-6 md:pb-28 lg:pb-6">
          {view === "overview" && <Overview DATA={DATA} SAFE={SAFE} GEO={GEO} go={go} />}
          {m && view !== "full" && <DistrictView m={m} name={name} view={view} DATA={DATA} GEO={GEO} SAFE={SAFE} TOWNS={TOWNS} town={town} setTown={setTown} nasaReady={nasaReady} alertLv={alertLv} setAlertLv={setAlertLv} go={go} />}
          {view === "full" && (
            <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
              <Card className="h-fit xl:sticky xl:top-24">
                <CardHeader><CardTitle>{ui("map_t")}</CardTitle><CardDescription>{ui("map_d")}</CardDescription></CardHeader>
                <CardContent>{GEO && <IslandMap GEO={GEO} DATA={DATA} FLOOD={FLOOD} name={name} onPick={(n) => go("full", n)} view="full" full showFlood={showFlood} onFlood={setShowFlood} />}</CardContent>
              </Card>
              <div className="grid min-w-0 content-start gap-4 md:gap-6">
                <FullData DATA={DATA} GEO={GEO} SAFE={SAFE} TOWNS={TOWNS} name={name} />
                {m && <OutlookCard m={m} DATA={DATA} name={name} />}
                {m?.years && <YearsCard m={m} DATA={DATA} name={name} />}
              </div>
            </div>
          )}
          {view === "nasa" && <Gallery INDEX={INDEX} />}
          {view === "calendar" && <Calendar DATA={DATA} current={name} />}
          {view === "how" && <How DATA={DATA} SAFE={SAFE} />}
          <Footer />
        </main>
      </div>

      {/* phones and tablets: the main pages one tap away at the bottom, the rest under More */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        {more && (
          <div className="grid gap-1 border-b p-3">
            {NAV.filter((n) => !BOTTOM.includes(n.v)).map(({ v, icon: I }) => (
              <button key={v} type="button" onClick={() => pickView(v)} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium", v === view ? "bg-secondary" : "hover:bg-secondary/60")}><I className="size-5" />{navLabel(v)}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))]">
          {BOTTOM.map((v) => {
            const I = NAV.find((n) => n.v === v).icon;
            return (
              <button key={v} type="button" onClick={() => pickView(v)} aria-current={v === view ? "page" : undefined}
                className={cn("flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium", v === view ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", v === view && "bg-secondary")}><I className="size-5" /></span>
                <span className="w-full truncate text-center">{navLabel(v)}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setMore((x) => !x)} aria-expanded={more}
            className={cn("flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium", more || !BOTTOM.includes(view) ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("grid h-7 w-12 place-items-center rounded-full", (more || !BOTTOM.includes(view)) && "bg-secondary")}><Menu className="size-5" /></span>
            <span>{ui("more")}</span>
          </button>
        </div>
      </nav>
    </div>
    </>
  );
}

function Footer() {
  return (
    <div className="grid gap-3">
      <Card className="border-0 bg-[#10232a] text-[#f3efe6] dark:bg-[#1c2f35]">
        <CardContent className="flex items-start gap-3 p-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand" /><p className="font-medium">{t("emer")}</p></CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("disc")}</p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Satellite className="size-4 shrink-0" />{t("rep_nasa")}</p>
    </div>
  );
}

function Kpi({ label, value, sub, icon: I, className, dot }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="font-medium">{label}</CardDescription>
        {I && <I className="size-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 font-display text-2xl font-bold leading-tight">{dot && <span className={cn("size-3 shrink-0 rounded-full", dot)} />}{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------- overview: the whole island ----------------
function Overview({ DATA, SAFE, GEO, go }) {
  const names = Object.keys(DATA.districts);
  const rows = names.map((n) => {
    const d = DATA.districts[n], lv = d.level || { level: 0 };
    const ms = monthSigns(DATA, n).slice(0, 3);
    const pDry = ms.length ? ms.reduce((a, x) => a + x.pDry, 0) / ms.length : 0;
    const pWet = ms.length ? ms.reduce((a, x) => a + x.pWet, 0) / ms.length : 0;
    const next = !ms.some((x) => x.sig) ? "normal" : pDry >= 0.5 ? "dry" : pWet >= 0.5 ? "wet" : "mixed";
    return { n, d, lv, next };
  }).sort((a, b) => b.lv.level - a.lv.level || (b.lv.rain_3d ?? 0) - (a.lv.rain_3d ?? 0) || a.n.localeCompare(b.n));
  const onAlert = rows.filter((r) => r.lv.level > 0).length;
  const counts = DATA.meta.watch_counts || {};
  const LV = DATA.levels || {};
  const cur = DATA.el_nino.current;
  const dry3 = rows.filter((r) => r.next === "dry").length;
  const day = LV.day ? `${Number(LV.day.slice(8, 10))} ${monthName(LV.day.slice(0, 7))}` : "";
  const chart = [...rows].sort((a, b) => (b.lv.rain_3d ?? 0) - (a.lv.rain_3d ?? 0)).map((r) => ({
    name: dName(r.n), v: Math.round(r.lv.rain_3d ?? 0), fill: LEVEL_FILL[r.lv.level],
    title: dName(r.n), tip: [t("lvl_rain", { a: Math.round(r.lv.rain_1d ?? 0), b: Math.round(r.lv.rain_3d ?? 0), d: day }), t(`lvl_${r.lv.level}`)],
  }));
  const safer = SAFE ? Object.values(SAFE.districts).reduce((a, s) => a + s.safer, 0) : null;
  const total = SAFE ? Object.values(SAFE.districts).reduce((a, s) => a + s.count, 0) : null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={ui("k_level")} value={`${onAlert} / ${rows.length}`} sub={ui("k_level_d")} icon={Bell} />
        <Kpi label={ui("k_watch")} icon={Mountain}
          value={<span className="flex flex-wrap gap-x-3 text-xl">{["SlopeWatch", "FloodWatch", "DryWatch"].filter((w) => counts[w]).map((w) => <span key={w}>{counts[w]} {w}</span>)}</span>}
          sub={`${counts.Clear || 0} · ${t("w_Clear")}`} />
        <Kpi label={ui("k_rain")} value={day} sub={ui(LV.source === "early" ? "k_rain_early" : "k_rain_late")} icon={CloudRain} />
        <Kpi label={ui("k_ocean")} icon={Waves}
          value={cur ? `${cur.peak > 0 ? "+" : ""}${cur.peak}` : "0"} sub={cur ? t(cur.kind === "la_nina" ? "nina" : "nino", { y: cur.year0, s: t(cur.strength), v: cur.peak }) : t("neutral")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader><CardTitle>{ui("t_districts")}</CardTitle><CardDescription>{ui("t_districts_d")}</CardDescription></CardHeader>
          <CardContent className="px-2 sm:px-5">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{ui("district")}</TableHead><TableHead>{ui("th_level")}</TableHead><TableHead className="hidden md:table-cell">{ui("th_watch")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{ui("th_1d")}</TableHead><TableHead className="text-right">{ui("th_3d")}</TableHead><TableHead>{ui("th_next")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const WI = WATCH_ICON[r.d.watch] || CheckCircle2;
                  return (
                    <TableRow key={r.n} className="cursor-pointer" onClick={() => go("family", r.n)}>
                      <TableCell className="font-medium">{dName(r.n)}</TableCell>
                      <TableCell><span className="flex items-center gap-2 whitespace-nowrap"><span className={cn("size-2.5 rounded-full", LEVEL_DOT[r.lv.level])} />{t(`lvs_${r.lv.level}`)}</span></TableCell>
                      <TableCell className="hidden md:table-cell"><span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground"><WI className="size-3.5" />{r.d.watch === "Clear" ? "–" : r.d.watch}</span></TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{Math.round(r.lv.rain_1d ?? 0)} mm</TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(r.lv.rain_3d ?? 0)} mm</TableCell>
                      <TableCell><span className={cn("inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", SIGN_CLS[r.next])}>{t(`kf_${r.next}`)}</span></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>{ui("map_t")}</CardTitle><CardDescription>{ui("map_d")}</CardDescription></CardHeader>
            <CardContent>{GEO && <IslandMap GEO={GEO} DATA={DATA} name="" onPick={(n) => go("family", n)} view="family" className="mx-auto max-w-[420px]" />}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">{ui("c_rain")}<NasaTag>NASA GPM IMERG</NasaTag></CardTitle><CardDescription>{ui("c_rain_d")}</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer className="aspect-auto h-[600px]">
                <BarChart data={chart} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} unit=" mm" />
                  <YAxis type="category" dataKey="name" width={104} tickLine={false} axisLine={false} interval={0} />
                  <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="v" radius={4}>{chart.map((c, i) => <Cell key={i} fill={c.fill} />)}</Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Kpi label={ui("k_dry3")} value={dry3} sub={ui("k_dry3_d")} icon={Droplets} />
            <Kpi label={ui("k_safe")} icon={MapPin} value={safer != null ? safer.toLocaleString() : "…"} sub={total != null ? `/ ${total.toLocaleString()} · NASA SRTM` : ""} />
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------- one district ----------------
function DistrictView({ m, name, view, DATA, GEO, SAFE, TOWNS, town, setTown, nasaReady, alertLv, setAlertLv, go }) {
  const mapExtra = m.extras.find((e) => e.map);
  const otherExtras = m.extras.filter((e) => !e.map);
  const cmapHTML = GEO ? centreMap(name, GEO, SAFE, TOWNS, DATA.towns?.districts?.[name], town) : "";
  const greenHTML = GEO && nasaReady ? greenMap(name, GEO) : "";
  const sp = SAFE?.districts?.[name];
  const tsp = town ? SAFE?.towns?.[`${name}|${town}`] : null;
  const res = (DATA.reservoirs?.items || []).filter((r) => r.district === name && r.pct_full != null);
  const tanks = res.length ? Math.round(res.reduce((a, r) => a + r.pct_full, 0) / res.length) : null;
  const WI = WATCH_ICON[m.now.watch] || CheckCircle2;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{m.aud}</Badge>
        <Button size="sm" variant="ghost" onClick={() => downloadPNG(m)}><Download />{ui("png")}</Button>
        <Button size="sm" onClick={() => print()}><Printer />{ui("yearplan")}</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,340px)_1fr]">
      <Card className="xl:row-span-1">
        <CardContent className="p-4">{GEO && <IslandMap GEO={GEO} DATA={DATA} name={name} onPick={(n) => go(view, n)} view={view} compact />}</CardContent>
      </Card>
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <Card className={cn(m.level && LEVEL_TONE[m.level.n])}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardDescription className="font-medium">{t("s_level")}</CardDescription><Bell className="size-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 font-display text-lg font-bold leading-snug"><span className={cn("size-3 shrink-0 rounded-full", LEVEL_DOT[m.level?.n || 0])} />{m.level ? m.level.title : t("lvl_0")}</p>
            {m.level && <p className="mt-1 text-xs text-muted-foreground">{m.level.rain}</p>}
          </CardContent>
        </Card>
        <Card className="border-0" style={{ background: m.now.bg, color: m.now.fg }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><p className="text-sm font-medium opacity-85">{t("s_now")} · {m.when}</p><WI className="size-4 opacity-80" /></CardHeader>
          <CardContent><p className="font-display text-lg font-bold leading-snug">{m.now.title}</p><p className="mt-1 text-xs opacity-90">{m.now.desc}</p></CardContent>
        </Card>
        <Kpi label={ui("k_next3")} icon={CloudRain} value={<span className="text-base font-semibold leading-snug">{m.periods[1]?.lines[0] || m.basis}</span>} sub={m.periods[1]?.range} />
        {view === "farmer" && tanks != null
          ? <Kpi label={ui("k_tanks")} icon={Droplets} value={`${tanks}%`} sub={`${ui("k_full")} · ${res.length} · Irrigation Department`} />
          : <Kpi label={t("s_safe")} icon={MapPin} value={sp ? `${(tsp || sp).safer} / ${(tsp || sp).count}` : "…"} sub="NASA SRTM · OpenStreetMap" />}
      </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <OutlookCard m={m} DATA={DATA} name={name} className="xl:col-span-2" />
        <AskCard m={m} />
      </div>

      {m.plant?.length > 0 && <PlantCard m={m} />}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-brand" />{t("s_todo")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {m.todo.map((x, i) => <li key={i} className="flex gap-3 text-[15px]"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{i + 1}</span><span>{x}</span></li>)}
            </ul>
          </CardContent>
        </Card>
        {mapExtra && (
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><MapPin className="size-5 text-brand" />{mapExtra.title}<NasaTag>{mapExtra.tag}</NasaTag></CardTitle><CardDescription>{mapExtra.lines[mapExtra.lines.length - 1]}</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              {cmapHTML ? <div className="rounded-md bg-secondary/60 p-2" dangerouslySetInnerHTML={{ __html: cmapHTML }}
                onClick={(e) => { const p = e.target.closest("path.town"); if (p) setTown(p.dataset.town === town ? "" : p.dataset.town); }} /> : <div />}
              <div>
                <Table>
                  <TableBody>
                    {((tsp || sp)?.top || []).slice(0, 5).map((c, i) => (
                      <TableRow key={i}><TableCell className="w-8 font-semibold">{i + 1}</TableCell><TableCell><a href={mapsLink(c)} target="_blank" rel="noopener" className="group flex items-start justify-between gap-2"><span>{c[3]}<span className="block text-xs text-muted-foreground">{t(`kind_${c[2]}`)}</span></span><MapPin className="mt-0.5 size-4 shrink-0 text-brand opacity-70 group-hover:opacity-100" /></a></TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-sm text-muted-foreground">{mapExtra.lines[mapExtra.lines.length - 2]}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {m.years && <YearsCard m={m} DATA={DATA} name={name} className="xl:col-span-2" />}
        {m.level && <AlertsCard m={m} lv={alertLv} setLv={setAlertLv} />}
      </div>

      {otherExtras.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {otherExtras.map((e, i) => (
            <Card key={i} className={cn(e.green && "md:col-span-2")}>
              <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">{e.green ? <Leaf className="size-5 text-brand" /> : <CloudRain className="size-5 text-brand" />}{e.title}<NasaTag>{e.tag}</NasaTag></CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {e.green && greenHTML && <div className="[&_.green]:max-w-xl" dangerouslySetInnerHTML={{ __html: greenHTML }} />}
                <ul className="grid gap-1.5 text-[15px]">{e.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

