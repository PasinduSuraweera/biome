// The landing page: what Biome is, live from today's NASA data, and the way in
// for families, farmers, coastal towns and officers.
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, CloudRain, Droplets, MapPin, Mountain, Satellite, Sprout, Users, Waves } from "lucide-react";
import { t, dName, getLang, LANGS, monthName } from "@classic/i18n.js";
import { buildReport } from "@classic/simple.js";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IslandMap } from "@/sections/IslandMap";
import { LEVEL_DOT, slug } from "@/lib/biome";
import { Logo, ThemeToggle } from "@/lib/theme";
import { cn } from "@/lib/utils";

// the page has <base href> pointing at the classic site's data, so in-page links
// must name this app's own address or they would open the classic site
const HERE = import.meta.env.BASE_URL;
const L = (en, si, ta) => ({ en, si, ta });
const S = {
  nav_how: L("How it works", "එය ක්‍රියා කරන ආකාරය", "இது எப்படி செயல்படுகிறது"),
  nav_nasa: L("Seen by NASA", "NASA දුටු දේ", "NASA பார்த்தவை"),
  nav_cal: L("Risk calendar", "අවදානම් දින දර්ශනය", "அபாய நாட்காட்டி"),
  open: L("Open the dashboard", "උපකරණ පුවරුව විවෘත කරන්න", "டாஷ்போர்டைத் திறக்கவும்"),
  h1a: L("Drought, flood, landslide.", "නියඟය, ගංවතුර, නායයෑම.", "வறட்சி, வெள்ளம், மண்சரிவு."),
  h1b: L("Seen from space,", "අභ්‍යවකාශයෙන් පෙනේ,", "விண்வெளியிலிருந்து தெரியும்,"),
  h1c: L("before they come.", "ඒවා පැමිණීමට පෙර.", "அவை வருவதற்கு முன்."),
  lede: L("Biome turns free NASA satellite data into plain warnings for every district and town in Sri Lanka, in Sinhala, Tamil and English.",
    "Biome නොමිලේ ලැබෙන NASA චන්ද්‍රිකා දත්ත, ශ්‍රී ලංකාවේ සෑම දිස්ත්‍රික්කයකටම සහ නගරයකටම සරල අනතුරු ඇඟවීම් බවට සිංහල, දෙමළ සහ ඉංග්‍රීසියෙන් පරිවර්තනය කරයි.",
    "Biome இலவச NASA செயற்கைக்கோள் தரவை, இலங்கையின் ஒவ்வொரு மாவட்டத்துக்கும் நகரத்துக்கும் எளிய எச்சரிக்கைகளாக சிங்களம், தமிழ், ஆங்கிலத்தில் மாற்றுகிறது."),
  cta: L("Check your district", "ඔබේ දිස්ත්‍රික්කය බලන්න", "உங்கள் மாவட்டத்தைப் பாருங்கள்"),
  note: L("Free. Refreshed every 3 hours from NASA data.", "නොමිලේ. NASA දත්තවලින් පැය 3 කට වරක් යාවත්කාලීන වේ.", "இலவசம். NASA தரவிலிருந்து 3 மணி நேரத்துக்கு ஒருமுறை புதுப்பிக்கப்படுகிறது."),
  today: L("Today across Sri Lanka", "අද ශ්‍රී ලංකාව පුරා", "இன்று இலங்கை முழுவதும்"),
  k_alert: L("districts on alert", "අවදානම් මට්ටමේ දිස්ත්‍රික්ක", "எச்சரிக்கையில் உள்ள மாவட்டங்கள்"),
  k_slope: L("on SlopeWatch", "SlopeWatch යටතේ", "SlopeWatch இல்"),
  k_dry: L("on DryWatch", "DryWatch යටතේ", "DryWatch இல்"),
  k_rain: L("latest NASA rain", "නවතම NASA වැසි", "சமீபத்திய NASA மழை"),
  k_oni: L("ocean index, El Niño", "සාගර දර්ශකය, එල් නිනෝ", "கடல் குறியீடு, எல் நினோ"),
  how_t: L("Three steps, from orbit to your door.", "කක්ෂයේ සිට ඔබේ දොරකඩට, පියවර තුනකින්.", "சுற்றுப்பாதையிலிருந்து உங்கள் வாசல் வரை, மூன்று படிகள்."),
  how1t: L("NASA measures", "NASA මනියි", "NASA அளவிடுகிறது"),
  how1: L("Rain every day, soil moisture, plant greenness and the height of the land, from seven NASA products.", "NASA නිෂ්පාදන හතකින්, දිනපතා වැසි, පසේ තෙතමනය, ශාකවල හරිතභාවය සහ බිමේ උස.", "ஏழு NASA தயாரிப்புகளிலிருந்து தினசரி மழை, மண் ஈரப்பதம், தாவரப் பசுமை, நிலத்தின் உயரம்."),
  how2t: L("Biome compares", "Biome සසඳයි", "Biome ஒப்பிடுகிறது"),
  how2: L("Each district against 46 years of its own record, giving most weight to the years when the ocean looked like it does now.", "සෑම දිස්ත්‍රික්කයක්ම තමන්ගේම වසර 46 ක වාර්තාව සමඟ, සාගරය දැන් මෙන් වූ වසරවලට වැඩි බරක් දෙමින්.", "ஒவ்வொரு மாவட்டத்தையும் அதன் 46 ஆண்டுப் பதிவுடன், கடல் இப்போது போல இருந்த ஆண்டுகளுக்கு அதிக எடை கொடுத்து."),
  how3t: L("You get told", "ඔබට දැනුම් දෙයි", "உங்களுக்குச் சொல்லப்படுகிறது"),
  how3: L("A level for today, a 12-month outlook, the safer places near you and a Telegram alert, in your language.", "අද සඳහා මට්ටමක්, මාස 12 ක පුරෝකථනයක්, ඔබ අසල ආරක්ෂිත ස්ථාන සහ Telegram අනතුරු ඇඟවීමක්, ඔබේ භාෂාවෙන්.", "இன்றைய நிலை, 12 மாத முன்னோக்கு, உங்கள் அருகிலுள்ள பாதுகாப்பான இடங்கள், Telegram எச்சரிக்கை, உங்கள் மொழியில்."),
  asks: L("Families, farmers and coastal towns ask Biome:", "පවුල්, ගොවීන් සහ වෙරළබඩ නගර Biome ගෙන් අසන්නේ:", "குடும்பங்கள், விவசாயிகள், கரையோர நகரங்கள் Biome இடம் கேட்பவை:"),
  fam_t: L("For families: a level for today, and where to go", "පවුල් සඳහා: අද මට්ටම සහ යා යුතු තැන", "குடும்பங்களுக்கு: இன்றைய நிலை, செல்ல வேண்டிய இடம்"),
  fam_b: L("Yellow, Amber or Red from NASA's daily rain and NBRO's own rainfall steps, for each district and each of 330 divisions. And the schools, temples, churches, mosques and halls on safer ground.", "NASA දෛනික වැසි සහ NBRO වැසි පියවර අනුව, සෑම දිස්ත්‍රික්කයකටම සහ කොට්ඨාස 330 න් එකකටම කහ, තැඹිලි හෝ රතු. සහ ආරක්ෂිත බිමක ඇති පාසල්, පන්සල්, පල්லි, මුස්ලිම් පල්ලි සහ ශාලා.", "NASA தினசரி மழை, NBRO மழை அளவுகளின்படி, ஒவ்வொரு மாவட்டத்துக்கும் 330 பிரிவுகளுக்கும் மஞ்சள், செம்மஞ்சள் அல்லது சிவப்பு. பாதுகாப்பான நிலத்தில் உள்ள பாடசாலைகள், கோவில்கள், தேவாலயங்கள், பள்ளிவாசல்கள், மண்டபங்கள்."),
  farm_t: L("For farmers: the season ahead, before you plant", "ගොවීන් සඳහා: වගා කිරීමට පෙර, ඉදිරි කන්නය", "விவசாயிகளுக்கு: பயிரிடுவதற்கு முன், வரும் பருவம்"),
  farm_b: L("The chance of a drier or wetter Maha and Yala, the month drought danger peaks, tank levels and plant greenness from NASA's Terra satellite.", "වඩා වියළි හෝ වැඩි වැසි සහිත මහ සහ යල කන්නවල සම්භාවිතාව, නියඟ අවදානම උපරිම වන මාසය, වැව් මට්ටම් සහ NASA Terra චන්ද්‍රිකාවෙන් ශාක හරිතභාවය.", "வறண்ட அல்லது ஈரமான பெரும்போகம், சிறுபோகம் வாய்ப்பு, வறட்சி அபாயம் உச்சமாகும் மாதம், குள நீர் மட்டம், NASA Terra செயற்கைக்கோளின் தாவரப் பசுமை."),
  coast_t: L("For the coast: when the flood is coming", "වෙරළ සඳහා: ගංවතුර එන්නේ කවදා ද", "கரையோரத்துக்கு: வெள்ளம் எப்போது வரும்"),
  coast_b: L("Fourteen of our 25 districts touch the sea. Biome watches the rain that reaches them through the rivers, and next adds sea level and shoreline change from NASA.", "අපේ දිස්ත්‍රික්ක 25 න් 14 ක් මුහුදට යාබද ය. ගංගා හරහා ඒවාට ළඟා වන වැසි Biome නිරීක්ෂණය කරයි; ඊළඟට NASA වෙතින් මුහුදු මට්ටම සහ වෙරළ වෙනස්වීම් එක් කරයි.", "நமது 25 மாவட்டங்களில் 14 கடலைத் தொடுகின்றன. ஆறுகள் வழியாக அவற்றை அடையும் மழையை Biome கண்காணிக்கிறது; அடுத்து NASA வின் கடல் மட்டம், கரையோர மாற்றம் சேர்க்கப்படும்."),
  see: L("See the report", "වාර්තාව බලන්න", "அறிக்கையைப் பாருங்கள்"),
  nasa_t: L("Made possible by NASA.", "NASA නිසා හැකි විය.", "NASA வால் சாத்தியமானது."),
  nasa_b: L("Sri Lanka could not afford to measure all of this. NASA's satellites already watch our island every day, and give the data away.", "ශ්‍රී ලංකාවට මේ සියල්ල මැනීමට නොහැකි ය. NASA චන්ද්‍රිකා දිනපතා අපේ දිවයින නිරීක්ෂණය කර, එම දත්ත නොමිලේ ලබා දෙයි.", "இவை அனைத்தையும் அளவிட இலங்கையால் முடியாது. NASA செயற்கைக்கோள்கள் ஒவ்வொரு நாளும் நம் தீவைக் கண்காணித்து, தரவை இலவசமாக வழங்குகின்றன."),
  st_years: L("years of NASA data", "වසරක NASA දත්ත", "ஆண்டு NASA தரவு"),
  st_div: L("divisions with their own level", "තමන්ගේම මට්ටමක් ඇති කොට්ඨාස", "சொந்த நிலை கொண்ட பிரிவுகள்"),
  st_places: L("places checked for safer ground", "ආරක්ෂිත බිම සඳහා පරීක්ෂා කළ ස්ථාන", "பாதுகாப்பான நிலத்துக்குச் சரிபார்க்கப்பட்ட இடங்கள்"),
  st_lang: L("languages, at the same moment", "භාෂා, එකම මොහොතේ", "மொழிகள், ஒரே நேரத்தில்"),
  proof_t: L("Tested before we trusted it.", "විශ්වාස කිරීමට පෙර පරීක්ෂා කළා.", "நம்புவதற்கு முன் சோதிக்கப்பட்டது."),
  proof_b: L("On Cyclone Ditwah, on this week's warnings, on past El Niño years and on real rain gauges.", "ඩිට්වා සුළි කුණාටුව, මෙම සතියේ අනතුරු ඇඟවීම්, අතීත එල් නිනෝ වසර සහ සැබෑ වැසි මානවලින්.", "டித்வா சூறாவளி, இந்த வார எச்சரிக்கைகள், கடந்த எல் நினோ ஆண்டுகள், உண்மையான மழைமானிகள் மீது."),
  p1t: L("Ditwah, replayed day by day", "ඩිට්වා, දිනෙන් දින නැවත ධාවනය කළා", "டித்வா, நாள் தோறும் மீண்டும்"),
  p1: L("From the rain of 26 November 2025: {r} districts Red and {a} Amber, Kandy among them, using only what was known that day.", "2025 නොවැම්බර් 26 වැසි අනුව: මහනුවර ද ඇතුළුව දිස්ත්‍රික්ක {r} ක් රතු සහ {a} ක් තැඹිලි, එදින දැන සිටි දේ පමණක් භාවිතයෙන්.", "2025 நவம்பர் 26 மழையிலிருந்து: கண்டி உட்பட {r} மாவட்டங்கள் சிவப்பு, {a} செம்மஞ்சள், அன்று தெரிந்தவற்றை மட்டும் பயன்படுத்தி."),
  p2t: L("This week's landslide warnings", "මෙම සතියේ නායයෑම් අනතුරු ඇඟවීම්", "இந்த வார மண்சரிவு எச்சரிக்கைகள்"),
  p2: L("All 7 districts Biome had on SlopeWatch were under NBRO landslide warnings between 8 and 11 November.", "Biome SlopeWatch යටතේ තැබූ දිස්ත්‍රික්ක 7 ම නොවැම්බර් 8 සිට 11 දක්වා NBRO නායයෑම් අනතුරු ඇඟවීම් යටතේ විය.", "Biome SlopeWatch இல் வைத்த 7 மாவட்டங்களும் நவம்பர் 8 முதல் 11 வரை NBRO மண்சரிவு எச்சரிக்கையில் இருந்தன."),
  p3t: L("The outlook, in strong El Niño years", "ප්‍රබල එල් නිනෝ වසරවල පුරෝකථනය", "வலுவான எல் நினோ ஆண்டுகளில் முன்னோக்கு"),
  p3: L("Right about {a} times in 10 for the months it shows a signal. Guessing gets 3. In ordinary years it says it has no clear signal.", "සංඥාවක් පෙන්වන මාසවලදී 10 න් {a} ක් පමණ නිවැරදි ය. අනුමානයෙන් 3 යි. සාමාන්‍ය වසරවලදී පැහැදිලි සංඥාවක් නැති බව කියයි.", "சமிக்ஞை காட்டும் மாதங்களில் 10 இல் சுமார் {a} சரி. ஊகம் 3. சாதாரண ஆண்டுகளில் தெளிவான சமிக்ஞை இல்லை என்கிறது."),
  p4t: L("Checked against rain gauges", "වැසි මාන සමඟ පරීක්ෂා කළා", "மழைமானிகளுடன் சரிபார்க்கப்பட்டது"),
  p4: L("NASA's satellite rain matches NOAA's ground stations with r of {r} or more at {n} of {t} stations.", "NASA චන්ද්‍රිකා වැසි, NOAA භූමි මධ්‍යස්ථාන {t} න් {n} ක r {r} හෝ ඊට වැඩියෙන් ගැළපේ.", "NASA செயற்கைக்கோள் மழை, NOAA தரை நிலையங்கள் {t} இல் {n} இல் r {r} அல்லது அதற்கு மேல் பொருந்துகிறது."),
  final_t: L("Check your district.", "ඔබේ දිස්ත්‍රික්කය බලන්න.", "உங்கள் மாவட்டத்தைப் பாருங்கள்."),
  final_b: L("Pick your district and who you are. The report is free, in your language, and you can save it as a picture to share.", "ඔබේ දිස්ත්‍රික්කය සහ ඔබ කවුරුන්දැයි තෝරන්න. වාර්තාව නොමිලේ, ඔබේ භාෂාවෙන්, බෙදා ගැනීමට පින්තූරයක් ලෙස සුරැකිය හැක.", "உங்கள் மாவட்டத்தையும் நீங்கள் யார் என்பதையும் தேர்ந்தெடுங்கள். அறிக்கை இலவசம், உங்கள் மொழியில், பகிர படமாகச் சேமிக்கலாம்."),
  team: L("Team Biome · NASA Space Apps Challenge 2026 · Kandy", "Biome කණ්ඩායම · NASA Space Apps Challenge 2026 · මහනුවර", "Biome அணி · NASA Space Apps Challenge 2026 · கண்டி"),
};
const s = (k, v = {}) => Object.entries(v).reduce((a, [x, y]) => a.replaceAll(`{${x}}`, y), S[k][getLang()] || S[k].en);

