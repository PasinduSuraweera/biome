# Biome: Sri Lanka's Earth, read from space

NASA Space Apps Challenge 2026 · Kandy · Challenge: **Be An Earth System Trend Detective!**

In Sri Lanka, hazards arrive in sequence: a dry spell drains reservoirs and stresses crops, then the rains hit parched fields, swollen rivers and soaked slopes. Biome reads NASA Earth data to show each of the 25 districts how its land swings between drought, flood and landslide danger in strong El Niño years, and where this year stands.

- **DryWatch:** rain deficit, dry soil and stressed vegetation
- **FloodWatch:** well above normal rain on already saturated ground
- **SlopeWatch:** soaked ground plus heavy rain in hill country districts
- **Biome Stories:** each district's pattern in plain words

Biome is not a weather forecast. It compares this year with what past strong El Niños did in each district. For warnings, follow the Department of Meteorology, NBRO and the Disaster Management Centre.

## Data

| What | Dataset | Notes |
| --- | --- | --- |
| Rain | NASA GPM IMERG Final monthly V07 (GPM_3IMERGM), IMERG Late daily (GPM_3IMERGDL) for recent months | 0.1°, June 2000 onward |
| Soil moisture | NASA GLDAS Noah monthly V2.1 (GLDAS_NOAH025_M), root zone | 0.25°, 2000 onward |
| Vegetation | NASA MODIS Terra MOD13A3 v061 NDVI via AppEEARS | 1 km, 2000 onward |
| Older El Niños | NASA MERRA-2 M2TMNXFLX (rain) and M2TMNXLND (soil wetness) | 1980 to 2010 |
| El Niño years | NOAA CPC Oceanic Niño Index | official NOAA definition |
| Ground truth | NOAA GHCN-Daily rain gauges in Sri Lanka | validation only |
| Districts | geoBoundaries LKA ADM2 | CC BY 4.0 |

## Method

1. District averages each month, weighting every grid cell by the share of it inside the district.
2. Normal per district and calendar month (2001 to 2025; 1981 to 2010 for MERRA-2). Rain as % of normal, soil moisture as a percentile rank.
3. Strong El Niños (peak ONI of 1.5 or more) picked by NOAA's rule.
4. Whiplash profile: average path of anomalies from January of the El Niño year to June of the next, with the range across events.
5. Significance: El Niño seasons compared against 5,000 random sets of years (permutation test).
6. Long-term trend: Seasonal Mann-Kendall test and Sen's slope, Benjamini-Hochberg correction across districts.
7. Watch flags from the latest months; satellite rain checked against rain gauges; backtest on past disasters.

## Run it

```bash
# 1. data (needs a free NASA Earthdata Login stored in ~/.netrc or %USERPROFILE%\_netrc)
cd pipeline
pip install -r requirements.txt
python fetch_ground.py            # El Niño index and rain gauges, no login
python fetch_nasa.py all          # IMERG, GLDAS, MERRA-2 (streams only the Sri Lanka box)
python fetch_modis.py submit      # MODIS NDVI via AppEEARS; later: status, then get
python analysis.py                # writes web/public/data/biome.json

# 2. web app
cd ../web
npm install
npm run dev                       # or: npm run build
```

## Use of AI

The concept, problem framing and pitch for Biome are the team's own. Code in this repository was written with help from Anthropic's Claude (an AI assistant), under the team's direction; the team reviewed it and checked results against NASA tools and ground stations. No AI-generated images, video or audio are used.

## License

MIT. Data remains under its providers' terms; no NASA endorsement is implied.
