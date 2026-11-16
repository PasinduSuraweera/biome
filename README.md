<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/public/logo-on-dark.png">
    <img src="web/public/logo.png" alt="Biome" width="320">
  </picture>
</p>

# Biome: Sri Lanka's Earth, read from space

NASA Space Apps Challenge 2026 · Kandy · Challenge: **Be An Earth System Trend Detective!**

Live site: https://biome-rosy.vercel.app/ (classic version: https://biome-rosy.vercel.app/classic/; also on GitHub Pages at https://pasindusuraweera.github.io/biome/)

In Sri Lanka, hazards arrive in sequence. A dry spell drains reservoirs and stresses crops, then the rain falls on parched fields, swollen rivers and soaked slopes. The same family can queue for trucked water in August and flee a flood in December. Biome turns free NASA Earth data into warnings each district, town and family can act on, in English, Sinhala and Tamil.

So the next storm finds us ready.

## What Biome does

| Feature | What a person gets | NASA data behind it |
| --- | --- | --- |
| **Watches** | DryWatch, FloodWatch or SlopeWatch for each of the 25 districts, from this month's rain and how wet the ground already is | GPM IMERG, GLDAS |
| **Daily risk levels** | Yellow, Amber or Red for each district and each of 330 Divisional Secretariat divisions, from the last day's rain against NBRO's 75, 100 and 150 mm steps, refreshed every 3 hours | GPM IMERG Early and Late (daily), NASADEM |
| **12-month outlook** | The chance of a drier or wetter month, and of each Watch, for every month of the coming year | 46 years of MERRA-2 and GPM IMERG, NOAA ONI |
| **Risk calendar** | The same chances for a district, province or the country, with a CSV download for planners | as above |
| **Safer places to go** | About 15,000 schools, places of worship and halls checked for steep ground and past flooding, with a map and a top five per district and division | NASADEM (SRTM) 30 m |
| **Plain-language views** | Families, Farmers and Coast pages with what to do now and a report to download as a picture or PDF | all of the above, MODIS NDVI for farmers |
| **Ask Biome** | Three plain questions on every report ("Is it safe at home today?", "Should I plant now?", "Is flooding likely here now?"), each answered from the levels and the outlook | GPM IMERG, MERRA-2, NASADEM |
| **Planting this season** | For farmers: the chance of a drier or wetter Maha and Yala season, the month drought danger peaks, and what to do about it | GPM IMERG, MERRA-2, NOAA ONI |
| **Through the years** | Every Maha and Yala season since 1980 for the district, with what followed past strong El Niños | MERRA-2, GPM IMERG |
| **Alerts** | A Telegram message in the person's language when their district reaches the level they chose | GPM IMERG Early and Late (daily) |
| **Seen by NASA** | Real satellite pictures of Cyclone Ditwah, its rain, the flood water after it and this week's weather, plus each district's greenness in September 2025 and September 2026, each linked to NASA Worldview | VIIRS, MODIS and IMERG through NASA GIBS |
| **Live ground data** | 74 reservoirs and 40 river gauges, refreshed every 3 hours | Irrigation Department (not NASA) |

Biome is not a weather forecast and not an official warning. For warnings, follow the Department of Meteorology, NBRO and the Disaster Management Centre (call 117).

## Data

| What | Dataset | Notes |
| --- | --- | --- |
| Rain, monthly | NASA GPM IMERG Final V07 (GPM_3IMERGM) | 0.1°, June 2000 to September 2025 |
| Rain, daily | NASA GPM IMERG Early V07 (GPM_3IMERGDE) and Late V07 (GPM_3IMERGDL) | 0.1°; Early gives the newest days about 4 hours after each day ends, Late replaces it about 14 hours after and fills the months after Final ends |
| Soil moisture | NASA GLDAS Noah V2.1 (GLDAS_NOAH025_M), root zone | 0.25°, 2000 onward, about 3 months behind |
| Older years | NASA MERRA-2 M2TMNXFLX (rain) and M2TMNXLND (soil wetness) | 1980 to 2010 |
| Vegetation | NASA MODIS Terra MOD13A3 v061 NDVI, through AppEEARS | 1 km, 2000 onward |
| Terrain | NASA NASADEM_HGT v001 (Shuttle Radar Topography Mission) | 30 m |
| Pictures | NASA GIBS / Worldview: VIIRS and MODIS true colour, IMERG precipitation rate, VIIRS flood map | fetched by date and bounding box |
| El Niño and La Niña | NOAA CPC Oceanic Niño Index | official NOAA definition |
| Rain gauges | NOAA GHCN-Daily stations in Sri Lanka | validation only |
| Reservoirs, rivers, 2025 flood extent | Sri Lanka Irrigation Department public feeds | shown as published |
| Buildings | OpenStreetMap contributors (ODbL) | schools, places of worship, halls |
| Boundaries | geoBoundaries LKA ADM2 (districts) and ADM3 (divisions) | CC BY 4.0 |

## Method

