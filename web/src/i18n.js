// Every user-facing line in English, Sinhala and Tamil.
// The Sinhala and Tamil text must be checked by native speakers before release.

import { S } from "./i18n_simple.js";

export const LANGS = { en: "English", si: "සිංහල", ta: "தமிழ்" };
export const LOCALE = { en: "en-GB", si: "si-LK", ta: "ta-LK" };

export const DISTRICTS = {
  Ampara: ["අම්පාර", "அம்பாறை"], Anuradhapura: ["අනුරාධපුරය", "அனுராதபுரம்"], Badulla: ["බදුල්ල", "பதுளை"],
  Batticaloa: ["මඩකලපුව", "மட்டக்களப்பு"], Colombo: ["කොළඹ", "கொழும்பு"], Galle: ["ගාල්ල", "காலி"],
  Gampaha: ["ගම්පහ", "கம்பஹா"], Hambantota: ["හම්බන්තොට", "அம்பாந்தோட்டை"], Jaffna: ["යාපනය", "யாழ்ப்பாணம்"],
  Kalutara: ["කළුතර", "களுத்துறை"], Kandy: ["මහනුවර", "கண்டி"], Kegalle: ["කෑගල්ල", "கேகாலை"],
  Kilinochchi: ["කිලිනොච්චිය", "கிளிநொச்சி"], Kurunegala: ["කුරුණෑගල", "குருநாகல்"], Mannar: ["මන්නාරම", "மன்னார்"],
  Matale: ["මාතලේ", "மாத்தளை"], Matara: ["මාතර", "மாத்தறை"], Monaragala: ["මොණරාගල", "மொனராகலை"],
  Mullaitivu: ["මුලතිව්", "முல்லைத்தீவு"], "Nuwara Eliya": ["නුවරඑළිය", "நுவரெலியா"], Polonnaruwa: ["පොළොන්නරුව", "பொலன்னறுவை"],
  Puttalam: ["පුත්තලම", "புத்தளம்"], Ratnapura: ["රත්නපුර", "இரத்தினபுரி"], Trincomalee: ["ත්‍රිකුණාමලය", "திருகோணமலை"],
  Vavuniya: ["වවුනියාව", "வவுனியா"],
};
export const PROVINCES = {
  Western: ["බස්නාහිර", "மேல்"], Central: ["මධ්‍යම", "மத்திய"], Southern: ["දකුණු", "தென்"],
  Northern: ["උතුරු", "வட"], Eastern: ["නැගෙනහිර", "கிழக்கு"], "North Western": ["වයඹ", "வடமேல்"],
  "North Central": ["උතුරු මැද", "வட மத்திய"], Uva: ["ඌව", "ஊவா"], Sabaragamuwa: ["සබරගමුව", "சப்ரகமுவ"],
  "Sri Lanka": ["ශ්‍රී ලංකාව", "இலங்கை"],
};

