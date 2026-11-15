// The year plan: a printable A4 report for families, farmers and the coast, in
// the chosen language, to keep on the wall for the year. It is only shown when
// printing or saving as PDF; on screen the dashboard stays as it is.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Cloud, CloudRain, CloudSun, Sun } from "lucide-react";
import { t, monthName, getLang } from "@classic/i18n.js";
import { L, in10, monthSigns, slug } from "@/lib/ui";
import { mapsLink } from "@/sections/cards";
import { cn } from "@/lib/utils";

const S = {
  title: L("Year plan", "වාර්ෂික සැලැස්ම", "ஆண்டுத் திட்டம்"),
  made: L("Made on {d} from NASA satellite data. The outlook changes as the months pass: print a new one each month if you can.",
    "{d} දින NASA චන්ද්‍රිකා දත්තවලින් සකස් කළා. මාස ගෙවී යන විට පුරෝකථනය වෙනස් වේ: හැකි නම් සෑම මසකම නව එකක් මුද්‍රණය කරන්න.",
    "{d} அன்று NASA செயற்கைக்கோள் தரவிலிருந்து தயாரிக்கப்பட்டது. மாதங்கள் செல்லச் செல்ல முன்னோக்கு மாறும்: முடிந்தால் ஒவ்வொரு மாதமும் புதிதாக அச்சிடுங்கள்."),
  scan: L("Scan for today's level", "අද මට්ටම සඳහා ස්කෑන් කරන්න", "இன்றைய நிலைக்கு ஸ்கேன் செய்யுங்கள்"),
  glance: L("Your year at a glance", "ඔබේ වසර එක බැල්මකින්", "உங்கள் ஆண்டு ஒரே பார்வையில்"),
  monthly: L("Month by month", "මාසයෙන් මාසයට", "மாதம் தோறும்"),
  th_m: L("Month", "මාසය", "மாதம்"), th_e: L("What to expect", "බලාපොරොත්තු විය යුතු දේ", "என்ன எதிர்பார்க்கலாம்"),
  th_d: L("What to do", "කළ යුතු දේ", "என்ன செய்ய வேண்டும்"), th_ok: L("Done", "කළා", "முடிந்தது"),
  ready: L("Be ready: tick when done", "සූදානම්ව සිටින්න: කළ විට සලකුණු කරන්න", "தயாராக இருங்கள்: முடிந்ததும் குறியிடுங்கள்"),
  places: L("Safer places to go", "යා හැකි ආරක්ෂිත ස්ථාන", "செல்லக்கூடிய பாதுகாப்பான இடங்கள்"),
  places_d: L("Scan a code for directions in Google Maps. Check with your Grama Niladhari before you rely on one.", "Google Maps මාර්ගය සඳහා කේතයක් ස්කෑන් කරන්න. ඒ මත විශ්වාසය තැබීමට පෙර ග්‍රාම නිලධාරී සමඟ තහවුරු කර ගන්න.", "Google Maps வழிக்கு ஒரு குறியீட்டை ஸ்கேன் செய்யுங்கள். நம்புவதற்கு முன் கிராம சேவகரிடம் உறுதிப்படுத்துங்கள்."),
  numbers: L("Emergency numbers", "හදිසි අංක", "அவசர எண்கள்"),
  n117: L("Disaster Management Centre", "ආපදා කළමනාකරණ මධ්‍යස්ථානය", "அனர்த்த முகாமைத்துவ நிலையம்"),
  n1990: L("Ambulance (Suwa Seriya)", "ගිලන් රථ (සුව සැරිය)", "அம்புலன்ஸ் (சுவ செரிய)"),
  n119: L("Police", "පොලිසිය", "பொலிஸ்"),
  my: L("My Grama Niladhari:", "මගේ ග්‍රාම නිලධාරී:", "எனது கிராம சேவகர்:"),
  meet: L("Our family meeting point:", "අපේ පවුල හමු වන ස්ථානය:", "எங்கள் குடும்பம் சந்திக்கும் இடம்:"),
  dry: L("Drier", "වියළි", "வறட்சி"), wet: L("Wetter", "වැඩි වැසි", "அதிக மழை"), mixed: L("Either way", "දෙපැත්තටම", "இரு வகையிலும்"), normal: L("Usual", "සාමාන්‍ය", "வழக்கம்"),
  f_dry: L("Drought danger {x} in 10.", "නියඟ අවදානම 10න් {x}.", "வறட்சி அபாயம் 10 இல் {x}."),
  f_flood: L("Flood danger {x} in 10.", "ගංවතුර අවදානම 10න් {x}.", "வெள்ள அபாயம் 10 இல் {x}."),
  f_slope: L("Landslide danger {x} in 10.", "නායයෑම් අවදානම 10න් {x}.", "மண்சரிவு அபாயம் 10 இல் {x}."),
  a_family_dry: L("Store water and use it carefully. No fires outdoors on dry, windy days.", "ජලය ගබඩා කර පරිස්සමින් භාවිත කරන්න. වියළි, සුළං සහිත දිනවල එළිමහනේ ගිනි නොදල්වන්න.", "தண்ணீரைச் சேமித்து கவனமாகப் பயன்படுத்துங்கள். வறண்ட, காற்று வீசும் நாட்களில் வெளியில் தீ மூட்ட வேண்டாம்."),
  a_family_wet: L("Keep the emergency bag ready, clear drains around the house, and know the way to your safer place.", "හදිසි බෑගය සූදානම්ව තබා, නිවස වටා කාණු පිරිසිදු කර, ආරක්ෂිත ස්ථානයට යන මාර්ගය දැනගන්න.", "அவசரப் பையைத் தயாராக வைத்து, வீட்டைச் சுற்றியுள்ள வடிகால்களைச் சுத்தம் செய்து, பாதுகாப்பான இடத்துக்கான வழியை அறிந்துகொள்ளுங்கள்."),
  a_family_mixed: L("Could go either way: keep the emergency bag ready and store some water.", "දෙපැත්තටම විය හැක: හදිසි බෑගය සූදානම්ව තබා, ජලය ටිකක් ගබඩා කරන්න.", "இரு வகையிலும் அமையலாம்: அவசரப் பையைத் தயாராக வைத்து, சிறிது தண்ணீரைச் சேமியுங்கள்."),
  a_family_normal: L("A usual month. Look at Biome once a week.", "සාමාන්‍ය මාසයකි. සතියකට වරක් Biome බලන්න.", "வழக்கமான மாதம். வாரத்துக்கு ஒருமுறை Biome ஐப் பாருங்கள்."),
  a_farmer_dry: L("Plan for less water: keep to water turns, water early or late in the day, and cover the soil to keep it moist.", "අඩු ජලයකට සැලසුම් කරන්න: ජල වාර පිළිපදින්න, උදේ හෝ සවස ජලය දෙන්න, පස තෙත්ව තබා ගැනීමට වසන්න.", "குறைந்த நீருக்குத் திட்டமிடுங்கள்: நீர் முறைகளைப் பின்பற்றி, காலை அல்லது மாலை நீர் பாய்ச்சி, மண்ணின் ஈரம் காக்க மூடுங்கள்."),
  a_farmer_wet: L("Clear field channels and drains, keep seed and fertiliser dry, and harvest early if heavy rain is coming.", "ඇළ මාර්ග හා කාණු පිරිසිදු කර, බීජ හා පොහොර වියළිව තබා, තද වැසි එන්නේ නම් කලින් අස්වනු නෙළන්න.", "வாய்க்கால்களையும் வடிகால்களையும் சுத்தம் செய்து, விதை, உரத்தை உலர வைத்து, கனமழை வந்தால் முன்கூட்டியே அறுவடை செய்யுங்கள்."),
  a_farmer_mixed: L("Could go either way: keep channels clear and keep some water in store.", "දෙපැත්තටම විය හැක: ඇළ මාර්ග පිරිසිදුව තබා, ජලය ටිකක් ගබඩා කරන්න.", "இரு வகையிலும் அமையலாம்: வாய்க்கால்களைச் சுத்தமாக வைத்து, சிறிது நீரைச் சேமியுங்கள்."),
  a_farmer_normal: L("A usual month. Farm as normal and look at Biome each week.", "සාමාන්‍ය මාසයකි. සාමාන්‍ය පරිදි වගා කර, සෑම සතියකම Biome බලන්න.", "வழக்கமான மாதம். வழக்கம்போல் பயிரிட்டு, ஒவ்வொரு வாரமும் Biome ஐப் பாருங்கள்."),
  a_coast_dry: L("Store drinking water. Check the sea forecast before every trip.", "පානීය ජලය ගබඩා කරන්න. සෑම ගමනකටම පෙර මුහුදු පුරෝකථනය බලන්න.", "குடிநீரைச் சேமியுங்கள். ஒவ்வொரு பயணத்துக்கும் முன் கடல் முன்னறிவிப்பைப் பாருங்கள்."),
  a_coast_wet: L("Watch rivers and lagoon mouths after heavy rain inland. Keep boats and nets above the high-water line.", "ඇතුළත තද වැසිවලින් පසු ගංගා සහ කලපු මෝය නිරීක්ෂණය කරන්න. බෝට්ටු සහ දැල් ඉහළ ජල මට්ටමට ඉහළින් තබන්න.", "உள்நாட்டில் கனமழைக்குப் பின் ஆறுகளையும் களப்பு முகத்துவாரங்களையும் கவனியுங்கள். படகுகள், வலைகளை உயர் நீர்க் கோட்டுக்கு மேலே வையுங்கள்."),
  a_coast_mixed: L("Could go either way: keep the emergency bag ready and watch the rivers.", "දෙපැත්තටම විය හැක: හදිසි බෑගය සූදානම්ව තබා ගංගා නිරීක්ෂණය කරන්න.", "இரு வகையிலும் அமையலாம்: அவசரப் பையைத் தயாராக வைத்து, ஆறுகளைக் கவனியுங்கள்."),
  a_coast_normal: L("A usual month. Check the sea forecast before every trip.", "සාමාන්‍ය මාසයකි. සෑම ගමනකටම පෙර මුහුදු පුරෝකථනය බලන්න.", "வழக்கமான மாதம். ஒவ்வொரு பயணத்துக்கும் முன் கடல் முன்னறிவிப்பைப் பாருங்கள்."),
  fam_1: L("Emergency bag: ID and documents in a plastic bag, medicine, torch, power bank, water and dry food.", "හදිසි බෑගය: හැඳුනුම්පත සහ ලේඛන ප්ලාස්ටික් බෑගයක, ඖෂධ, විදුලි පන්දම, පවර් බැංකුව, ජලය සහ වියළි ආහාර.", "அவசரப் பை: அடையாள அட்டை, ஆவணங்கள் பிளாஸ்டிக் பையில், மருந்து, டார்ச், பவர் பேங்க், தண்ணீர், உலர் உணவு."),
  fam_2: L("We know the way to our safer place.", "අපේ ආරක්ෂිත ස්ථානයට යන මාර්ගය අපි දනිමු.", "எங்கள் பாதுகாப்பான இடத்துக்கான வழி எங்களுக்குத் தெரியும்."),
  fam_3: L("The emergency numbers are saved in every phone.", "හදිසි අංක සෑම දුරකථනයකම සුරකිලා ඇත.", "அவசர எண்கள் ஒவ்வொரு கைபேசியிலும் சேமிக்கப்பட்டுள்ளன."),
  fam_4: L("We agreed where the family meets if we get separated.", "වෙන් වුවහොත් පවුල හමු වන ස්ථානය අපි එකඟ වුණෙමු.", "பிரிந்துவிட்டால் குடும்பம் சந்திக்கும் இடத்தை ஒப்புக்கொண்டோம்."),
  fam_5: L("We get Biome alerts on Telegram.", "අපට Telegram හරහා Biome අනතුරු ඇඟවීම් ලැබේ.", "Telegram இல் Biome எச்சரிக்கைகளைப் பெறுகிறோம்."),
  farm_1: L("Water turns agreed with the farmer organisation.", "ගොවි සංවිධානය සමඟ ජල වාර එකඟ විය.", "விவசாய அமைப்புடன் நீர் முறைகள் ஒப்புக்கொள்ளப்பட்டன."),
  farm_2: L("Seed chosen for this season's outlook.", "මෙම කන්නයේ පුරෝකථනයට ගැළපෙන බීජ තෝරා ගත්තා.", "இந்தப் பருவ முன்னோக்குக்கு ஏற்ற விதை தேர்ந்தெடுக்கப்பட்டது."),
  farm_3: L("Field channels and drains cleared.", "ඇළ මාර්ග සහ කාණු පිරිසිදු කළා.", "வாய்க்கால்களும் வடிகால்களும் சுத்தம் செய்யப்பட்டன."),
  farm_4: L("Seed, fertiliser and chemicals stored off the ground.", "බීජ, පොහොර සහ රසායන බිමෙන් ඉහළින් ගබඩා කළා.", "விதை, உரம், இரசாயனங்கள் தரையிலிருந்து உயர்த்தி வைக்கப்பட்டன."),
  coast_1: L("Boats, engines and nets kept above the high-water line.", "බෝට්ටු, එන්ජින් සහ දැල් ඉහළ ජල මට්ටමට ඉහළින් තැබුවා.", "படகுகள், இயந்திரங்கள், வலைகள் உயர் நீர்க் கோட்டுக்கு மேலே வைக்கப்பட்டன."),
  footer: L("Biome is not an official warning. For warnings, follow the Department of Meteorology, NBRO and the Disaster Management Centre (117). Made possible by NASA: GPM rain satellites, MERRA-2, Terra MODIS and Shuttle Radar elevation.",
    "Biome නිල අනතුරු ඇඟවීමක් නොවේ. අනතුරු ඇඟවීම් සඳහා කාලගුණ විද්‍යා දෙපාර්තමේන්තුව, NBRO සහ ආපදා කළමනාකරණ මධ්‍යස්ථානය (117) අනුගමනය කරන්න. NASA නිසා හැකි විය: GPM වැසි චන්ද්‍රිකා, MERRA-2, Terra MODIS සහ Shuttle Radar උස.",
    "Biome அதிகாரபூர்வ எச்சரிக்கை அல்ல. எச்சரிக்கைகளுக்கு வளிமண்டலவியல் திணைக்களம், NBRO, அனர்த்த முகாமைத்துவ நிலையம் (117) ஆகியவற்றைப் பின்பற்றுங்கள். NASA வால் சாத்தியமானது: GPM மழை செயற்கைக்கோள்கள், MERRA-2, Terra MODIS, Shuttle Radar உயரம்."),
};
const s = (k, v = {}) => Object.entries(v).reduce((a, [x, y]) => a.replaceAll(`{${x}}`, y), S[k][getLang()] || S[k].en);
const ICON = { dry: Sun, wet: CloudRain, mixed: CloudSun, normal: Cloud };
const TILE = { dry: "#f6ecd2", wet: "#dcebef", mixed: "linear-gradient(135deg,#f6ecd2 50%,#dcebef 50%)", normal: "#eef0eb" };
const SITE = "https://pasindusuraweera.github.io/biome/v2/";

