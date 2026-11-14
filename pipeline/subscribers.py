"""Risk-level alerts for people who register, through a Telegram bot.

    python subscribers.py sync                       # read new sign-ups, confirm them
    python subscribers.py send ../web/public/data/biome.json   # alert people whose district reached their level

Sign-up needs no account on Biome: the site builds a link such as
https://t.me/<bot>?start=kandy-si-2 (district, language, level). Opening it and
pressing Start registers that chat. /stop removes it.

Only four things are kept per person: the Telegram chat id, district, language
and chosen level. They live in data/private/subscribers.json, which is never
committed (the workflow keeps it in its private cache).

Needs TELEGRAM_BOT_TOKEN. Without it both commands only print what they would do.
Biome's alerts are heads-ups from NASA satellite rain, never official orders:
every message points to DMC and NBRO.
"""
import json
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "data" / "private" / "subscribers.json"
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
SITE = os.environ.get("BIOME_SITE_URL") or "https://pasindusuraweera.github.io/biome/"
LANGS = ("en", "si", "ta")

T = {
    "level": {
        "en": {1: "Level 1, Yellow: be aware", 2: "Level 2, Amber: be ready", 3: "Level 3, Red: act now"},
        "si": {1: "1 මට්ටම, කහ: අවධානයෙන් සිටින්න", 2: "2 මට්ටම, ඇම්බර්: සූදානම්ව සිටින්න", 3: "3 මට්ටම, රතු: දැන්ම ක්‍රියා කරන්න"},
        "ta": {1: "நிலை 1, மஞ்சள்: விழிப்புடன் இருங்கள்", 2: "நிலை 2, செம்மஞ்சள்: தயாராக இருங்கள்", 3: "நிலை 3, சிவப்பு: உடனே செயல்படுங்கள்"},
    },
    "hazard": {
        "en": {"landslide": "landslide danger", "flood": "flood danger", "drought": "drought"},
        "si": {"landslide": "නායයෑම් අවදානම", "flood": "ගංවතුර අවදානම", "drought": "නියඟය"},
        "ta": {"landslide": "மண்சரிவு அபாயம்", "flood": "வெள்ள அபாயம்", "drought": "வறட்சி"},
    },
    "rain": {
        "en": "NASA satellites measured {r1} mm of rain in the last day and {r3} mm in three days.",
        "si": "NASA චන්ද්‍රිකා පසුගිය දිනයේ මි.මී. {r1}ක් සහ දින තුනක් තුළ මි.මී. {r3}ක වැසි මැන ඇත.",
        "ta": "NASA செயற்கைக்கோள்கள் கடந்த நாளில் {r1} மி.மீ., மூன்று நாட்களில் {r3} மி.மீ. மழையை அளவிட்டுள்ளன.",
    },
    "do": {
        "en": {1: "Stay alert and keep your phone charged.", 2: "Pack documents and medicine. Know the way to your safe place.",
               3: "Go to your safe place now. Do not wait."},
        "si": {1: "අවධානයෙන් සිටින්න. දුරකථනය ආරෝපණය කර තබාගන්න.", 2: "ලියකියවිලි සහ බෙහෙත් සූදානම් කරගන්න. ආරක්ෂිත ස්ථානයට යන මාර්ගය දැනගන්න.",
               3: "දැන්ම ආරක්ෂිත ස්ථානයට යන්න. බලා නොසිටින්න."},
        "ta": {1: "விழிப்புடன் இருங்கள். கைபேசியை சார்ஜ் செய்து வையுங்கள்.", 2: "ஆவணங்களையும் மருந்துகளையும் எடுத்து வையுங்கள். பாதுகாப்பான இடத்துக்குச் செல்லும் வழியை அறிந்து கொள்ளுங்கள்.",
               3: "இப்போதே பாதுகாப்பான இடத்துக்குச் செல்லுங்கள். காத்திருக்க வேண்டாம்."},
    },
    "safe": {"en": "Safer places", "si": "ආරක්ෂිත ස්ථාන", "ta": "பாதுகாப்பான இடங்கள்"},
    "official": {
        "en": "This is a heads-up from NASA satellite data, not an official order. Follow DMC (call 117) and NBRO.",
        "si": "මෙය NASA චන්ද්‍රිකා දත්ත මත පදනම් වූ පූර්ව දැනුම්දීමකි, නිල නියෝගයක් නොවේ. DMC (117 අමතන්න) සහ NBRO අනුගමනය කරන්න.",
        "ta": "இது NASA செயற்கைக்கோள் தரவிலிருந்து ஒரு முன்னறிவிப்பு, அதிகாரப்பூர்வ உத்தரவு அல்ல. DMC (117 ஐ அழையுங்கள்), NBRO ஆகியவற்றைப் பின்பற்றுங்கள்.",
    },
    "clear": {
        "en": "Biome: {d} is back below your alert level.",
        "si": "Biome: {d} දැන් ඔබ තෝරාගත් අවදානම් මට්ටමට වඩා පහළින් පවතී.",
        "ta": "Biome: {d} இப்போது நீங்கள் தேர்ந்தெடுத்த எச்சரிக்கை நிலைக்குக் கீழே உள்ளது.",
    },
    "welcome": {
        "en": "You are registered for Biome alerts for {d}, from {lvl} upward. Send /stop to leave.",
        "si": "{d} සඳහා Biome අනතුරු ඇඟවීම් සඳහා ඔබ ලියාපදිංචි වී ඇත ({lvl} සිට ඉහළට). ඉවත් වීමට /stop යවන්න.",
        "ta": "{d} க்கான Biome எச்சரிக்கைகளுக்கு நீங்கள் பதிவு செய்யப்பட்டுள்ளீர்கள் ({lvl} முதல் மேல்நோக்கி). விலக /stop அனுப்புங்கள்.",
    },
    "stopped": {"en": "You will get no more Biome alerts.", "si": "ඔබට තවදුරටත් Biome අනතුරු ඇඟවීම් නොලැබේ.",
                "ta": "இனி உங்களுக்கு Biome எச்சரிக்கைகள் வராது."},
    "help": {"en": "To register, choose your district and level on {site} and press the Telegram button there.",
             "si": "ලියාපදිංචි වීමට {site} හි ඔබේ දිස්ත්‍රික්කය සහ මට්ටම තෝරා එහි ඇති Telegram බොත්තම ඔබන්න.",
             "ta": "பதிவு செய்ய {site} இல் உங்கள் மாவட்டத்தையும் நிலையையும் தேர்ந்தெடுத்து அங்குள்ள Telegram பொத்தானை அழுத்துங்கள்."},
}