function Reveal({ children, className }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={cn("transition-all duration-700 ease-out motion-reduce:transition-none", on ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", className)}>{children}</div>;
}

function Paper({ children, className }) {
  return <div className={cn("rounded-xl border bg-card p-5 shadow-[0_24px_50px_-28px_rgba(16,35,42,0.45)]", className)}>{children}</div>;
}

export function Landing({ DATA, SAFE, GEO, INDEX, lang, changeLang, go, theme, toggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [pickD, setPickD] = useState("Kandy");
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const names = Object.keys(DATA.districts).sort((a, b) => dName(a).localeCompare(dName(b)));
  const lvls = Object.values(DATA.districts).map((d) => d.level?.level || 0);
  const counts = DATA.meta.watch_counts || {};
  const LV = DATA.levels || {};
  const day = LV.day ? `${Number(LV.day.slice(8, 10))} ${monthName(LV.day.slice(0, 7))}` : "";
  const cur = DATA.el_nino.current;
  const fam = buildReport("Kandy", "family", DATA, SAFE, "");
  const farm = buildReport("Polonnaruwa", "farmer", DATA, SAFE, "");
  const coast = buildReport("Batticaloa", "coast", DATA, SAFE, "");
  const d26 = LV.ditwah_replay?.find((r) => r.day === "2025-11-26");
  const F = DATA.forecast;
  const hits = F ? F.skill.like_this_year.hit_rate.filter((_, i) => F.skill.signal[i]) : [];
  const hitA = hits.length ? Math.round(10 * hits.reduce((a, b) => a + b, 0) / hits.length) : 6;
  const st = DATA.validation?.stations || [];
  const good = st.filter((x) => x.r_monthly >= 0.85).length;
  const places = SAFE ? Object.values(SAFE.districts).reduce((a, x) => a + x.count, 0) : 15000;
  const ditwah = (INDEX?.images || []).find((i) => i.id === "ditwah-2025-11-27");
  const ASKS = [
    [t("q_safe"), "family", "Kandy", Users], [t("q_go"), "family", "Ratnapura", MapPin], [t("q_plant"), "farmer", "Polonnaruwa", Sprout],
    [t("q_tank"), "farmer", "Anuradhapura", Droplets], [t("q_flood"), "coast", "Batticaloa", Waves], [t("q_rain"), "farmer", "Kurunegala", CloudRain],
  ];
  const scen = [
    { k: "family", d: "Kandy", title: s("fam_t"), body: s("fam_b"), m: fam, icon: Users },
    { k: "farmer", d: "Polonnaruwa", title: s("farm_t"), body: s("farm_b"), m: farm, icon: Sprout },
    { k: "coast", d: "Batticaloa", title: s("coast_t"), body: s("coast_b"), m: coast, icon: Waves },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="sticky top-3 z-40 px-3 pt-3">
        <nav className={cn("mx-auto flex max-w-6xl items-center justify-between rounded-full px-3 py-2 transition-all duration-300 sm:px-4",
          scrolled ? "bg-card/80 dark:bg-card/85 shadow-[0_8px_30px_-12px_rgba(16,35,42,0.3)] ring-1 ring-foreground/5 backdrop-blur-md" : "bg-transparent")} aria-label="Main">
          <a href={`${HERE}#`} className="pl-1" aria-label="Biome"><Logo className="h-8 w-auto" /></a>
          <div className="hidden items-center gap-1 rounded-full bg-foreground/[0.05] p-1 lg:flex">
            <button type="button" onClick={() => scrollTo("how-it-works")} className="rounded-full px-3 py-1.5 text-[13px] hover:bg-card">{s("nav_how")}</button>
            <a href={`${HERE}#nasa`} className="rounded-full px-3 py-1.5 text-[13px] hover:bg-card">{s("nav_nasa")}</a>
            <a href={`${HERE}#calendar`} className="rounded-full px-3 py-1.5 text-[13px] hover:bg-card">{s("nav_cal")}</a>
            <a href={`${HERE}#how`} className="rounded-full px-3 py-1.5 text-[13px] hover:bg-card">{t("how_title")}</a>
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden sm:flex">
              {Object.entries(LANGS).map(([k, label]) => <Button key={k} size="sm" variant={k === lang ? "secondary" : "ghost"} className="h-8 rounded-full px-2.5" onClick={() => changeLang(k)}>{label}</Button>)}
            </div>
            <ThemeToggle theme={theme} toggle={toggleTheme} />
            <Button asChild className="h-10 rounded-full px-5"><a href={`${HERE}#overview`}>{s("open")}</a></Button>
          </div>
        </nav>
        <div className="mt-2 flex justify-end gap-1 sm:hidden">
          {Object.entries(LANGS).map(([k, label]) => <Button key={k} size="sm" variant={k === lang ? "secondary" : "ghost"} className="h-8 rounded-full px-2.5" onClick={() => changeLang(k)}>{label}</Button>)}
        </div>
      </div>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <Reveal>
            <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[60px] lg:text-[68px]">
              {s("h1a")}<br />{s("h1b")}<br />
              <span className="relative inline-block text-brand-deep">{s("h1c")}
                <svg viewBox="0 0 260 18" fill="none" aria-hidden="true" className="absolute -bottom-3 left-0 h-4 w-full text-brand" preserveAspectRatio="none"><path d="M3 13C70 1 164 2 255 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
              </span>
            </h1>
            <p className="mt-8 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">{s("lede")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="h-12 rounded-full px-6 text-[15px]"><a href={`${HERE}#family/${slug(pickD)}`}>{s("cta")}<ArrowRight /></a></Button>
              <button type="button" onClick={() => scrollTo("how-it-works")} className="text-[15px] font-medium underline-offset-4 hover:underline">{s("nav_how")}</button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{s("note")}</p>
          </Reveal>
          <Reveal className="relative mx-auto w-full max-w-[460px]">
            <Paper className="relative rotate-[-1.5deg] p-4">
              {GEO && <IslandMap GEO={GEO} DATA={DATA} name="" onPick={(n) => go("family", n)} view="family" compact />}
            </Paper>
            <Paper className="absolute -left-4 top-10 hidden w-56 rotate-[-4deg] p-4 sm:block lg:-left-12">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("s_level")}</p>
              <p className="mt-1 font-display text-lg font-semibold">{dName("Kandy")}</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium"><span className={cn("size-3 rounded-full", LEVEL_DOT[fam.level?.n || 0])} />{fam.level ? fam.level.title : t("lvl_0")}</p>
            </Paper>
            {ditwah && (
              <Paper className="absolute -bottom-8 -right-3 hidden w-48 rotate-[3deg] overflow-hidden p-0 sm:block lg:-right-10">
                <img src={ditwah.file} alt="Cyclone Ditwah, NASA Suomi NPP VIIRS" className="h-32 w-full object-cover" />
                <p className="p-2.5 text-[11px] leading-snug text-muted-foreground">Cyclone Ditwah · 27 Nov 2025 · NASA VIIRS</p>
              </Paper>
            )}
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <p className="text-sm font-medium uppercase tracking-wide text-brand-deep">{s("today")}</p>
              <div className="mt-4 grid grid-cols-2 gap-6 lg:grid-cols-5">
                {[[lvls.filter((x) => x > 0).length, s("k_alert"), Bell], [counts.SlopeWatch || 0, s("k_slope"), Mountain], [counts.DryWatch || 0, s("k_dry"), Droplets],
                  [day, s("k_rain"), CloudRain], [cur ? `+${cur.peak}` : "0", s("k_oni"), Waves]].map(([v, l, I], i) => (
                  <div key={i} className="grid content-start gap-1">
                    <I className="size-5 text-brand" />
                    <p className="font-display text-3xl font-bold tracking-tight">{v}</p>
                    <p className="text-sm text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 lg:py-28">
          <Reveal><h2 className="max-w-[20ch] font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">{s("how_t")}</h2></Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[[s("how1t"), s("how1"), Satellite], [s("how2t"), s("how2"), CalendarDays], [s("how3t"), s("how3"), Bell]].map(([h, b, I], i) => (
              <Reveal key={i}>
                <div className="grid h-full content-start gap-3 rounded-2xl border bg-card p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-secondary"><I className="size-5 text-brand-deep" /></span>
                  <p className="text-sm font-semibold text-muted-foreground">0{i + 1}</p>
                  <h3 className="font-display text-xl font-semibold">{h}</h3>
                  <p className="leading-relaxed text-muted-foreground">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 border-t px-5 py-20 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-[26px] font-semibold leading-[1.2] tracking-[-0.02em]">{s("asks")}</h2>
          </div>
          <ul className="grid gap-2 lg:col-span-8">
            {ASKS.map(([q, v, d, I]) => (
              <li key={q}>
                <a href={`${HERE}#${v}/${slug(d)}`} className="group flex items-center gap-4 rounded-xl border bg-card px-5 py-4 transition-colors hover:bg-secondary/60">
                  <I className="size-5 shrink-0 text-brand" />
                  <span className="flex-1 text-[17px] font-medium">{q}</span>
                  <span className="hidden text-sm text-muted-foreground sm:inline">{dName(d)}</span>
                  <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {scen.map(({ k, d, title, body, m, icon: I }, idx) => (
          <section key={k} className="mx-auto max-w-6xl px-5">
            <div className="grid items-center gap-12 border-t py-20 lg:grid-cols-2 lg:py-24">
              <Reveal className={cn(idx % 2 === 1 && "lg:order-2")}>
                <span className="grid size-10 place-items-center rounded-full bg-secondary"><I className="size-5 text-brand-deep" /></span>
                <h2 className="mt-4 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">{title}</h2>
                <p className="mt-4 max-w-[50ch] text-[17px] leading-relaxed text-muted-foreground">{body}</p>
                <Button asChild variant="outline" className="mt-6 h-11 rounded-full px-5"><a href={`${HERE}#${k}/${slug(d)}`}>{s("see")}: {dName(d)}<ArrowRight /></a></Button>
              </Reveal>
              <Reveal className="relative mx-auto w-full max-w-[460px]">
                {k === "family" && <>
                  <Paper className="rotate-[1.5deg]">
                    <p className="text-sm font-medium">{t("s_level")} · {m.district}</p>
                    <p className="mt-2 flex items-center gap-2 font-display text-xl font-semibold"><span className={cn("size-3 rounded-full", LEVEL_DOT[m.level?.n || 0])} />{m.level ? m.level.title : t("lvl_0")}</p>
                    {m.level && <p className="mt-2 text-sm text-muted-foreground">{m.level.rain}</p>}
                    <div className="mt-4 border-t pt-3">
                      <p className="text-sm font-medium">{t("s_safe")}</p>
                      <ol className="mt-2 grid gap-1.5 text-sm">{(SAFE?.districts?.[d]?.top || []).slice(0, 3).map((c, i) => <li key={i} className="flex gap-2"><span className="font-semibold">{i + 1}.</span>{c[3]}</li>)}</ol>
                    </div>
                  </Paper>
                </>}
                {k === "farmer" && m.plant?.[0] && (
                  <Paper className="rotate-[-1.5deg]">
                    <div className="flex items-baseline justify-between gap-2"><p className="font-display text-xl font-semibold">{m.plant[0].title}</p><p className="text-sm text-muted-foreground">{m.district}</p></div>
                    <p className="text-sm text-muted-foreground">{m.plant[0].range}</p>
                    <div className="mt-3 grid gap-1.5 text-[15px]">{m.plant[0].lines.map((l, i) => <p key={i}>{l}</p>)}</div>
                    <p className="mt-3 border-t pt-3 text-sm font-medium">{m.plant[0].adv}</p>
                  </Paper>
                )}
                {k === "coast" && (
                  <Paper className="rotate-[1.5deg] overflow-hidden p-0">
                    <div className="p-5" style={{ background: m.now.bg, color: m.now.fg }}>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t("s_now")} · {m.district}</p>
                      <p className="mt-1 font-display text-xl font-bold">{m.now.title}</p>
                    </div>
                    <div className="grid gap-2 p-5 text-[15px]">
                      <p className="font-semibold">{m.ask?.[0]?.q}</p>
                      {(m.ask?.[0]?.a || []).slice(0, 2).map((l, i) => <p key={i} className={cn(i > 0 && "text-sm text-muted-foreground")}>{l}</p>)}
                    </div>
                  </Paper>
                )}
              </Reveal>
            </div>
          </section>
        ))}

        <section className="mt-8 bg-[#10232a] text-[#f3efe6] dark:bg-[#16272d]">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:py-24">
            <Reveal>
              <h2 className="font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[52px]">{s("nasa_t")}</h2>
              <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-[#f3efe6]/80">{s("nasa_b")}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["GPM IMERG", "GLDAS", "MERRA-2", "MODIS", "NASADEM (SRTM)", "VIIRS", "Worldview"].map((x) => <span key={x} className="rounded-full px-3 py-1 text-sm ring-1 ring-[#f3efe6]/25">{x}</span>)}
              </div>
              <Button asChild variant="secondary" className="mt-8 h-11 rounded-full px-5"><a href={`${HERE}#nasa`}>{s("nav_nasa")}<ArrowUpRight /></a></Button>
            </Reveal>
            <div className="grid grid-cols-2 gap-6">
              {[["46", s("st_years")], ["330", s("st_div")], [places.toLocaleString(), s("st_places")], ["3", s("st_lang")]].map(([v, l]) => (
                <Reveal key={l}><p className="font-display text-5xl font-bold tracking-tight sm:text-6xl">{v}</p><p className="mt-2 text-[#f3efe6]/75">{l}</p></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-4">
            <h2 className="font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">{s("proof_t")}</h2>
            <p className="mt-4 max-w-[36ch] text-muted-foreground">{s("proof_b")}</p>
            <a href={`${HERE}#how`} className="mt-5 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">{t("how_title")}<ArrowRight className="size-4" /></a>
          </div>
          <div className="grid overflow-hidden rounded-2xl border bg-card sm:grid-cols-2 lg:col-span-8">
            {[[s("p1t"), s("p1", { r: d26?.counts?.["3"] ?? 2, a: d26?.counts?.["2"] ?? 6 })], [s("p2t"), s("p2")],
              [s("p3t"), s("p3", { a: hitA })], [s("p4t"), s("p4", { r: "0.85", n: good, t: st.length })]].map(([h, b], i) => (
              <div key={h} className={cn("p-7", i % 2 === 0 && "sm:border-r", i < 2 && "border-b")}>
                <h3 className="font-display text-lg font-semibold leading-snug">{h}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-10 rounded-3xl border bg-card p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">{s("final_t")}</h2>
              <p className="mt-4 max-w-[44ch] text-muted-foreground">{s("final_b")}</p>
            </div>
            <div className="grid content-center gap-4">
              <Select value={pickD} onValueChange={setPickD}>
                <SelectTrigger className="h-12 rounded-xl text-base" aria-label={t("district")}><SelectValue /></SelectTrigger>
                <SelectContent>{names.map((n) => <SelectItem key={n} value={n}>{dName(n)}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-11 rounded-full px-5"><a href={`${HERE}#family/${slug(pickD)}`}><Users />{t("tab_family")}</a></Button>
                <Button asChild variant="outline" className="h-11 rounded-full px-5"><a href={`${HERE}#farmer/${slug(pickD)}`}><Sprout />{t("tab_farmer")}</a></Button>
                <Button asChild variant="outline" className="h-11 rounded-full px-5"><a href={`${HERE}#coast/${slug(pickD)}`}><Waves />{t("tab_coast")}</a></Button>
                <Button asChild variant="ghost" className="h-11 rounded-full px-5"><a href={`${HERE}#full/${slug(pickD)}`}>{t("tab_full")}</a></Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-3 px-5 py-10 text-sm text-muted-foreground">
          <Logo className="h-7 w-fit" />
          <p className="font-medium text-foreground">{t("emer")}</p>
          <p>{t("disc")}</p>
          <p>{s("team")}</p>
          <p>Data: NASA GPM IMERG, GLDAS, MERRA-2, MODIS and NASADEM; NASA GIBS and Worldview; NOAA; Sri Lanka Irrigation Department; OpenStreetMap; geoBoundaries (CC BY 4.0). No NASA endorsement is implied.</p>
        </div>
      </footer>
    </div>
  );
}
