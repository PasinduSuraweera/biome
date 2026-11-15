// The simple report for families, farmers and the coast: today in one line, a
// plan to tick off, how the coming months look, and where to go. Phone first.
import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Cloud, CloudRain, CloudSun, Download, Droplets, Leaf, ListChecks, MapPin, Printer, Sun } from "lucide-react";
import { t, monthName, getLang } from "@classic/i18n.js";
import { downloadPNG } from "@classic/simple.js";
import { centreMap, greenMap } from "@classic/nasa.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NasaTag, AskCard, PlantCard, AlertsCard, SafePlaces } from "@/sections/cards";
import { L, in10, LEVEL_TONE, LEVEL_DOT, monthSigns } from "@/lib/ui";
import { cn } from "@/lib/utils";

const S = {
  plan_t: L("Your plan", "ඔබේ සැලැස්ම", "உங்கள் திட்டம்"),
  plan_d: L("Tick each one when it is done. Your ticks stay on this phone.", "අවසන් වූ විට එක් එක සලකුණු කරන්න. ඔබේ සලකුණු මෙම දුරකථනයේ රැඳේ.", "முடிந்ததும் ஒவ்வொன்றையும் குறியிடுங்கள். உங்கள் குறிகள் இந்தத் தொலைபேசியில் இருக்கும்."),
  now: L("Do now", "දැන් කරන්න", "இப்போது செய்யுங்கள்"),
  ready: L("Be ready", "සූදානම්ව සිටින්න", "தயாராக இருங்கள்"),
  done: L("{a} of {n} done", "{n} න් {a} ක් අවසන්", "{n} இல் {a} முடிந்தது"),
  months_t: L("The next 12 months", "ඉදිරි මාස 12", "அடுத்த 12 மாதங்கள்"),
  drought: L("Drought danger {x} in 10", "නියඟ අවදානම 10න් {x}", "வறட்சி அபாயம் 10 இல் {x}"),
  dry: L("Drier", "වියළි", "வறட்சி"), wet: L("Wetter", "වැඩි වැසි", "அதிக மழை"), mixed: L("Either way", "දෙපැත්තටම", "இரு வகையிலும்"), normal: L("Usual", "සාමාන්‍ය", "வழக்கம்"),
  fam_1: L("Pack an emergency bag: ID and documents in a plastic bag, medicine, torch, power bank, water and dry food.",
    "හදිසි බෑගයක් සකසන්න: හැඳුනුම්පත සහ ලේඛන ප්ලාස්ටික් බෑගයක, ඖෂධ, විදුලි පන්දම, පවර් බැංකුව, ජලය සහ වියළි ආහාර.",
    "அவசரப் பையைத் தயார் செய்யுங்கள்: அடையாள அட்டை, ஆவணங்கள் பிளாஸ்டிக் பையில், மருந்து, டார்ச், பவர் பேங்க், தண்ணீர், உலர் உணவு."),
  fam_2: L("Know the way to your safer place: {p}.", "ඔබේ ආරක්ෂිත ස්ථානයට යන මාර්ගය දැනගන්න: {p}.", "உங்கள் பாதுகாப்பான இடத்துக்குச் செல்லும் வழியை அறிந்துகொள்ளுங்கள்: {p}."),
  fam_2b: L("Ask your Grama Niladhari where your nearest safe centre is.", "ඔබේ ළඟම ආරක්ෂිත මධ්‍යස්ථානය කොතැනදැයි ග්‍රාම නිලධාරීගෙන් අසන්න.", "உங்கள் அருகிலுள்ள பாதுகாப்பு மையம் எங்கே என்று கிராம சேவகரிடம் கேளுங்கள்."),
  fam_3: L("Save these numbers: 117 Disaster Management Centre, 1990 ambulance, 119 police.", "මෙම අංක සුරකින්න: 117 ආපදා කළමනාකරණ මධ්‍යස්ථානය, 1990 ගිලන් රථ, 119 පොලිසිය.", "இந்த எண்களைச் சேமியுங்கள்: 117 அனர்த்த முகாமைத்துவ நிலையம், 1990 அம்புலன்ஸ், 119 பொலிஸ்."),
  fam_4: L("Agree where the family meets if you get separated.", "වෙන් වුවහොත් පවුල හමු වන ස්ථානය එකඟ කර ගන්න.", "பிரிந்துவிட்டால் குடும்பம் எங்கே சந்திப்பது என்பதை ஒப்புக்கொள்ளுங்கள்."),
  fam_5: L("Get Biome alerts on Telegram, and keep your phone charged.", "Telegram හරහා Biome අනතුරු ඇඟවීම් ලබාගෙන, දුරකථනය ආරෝපණය කර තබාගන්න.", "Telegram இல் Biome எச்சரிக்கைகளைப் பெற்று, கைபேசியை சார்ஜ் செய்து வையுங்கள்."),
  farm_1: L("Check how full your tank is, and agree water turns with your farmer organisation.", "ඔබේ වැව කොතරම් පිරී ඇත්දැයි බලා, ගොවි සංවිධානය සමඟ ජල වාර එකඟ කර ගන්න.", "உங்கள் குளம் எவ்வளவு நிரம்பியுள்ளது எனப் பார்த்து, விவசாய அமைப்புடன் நீர் முறைகளை ஒப்புக்கொள்ளுங்கள்."),
  farm_2: L("Choose seed that suits this season's outlook before you buy.", "මිලදී ගැනීමට පෙර, මෙම කන්නයේ පුරෝකථනයට ගැළපෙන බීජ තෝරන්න.", "வாங்குவதற்கு முன், இந்தப் பருவ முன்னோக்குக்கு ஏற்ற விதையைத் தேர்ந்தெடுங்கள்."),
  farm_3: L("Clear field channels and drains.", "ඇළ මාර්ග සහ කාණු පිරිසිදු කරන්න.", "வயல் வாய்க்கால்களையும் வடிகால்களையும் சுத்தம் செய்யுங்கள்."),
  farm_4: L("Store seed, fertiliser and chemicals off the ground, in a dry place.", "බීජ, පොහොර සහ රසායන ද්‍රව්‍ය බිමෙන් ඉහළින්, වියළි ස්ථානයක ගබඩා කරන්න.", "விதை, உரம், இரசாயனங்களைத் தரையிலிருந்து உயர்த்தி, உலர்ந்த இடத்தில் வையுங்கள்."),
  farm_5: L("Look at Biome each week before you plant or water.", "වගා කිරීමට හෝ ජලය දීමට පෙර සෑම සතියකම Biome බලන්න.", "பயிரிடுவதற்கு அல்லது நீர் பாய்ச்சுவதற்கு முன் ஒவ்வொரு வாரமும் Biome ஐப் பாருங்கள்."),
  coast_1: L("Check the Met Department sea forecast before every trip to sea.", "මුහුදු යාමට පෙර සෑම විටම කාලගුණ දෙපාර්තමේන්තුවේ මුහුදු පුරෝකථනය බලන්න.", "ஒவ்வொரு முறை கடலுக்குச் செல்லும் முன்பும் வளிமண்டலவியல் திணைக்களத்தின் கடல் முன்னறிவிப்பைப் பாருங்கள்."),
  coast_2: L("Keep boats, engines and nets above the high-water line.", "බෝට්ටු, එන්ජින් සහ දැල් ඉහළ ජල මට්ටමට ඉහළින් තබන්න.", "படகுகள், இயந்திரங்கள், வலைகளை உயர் நீர்க் கோட்டுக்கு மேலே வையுங்கள்."),
  save: L("Save as picture", "පින්තූරයක් ලෙස සුරකින්න", "படமாகச் சேமிக்கவும்"),
};
const s = (k, v = {}) => Object.entries(v).reduce((a, [x, y]) => a.replaceAll(`{${x}}`, y), S[k][getLang()] || S[k].en);
const ICON = { dry: Sun, wet: CloudRain, mixed: CloudSun, normal: Cloud };
const TILE = {
  dry: "bg-[#f6ecd2] text-[#5a430c] dark:bg-[#3a3214] dark:text-[#f1dba6]",
  wet: "bg-[#dcebef] text-[#164c59] dark:bg-[#15303a] dark:text-[#b9d6dc]",
  mixed: "bg-[linear-gradient(135deg,#f6ecd2_50%,#dcebef_50%)] text-[#16201f] dark:bg-[linear-gradient(135deg,#3a3214_50%,#15303a_50%)] dark:text-foreground",
  normal: "bg-secondary text-muted-foreground",
};