1. **District and division averages.** Every grid cell is weighted by the share of it inside the district or division (`districts.py`).
2. **Normals.** Rain as % of the 2001 to 2025 normal for that calendar month (1981 to 2010 for MERRA-2); ground wetness as a rank against the same month in other years.
3. **Watches.** DryWatch: 3-month rain at or below 75% of normal and ground in the driest 25%. FloodWatch: rain at or above 150% on ground in the wettest 25%. SlopeWatch: rain at or above 130% on ground in the wettest 25%, in hill country. GLDAS runs about 3 months behind, so for recent months ground wetness is the rank of the last 3 months of rain.
4. **Hill country, measured.** A district or division is hill country when 10% or more of its land is steeper than 15° in NASADEM (`fetch_dem.py`).
5. **Daily risk levels.** Yellow at 75 mm in the last day or when a Watch is on; Amber at 100 mm, or 75 mm on soaked ground; Red at 150 mm, or 100 mm on soaked ground. NASA's Early rain arrives about 4 hours after the day ends and is replaced by Late about 14 hours after, so a level describes the last full day. **Outlook model** (`forecast.py`). A weighted analog ensemble: every year since 1980 is one possible future (the rain that really fell over the following 12 months), weighted by how close its ocean state (NOAA ONI) was to today's with a Gaussian kernel whose width is chosen by cross-validation. The Watch rules run on every member; the weighted share on a Watch is the chance in the calendar.
7. **Honest skill.** Each past year is left out and forecast from the others, and scored with the ranked probability skill score against equal odds. Months without skill are shown as "no clear signal" instead of a number.
8. **Safer places.** A building is marked safer when it did not flood in Cyclone Ditwah and has no slope of 20° or more within 90 m. Ranking: schools and halls first, then height above the lowest ground within 500 m. They are candidates for officers to confirm, not an official list.
9. **Trend and significance.** Seasonal Mann-Kendall with Sen's slope and Benjamini-Hochberg correction; El Niño seasons against 5,000 random sets of years.

## What the tests show

- **This week (8 to 11 November 2026):** all 7 districts on SlopeWatch were under NBRO landslide warnings.
- **Cyclone Ditwah, replayed day by day:** Kandy was on SlopeWatch in October 2025. From the rain of 26 November 2025, Kandy and Nuwara Eliya go Red and six more districts go Amber.
- **Outlook model:** in strong El Niño years (1982, 1987, 1997, 2015, 2023) it picked the right category about 6 times in 10 for December to April; guessing gets 3. Over all years it has little skill, and says so.
- **Rain gauges:** satellite rain matches NOAA stations with r of 0.85 to 0.95 at 4 of 5 stations (0.51 at Nuwara Eliya).
- **Past disasters at monthly scale:** 2 of 3 caught; the Ratnapura 2017 floods, which came from one extreme day, were missed. That is why daily levels were added.

## Next

- **The coastline:** sea-level rise and shoreline change for the 14 coastal districts, from NASA's SWOT and Landsat satellites, on the Coast page.
- **Checked with the people who warn today:** take the Watches, levels and safer places to NBRO and the Disaster Management Centre, starting from SLIIT Kandy UNI with the Kandy district, and have Grama Niladharis confirm the safer places on the ground.

## Limits

- Daily levels lag the rain by about 4 hours (NASA IMERG Early), and Early is a little rougher than the Late estimate that replaces it. They are a nowcast, not a forecast.
- The outlook only has skill in strong El Niño or La Niña years, and only for some months. Five strong El Niño years is a small sample.
- Town level uses rain on squares of about 10 km. The seasonal Watch and the outlook stay at district level because the long records are coarser than a town.
- Safer places come from OpenStreetMap and a 30 m height map. Nobody has checked them on the ground yet.
- The Sinhala and Tamil text must be checked by native speakers.

## How it runs

Everything is refreshed by GitHub Actions; no server is needed.

| Workflow | When | What |
| --- | --- | --- |
| `data.yml` | daily | NASA rain, soil and history; analysis; outlook model; alerts |
| `live.yml` | every 3 hours | reservoirs, river gauges, ocean index; NASA IMERG Early rain and the daily levels; alerts and new sign-ups |
| `nasa-images.yml` | daily | NASA pictures, division boundaries, terrain and safer places |
| `modis.yml` | weekly | MODIS greenness through AppEEARS |
| `pages.yml` | on change and after each data run | builds and publishes the GitHub Pages copy |
| Vercel | every push to main | builds `scripts/vercel-build.sh`: the dashboard at `/`, the classic app at `/classic/` |

Repository secrets: `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD` (free NASA Earthdata Login) and, for alerts, `TELEGRAM_BOT_TOKEN`. People who register are kept in a private Actions cache, never in the repository; only the chat id, district, language and level are stored.

## Run it yourself

```bash
# 1. data (needs a free NASA Earthdata Login in ~/.netrc or the two environment variables)
cd pipeline
pip install -r requirements.txt
python fetch_ground.py            # ocean index and rain gauges, no login
python fetch_irrigation.py        # reservoirs, rivers and the 2025 flood extent, no login
python fetch_nasa.py all          # IMERG, GLDAS, MERRA-2 (streams only the Sri Lanka box)
python fetch_towns.py             # division boundaries
python fetch_nasa.py imerg_late_towns
python fetch_places.py            # schools, places of worship and halls from OpenStreetMap
python fetch_dem.py               # NASA elevation: hill country and safer places
python fetch_nasa_images.py       # NASA pictures, no login
python fetch_modis.py submit      # MODIS NDVI through AppEEARS; later: status, then get
python analysis.py                # writes web/public/data/biome.json

# 2. web app
cd ../web
npm install
npm run dev                       # or: npm run build
```

## Use of AI

The concept, problem framing and pitch for Biome are the team's own. Code in this repository was written with help from Anthropic's Claude (an AI assistant), under the team's direction; the team reviewed it and checked results against NASA tools, NBRO warnings and ground stations. The Sinhala and Tamil text was drafted with the same assistant and still needs a check by native speakers. No AI-generated images, video or audio are used: every picture on the site is a NASA satellite image or is drawn from NASA data.

## License

MIT. Data remains under its providers' terms; no NASA endorsement is implied.
