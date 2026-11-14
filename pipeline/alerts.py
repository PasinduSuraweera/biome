"""Send a message when a district moves up a Watch level, in all three languages.

    python alerts.py previous_biome.json web/public/data/biome.json

Run after analysis.py. Compares the new Watch flags with the previous run and
posts one message per escalated district to a Telegram channel that officers
and residents can join. Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (the
channel) as environment variables; without them it only prints the messages.

Biome's alerts are heads-ups about a district's swing, never evacuation orders:
every message points to the official DMC and NBRO warnings.
"""
import json
import os
import sys

import requests

LEVEL = {"Clear": 0, "DryWatch": 1, "FloodWatch": 2, "SlopeWatch": 3}
NAMES = {
    "DryWatch": ("drought danger", "නියඟ අවදානම", "வறட்சி அபாயம்"),
    "FloodWatch": ("flood danger", "ගංවතුර අවදානම", "வெள்ள அபாயம்"),
    "SlopeWatch": ("landslide danger", "නායයෑම් අවදානම", "மண்சரிவு அபாயம்"),
}
SITE = os.environ.get("BIOME_SITE_URL", "")


def message(district, names, watch, reason):
    en, si, ta = NAMES[watch]
    link = f"\n{SITE}#{district.lower().replace(' ', '-')}" if SITE else ""
    return (f"Biome: {district} is now on {watch} ({en}). {reason}. Follow DMC and NBRO warnings.\n\n"
            f"Biome: {names[0]} දැන් {watch} ({si}) මට්ටමේ ඇත. නිල අනතුරු ඇඟවීම් සඳහා DMC සහ NBRO අනුගමනය කරන්න.\n\n"
            f"Biome: {names[1]} இப்போது {watch} ({ta}) நிலையில் உள்ளது. அதிகாரப்பூர்வ எச்சரிக்கைகளுக்கு DMC மற்றும் NBRO ஐப் பின்பற்றவும்."
            f"{link}")


def main(prev_path, new_path):
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "web", "src"))
    names = {}
    try:  # district names in Sinhala and Tamil, from the app's own word list
        import re
        src = open(os.path.join(os.path.dirname(__file__), "..", "web", "src", "i18n.js"), encoding="utf-8").read()
        for m in re.finditer(r'"?([A-Z][A-Za-z ]+)"?: \["([^"]+)", "([^"]+)"\]', src):
            names[m.group(1)] = (m.group(2), m.group(3))
    except OSError:
        pass
    new = json.load(open(new_path, encoding="utf-8"))["districts"]
    try:
        old = json.load(open(prev_path, encoding="utf-8"))["districts"]
    except (OSError, ValueError, KeyError):
        old = {}
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    sent = 0
    for d, v in new.items():
        before = old.get(d, {}).get("watch", "Clear")
        if LEVEL.get(v["watch"], 0) > LEVEL.get(before, 0):
            text = message(d, names.get(d, (d, d)), v["watch"], v.get("reason", ""))
            print(text, "\n---")
            if token and chat:
                requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                              data={"chat_id": chat, "text": text}, timeout=30).raise_for_status()
                sent += 1
    print(f"{sent} alerts sent")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
