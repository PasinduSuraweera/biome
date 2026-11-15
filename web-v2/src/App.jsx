// Biome, new design (shadcn/ui). The report itself (what it says, the numbers,
// the translations) comes from the classic app's code in ../web/src, so the two
// versions can be compared side by side and always agree.
import { useCallback, useEffect, useMemo, useState } from "react";
import { geoArea } from "d3-geo";
import {
  AlertTriangle, ArrowUpRight, Bell, CheckCircle2, CloudRain, Download, Leaf, MapPin, MessageCircleQuestion,
  Printer, Satellite, Sprout, Waves,
} from "lucide-react";
import { t, dName, getLang, setLang, LANGS } from "@classic/i18n.js";
import { buildReport, alertMessage, downloadPNG, COASTAL } from "@classic/simple.js";
import { loadNasa, centreMap, greenMap } from "@classic/nasa.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const VIEWS = ["family", "farmer", "coast"];
const VIEW_ICON = { family: MapPin, farmer: Sprout, coast: Waves };
const L = (en, si, ta) => ({ en, si, ta });
const UI = {
  district: L("District", "දිස්ත්‍රික්කය", "மாவட்டம்"),
  preview: L("New design · preview", "නව සැලසුම · පෙරදසුන", "புதிய வடிவமைப்பு · முன்னோட்டம்"),
  classic: L("Classic version", "පැරණි අනුවාදය", "பழைய பதிப்பு"),
  loading: L("Loading NASA data…", "NASA දත්ත පූරණය වෙමින්…", "NASA தரவு ஏற்றப்படுகிறது…"),
  png: L("Save as picture", "පින්තූරයක් ලෙස සුරකින්න", "படமாகச் சேமிக்கவும்"),
};
const ui = (k) => UI[k][getLang()] || UI[k].en;
const slug = (n) => n.toLowerCase().replace(/\s+/g, "-");
const LEVEL_TONE = ["bg-card", "bg-[#fbf3d0]", "bg-[#fbe2cc]", "bg-[#f6d3cf]"];
const LEVEL_DOT = ["bg-[#9aa39e]", "bg-[#e0b422]", "bg-[#d2691e]", "bg-[#b3261e]"];
const SIGN_CLS = {
  dry: "bg-dry text-[#2a1e05]", wet: "bg-wet text-white", normal: "bg-usual text-[#4a5552]",
  mixed: "text-[#16201f] bg-[linear-gradient(135deg,#f1dba6_50%,#b9d6dc_50%)]",
};

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

const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);

function readHash() {
  const [v, d] = decodeURIComponent(location.hash.slice(1)).split("/");
  return { view: VIEWS.includes(v) ? v : "family", d: d || "" };
}

