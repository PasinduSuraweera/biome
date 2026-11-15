// How we know: the data, the rules, the method, the tests and the limits,
// the same content as the classic app.
import { t, getLang, monthName } from "@classic/i18n.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const H = ({ children }) => <h3 className="mt-2 font-display text-lg font-semibold">{children}</h3>;
function T({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader><TableRow>{head.map((h, i) => <TableHead key={i} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  );
}

export function How({ DATA, SAFE }) {
  const m = DATA.meta, v = DATA.validation || {}, b = DATA.backtest || [], e = DATA.el_nino, R = DATA.reservoirs, F = DATA.forecast, LV = DATA.levels;
  const rng = (r) => (r ? `${r[0]} to ${r[1]}` : "not loaded");
  const ev = [...e.events.filter((x) => x.strength === "strong" || x.strength === "very strong"), ...(e.la_nina_events || []).filter((x) => x.strength !== "weak")]
    .filter((x) => x.year0 >= 1980).sort((a, c) => a.year0 - c.year0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-2xl">{t("how_title")}</CardTitle>{getLang() !== "en" && <CardDescription>{t("how_note")}</CardDescription>}</CardHeader>
      <CardContent className="grid gap-4 text-[15px] leading-relaxed">
        <p>Biome is a trend detective, not a weather forecast. It learns what is normal for each district, looks at how past El Niños and La Niñas hit it, and places this year inside that pattern. Every number on this page is computed from the public data below, with code you can rerun.</p>
        <H>NASA and partner data</H>
        <T head={["What", "Dataset", "Period used"]} rows={[
          ["Rain", "NASA GPM IMERG Final, monthly 0.1° (V07); IMERG Early and Late daily for the latest days", rng(m.data_ranges.rain)],
          ["Soil moisture", "NASA GLDAS Noah, monthly 0.25° (V2.1), root zone", rng(m.data_ranges.soil)],
          ["Plant greenness", "NASA MODIS Terra NDVI, monthly 1 km (MOD13A3 v061)", rng(m.data_ranges.ndvi)],
          ["Older years", "NASA MERRA-2 reanalysis, monthly rain and soil wetness", rng(m.data_ranges.merra2_rain)],
          ["Terrain", "NASA NASADEM (Shuttle Radar Topography Mission), 30 m", "2000"],
          ["Pictures", "NASA GIBS / Worldview: VIIRS and MODIS true colour, IMERG rain, VIIRS flood map", "by date"],
          ["El Niño and La Niña years", "NOAA Oceanic Niño Index (official definition)", "1950 to now"],
          ["Ground truth", "NOAA GHCN-Daily rain gauges in Sri Lanka", "see check below"],
          ["Reservoirs and rivers", "Sri Lanka Irrigation Department: daily reservoir storage and spilling, live river gauges with flood levels, Nov 2025 flood extent", R ? `${R.count} reservoirs, ${R.date}` : "not loaded"],
        ]} />
        <H>The Watch rules</H>
        <ul className="list-disc pl-5">{Object.entries(m.rules).map(([k, txt]) => <li key={k}><b>{k}:</b> {txt}.</li>)}</ul>
        <H>Method</H>
        <ol className="list-decimal pl-5">
          <li>District averages for every month, weighting each satellite grid cell by how much of it lies in the district.</li>
          <li>Normal for each district and calendar month over {m.normal_period}; rain as % of normal, soil moisture as a rank against the same month in other years.</li>
          <li>El Niño and La Niña years chosen by NOAA's rule (strong El Niño: peak index 1.5 or more; La Niña: moderate or stronger), not by us.</li>
          <li>Significance: El Niño seasons compared with 5,000 random sets of years from the whole record (permutation test).</li>
          <li>Long-term trend: Seasonal Mann-Kendall test with Sen's slope, corrected for testing 25 districts at once (Benjamini-Hochberg).</li>
          <li>Risk calendar: the Watch rules applied to every month from {DATA.calendar?.years?.[0] ?? ""} (MERRA-2 before 2001, NASA satellites after).</li>
          <li>Reservoirs: each reservoir's monthly change in storage compared with NASA rain over its district{R?.median_r_rain_vs_storage != null ? ` (median correlation ${R.median_r_rain_vs_storage})` : ""}.</li>
        </ol>
        {F && <>
          <H>The outlook model and risk calendar</H>
          <p>The outlook is a weighted analog ensemble. Every year from {F.train_years[0]} to {F.train_years[1]} is one possible future: the rain that really fell over the following 12 months (NASA MERRA-2 before 2001, NASA GPM IMERG after). Each year is weighted by how close its ocean state (NOAA ONI in {monthName(F.issue_month)}) was to today's {F.oni}, with a Gaussian kernel whose width ({F.kernel_width}) is chosen by cross-validation. The Watch rules run on every member; the weighted share on a Watch is the chance in the calendar. The years that count most now: {F.closest_years.slice(0, 5).map((y) => `${y.year} (${Math.round(y.weight * 100)}%)`).join(", ")}; the weights are worth about {F.effective_members} equally weighted years.</p>
          <p>Skill is measured by leaving each year out, forecasting it from the others and scoring the three-category forecast (drier, usual, wetter) with the ranked probability skill score against equal odds. Over all years the ocean says little about Sri Lanka's monthly rain, and the model says so. In {F.skill.like_this_year.kind} ({F.skill.like_this_year.years.join(", ")}) it has real skill for some months. Only months with a score of 0.05 or more are shown as a signal.</p>
          <T head={["Month ahead", ...F.months.map((ym) => monthName(ym, true))]} rows={[
            ["Skill score, years like this one", ...F.skill.like_this_year.rpss.map((x) => x ?? "")],
            ["Right category, years like this one", ...F.skill.like_this_year.hit_rate.map((x) => (x == null ? "" : Math.round(x * 100) + "%"))],
            ["Skill score, all years", ...F.skill.all_years.rpss.map((x) => x ?? "")],
            ["Shown as a signal", ...F.skill.signal.map((x) => (x ? "yes" : "no"))],
          ]} />
          <p className="text-sm text-muted-foreground">Guessing gets the right category 33% of the time. The years like this one are few ({F.skill.like_this_year.years.length}) and neighbouring districts are not independent, so treat the scores as a guide.</p>
        </>}
        {LV && <>
          <H>Daily risk levels</H>
          <ul className="list-disc pl-5">{["1", "2", "3", "drought"].map((k) => <li key={k}>{LV.rule[k]}.</li>)}</ul>
          <p>{LV.rule.source}. Replayed on the week of Cyclone Ditwah, using only what was known at the time:</p>
          <T head={["Day of rain", "Yellow", "Amber", "Red", "Amber and Red districts (district rain, mm)"]} rows={LV.ditwah_replay.map((r) => [r.day, r.counts["1"], r.counts["2"], r.counts["3"],
            Object.entries(r.districts).filter(([, x]) => x.level >= 2).sort((a, c) => c[1].level - a[1].level).map(([n, x]) => `${n} ${x.level === 3 ? "Red" : "Amber"} (${Math.round(x.rain_mm)})`).join(", ")])} />
          <p className="text-sm text-muted-foreground">NASA's Early rain estimate arrives about 4 hours after the day ends and is replaced by the more careful Late estimate about 14 hours after. A level reflects the last full day's rain. It is a nowcast, not a forecast.</p>
        </>}
        {m.hill_rule?.source && <>
          <H>Hill districts and safer places</H>
          <p>A district is hill country, and can get SlopeWatch, when {Math.round(m.hill_rule.min_share * 100)}% or more of its land is steeper than {m.hill_rule.steep_degrees} degrees in {m.hill_rule.source}: {m.hill_rule.districts.join(", ")}. The same elevation data checks {SAFE ? Object.values(SAFE.districts).reduce((a, x) => a + x.count, 0).toLocaleString() : "about 15,000"} schools, places of worship and halls from OpenStreetMap: a place is marked safer when it did not flood in Cyclone Ditwah and has no slope of 20 degrees or more within 90 m. Places are ranked by building type and by height above the lowest ground within 500 m. They are candidates for officers to confirm, not an official list.</p>
        </>}
        <H>El Niño and La Niña in the record</H>
        <T head={["Event", "Strength", "Peak index", "Use"]} rows={ev.map((x) => [`${x.kind === "la_nina" ? "La Niña" : "El Niño"} ${x.year0} to ${x.year0 + 1}`, x.strength, x.peak,
          x.ongoing ? "this year" : (e.strong_used || []).includes(x.year0) || (e.la_nina_used || []).includes(x.year0) ? "in the profile" : "outside data"])} />
        <H>Check against rain gauges</H>
        <p>Satellite rain for the district compared with NOAA station records, month by month. "Anomaly r" removes the seasons first, so it shows whether the satellite catches unusual months, not just the monsoon.</p>
        <T head={["Station", "District", "Months", "r (monthly)", "r (anomaly)", "Satellite bias"]} rows={(v.stations || []).map((s) => [s.station, s.district, s.months, s.r_monthly, s.r_anomaly, `${s.bias_pct > 0 ? "+" : ""}${s.bias_pct}%`])} />
        <H>Backtest on known disasters</H>
        <p>What the Watch rules showed in the month before and the month of past disasters.</p>
        <T head={["Event", "District", "Month before", "Month of"]} rows={b.map((x) => [x.event, x.district, `${x.month_before?.watch ?? "n/a"} (ground wetness rank ${x.month_before?.wet_pct ?? "n/a"})`, x.month_of?.watch ?? "n/a"])} />
        <H>Limits</H>
        <ul className="list-disc pl-5">
          <li>Only a handful of strong El Niños fall in the record, so the profile is a pattern, not a certainty.</li>
          <li>Satellite rain smooths out local cloudbursts; a district average can hide a village-scale downpour.</li>
          <li>The latest days use NASA's early estimates, which are revised later.</li>
          <li>MODIS Terra has drifted in orbit since 2022; greenness is used only as supporting evidence.</li>
          <li>Reservoir and river readings are the Irrigation Department's; Biome shows them as published.</li>
        </ul>
        <p className="text-sm text-muted-foreground">Data: NASA GPM IMERG, GLDAS, MERRA-2, MODIS and NASADEM; NOAA Oceanic Niño Index and GHCN-Daily stations; Sri Lanka Irrigation Department reservoir, river gauge and flood data; OpenStreetMap; district and division boundaries from geoBoundaries (CC BY 4.0). No NASA endorsement is implied.</p>
      </CardContent>
    </Card>
  );
}
