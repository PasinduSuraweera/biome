// Biome, new design: a dashboard built with shadcn/ui (Radix, Tailwind, Recharts).
// The report itself (what it says, the numbers, the translations) comes from the
// classic app's code in ../web/src, so both versions always agree.
import { useCallback, useEffect, useMemo, useState } from "react";
import { geoArea } from "d3-geo";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, Bell, BookOpen, CalendarDays, CheckCircle2, CloudRain, Database, Download, Droplets, Home, Image, LayoutDashboard, Leaf, MapPin,
  MessageCircleQuestion, Mountain, Printer, Satellite, Sprout, Users, Waves,
} from "lucide-react";
import { IslandMap } from "@/sections/IslandMap";
import { Gallery } from "@/sections/Gallery";
import { FullData } from "@/sections/FullData";
import { Calendar } from "@/sections/Calendar";
import { How } from "@/sections/How";
import { Landing } from "@/sections/Landing";
import { Logo, ThemeToggle, useTheme } from "@/lib/theme";
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
const L = (en, si, ta) => ({ en, si, ta });
const UI = {
  overview: L("Overview", "දළ විශ්ලේෂණය", "மேலோட்டம்"),
  home: L("Home", "මුල් පිටුව", "முகப்பு"),
  nasa: L("Seen by NASA", "NASA දුටු දේ", "NASA பார்த்தவை"),
  map_t: L("Watches this month", "මෙම මාසයේ අවදානම් නිවේදන", "இந்த மாத எச்சரிக்கைகள்"),
  map_d: L("Tap a district for its report.", "වාර්තාව සඳහා දිස්ත්‍රික්කයක් ඔබන්න.", "அறிக்கைக்கு ஒரு மாவட்டத்தைத் தட்டவும்."),
  district: L("District", "දිස්ත්‍රික්කය", "மாவட்டம்"),
  preview: L("New design · preview", "නව සැලසුම · පෙරදසුන", "புதிய வடிவமைப்பு · முன்னோட்டம்"),
  classic: L("Classic version", "පැරණි අනුවාදය", "பழைய பதிப்பு"),
  loading: L("Loading NASA data…", "NASA දත්ත පූරණය වෙමින්…", "NASA தரவு ஏற்றப்படுகிறது…"),
  png: L("Save as picture", "පින්තූරයක් ලෙස සුරකින්න", "படமாகச் சேமிக்கவும்"),
  allSL: L("All of Sri Lanka", "මුළු ශ්‍රී ලංකාව", "முழு இலங்கை"),
  k_level: L("Districts on alert today", "අද අවදානම් මට්ටමේ දිස්ත්‍රික්ක", "இன்று எச்சரிக்கையில் உள்ள மாவட்டங்கள்"),
  k_level_d: L("Yellow or above, from NASA's daily rain", "කහ හෝ ඉහළ, NASA දෛනික වැසි අනුව", "மஞ்சள் அல்லது அதற்கு மேல், NASA தினசரி மழையிலிருந்து"),
  k_watch: L("Watches this month", "මෙම මාසයේ අවදානම් නිවේදන", "இந்த மாத எச்சரிக்கைகள்"),
  k_rain: L("Latest NASA rain", "නවතම NASA වැසි", "சமீபத்திய NASA மழை"),
  k_rain_early: L("IMERG Early, about 4 hours after the day", "IMERG Early, දිනයෙන් පැය 4 කට පමණ පසු", "IMERG Early, நாள் முடிந்து சுமார் 4 மணி நேரத்தில்"),
  k_rain_late: L("IMERG Late, about 14 hours after the day", "IMERG Late, දිනයෙන් පැය 14 කට පමණ පසු", "IMERG Late, நாள் முடிந்து சுமார் 14 மணி நேரத்தில்"),
  k_ocean: L("Ocean index (NOAA ONI)", "සාගර දර්ශකය (NOAA ONI)", "கடல் குறியீடு (NOAA ONI)"),
  k_dry3: L("Likely drier, next 3 months", "ඉදිරි මාස 3, වියළි විය හැකි", "அடுத்த 3 மாதங்கள், வறட்சி வாய்ப்பு"),
  k_dry3_d: L("districts, from the outlook model", "දිස්ත්‍රික්ක, පුරෝකථන ආකෘතියෙන්", "மாவட்டங்கள், முன்னோக்கு மாதிரியிலிருந்து"),
  k_safe: L("Safer places checked", "පරීක්ෂා කළ ආරක්ෂිත ස්ථාන", "சரிபார்க்கப்பட்ட பாதுகாப்பான இடங்கள்"),
  k_tanks: L("Tanks, average", "වැව්, සාමාන්‍යය", "குளங்கள், சராசரி"),
  k_full: L("full", "පිරී ඇත", "நிரம்பியுள்ளது"),
  k_next3: L("Next 3 months", "ඉදිරි මාස 3", "அடுத்த 3 மாதங்கள்"),
  t_districts: L("Every district today", "අද සියලු දිස්ත්‍රික්ක", "இன்று அனைத்து மாவட்டங்களும்"),
  t_districts_d: L("Tap a district for its report.", "වාර්තාව සඳහා දිස්ත්‍රික්කයක් ඔබන්න.", "அறிக்கைக்கு ஒரு மாவட்டத்தைத் தட்டவும்."),
  th_level: L("Level", "මට්ටම", "நிலை"), th_watch: L("Watch", "අවදානම", "எச்சரிக்கை"),
  th_1d: L("Last day", "පසුගිය දිනය", "கடந்த நாள்"), th_3d: L("3 days", "දින 3", "3 நாட்கள்"),
  th_next: L("Next 3 months", "ඉදිරි මාස 3", "அடுத்த 3 மாதங்கள்"),
  c_rain: L("Rain in the last 3 days", "පසුගිය දින 3 තුළ වැසි", "கடந்த 3 நாட்களில் மழை"),
  c_rain_d: L("NASA GPM IMERG, mm, by district. NBRO warns at 75, 100 and 150 mm in a day.", "NASA GPM IMERG, මි.මී., දිස්ත්‍රික්ක අනුව. NBRO දිනකට මි.මී. 75, 100 සහ 150 දී අනතුරු අඟවයි.", "NASA GPM IMERG, மி.மீ., மாவட்ட வாரியாக. NBRO ஒரு நாளில் 75, 100, 150 மி.மீ. இல் எச்சரிக்கிறது."),
  c_out: L("Expected rain, month by month", "මාසයෙන් මාසයට අපේක්ෂිත වැසි", "மாதம் தோறும் எதிர்பார்க்கப்படும் மழை"),
  c_out_d: L("% of the usual rain, middle of the outlook model's range. 100 = usual.", "සාමාන්‍ය වැසිවල %, පුරෝකථන ආකෘතියේ මැද අගය. 100 = සාමාන්‍ය.", "வழக்கமான மழையின் %, முன்னோக்கு மாதிரியின் நடு மதிப்பு. 100 = வழக்கம்."),
  tip_dry: L("Drier than usual: {x} in 10", "සාමාන්‍යයට වඩා වියළි: 10න් {x}", "வழக்கத்தை விட வறட்சி: 10 இல் {x}"),
  tip_wet: L("Wetter than usual: {x} in 10", "සාමාන්‍යයට වඩා වැසි: 10න් {x}", "வழக்கத்தை விட அதிக மழை: 10 இல் {x}"),
  tip_drought: L("Drought danger: {x} in 10", "නියඟ අවදානම: 10න් {x}", "வறட்சி அபாயம்: 10 இல் {x}"),
  tip_nosig: L("No clear signal this month", "මෙම මාසයට පැහැදිලි සංඥාවක් නැත", "இந்த மாதத்துக்குத் தெளிவான சமிக்ஞை இல்லை"),
  tip_pct: L("{p}% of usual rain", "සාමාන්‍ය වැසිවලින් {p}%", "வழக்கமான மழையின் {p}%"),
  c_years_d: L("Each bar is one season: above the line wetter than usual, below drier. Outlined bars are strong El Niño years.", "සෑම තීරුවක්ම එක් කන්නයකි: රේඛාවට ඉහළ නම් වැඩි වැසි, පහළ නම් වියළි. වට කළ තීරු ප්‍රබල එල් නිනෝ වසර ය.", "ஒவ்வொரு பட்டியும் ஒரு பருவம்: கோட்டுக்கு மேல் அதிக மழை, கீழே வறட்சி. விளிம்பிட்ட பட்டிகள் வலுவான எல் நினோ ஆண்டுகள்."),
  el_nino: L("strong El Niño year", "ප්‍රබල එල් නිනෝ වසර", "வலுவான எல் நினோ ஆண்டு"),
};
const ui = (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.replaceAll(`{${a}}`, b), UI[k][getLang()] || UI[k].en);
const slug = (n) => n.toLowerCase().replace(/\s+/g, "-");
const in10 = (p) => Math.max(1, Math.min(9, Math.round(p * 10)));
const LEVEL_TONE = ["", "bg-[#fbf3d0] dark:bg-[#3a3214]", "bg-[#fbe2cc] dark:bg-[#43281a]", "bg-[#f6d3cf] dark:bg-[#4a1f1c]"];
const LEVEL_DOT = ["bg-[#9aa39e]", "bg-[#e0b422]", "bg-[#d2691e]", "bg-[#b3261e]"];
const LEVEL_FILL = ["#c9cec9", "#e0b422", "#d2691e", "#b3261e"];
const SIGN_FILL = { dry: "#e3b85c", wet: "#23687a", mixed: "#9fbfc4", normal: "#cfd3cc" };
const SIGN_CLS = {
  dry: "bg-dry text-[#2a1e05]", wet: "bg-wet text-white", normal: "bg-usual text-[#4a5552]",
  mixed: "text-[#16201f] bg-[linear-gradient(135deg,#f1dba6_50%,#b9d6dc_50%)]",
};
const narrow = () => typeof window !== "undefined" && window.innerWidth < 640;
const WATCH_ICON = { SlopeWatch: Mountain, FloodWatch: Waves, DryWatch: Droplets, Clear: CheckCircle2 };

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
// the outlook model's call for each month, the same rule the classic report uses
function monthSigns(DATA, name) {
  const F = DATA.forecast, x = F?.district?.[name];
  if (!x) return [];
  return F.months.map((ym, i) => {
    const sig = F.skill.signal[i];
    const sign = !sig ? "normal" : x.p_dry[i] >= 0.5 ? "dry" : x.p_wet[i] >= 0.5 ? "wet" : (1 - x.p_dry[i] - x.p_wet[i]) >= 0.4 ? "normal" : "mixed";
    return { ym, sig, sign, median: x.median[i], pDry: x.p_dry[i], pWet: x.p_wet[i], drought: x.watch.DryWatch[i] };
  });
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

  const m = useMemo(() => (DATA && name && ["family", "farmer", "coast"].includes(view) ? buildReport(name, view, DATA, SAFE, town) : null),
    [DATA, SAFE, name, view, town, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeLang = (l) => { setLang(l); setL(l); document.documentElement.lang = l; };

  if (!DATA) return <div className="grid min-h-screen place-items-center text-muted-foreground">{ui("loading")}</div>;
  if (view === "home") return <Landing DATA={DATA} SAFE={SAFE} GEO={GEO} INDEX={INDEX} lang={lang} changeLang={changeLang} go={go} theme={theme} toggleTheme={toggleTheme} />;
  const title = navLabel(view);
  const isDistrict = DISTRICT_VIEWS.includes(view);

  return (
    <div className="flex min-h-screen">
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
            <span className="lg:hidden"><Logo className="h-7 w-auto" /></span>
            <div className="order-first flex w-full items-center justify-end gap-1 sm:hidden">
              <ThemeToggle theme={theme} toggle={toggleTheme} className="mr-auto lg:hidden" />
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
                {m?.towns.length > 0 && (
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
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
            <Tabs value={view} onValueChange={pickView}>
              <TabsList>{NAV.map(({ v, icon: I }) => <TabsTrigger key={v} value={v}><I />{navLabel(v)}</TabsTrigger>)}</TabsList>
            </Tabs>
            <div className="ml-auto hidden items-center gap-1 sm:flex lg:hidden">
              <ThemeToggle theme={theme} toggle={toggleTheme} />
              {Object.entries(LANGS).map(([k, label]) => (
                <Button key={k} size="sm" variant={k === lang ? "secondary" : "ghost"} className="px-2" onClick={() => changeLang(k)}>{label}</Button>
              ))}
            </div>
          </div>
        </header>

        <main className="grid gap-4 p-4 md:gap-6 md:p-6">
          {view === "overview" && <Overview DATA={DATA} SAFE={SAFE} GEO={GEO} go={go} />}
          {m && <DistrictView m={m} name={name} view={view} DATA={DATA} GEO={GEO} SAFE={SAFE} TOWNS={TOWNS} town={town} setTown={setTown} nasaReady={nasaReady} alertLv={alertLv} setAlertLv={setAlertLv} go={go} />}
          {view === "full" && (
            <div className="grid gap-4 md:gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
              <Card className="h-fit xl:sticky xl:top-24">
                <CardHeader><CardTitle>{ui("map_t")}</CardTitle><CardDescription>{ui("map_d")}</CardDescription></CardHeader>
                <CardContent>{GEO && <IslandMap GEO={GEO} DATA={DATA} FLOOD={FLOOD} name={name} onPick={(n) => go("full", n)} view="full" full showFlood={showFlood} onFlood={setShowFlood} />}</CardContent>
              </Card>
              <FullData DATA={DATA} GEO={GEO} SAFE={SAFE} TOWNS={TOWNS} name={name} />
            </div>
          )}
          {view === "nasa" && <Gallery INDEX={INDEX} />}
          {view === "calendar" && <Calendar DATA={DATA} current={name} />}
          {view === "how" && <How DATA={DATA} SAFE={SAFE} />}
          <Footer />
        </main>
      </div>
    </div>
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

function NasaTag({ children }) {
  return children ? <Badge variant="outline" className="font-medium normal-case tracking-normal">{children}</Badge> : null;
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
                <TableHead>{ui("district")}</TableHead><TableHead>{ui("th_level")}</TableHead><TableHead>{ui("th_watch")}</TableHead>
                <TableHead className="text-right">{ui("th_1d")}</TableHead><TableHead className="text-right">{ui("th_3d")}</TableHead><TableHead>{ui("th_next")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const WI = WATCH_ICON[r.d.watch] || CheckCircle2;
                  return (
                    <TableRow key={r.n} className="cursor-pointer" onClick={() => go("family", r.n)}>
                      <TableCell className="font-medium">{dName(r.n)}</TableCell>
                      <TableCell><span className="flex items-center gap-2 whitespace-nowrap"><span className={cn("size-2.5 rounded-full", LEVEL_DOT[r.lv.level])} />{t(`lvs_${r.lv.level}`)}</span></TableCell>
                      <TableCell><span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground"><WI className="size-3.5" />{r.d.watch === "Clear" ? "–" : r.d.watch}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(r.lv.rain_1d ?? 0)} mm</TableCell>
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
        <Button size="sm" variant="ghost" onClick={() => print()}><Printer />{t("dl_pdf")}</Button>
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
                      <TableRow key={i}><TableCell className="w-8 font-semibold">{i + 1}</TableCell><TableCell>{c[3]}<p className="text-xs text-muted-foreground">{t(`kind_${c[2]}`)}</p></TableCell></TableRow>
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

function OutlookCard({ m, DATA, name, className }) {
  const ms = monthSigns(DATA, name);
  const data = ms.map((x) => ({
    name: monthName(x.ym, true), v: Math.round(x.median), fill: SIGN_FILL[x.sign], title: monthName(x.ym),
    tip: [ui("tip_pct", { p: Math.round(x.median) }), ...(x.sig ? [ui("tip_dry", { x: in10(x.pDry) }), ui("tip_wet", { x: in10(x.pWet) }), ...(x.drought >= 0.3 ? [ui("tip_drought", { x: in10(x.drought) })] : [])] : [ui("tip_nosig")])],
  }));
  const tabs = [...m.periods, ...(m.year ? [m.year] : [])];
  const top = Math.max(150, Math.ceil(Math.max(...data.map((d) => d.v), 0) / 50) * 50);
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><CloudRain className="size-5 text-brand" />{t("s_expect")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{m.basis}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data.length > 0 && (
          <div>
            <p className="text-sm font-medium">{ui("c_out")}</p>
            <p className="mb-3 text-xs text-muted-foreground">{ui("c_out_d")}</p>
            <ChartContainer className="aspect-auto h-56">
              <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={narrow() ? 1 : 0} tickMargin={6} />
                <YAxis tickLine={false} axisLine={false} unit="%" width={48} domain={[0, top]} ticks={ticks} />
                <ReferenceLine y={100} strokeDasharray="4 4" />
                <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                <Bar dataKey="v" radius={[4, 4, 0, 0]}>{data.map((c, i) => <Cell key={i} fill={c.fill} />)}</Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {["dry", "wet", "mixed", "normal"].map((k) => <span key={k} className="flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm" style={{ background: SIGN_FILL[k] }} />{t(`kf_${k}`)}</span>)}
            </div>
          </div>
        )}
        <Tabs defaultValue="0">
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs.map((p, i) => <TabsTrigger key={i} value={String(i)}>{p.label}</TabsTrigger>)}
          </TabsList>
          {tabs.map((p, i) => (
            <TabsContent key={i} value={String(i)} className="grid gap-2 rounded-md border bg-background/60 p-4 data-[state=inactive]:hidden">
              <p className="text-sm text-muted-foreground">{p.range}</p>
              {p.lines.map((l, j) => <p key={j} className="text-[15px]">{l}</p>)}
              {p.adv.map((a, j) => <p key={j} className="text-[15px] font-semibold">{a}</p>)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
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

function PlantCard({ m }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><Sprout className="size-5 text-brand" />{t("s_plant")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{t("pl_note")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {m.plant.map((p, i) => (
          <div key={i} className={cn("grid content-start gap-2 rounded-md border p-4", p.sign === "dry" ? "bg-[#f6ecd2] dark:bg-[#332d1a]" : p.sign === "wet" ? "bg-[#e2eff2] dark:bg-[#15303a]" : "bg-background/60")}>
            <div className="flex items-baseline justify-between gap-2"><p className="font-display text-lg font-semibold">{p.title}</p><p className="text-sm text-muted-foreground">{p.range}</p></div>
            {p.lines.map((l, j) => <p key={j} className="text-[15px]">{l}</p>)}
            <Separator className="my-1" />
            <p className="text-[15px] font-medium">{p.adv}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function YearsCard({ m, DATA, name, className }) {
  const s = DATA.districts[name].seasons;
  const strong = new Set(DATA.meta?.strong_el_nino_years || []);
  const series = (k) => s[k].years.map((y, i) => {
    const p = s[k].rain_pct[i];
    const sign = p == null ? "normal" : p < 85 ? "dry" : p > 115 ? "wet" : "normal";
    return { name: String(y), v: p == null ? 0 : Math.round(p - 100), fill: SIGN_FILL[sign], nino: strong.has(y),
      title: k === "maha" ? t("season_maha", { a: y, b: String(y + 1).slice(2) }) : t("season_yala", { a: y }),
      tip: [ui("tip_pct", { p: Math.round(p) }), ...(strong.has(y) ? [ui("el_nino")] : [])] };
  });
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><Satellite className="size-5 text-brand" />{t("s_years")}<NasaTag>NASA MERRA-2 + GPM IMERG</NasaTag></CardTitle>
        <CardDescription>{ui("c_years_d")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Tabs defaultValue="maha">
          <TabsList><TabsTrigger value="maha">{t("s_maha")}</TabsTrigger><TabsTrigger value="yala">{t("s_yala")}</TabsTrigger></TabsList>
          {["maha", "yala"].map((k) => {
            const data = series(k);
            return (
              <TabsContent key={k} value={k}>
                <ChartContainer className="aspect-auto h-56">
                  <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={narrow() ? 9 : 4} tickMargin={6} />
                    <YAxis tickLine={false} axisLine={false} unit="%" width={48} />
                    <ReferenceLine y={0} />
                    <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                    <Bar dataKey="v" radius={2}>{data.map((c, i) => <Cell key={i} fill={c.fill} stroke={c.nino ? "hsl(var(--foreground))" : "none"} strokeWidth={c.nino ? 2 : 0} />)}</Bar>
                  </BarChart>
                </ChartContainer>
              </TabsContent>
            );
          })}
        </Tabs>
        {m.years.note && <p className="rounded-md bg-secondary p-3 text-[15px] font-medium">{m.years.note}</p>}
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