def district_names():
    """{slug: (English, Sinhala, Tamil)} from the app's own word list."""
    import re
    src = (ROOT / "web" / "src" / "i18n.js").read_text(encoding="utf-8")
    block = src[src.index("export const DISTRICTS"):src.index("export const PROVINCES")]
    out = {}
    for m in re.finditer(r'"?([A-Z][A-Za-z ]+)"?: \["([^"]+)", "([^"]+)"\]', block):
        out[m.group(1).lower().replace(" ", "-")] = (m.group(1), m.group(2), m.group(3))
    return out


def api(method, **params):
    if not TOKEN:
        print(f"[no token] {method} {json.dumps(params, ensure_ascii=False)[:300]}")
        return {"ok": True, "result": []}
    r = requests.post(f"https://api.telegram.org/bot{TOKEN}/{method}", data=params, timeout=40)
    res = r.json()
    if not res.get("ok"):  # say why, without printing the token
        print(f"Telegram {method} failed: {res.get('error_code')} {res.get('description')}")
    return res


def load():
    if STORE.exists():
        return json.loads(STORE.read_text())
    return {"offset": 0, "people": {}}


def save(state):
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(state, ensure_ascii=False, indent=1))


def alert_text(lang, name, lv, safe=None, link=""):
    """The message one person gets. `lv` is the district's level block from biome.json."""
    n = lv["level"]
    lines = [f"Biome · {name}", f"{T['level'][lang][n]} ({T['hazard'][lang][lv['hazard']]})"]
    if lv.get("rain_1d") is not None:
        lines.append(T["rain"][lang].format(r1=round(lv["rain_1d"]), r3=round(lv["rain_3d"])))
    lines.append(T["do"][lang][n])
    if safe and n >= 2:
        lines.append(f"{T['safe'][lang]}: " + "; ".join(c[3] for c in safe[:3]))
    lines.append(T["official"][lang])
    if link:
        lines.append(link)
    return "\n".join(lines)


def sync():
    state, names = load(), district_names()
    res = api("getUpdates", offset=state["offset"], timeout=0, allowed_updates='["message"]')
    for u in res.get("result", []):
        state["offset"] = u["update_id"] + 1
        msg = u.get("message") or {}
        chat, text = str(msg.get("chat", {}).get("id", "")), (msg.get("text") or "").strip()
        if not chat:
            continue
        lang = state["people"].get(chat, {}).get("lang", "en")
        if text.startswith("/stop"):
            state["people"].pop(chat, None)
            api("sendMessage", chat_id=chat, text=T["stopped"][lang])
            continue
        parts = text.split(maxsplit=1)[1].rsplit("-", 2) if text.startswith("/start ") else []
        if len(parts) == 3 and parts[0] in names and parts[1] in LANGS and parts[2] in "123":
            slug, lang, level = parts[0], parts[1], int(parts[2])
            state["people"][chat] = {"district": names[slug][0], "lang": lang, "level": level, "sent": 0}
            api("sendMessage", chat_id=chat,
                text=T["welcome"][lang].format(d=names[slug][LANGS.index(lang)], lvl=T["level"][lang][level]))
        else:
            api("sendMessage", chat_id=chat, text=T["help"][lang].format(site=SITE))
    save(state)
    print(f"{len(state['people'])} registered")


def send(biome_path):
    state, names = load(), district_names()
    data = json.loads(Path(biome_path).read_text(encoding="utf-8"))
    safe_file = Path(biome_path).parent / "safe_centres.json"
    safe = json.loads(safe_file.read_text(encoding="utf-8"))["districts"] if safe_file.exists() else {}
    sent = 0
    for chat, p in state["people"].items():
        lv = (data["districts"].get(p["district"]) or {}).get("level") or {"level": 0}
        slug = p["district"].lower().replace(" ", "-")
        name = names.get(slug, (p["district"],) * 3)[LANGS.index(p["lang"])]
        if lv["level"] >= p["level"] and lv["level"] > p.get("sent", 0):
            api("sendMessage", chat_id=chat,
                text=alert_text(p["lang"], name, lv, safe.get(p["district"], {}).get("top"), f"{SITE}#family/{slug}"))
            sent += 1
        elif lv["level"] < p["level"] <= p.get("sent", 0):
            api("sendMessage", chat_id=chat, text=T["clear"][p["lang"]].format(d=name))
        p["sent"] = lv["level"]
    save(state)
    print(f"{sent} alerts sent to {len(state['people'])} registered")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "sync":
        sync()
    elif len(sys.argv) > 2 and sys.argv[1] == "send":
        send(sys.argv[2])
    else:
        print(__doc__)