function useQR(text, size = 180) {
  const [src, setSrc] = useState("");
  useEffect(() => { let on = true; QRCode.toDataURL(text, { margin: 0, width: size }).then((u) => on && setSrc(u)).catch(() => {}); return () => { on = false; }; }, [text, size]);
  return src;
}
function QR({ text, size, className }) {
  const src = useQR(text, size);
  return src ? <img src={src} alt="" className={className} /> : null;
}
const Box = () => <span className="inline-block size-4 shrink-0 rounded-[3px] border-2 border-[#16201f] align-middle" />;
const H = ({ children }) => <h2 className="mb-2 mt-4 font-display text-[15pt] font-bold text-[#10232a]">{children}</h2>;

export function YearPlan({ m, name, view, DATA, SAFE, town }) {
  const aud = view === "farmer" ? "farmer" : view === "coast" ? "coast" : "family";
  const ms = monthSigns(DATA, name);
  const F = DATA.forecast?.district?.[name];
  const sp = (town && SAFE?.towns?.[`${name}|${town}`]) || SAFE?.districts?.[name];
  const top = (sp?.top || []).slice(0, 5);
  const today = new Date();
  const made = `${today.getDate()} ${monthName(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`)}`;
  const link = `${SITE}#${view}/${slug(name)}`;
  const expect = (x) => (!x.sig ? `${t("lv_unclear")}.` : x.sign === "dry" ? t("pl_dry", { x: in10(x.pDry) }) : x.sign === "wet" ? t("pl_wet", { x: in10(x.pWet) })
    : x.sign === "mixed" ? `${t("lv_mixed")}. ${t("mixed_odds", { a: in10(x.pDry), b: in10(x.pWet) })}` : `${t("lv_normal")}.`);
  const flags = (x, i) => {
    if (!x.sig || !F) return [];
    const out = [];
    if (F.watch.DryWatch[i] >= 0.3) out.push(s("f_dry", { x: in10(F.watch.DryWatch[i]) }));
    if (F.watch.FloodWatch[i] >= 0.3) out.push(s("f_flood", { x: in10(F.watch.FloodWatch[i]) }));
    if (F.watch.SlopeWatch[i] >= 0.3) out.push(s("f_slope", { x: in10(F.watch.SlopeWatch[i]) }));
    return out;
  };
  const ready = aud === "farmer" ? ["farm_1", "farm_2", "farm_3", "farm_4", "fam_1", "fam_3"]
    : aud === "coast" ? ["coast_1", "fam_1", "fam_2", "fam_3", "fam_4", "fam_5"] : ["fam_1", "fam_2", "fam_3", "fam_4", "fam_5"];
  return (
    <div className="year-plan hidden bg-white text-[10.5pt] leading-snug text-[#16201f] print:block">
      {/* page 1 */}
      <section className="yp-page">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#10232a] pb-3">
          <div>
            <img src="logo.png" alt="Biome" className="h-9 w-auto" />
            <h1 className="mt-2 font-display text-[22pt] font-bold leading-tight">{s("title")} · {m.district}</h1>
            <p className="text-[11pt] font-semibold text-[#a84a22]">{m.aud}</p>
            <p className="mt-1 max-w-[120mm] text-[9pt] text-[#4a5552]">{s("made", { d: made })}</p>
          </div>
          <div className="grid justify-items-center gap-1 text-center"><QR text={link} size={240} className="size-[26mm]" /><span className="max-w-[30mm] text-[8pt]">{s("scan")}</span></div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-md p-3" style={{ background: m.now.bg, color: m.now.fg }}>
            <p className="text-[8.5pt] font-semibold uppercase opacity-85">{t("s_now")} · {m.when}</p>
            <p className="font-display text-[14pt] font-bold">{m.now.title}</p>
            <p className="text-[9.5pt]">{m.now.desc}</p>
          </div>
          <div className="rounded-md border border-[#c9c3b4] p-3">
            <p className="text-[8.5pt] font-semibold uppercase text-[#4a5552]">{t("s_level")}</p>
            <p className="font-display text-[12pt] font-bold">{m.level ? m.level.title : t("lvl_0")}</p>
            {m.level && <p className="text-[9.5pt]">{m.level.rain}</p>}
          </div>
        </div>

        <H>{s("glance")}</H>
        <ol className="grid grid-cols-6 gap-1.5">
          {ms.map((x, i) => {
            const I = ICON[x.sign];
            return (
              <li key={x.ym} className="rounded-md border border-[#d6d1c5] p-1.5" style={{ background: TILE[x.sign] }}>
                <p className="text-[8.5pt] font-semibold">{monthName(x.ym, true)} {x.ym.slice(2, 4)}</p>
                <I className="my-0.5 size-5" />
                <p className="text-[10pt] font-bold">{s(x.sign)}</p>
                {x.sig && F?.watch.DryWatch[i] >= 0.5 && <p className="text-[7.5pt] font-medium">{s("f_dry", { x: in10(F.watch.DryWatch[i]) })}</p>}
              </li>
            );
          })}
        </ol>
        <p className="mt-1.5 text-[8.5pt] text-[#4a5552]">{m.basis}</p>

        {aud === "farmer" && m.plant?.length > 0 && <>
          <H>{t("s_plant")}</H>
          <div className="grid grid-cols-2 gap-3">
            {m.plant.map((p, i) => (
              <div key={i} className="rounded-md border border-[#c9c3b4] p-3" style={{ background: p.sign === "dry" ? "#f6ecd2" : p.sign === "wet" ? "#dcebef" : "#fff" }}>
                <p className="font-display text-[12pt] font-bold">{p.title} <span className="text-[9pt] font-normal">· {p.range}</span></p>
                {p.lines.map((l, j) => <p key={j} className="text-[9.5pt]">{l}</p>)}
                <p className="mt-1 text-[9.5pt] font-semibold">{p.adv}</p>
              </div>
            ))}
          </div>
        </>}

        <H>{s("ready")}</H>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[...m.todo, ...ready.map((k) => s(k))].map((x, i) => <li key={i} className="flex items-start gap-2"><Box /><span>{x}</span></li>)}
        </ul>
      </section>

      {/* page 2 */}
      <section className="yp-page yp-break">
        <H>{s("monthly")}</H>
        <table className={cn("w-full border-collapse", getLang() === "ta" ? "text-[8pt] leading-tight" : "text-[9pt]")}>
          <thead>
            <tr className="border-b-2 border-[#10232a] text-left">
              <th className="w-[22mm] py-1 pr-2">{s("th_m")}</th><th className="w-[58mm] py-1 pr-2">{s("th_e")}</th><th className="py-1 pr-2">{s("th_d")}</th><th className="w-[12mm] py-1 text-center">{s("th_ok")}</th>
            </tr>
          </thead>
          <tbody>
            {ms.map((x, i) => (
              <tr key={x.ym} className="break-inside-avoid border-b border-[#d6d1c5] align-top">
                <td className="py-1 pr-2 font-semibold">{monthName(x.ym)}</td>
                <td className="py-1 pr-2">{expect(x)} {flags(x, i).join(" ")}</td>
                <td className="py-1 pr-2">{s(`a_${aud}_${x.sig ? x.sign : "normal"}`)}</td>
                <td className="py-1 text-center"><Box /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {top.length > 0 && <>
          <H>{s("places")}</H>
          <p className="mb-2 text-[9pt] text-[#4a5552]">{s("places_d")}</p>
          <ol className="grid grid-cols-5 gap-2">
            {top.map((c, i) => (
              <li key={i} className="grid content-start justify-items-center gap-1 rounded-md border border-[#d6d1c5] p-2 text-center">
                <QR text={mapsLink(c)} size={160} className={getLang() === "ta" ? "size-[15mm]" : "size-[18mm]"} />
                <p className="text-[9pt] font-semibold leading-tight">{i + 1}. {c[3]}</p>
                <p className="text-[8pt] text-[#4a5552]">{t("kind_" + c[2])}</p>
              </li>
            ))}
          </ol>
        </>}

        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-3 break-inside-avoid">
          <div className="rounded-md bg-[#10232a] p-3 text-[#f3efe6]">
            <p className="font-display text-[12pt] font-bold">{s("numbers")}</p>
            <p className="mt-1 text-[11pt]"><b className="text-[14pt]">117</b> · {s("n117")}</p>
            <p className="text-[11pt]"><b className="text-[14pt]">1990</b> · {s("n1990")}</p>
            <p className="text-[11pt]"><b className="text-[14pt]">119</b> · {s("n119")}</p>
          </div>
          <div className="grid content-start gap-4 rounded-md border border-[#c9c3b4] p-3 text-[10pt]">
            <p>{s("my")} <span className="inline-block w-full border-b border-dotted border-[#16201f] pt-4" /></p>
            <p>{s("meet")} <span className="inline-block w-full border-b border-dotted border-[#16201f] pt-4" /></p>
          </div>
        </div>
        <p className="mt-4 text-[8pt] text-[#4a5552]">{s("footer")}</p>
      </section>
    </div>
  );
}
