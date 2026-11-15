// Seen by NASA: the classic gallery (Cyclone Ditwah day by day, this week,
// the flood water, the terrain, greenness a year apart) and the missions behind Biome.
import { useState } from "react";
import { ArrowUpRight, Satellite } from "lucide-react";
import { t, monthName } from "@classic/i18n.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const fmtDay = (d) => `${Number(d.slice(8, 10))} ${monthName(d.slice(0, 7))}`;

function Shot({ im, cap, monthly = false }) {
  if (!im) return null;
  const layer = im.layer.replaceAll("_", " ");
  const when = monthly ? monthName(im.date.slice(0, 7)) : fmtDay(im.date);
  return (
    <figure className="m-0 overflow-hidden rounded-lg border bg-card">
      <a href={im.worldview} target="_blank" rel="noopener" className="block bg-black">
        <img loading="lazy" src={im.file} width={im.w} height={im.h} alt={`${cap}, ${when}. NASA ${layer}`} className="h-auto w-full" />
      </a>
      <figcaption className="grid gap-0.5 p-3 text-sm">
        <span><b>{cap}</b> · {when}</span>
        <span className="text-xs text-muted-foreground">NASA Worldview / GIBS · {layer}</span>
        <a href={im.worldview} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2">{t("g_open")}<ArrowUpRight className="size-3" /></a>
      </figcaption>
    </figure>
  );
}

export function Gallery({ INDEX }) {
  const imgs = INDEX?.images || [];
  const by = (g) => imgs.filter((i) => i.group === g);
  const days = by("ditwah").map((i) => i.date);
  const [day, setDay] = useState(days.includes("2025-11-27") ? "2025-11-27" : days[0]);
  if (!imgs.length) return null;
  const pick = (g, d) => by(g).find((i) => i.date === d);
  const ndvi = by("ndvi").sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="grid gap-4 md:gap-6">
      <Card>
        <CardHeader><CardTitle className="text-2xl">{t("g_title")}</CardTitle><CardDescription className="text-base">{t("g_lede")}</CardDescription></CardHeader>
      </Card>
      {days.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("g_ditwah")}</CardTitle><CardDescription>{t("g_ditwah_d")}</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Tabs value={day} onValueChange={setDay}><TabsList className="h-auto flex-wrap">{days.map((d) => <TabsTrigger key={d} value={d}>{fmtDay(d)}</TabsTrigger>)}</TabsList></Tabs>
            <div className="grid gap-4 md:grid-cols-2"><Shot im={pick("ditwah", day)} cap={t("g_clouds")} /><Shot im={pick("ditwah_rain", day)} cap={t("g_rain")} /></div>
          </CardContent>
        </Card>
      )}
      {(by("now").length > 0 || by("now_rain").length > 0) && (
        <Card>
          <CardHeader><CardTitle>{t("g_now")}</CardTitle><CardDescription>{t("g_now_d")}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2"><Shot im={by("now")[0]} cap={t("g_clouds")} /><Shot im={by("now_rain")[0]} cap={t("g_rain")} /></CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {by("flood")[0] && (
          <Card>
            <CardHeader><CardTitle>{t("g_flood")}</CardTitle><CardDescription>{t("g_flood_d")}</CardDescription></CardHeader>
            <CardContent><Shot im={by("flood")[0]} cap={t("g_flood")} /></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>{t("g_terrain")}</CardTitle><CardDescription>{t("g_terrain_d")}</CardDescription></CardHeader>
          <CardContent>
            <figure className="m-0 overflow-hidden rounded-lg border bg-card">
              <img loading="lazy" src="nasa/terrain.jpg" width={990} height={1600} alt={t("g_terrain")} className="mx-auto h-auto max-h-[720px] w-auto" />
              <figcaption className="p-3 text-xs text-muted-foreground">NASA NASADEM (Shuttle Radar Topography Mission), 30 m</figcaption>
            </figure>
          </CardContent>
        </Card>
      </div>
      {ndvi.length >= 2 && (
        <Card>
          <CardHeader><CardTitle>{t("g_green")}</CardTitle><CardDescription>{t("green_cmp")}</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">{ndvi.map((im) => <Shot key={im.id} im={im} cap={t("s_green")} monthly />)}</CardContent>
        </Card>
      )}
      <Missions />
    </div>
  );
}

const MISSIONS = [["GPM · IMERG", "ms_gpm"], ["GLDAS · MERRA-2", "ms_gldas"], ["Terra · MODIS", "ms_modis"], ["SRTM · NASADEM", "ms_srtm"], ["Suomi NPP · VIIRS · Worldview", "ms_viirs"]];
export function Missions() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-2xl">{t("ms_title")}</CardTitle><CardDescription className="text-base">{t("ms_lede")}</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MISSIONS.map(([n, k]) => (
          <div key={k} className="grid content-start gap-2 rounded-lg border bg-background/60 p-4">
            <Badge variant="outline" className="w-fit gap-1 normal-case tracking-normal"><Satellite className="size-3" />NASA {n}</Badge>
            <p className="text-[15px]">{t(k)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
