"""Short videos of real NASA data over Sri Lanka, for the website.

    python make_videos.py

Builds two silent loops from NASA GIBS (the service behind NASA Worldview):
  ditwah-rain.mp4    NASA GPM IMERG rain, every hour, 24 to 30 November 2025
  ditwah-clouds.mp4  VIIRS true colour from three satellites, 21 to 30 November 2025
Each frame carries its date (Sri Lanka time) and the NASA source. Needs ffmpeg.
"""
import io
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "nasa" / "video"
WIDE = (72.0, 0.0, 92.0, 16.0)
SL = timezone(timedelta(hours=5, minutes=30))


def frame(layers, when, width=960):
    for attempt in range(3):
        try:
            return _frame(layers, when, width)
        except requests.RequestException as e:
            print("  retry", when, e.__class__.__name__)
    return None


def _frame(layers, when, width):
    h = round(width * (WIDE[3] - WIDE[1]) / (WIDE[2] - WIDE[0]))
    r = requests.get(WMS, timeout=90, params={
        "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap", "LAYERS": ",".join(layers), "STYLES": "",
        "FORMAT": "image/jpeg", "SRS": "EPSG:4326", "BBOX": ",".join(map(str, WIDE)), "WIDTH": width, "HEIGHT": h, "TIME": when})
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image") or len(r.content) < 20_000:
        return None
    return Image.open(io.BytesIO(r.content)).convert("RGB")


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def label(img, top, bottom):
    d = ImageDraw.Draw(img)
    big, small = font(30), font(18)
    d.rounded_rectangle([18, 18, 30 + d.textlength(top, font=big), 66], 8, fill=(16, 35, 42))
    d.text((24, 24), top, font=big, fill=(243, 239, 230))
    w = d.textlength(bottom, font=small)
    d.text((img.width - w - 18, img.height - 34), bottom, font=small, fill=(243, 239, 230), stroke_width=2, stroke_fill=(16, 35, 42))
    return img


def encode(frames, name, fps, crf=26):
    with tempfile.TemporaryDirectory() as tmp:
        for i, im in enumerate(frames):
            im.save(f"{tmp}/{i:04d}.jpg", quality=90)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", f"{tmp}/%04d.jpg",
                        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / f"{name}.mp4")], check=True)
    frames[len(frames) // 2].save(OUT / f"{name}.jpg", quality=85)
    print(f"{name}: {len(frames)} frames, {(OUT / f'{name}.mp4').stat().st_size // 1024} KB")


def fetch_all(jobs):
    """jobs: list of (layers, when, top, bottom); returns labelled frames in order, skipping failures"""
    with ThreadPoolExecutor(8) as ex:
        ims = list(ex.map(lambda j: frame(j[0], j[1]), jobs))
    return [label(im, j[2], j[3]) for im, j in zip(ims, jobs) if im]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs, t = [], datetime(2025, 11, 24, tzinfo=timezone.utc)
    while t < datetime(2025, 11, 30, tzinfo=timezone.utc):
        jobs.append((["BlueMarble_ShadedRelief_Bathymetry", "IMERG_Precipitation_Rate", "Coastlines_15m"], t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                     t.astimezone(SL).strftime("%d %b %Y, %H:%M"), "Rain · NASA GPM IMERG · Worldview"))
        t += timedelta(hours=1)
    rain = fetch_all(jobs)
    if len(rain) > 20:
        encode(rain, "ditwah-rain", 12)
    jobs, d = [], datetime(2025, 11, 21)
    while d <= datetime(2025, 11, 30):
        for sat, layer in (("NOAA-21", "VIIRS_NOAA21_CorrectedReflectance_TrueColor"), ("Suomi NPP", "VIIRS_SNPP_CorrectedReflectance_TrueColor"),
                           ("NOAA-20", "VIIRS_NOAA20_CorrectedReflectance_TrueColor")):
            jobs.append(([layer, "Coastlines_15m"], d.strftime("%Y-%m-%d"), d.strftime("%d %b %Y"), f"VIIRS {sat} · NASA Worldview"))
        d += timedelta(days=1)
    clouds = fetch_all(jobs)
    if len(clouds) > 8:
        encode(clouds, "ditwah-clouds", 3, crf=33)


if __name__ == "__main__":
    main()