function useTicks(key) {
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } };
  const [ticks, setTicks] = useState(read);
  useEffect(() => { setTicks(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (id) => setTicks((o) => {
    const n = { ...o, [id]: !o[id] };
    try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* storage blocked */ }
    return n;
  });
  return [ticks, flip];
}

function Check({ id, text, on, flip }) {
  return (
    <li>
      <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", on ? "bg-secondary/60" : "bg-background/60 hover:bg-secondary/40")}>
        <input type="checkbox" checked={!!on} onChange={() => flip(id)} className="mt-0.5 size-5 shrink-0 accent-[#10232a] dark:accent-[#f3efe6]" />
        <span className={cn("text-[15px] leading-snug", on && "text-muted-foreground line-through")}>{text}</span>
      </label>
    </li>
  );
}

function Plan({ m, view, name, top }) {
  const [ticks, flip] = useTicks(`biome-plan-${view}-${name}`);
  const place = top?.[0]?.[3];
  const fam2 = place ? s("fam_2", { p: place }) : s("fam_2b");
  const ready = view === "farmer" ? ["farm_1", "farm_2", "farm_3", "farm_4", "farm_5"].map((k) => [k, s(k)])
    : view === "coast" ? [["coast_1", s("coast_1")], ["coast_2", s("coast_2")], ["fam_2", fam2], ["fam_1", s("fam_1")], ["fam_3", s("fam_3")]]
    : [["fam_1", s("fam_1")], ["fam_2", fam2], ["fam_3", s("fam_3")], ["fam_4", s("fam_4")], ["fam_5", s("fam_5")]];
  const now = m.todo.map((x, i) => [`now_${m.now.watch}_${i}`, x]);
  const all = [...now, ...ready];
  const done = all.filter(([id]) => ticks[id]).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><ListChecks className="size-5 text-brand" />{s("plan_t")}</CardTitle>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{s("done", { a: done, n: all.length })}</span>
        </div>
        <CardDescription>{s("plan_d")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[#2e7d4f] transition-all" style={{ width: `${(100 * done) / all.length}%` }} /></div>
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-deep dark:text-brand">{s("now")}</p>
          <ul className="grid gap-2">{now.map(([id, x]) => <Check key={id} id={id} text={x} on={ticks[id]} flip={flip} />)}</ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-deep dark:text-brand">{s("ready")}</p>
          <ul className="grid gap-2">{ready.map(([id, x]) => <Check key={id} id={id} text={x} on={ticks[id]} flip={flip} />)}</ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Months({ m, DATA, name }) {
  const ms = monthSigns(DATA, name);
  const blocks = [...m.periods, ...(m.year ? [m.year] : [])];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><CloudRain className="size-5 text-brand" />{s("months_t")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{m.basis}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ms.length > 0 && (
          <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {ms.map((x) => {
              const I = ICON[x.sign];
              const dw = x.sig && x.drought >= 0.5;
              return (
                <li key={x.ym} className={cn("grid content-start gap-1 rounded-lg p-2.5", TILE[x.sign])}>
                  <span className="text-xs font-semibold opacity-80">{monthName(x.ym, true)} {x.ym.slice(2, 4)}</span>
                  <I className="size-6" />
                  <span className="text-sm font-semibold leading-tight">{s(x.sign)}</span>
                  {dw && <span className="flex items-center gap-1 text-[11px] font-medium leading-tight"><Droplets className="size-3 shrink-0" />{s("drought", { x: in10(x.drought) })}</span>}
                </li>
              );
            })}
          </ol>
        )}
        <Accordion type="single" collapsible defaultValue="b0">
          {blocks.map((p, i) => (
            <AccordionItem key={i} value={`b${i}`} className={cn(i === blocks.length - 1 && "border-b-0")}>
              <AccordionTrigger><span>{p.label}<span className="ml-2 font-normal text-muted-foreground">{p.range}</span></span></AccordionTrigger>
              <AccordionContent className="grid gap-2">
                {p.lines.map((l, j) => <p key={j}>{l}</p>)}
                {p.adv.map((a, j) => <p key={j} className="font-semibold">{a}</p>)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function Report({ m, name, view, DATA, GEO, SAFE, TOWNS, town, setTown, nasaReady, alertLv, setAlertLv }) {
  const mapExtra = m.extras.find((e) => e.map);
  const other = m.extras.filter((e) => !e.map);
  const sp = SAFE?.districts?.[name];
  const tsp = town ? SAFE?.towns?.[`${name}|${town}`] : null;
  const top = (tsp || sp)?.top || [];
  const cmapHTML = GEO && mapExtra ? centreMap(name, GEO, SAFE, TOWNS, DATA.towns?.districts?.[name], town) : "";
  const greenHTML = GEO && nasaReady ? greenMap(name, GEO) : "";
  const lv = m.level?.n || 0;
  return (
    <div className="grid gap-4 md:gap-6">
      <Card className="overflow-hidden">
        <div className="p-5 sm:p-6" style={{ background: m.now.bg, color: m.now.fg }}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-85">{m.aud} · {t("s_now")} · {m.when}</p>
          <p className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">{m.now.title}</p>
          <p className="mt-2 text-[15px] opacity-95">{m.now.desc}</p>
        </div>
        <div className={cn("grid gap-1 p-5 sm:p-6", LEVEL_TONE[lv])}>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Bell className="size-4" />{t("s_level")}<NasaTag>NASA GPM IMERG</NasaTag></p>
          <p className="flex items-center gap-3 font-display text-xl font-bold leading-snug"><span className={cn("size-4 shrink-0 rounded-full", LEVEL_DOT[lv])} />{m.level ? m.level.title : t("lvl_0")}</p>
          {m.level && <p className="text-[15px]">{m.level.rain}</p>}
          {m.level && <p className="text-xs text-muted-foreground">{m.level.how}</p>}
        </div>
      </Card>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <div className="grid content-start gap-4 md:gap-6">
          <Plan m={m} view={view} name={name} top={top} />
          {mapExtra && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2"><MapPin className="size-5 text-brand" />{mapExtra.title}<NasaTag>{mapExtra.tag}</NasaTag></CardTitle>
                <CardDescription>{mapExtra.lines[mapExtra.lines.length - 1]}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <SafePlaces top={top} />
                {cmapHTML && <div className="rounded-md bg-secondary/60 p-2" dangerouslySetInnerHTML={{ __html: cmapHTML }}
                  onClick={(e) => { const p = e.target.closest("path.town"); if (p) setTown(p.dataset.town === town ? "" : p.dataset.town); }} />}
                <p className="text-sm text-muted-foreground">{mapExtra.lines[mapExtra.lines.length - 2]}</p>
              </CardContent>
            </Card>
          )}
          <AskCard m={m} />
        </div>
        <div className="grid content-start gap-4 md:gap-6">
          <Months m={m} DATA={DATA} name={name} />
          {m.plant?.length > 0 && <PlantCard m={m} />}
          {other.map((e, i) => (
            <Card key={i}>
              <CardHeader><CardTitle className="flex flex-wrap items-center gap-2">{e.green ? <Leaf className="size-5 text-brand" /> : <CheckCircle2 className="size-5 text-brand" />}{e.title}<NasaTag>{e.tag}</NasaTag></CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {e.green && greenHTML && <div dangerouslySetInnerHTML={{ __html: greenHTML }} />}
                <ul className="grid gap-1.5 text-[15px]">{e.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
              </CardContent>
            </Card>
          ))}
          {m.level && <AlertsCard m={m} lv={alertLv} setLv={setAlertLv} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button onClick={() => downloadPNG(m)} className="h-11"><Download />{s("save")}</Button>
        <Button variant="outline" onClick={() => print()} className="h-11"><Printer />{t("dl_pdf")}</Button>
      </div>
    </div>
  );
}
