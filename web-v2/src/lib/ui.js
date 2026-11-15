// Strings and helpers shared by the dashboard's pages.
import { CheckCircle2, Droplets, Mountain, Waves } from "lucide-react";
import { getLang } from "@classic/i18n.js";

export const L = (en, si, ta) => ({ en, si, ta });
export const UI = {
  overview: L("Overview", "දළ විශ්ලේෂණය", "மேலோட்டம்"),
  more: L("More", "තවත්", "மேலும்"),
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
export const ui = (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.replaceAll(`{${a}}`, b), UI[k][getLang()] || UI[k].en);
export const slug = (n) => n.toLowerCase().replace(/\s+/g, "-");
export const in10 = (p) => Math.max(1, Math.min(9, Math.round(p * 10)));
export const LEVEL_TONE = ["", "bg-[#fbf3d0] dark:bg-[#3a3214]", "bg-[#fbe2cc] dark:bg-[#43281a]", "bg-[#f6d3cf] dark:bg-[#4a1f1c]"];
export const LEVEL_DOT = ["bg-[#9aa39e]", "bg-[#e0b422]", "bg-[#d2691e]", "bg-[#b3261e]"];
export const LEVEL_FILL = ["#c9cec9", "#e0b422", "#d2691e", "#b3261e"];
export const SIGN_FILL = { dry: "#e3b85c", wet: "#23687a", mixed: "#9fbfc4", normal: "#cfd3cc" };
export const SIGN_CLS = {
  dry: "bg-dry text-[#2a1e05]", wet: "bg-wet text-white", normal: "bg-usual text-[#4a5552]",
  mixed: "text-[#16201f] bg-[linear-gradient(135deg,#f1dba6_50%,#b9d6dc_50%)]",
};
export const narrow = () => typeof window !== "undefined" && window.innerWidth < 640;
export const WATCH_ICON = { SlopeWatch: Mountain, FloodWatch: Waves, DryWatch: Droplets, Clear: CheckCircle2 };


// the outlook model's call for each month, the same rule the classic report uses
export function monthSigns(DATA, name) {
  const F = DATA.forecast, x = F?.district?.[name];
  if (!x) return [];
  return F.months.map((ym, i) => {
    const sig = F.skill.signal[i];
    const sign = !sig ? "normal" : x.p_dry[i] >= 0.5 ? "dry" : x.p_wet[i] >= 0.5 ? "wet" : (1 - x.p_dry[i] - x.p_wet[i]) >= 0.4 ? "normal" : "mixed";
    return { ym, sig, sign, median: x.median[i], pDry: x.p_dry[i], pWet: x.p_wet[i], drought: x.watch.DryWatch[i] };
  });
}