const T = {
  tagline: ["Sri Lanka's Earth, read from space", "අභ්‍යවකාශයෙන් කියවන ශ්‍රී ලංකාවේ පොළොව", "விண்வெளியிலிருந்து வாசிக்கப்படும் இலங்கையின் நிலம்"],
  headline: ["So the next storm finds us ready.", "ඊළඟ කුණාටුව පැමිණෙන විට අප සූදානම්ව සිටිමු.", "அடுத்த புயல் வரும்போது நாம் தயாராக இருப்போம்."],
  nino: ["El Niño {y}: {s}, index {v}", "එල් නිනෝ {y}: {s}, දර්ශකය {v}", "எல் நினோ {y}: {s}, குறியீடு {v}"],
  nina: ["La Niña {y}: {s}, index {v}", "ලා නිනා {y}: {s}, දර්ශකය {v}", "லா நினா {y}: {s}, குறியீடு {v}"],
  neutral: ["No El Niño or La Niña under way", "එල් නිනෝ හෝ ලා නිනා තත්ත්වයක් නැත", "எல் நினோ அல்லது லா நினா நிலை இல்லை"],
  "very strong": ["very strong", "ඉතා ප්‍රබල", "மிகவும் வலுவான"],
  strong: ["strong", "ප්‍රබල", "வலுவான"],
  moderate: ["moderate", "මධ්‍යස්ථ", "மிதமான"],
  weak: ["weak", "දුර්වල", "பலவீனமான"],
  latest: ["Latest NASA rain data: {m}", "නවතම NASA වර්ෂාපතන දත්ත: {m}", "சமீபத்திய NASA மழைத் தரவு: {m}"],
  early: ["first {n} days, early estimate", "පළමු දින {n}, මූලික ඇස්තමේන්තුව", "முதல் {n} நாட்கள், ஆரம்ப மதிப்பீடு"],
  lede: ["Right now: {list}. Biome compares each district with what past El Niños and La Niñas did there, using 45 years of NASA Earth data. Tap a district.",
    "මේ මොහොතේ: {list}. Biome, NASA පෘථිවි දත්ත වසර 45ක් භාවිතයෙන්, එක් එක් දිස්ත්‍රික්කය අතීත එල් නිනෝ සහ ලා නිනා කාලවලදී එහි සිදු වූ දේ සමඟ සසඳයි. දිස්ත්‍රික්කයක් තෝරන්න.",
    "இப்போது: {list}. கடந்த எல் நினோ, லா நினா காலங்களில் ஒவ்வொரு மாவட்டத்திலும் நடந்ததை 45 ஆண்டு NASA பூமித் தரவுகளைக் கொண்டு Biome ஒப்பிடுகிறது. ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்."],
  lede_none: ["Every district is within its normal range right now. Tap a district to see its pattern.",
    "මේ මොහොතේ සියලු දිස්ත්‍රික්ක සාමාන්‍ය පරාසයේ පවතී. රටාව බැලීමට දිස්ත්‍රික්කයක් තෝරන්න.",
    "இப்போது எல்லா மாவட்டங்களும் இயல்பான வரம்பில் உள்ளன. அதன் போக்கைக் காண ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்."],
  count: ["{n} on {w}", "{w}: දිස්ත්‍රික්ක {n}", "{w}: {n} மாவட்டங்கள்"],
  choose: ["Or choose a district", "නැතහොත් දිස්ත්‍රික්කයක් තෝරන්න", "அல்லது ஒரு மாவட்டத்தைத் தேர்ந்தெடுக்கவும்"],
  hill: ["Hill country district", "කඳුකර දිස්ත්‍රික්කය", "மலைநாட்டு மாவட்டம்"],
  district: ["District", "දිස්ත්‍රික්කය", "மாவட்டம்"],
  w_DryWatch: ["drought danger", "නියඟ අවදානම", "வறட்சி அபாயம்"],
  w_FloodWatch: ["flood danger", "ගංවතුර අවදානම", "வெள்ள அபாயம்"],
  w_SlopeWatch: ["landslide danger", "නායයෑම් අවදානම", "மண்சரிவு அபாயம்"],
  w_Clear: ["No watch", "අවදානමක් නැත", "அபாயம் இல்லை"],
  r_SlopeWatch: ["Ground wetter than {s}% of past years and rain at {r}% of normal, on hill country.",
    "කඳුකර ප්‍රදේශයක, පස අතීත වසරවලින් {s}%කට වඩා තෙත් අතර වර්ෂාපතනය සාමාන්‍යයෙන් {r}%කි.",
    "மலைப்பகுதியில், மண் கடந்த ஆண்டுகளில் {s}% ஐ விட ஈரமாக உள்ளது, மழை வழக்கத்தின் {r}% ஆக உள்ளது."],
  r_FloodWatch: ["Rain at {r}% of normal on ground wetter than {s}% of past years.",
    "පස අතීත වසරවලින් {s}%කට වඩා තෙත් විට වර්ෂාපතනය සාමාන්‍යයෙන් {r}%කි.",
    "கடந்த ஆண்டுகளில் {s}% ஐ விட ஈரமான மண்ணில் மழை வழக்கத்தின் {r}% ஆக உள்ளது."],
  r_DryWatch: ["Three months of rain at {r3}% of normal, and ground drier than {d}% of past years.",
    "මාස තුනක වර්ෂාපතනය සාමාන්‍යයෙන් {r3}%ක් වන අතර පස අතීත වසරවලින් {d}%කට වඩා වියළිය.",
    "மூன்று மாத மழை வழக்கத்தின் {r3}% ஆக உள்ளது, மண் கடந்த ஆண்டுகளில் {d}% ஐ விட வறண்டுள்ளது."],
  r_Clear: ["Rain and ground wetness are within the normal range for this month.",
    "මෙම මාසයට වර්ෂාපතනය සහ පසෙහි තෙතමනය සාමාන්‍ය පරාසයේ පවතී.",
    "இந்த மாதத்திற்கு மழையும் மண் ஈரப்பதமும் இயல்பான வரம்பில் உள்ளன."],
  next: ["What usually comes next: in past years like this one, the next {n} months here brought {p}% of normal rain.",
    "සාමාන්‍යයෙන් ඊළඟට සිදුවන දේ: මෙවැනි අතීත වසරවලදී, ඊළඟ මාස {n} තුළ මෙහි සාමාන්‍ය වර්ෂාපතනයෙන් {p}%ක් ලැබුණි.",
    "பொதுவாக அடுத்து நடப்பது: இது போன்ற கடந்த ஆண்டுகளில், அடுத்த {n} மாதங்களில் இங்கு வழக்கமான மழையின் {p}% பெய்தது."],
  wet_from_rain: ["Ground wetness is judged from the last 3 months of rain, because NASA's soil data (GLDAS) runs about 3 months behind.", "පසුගිය මාස 3 වර්ෂාපතනය අනුව බිමේ තෙතමනය ගණනය කර ඇත; NASA පස් දත්ත (GLDAS) මාස 3ක් පමණ පසුවී පැමිණේ.", "கடந்த 3 மாத மழையைக் கொண்டு நிலத்தின் ஈரப்பதம் கணிக்கப்பட்டுள்ளது; NASA மண் தரவு (GLDAS) சுமார் 3 மாதங்கள் தாமதமாக வருகிறது."],
  soil_from: ["Soil moisture is from {m}, the latest NASA month.", "පස් තෙතමනය {m} මාසයේ, නවතම NASA දත්තවලිනි.", "மண் ஈரப்பதம் {m}, சமீபத்திய NASA மாதத்திலிருந்து."],
  not_forecast: ["Biome is not a forecast. For warnings, follow the Met Department, NBRO and the DMC.",
    "Biome කාලගුණ අනාවැකියක් නොවේ. අනතුරු ඇඟවීම් සඳහා කාලගුණ විද්‍යා දෙපාර්තමේන්තුව, NBRO සහ ආපදා කළමනාකරණ මධ්‍යස්ථානය අනුගමනය කරන්න.",
    "Biome ஒரு வானிலை முன்னறிவிப்பு அல்ல. எச்சரிக்கைகளுக்கு வளிமண்டலவியல் திணைக்களம், NBRO மற்றும் அனர்த்த முகாமைத்துவ நிலையத்தைப் பின்பற்றவும்."],
  swing_title: ["The swing: rain in years like this one", "වෙනස: මෙවැනි වසරවල වර්ෂාපතනය", "மாற்றம்: இது போன்ற ஆண்டுகளில் மழை"],
  swing_cap: ["Rain as % of normal, January of the event year to June of the next. Grey band: range of past events. Dark line: their average. Amber: {y} so far.",
    "සාමාන්‍යයේ ප්‍රතිශතයක් ලෙස වර්ෂාපතනය, සිදුවීම් වසරේ ජනවාරි සිට ඊළඟ වසරේ ජූනි දක්වා. අළු පටිය: අතීත සිදුවීම්වල පරාසය. තද රේඛාව: ඒවායේ සාමාන්‍යය. තැඹිලි: {y} මෙතෙක්.",
    "வழக்கமான மழையின் சதவீதமாக, நிகழ்வு ஆண்டின் ஜனவரி முதல் அடுத்த ஆண்டின் ஜூன் வரை. சாம்பல் பட்டை: கடந்த நிகழ்வுகளின் வரம்பு. அடர் கோடு: அவற்றின் சராசரி. செம்மஞ்சள்: {y} இதுவரை."],
  t_el_nino: ["Strong El Niño years", "ප්‍රබල එල් නිනෝ වසර", "வலுவான எல் நினோ ஆண்டுகள்"],
  t_la_nina: ["La Niña years", "ලා නිනා වසර", "லா நினா ஆண்டுகள்"],
  soil_title: ["How wet the ground is", "පස කෙතරම් තෙත්ද", "நிலம் எவ்வளவு ஈரமாக உள்ளது"],
  soil_cap: ["Root-zone soil moisture, ranked against the same month in other years (0 = driest, 100 = wettest).",
    "මූල කලාපයේ පස් තෙතමනය, අනෙක් වසරවල එම මාසය සමඟ සසඳා (0 = වියළිම, 100 = තෙත්ම).",
    "வேர் மண்டல மண் ஈரப்பதம், மற்ற ஆண்டுகளின் அதே மாதத்துடன் ஒப்பிட்டு (0 = மிக வறண்டது, 100 = மிக ஈரமானது)."],
  y_rain: ["% of normal rain", "සාමාන්‍ය වර්ෂාපතනයේ %", "வழக்கமான மழையின் %"],
  y_soil: ["soil moisture rank", "පස් තෙතමන ශ්‍රේණිය", "மண் ஈரப்பத தரம்"],
  past_avg: ["past average", "අතීත සාමාන්‍යය", "கடந்த சராசரி"],
  range: ["range", "පරාසය", "வரம்பு"],
  this_year: ["this year", "මෙම වසර", "இந்த ஆண்டு"],
  live_title: ["Reservoirs and rivers, live", "ජලාශ සහ ගංගා, සජීවී", "நீர்த்தேக்கங்களும் ஆறுகளும், நேரலை"],
  live_src: ["From the Irrigation Department, updated {t}.", "වාරිමාර්ග දෙපාර්තමේන්තුවෙන්, යාවත්කාලීන කළේ {t}.", "நீர்ப்பாசனத் திணைக்களத்திலிருந்து, புதுப்பிக்கப்பட்டது {t}."],
  res_none: ["No major reservoir in this district.", "මෙම දිස්ත්‍රික්කයේ ප්‍රධාන ජලාශයක් නොමැත.", "இந்த மாவட்டத்தில் பெரிய நீர்த்தேக்கம் இல்லை."],
  full: ["{p}% full", "{p}% පිරී ඇත", "{p}% நிரம்பியுள்ளது"],
  spilling: ["Spilling, {c} cusecs", "වාන් දමයි, ඝන අඩි/තත්පර {c}", "வான் பாய்கிறது, {c} கன அடி/வினாடி"],
  not_spilling: ["Not spilling", "වාන් නොදමයි", "வான் பாயவில்லை"],
  gauges_none: ["No river gauge in this district.", "මෙම දිස්ත්‍රික්කයේ ගංගා මාපකයක් නොමැත.", "இந்த மாவட்டத்தில் ஆற்று அளவி இல்லை."],
  g_normal: ["Normal", "සාමාන්‍ය", "இயல்பு"],
  g_alert: ["Alert level", "අනතුරු ඇඟවීමේ මට්ටම", "எச்சரிக்கை மட்டம்"],
  "g_minor flood": ["Minor flood", "සුළු ගංවතුර", "சிறு வெள்ளம்"],
  "g_major flood": ["Major flood", "මහා ගංවතුර", "பெரும் வெள்ளம்"],
  level: ["{l} m (alert at {a} m)", "මීටර් {l} (අනතුරු ඇඟවීම මීටර් {a})", "{l} மீ (எச்சரிக்கை {a} மீ)"],
  release: ["Release alert: a reservoir here is spilling and a river gauge is at alert level or above.",
    "ජල මුදාහැරීමේ අනතුරු ඇඟවීම: මෙහි ජලාශයක් වාන් දමන අතර ගංගා මාපකයක් අනතුරු ඇඟවීමේ මට්ටමේ හෝ ඊට ඉහළින් ඇත.",
    "நீர் வெளியேற்ற எச்சரிக்கை: இங்கு ஒரு நீர்த்தேக்கம் வான் பாய்கிறது, ஒரு ஆற்று அளவி எச்சரிக்கை மட்டத்தில் அல்லது அதற்கு மேல் உள்ளது."],
  flood_layer: ["Show the area flooded in Cyclone Ditwah (Nov 2025)", "දිට්වා සුළි කුණාටුවේදී (2025 නොවැම්බර්) ජලයෙන් යට වූ ප්‍රදේශය පෙන්වන්න", "டித்வா சூறாவளியில் (நவம்பர் 2025) வெள்ளம் பாதித்த பகுதியைக் காட்டு"],
  lg_res: ["Reservoir (filled = spilling)", "ජලාශය (පිරවූ = වාන් දමයි)", "நீர்த்தேக்கம் (நிரப்பியது = வான் பாய்கிறது)"],
  lg_gauge: ["River gauge at alert or above", "අනතුරු ඇඟවීමේ මට්ටමේ ගංගා මාපකය", "எச்சரிக்கை மட்டத்திலுள்ள ஆற்று அளவி"],
  lg_flood: ["Flooded in Ditwah", "දිට්වා ගංවතුරෙන් යට වූ", "டித்வாவில் வெள்ளம்"],
  cal_title: ["Risk calendar", "අවදානම් දින දර්ශනය", "அபாய நாட்காட்டி"],
  cal_lede: ["For planners: in how many past years each threat appeared in each month, from {a} to {b}, using NASA data. Use it to plan the year before it starts.",
    "සැලසුම්කරුවන් සඳහා: {a} සිට {b} දක්වා NASA දත්ත අනුව, එක් එක් අවදානම එක් එක් මාසයේ අතීත වසර කීයකදී පැවතියේද. වසර ආරම්භ වීමට පෙර සැලසුම් කිරීමට මෙය භාවිත කරන්න.",
    "திட்டமிடுபவர்களுக்கு: {a} முதல் {b} வரை NASA தரவுகளின்படி, ஒவ்வொரு அபாயமும் ஒவ்வொரு மாதமும் எத்தனை கடந்த ஆண்டுகளில் தோன்றியது. ஆண்டு தொடங்கும் முன் திட்டமிட இதைப் பயன்படுத்துங்கள்."],
  cal_level: ["Area", "ප්‍රදේශය", "பகுதி"],
  cal_type: ["Year type", "වසර වර්ගය", "ஆண்டு வகை"],
  cal_cell: ["{n} of {t} years", "වසර {t} න් {n}", "{t} ஆண்டுகளில் {n}"],
  ty_all: ["All years", "සියලු වසර", "எல்லா ஆண்டுகளும்"],
  ty_after_el_nino: ["Years after a strong El Niño (like 2027)", "ප්‍රබල එල් නිනෝවකට පසු වසර (2027 වැනි)", "வலுவான எல் நினோவுக்குப் பிந்தைய ஆண்டுகள் (2027 போல)"],
  ty_el_nino: ["Strong El Niño years", "ප්‍රබල එල් නිනෝ වසර", "வலுவான எல் நினோ ஆண்டுகள்"],
  ty_la_nina: ["La Niña years", "ලා නිනා වසර", "லா நினா ஆண்டுகள்"],
  ty_neutral: ["Neutral years", "සාමාන්‍ය වසර", "நடுநிலை ஆண்டுகள்"],
  lvl_country: ["Country", "රට", "நாடு"],
  lvl_province: ["Province", "පළාත", "மாகாணம்"],
  lvl_district: ["District", "දිස්ත්‍රික්කය", "மாவட்டம்"],
  how_title: ["How we know", "අපි දන්නේ කෙසේද", "நாம் எப்படி அறிவோம்"],
  how_note: ["Technical details below are in English.", "පහත තාක්ෂණික විස්තර ඉංග්‍රීසියෙනි.", "கீழே உள்ள தொழில்நுட்ப விவரங்கள் ஆங்கிலத்தில் உள்ளன."],
  story_title: ["Biome Story: {d}", "Biome කතාව: {d}", "Biome கதை: {d}"],
  story_swing: ["In {n} strong El Niños since {y}, {d} received {a}% of its normal rain from May to September, then {b}% from October to December.",
    "{y} සිට ප්‍රබල එල් නිනෝ {n}ක දී, {d} මැයි සිට සැප්තැම්බර් දක්වා සාමාන්‍ය වර්ෂාපතනයෙන් {a}%ක් ද, ඔක්තෝබර් සිට දෙසැම්බර් දක්වා {b}%ක් ද ලැබීය.",
    "{y} முதல் {n} வலுவான எல் நினோக்களில், {d} மே முதல் செப்டம்பர் வரை வழக்கமான மழையின் {a}% ஐயும், அக்டோபர் முதல் டிசம்பர் வரை {b}% ஐயும் பெற்றது."],
  story_sofar: ["{m} so far ({n} days) is on pace for {p}% of a normal month.",
    "{m} මෙතෙක් (දින {n}) සාමාන්‍ය මාසයකින් {p}%ක් දක්වා ගමන් කරයි.",
    "{m} இதுவரை ({n} நாட்கள்) வழக்கமான மாதத்தின் {p}% நோக்கிச் செல்கிறது."],
  story_trend_yes: ["Over 2001 to 2025, rain here changed by {p}% per decade, a trend unlikely to be chance.",
    "2001 සිට 2025 දක්වා, මෙහි වර්ෂාපතනය දශකයකට {p}%කින් වෙනස් විය; මෙය අහම්බයක් විය නොහැකි ප්‍රවණතාවකි.",
    "2001 முதல் 2025 வரை, இங்கு மழை பத்தாண்டுக்கு {p}% மாறியது; இது தற்செயலாக இருக்க வாய்ப்பில்லாத போக்கு."],
  story_trend_no: ["Over 2001 to 2025, rain here shows no trend that stands out from natural ups and downs.",
    "2001 සිට 2025 දක්වා, මෙහි වර්ෂාපතනයේ ස්වාභාවික උච්චාවචනවලින් කැපී පෙනෙන ප්‍රවණතාවක් නැත.",
    "2001 முதல் 2025 வரை, இங்கு மழையில் இயற்கையான ஏற்ற இறக்கங்களிலிருந்து தனித்து நிற்கும் போக்கு இல்லை."],
  f_sw: ["May to Sep in strong El Niños", "ප්‍රබල එල් නිනෝ කාලවල මැයි–සැප්තැම්බර්", "வலுவான எல் நினோ காலங்களில் மே–செப்டம்பர்"],
  f_ond: ["Oct to Dec in strong El Niños", "ප්‍රබල එල් නිනෝ කාලවල ඔක්තෝබර්–දෙසැම්බර්", "வலுவான எல் நினோ காலங்களில் அக்டோபர்–டிசம்பர்"],
  f_of_normal: ["{p}% of normal rain", "සාමාන්‍ය වර්ෂාපතනයෙන් {p}%", "வழக்கமான மழையின் {p}%"],
  f_not_chance: ["Unlikely to be chance (p = {p})", "අහම්බයක් විය නොහැක (p = {p})", "தற்செயலாக இருக்க வாய்ப்பில்லை (p = {p})"],
  f_chance: ["Could be chance (p = {p})", "අහම්බයක් විය හැක (p = {p})", "தற்செயலாக இருக்கலாம் (p = {p})"],
  f_trend: ["Rain trend, 2001 to 2025", "වර්ෂාපතන ප්‍රවණතාව, 2001–2025", "மழைப் போக்கு, 2001–2025"],
  f_per_decade: ["{p}% per decade", "දශකයකට {p}%", "பத்தாண்டுக்கு {p}%"],
  f_sig: ["Statistically significant", "සංඛ්‍යානමය වශයෙන් වැදගත්", "புள்ளியியல் ரீதியாக முக்கியமானது"],
  f_notsig: ["Not statistically significant (p = {p})", "සංඛ්‍යානමය වශයෙන් වැදගත් නොවේ (p = {p})", "புள்ளியியல் ரீதியாக முக்கியமற்றது (p = {p})"],
  foot: ["Biome is a NASA Space Apps Challenge 2026 project (Kandy). It shows patterns in past records and is not a weather forecast: for warnings, follow the Department of Meteorology, NBRO and the Disaster Management Centre.",
    "Biome යනු NASA Space Apps Challenge 2026 (මහනුවර) ව්‍යාපෘතියකි. එය අතීත වාර්තාවල රටා පෙන්වයි, කාලගුණ අනාවැකියක් නොවේ: අනතුරු ඇඟවීම් සඳහා කාලගුණ විද්‍යා දෙපාර්තමේන්තුව, NBRO සහ ආපදා කළමනාකරණ මධ්‍යස්ථානය අනුගමනය කරන්න.",
    "Biome என்பது NASA Space Apps Challenge 2026 (கண்டி) திட்டமாகும். இது கடந்த பதிவுகளின் போக்குகளைக் காட்டுகிறது, வானிலை முன்னறிவிப்பு அல்ல: எச்சரிக்கைகளுக்கு வளிமண்டலவியல் திணைக்களம், NBRO மற்றும் அனர்த்த முகாமைத்துவ நிலையத்தைப் பின்பற்றவும்."],
};
Object.assign(T, S);

let lang = "en";
try { lang = localStorage.getItem("biome-lang") || "en"; } catch { /* storage blocked */ }
if (!LANGS[lang]) lang = "en";

export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  try { localStorage.setItem("biome-lang", l); } catch { /* storage blocked */ }
}
const idx = () => ({ en: 0, si: 1, ta: 2 }[lang]);

export function t(key, vars = {}) {
  const row = T[key];
  let s = row ? row[idx()] ?? row[0] : key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
export const dName = (n) => (lang === "en" ? n : (DISTRICTS[n] || [n, n])[idx() - 1]);
export const pName = (n) => (lang === "en" ? n : (PROVINCES[n] || [n, n])[idx() - 1]);
// Our own month names: many browsers ship no Sinhala or Tamil date data.
const MONTHS = {
  si: ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"],
  ta: ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
};
export function monthName(ym, short = false) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  if (MONTHS[lang]) {
    const n = MONTHS[lang][m - 1];
    return short ? n.slice(0, lang === "ta" ? 4 : 3) : `${n} ${y}`;
  }
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(LOCALE[lang], { month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }), timeZone: "UTC" });
}