export default function App() {
  const [lang, setL] = useState(getLang());
  const [{ view, d: hashD }, setRoute] = useState(readHash);
  const [DATA, setData] = useState(null);
  const [GEO, setGeo] = useState(null);
  const [SAFE, setSafe] = useState(null);
  const [TOWNS, setTowns] = useState(null);
  const [nasaReady, setNasaReady] = useState(false);
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
    loadNasa().then(() => setNasaReady(true));
    const onHash = () => setRoute(readHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const names = useMemo(() => (DATA ? Object.keys(DATA.districts).sort() : []), [DATA]);
  const allowed = view === "coast" ? names.filter((n) => COASTAL.has(n)) : names;
  const name = allowed.find((n) => slug(n) === hashD) || (allowed.includes("Kandy") ? "Kandy" : allowed[0]);
  const go = useCallback((v, n) => { location.hash = `${v}/${slug(n)}`; setTown(""); }, []);

  const m = useMemo(() => (DATA && name ? buildReport(name, view, DATA, SAFE, town) : null),
    // lang is a dependency on purpose: the report's text is built in the chosen language
    [DATA, SAFE, name, view, town, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeLang = (l) => { setLang(l); setL(l); document.documentElement.lang = l; };

  if (!DATA || !m) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">{ui("loading")}</div>;
  }

  const mapExtra = m.extras.find((e) => e.map);
  const otherExtras = m.extras.filter((e) => !e.map);
  const cmapHTML = GEO ? centreMap(name, GEO, SAFE, TOWNS, DATA.towns?.districts?.[name], town) : "";
  const greenHTML = GEO && nasaReady ? greenMap(name, GEO) : "";

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
        <div className="container flex h-16 items-center justify-between gap-3">
          <a href="#" className="flex items-center gap-3">
            <img src="logo.png" alt="Biome" className="h-8 w-auto" />
            <span className="hidden text-sm text-muted-foreground md:inline">{t("tagline")}</span>
          </a>
          <div className="flex items-center gap-1">
            {Object.entries(LANGS).map(([k, label]) => (
              <Button key={k} size="sm" variant={k === lang ? "secondary" : "ghost"} onClick={() => changeLang(k)} aria-pressed={k === lang}>{label}</Button>
            ))}
          </div>
        </div>
      </header>

      <main className="container py-6 md:py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="mb-3">{ui("preview")}</Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("headline")}</h1>
          </div>
          <Button variant="link" asChild className="px-0 text-muted-foreground">
            <a href={`./#${view}/${slug(name)}`}>{ui("classic")} <ArrowUpRight /></a>
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => go(v, v === "coast" && !COASTAL.has(name) ? "Colombo" : name)}>
          <TabsList className="h-11">
            {VIEWS.map((v) => { const I = VIEW_ICON[v]; return <TabsTrigger key={v} value={v} className="px-4"><I />{t(`tab_${v}`)}</TabsTrigger>; })}
          </TabsList>
        </Tabs>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <label className="grid gap-1.5 text-sm text-muted-foreground">{ui("district")}
            <Select value={name} onValueChange={(n) => go(view, n)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{allowed.map((n) => <SelectItem key={n} value={n}>{dName(n)}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          {m.towns.length > 0 && (
            <label className="grid gap-1.5 text-sm text-muted-foreground">{t("s_town")}
              <Select value={town || "__all"} onValueChange={(v) => setTown(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("town_all")}</SelectItem>
                  {m.towns.map((x) => <SelectItem key={x.name} value={x.name}>{x.name}{x.level ? ` · ${t(`lvs_${x.level}`)}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-deep">{m.aud}</p>
          <h2 className="font-display text-2xl font-semibold">{m.district}</h2>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <div className="grid content-start gap-5">
            <NowCard m={m} />
            <AskCard m={m} />
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-brand" />{t("s_todo")}</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {m.todo.map((x, i) => (
                    <li key={i} className="flex gap-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">{i + 1}</span><span>{x}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            {mapExtra && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2"><MapPin className="size-5 text-brand" />{mapExtra.title}<NasaTag>{mapExtra.tag}</NasaTag></CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {cmapHTML && (
                    <div className="rounded-md bg-secondary/60 p-2" dangerouslySetInnerHTML={{ __html: cmapHTML }}
                      onClick={(e) => { const p = e.target.closest("path.town"); if (p) setTown(p.dataset.town === town ? "" : p.dataset.town); }} />
                  )}
                  <ul className="grid gap-1.5 text-[15px]">{mapExtra.lines.map((l, i) => <li key={i} className={cn(i >= 5 && "text-sm text-muted-foreground")}>{l}</li>)}</ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid content-start gap-5">
            <ExpectCard m={m} />
            {m.plant?.length > 0 && <PlantCard m={m} />}
            {m.years && <YearsCard m={m} />}
            {otherExtras.map((e, i) => (
              <Card key={i}>
                <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">{e.green ? <Leaf className="size-5 text-brand" /> : <CloudRain className="size-5 text-brand" />}{e.title}<NasaTag>{e.tag}</NasaTag></CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  {e.green && greenHTML && <div dangerouslySetInnerHTML={{ __html: greenHTML }} />}
                  <ul className="grid gap-1.5 text-[15px]">{e.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
                </CardContent>
              </Card>
            ))}
            {m.level && <AlertsCard m={m} lv={alertLv} setLv={setAlertLv} />}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => downloadPNG(m)}><Download />{ui("png")}</Button>
          <Button variant="outline" onClick={() => print()}><Printer />{t("dl_pdf")}</Button>
        </div>

        <Card className="mt-6 border-0 bg-primary text-primary-foreground">
          <CardContent className="flex items-start gap-3 p-5"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand" /><p className="font-medium">{m.emer}</p></CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">{m.disc}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Satellite className="size-4" />{m.nasa}</p>
      </main>
    </div>
  );
}

function NasaTag({ children }) {
  return children ? <Badge variant="outline" className="font-medium normal-case tracking-normal">{children}</Badge> : null;
}

function NowCard({ m }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-5" style={{ background: m.now.bg, color: m.now.fg }}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("s_now")} · {m.when} · NASA GPM IMERG</p>
        <p className="mt-1 font-display text-2xl font-bold">{m.now.title}</p>
        <p className="mt-1 opacity-95">{m.now.desc}</p>
      </div>
      {m.level && (
        <div className={cn("border-t p-5", LEVEL_TONE[m.level.n])}>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{t("s_level")}<NasaTag>NASA GPM IMERG</NasaTag></p>
          <p className="mt-2 flex items-center gap-3 font-display text-xl font-bold"><span className={cn("size-4 shrink-0 rounded-full", LEVEL_DOT[m.level.n])} />{m.level.title}</p>
          <p className="mt-1">{m.level.rain}</p>
          <p className="mt-2 text-sm text-muted-foreground">{m.level.how}</p>
        </div>
      )}
    </Card>
  );
}

function AskCard({ m }) {
  if (!m.ask?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircleQuestion className="size-5 text-brand" />{t("ask_title")}</CardTitle>
        <CardDescription>{t("ask_lede")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="q0">
          {m.ask.map((x, i) => (
            <AccordionItem key={i} value={`q${i}`} className={cn(i === m.ask.length - 1 && "border-b-0")}>
              <AccordionTrigger>{x.q}</AccordionTrigger>
              <AccordionContent className="grid gap-2 text-foreground/90">{x.a.map((l, j) => <p key={j} className={cn(j === 0 && "font-medium text-foreground")}>{l}</p>)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function Strip({ s }) {
  return (
    <div className={cn("grid gap-1", s.length > 6 && "grid-cols-6 sm:grid-cols-12")} style={s.length > 6 ? undefined : { gridTemplateColumns: `repeat(${s.length}, minmax(0, 1fr))` }}>
      {s.map((x, i) => <span key={i} className={cn("rounded-sm py-1 text-center text-[11px] font-semibold", SIGN_CLS[x.sign] || SIGN_CLS.normal)}>{x.lab}</span>)}
    </div>
  );
}

function Period({ p, className }) {
  return (
    <div className={cn("grid gap-2 rounded-md border bg-background/60 p-4", className)}>
      <div className="flex items-baseline justify-between gap-2"><p className="font-semibold">{p.label}</p><p className="text-sm text-muted-foreground">{p.range}</p></div>
      <Strip s={p.strip} />
      {p.lines.map((l, i) => <p key={i} className="text-[15px]">{l}</p>)}
      {p.adv.map((a, i) => <p key={i} className="text-[15px] font-semibold">{a}</p>)}
    </div>
  );
}

function ExpectCard({ m }) {
  const keys = m.modelled ? ["dry", "wet", "mixed", "normal"] : ["dry", "normal", "wet"];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><CloudRain className="size-5 text-brand" />{t("s_expect")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{m.basis}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {keys.map((k) => <span key={k} className="flex items-center gap-1.5"><i className={cn("inline-block size-3 rounded-sm", SIGN_CLS[k])} />{t(`${m.modelled ? "kf" : "k"}_${k}`)}</span>)}
        </div>
        {m.periods.map((p, i) => <Period key={i} p={p} />)}
        {m.year && <Period p={m.year} />}
      </CardContent>
    </Card>
  );
}

function PlantCard({ m }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><Sprout className="size-5 text-brand" />{t("s_plant")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{t("pl_note")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {m.plant.map((p, i) => (
          <div key={i} className={cn("grid content-start gap-2 rounded-md border p-4", p.sign === "dry" ? "bg-[#f6ecd2]" : p.sign === "wet" ? "bg-[#e2eff2]" : "bg-background/60")}>
            <div><p className="font-display text-lg font-semibold">{p.title}</p><p className="text-sm text-muted-foreground">{p.range}</p></div>
            {p.lines.map((l, j) => <p key={j} className="text-[15px]">{l}</p>)}
            <Separator className="my-1" />
            <p className="text-[15px] font-medium">{p.adv}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function YearsCard({ m }) {
  const y = m.years;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><Satellite className="size-5 text-brand" />{t("s_years")}<NasaTag>NASA MERRA-2 + GPM IMERG</NasaTag></CardTitle>
        <CardDescription>{t("yr_cap")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {y.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[84px_1fr] items-center gap-2">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${r.cells.length}, minmax(0, 1fr))` }}>
              {r.cells.map((c) => (
                <i key={c.y} title={`${c.y}: ${c.pct ?? "?"}%`} className={cn("relative block h-6 rounded-[2px]", SIGN_CLS[c.sign])}>
                  {c.nino && <span className={cn("absolute left-1/2 top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full", c.sign === "wet" ? "bg-white" : "bg-[#16201f]")} />}
                </i>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[84px_1fr] gap-2 text-xs text-muted-foreground"><span /><div className="flex justify-between"><span>{y.first}</span><span>{y.last}</span></div></div>
        {y.note && <p className="mt-2 rounded-md bg-secondary p-3 text-[15px] font-medium">{y.note}</p>}
        <p className="text-xs text-muted-foreground">{t("yr_src")}</p>
      </CardContent>
    </Card>
  );
}

function AlertsCard({ m, lv, setLv }) {
  const n = Number(lv);
  const href = m.bot ? `https://t.me/${m.bot}?start=${slug(m.name)}-${getLang()}-${n}` : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="size-5 text-brand" />{t("s_alerts", { d: m.district })}</CardTitle>
        <CardDescription>{t("al_note")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1.5 text-sm text-muted-foreground">{t("al_from")}
          <Select value={lv} onValueChange={setLv}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3].map((k) => <SelectItem key={k} value={String(k)}>{t(`lvl_${k}`)}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <p className="text-sm text-muted-foreground">{t("al_preview")}</p>
        <pre className="whitespace-pre-wrap rounded-md bg-secondary p-3 font-sans text-sm">{alertMessage(m, n)}</pre>
        {href ? <Button asChild><a href={href} target="_blank" rel="noopener">{t("al_btn")}</a></Button>
          : <p className="text-sm text-muted-foreground">{t("al_soon")}</p>}
      </CardContent>
    </Card>
  );
}
