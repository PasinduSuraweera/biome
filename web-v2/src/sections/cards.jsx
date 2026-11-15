// Cards shared by the simple reports and Full data.
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { Bell, CloudRain, ExternalLink, MapPin, MessageCircleQuestion, Satellite, Sprout } from "lucide-react";
import { t, getLang, monthName } from "@classic/i18n.js";
import { alertMessage } from "@classic/simple.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { ui, slug, in10, SIGN_FILL, narrow, monthSigns } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function NasaTag({ children }) {
  return children ? <Badge variant="outline" className="font-medium normal-case tracking-normal">{children}</Badge> : null;
}

export function OutlookCard({ m, DATA, name, className }) {
  const ms = monthSigns(DATA, name);
  const data = ms.map((x) => ({
    name: monthName(x.ym, true), v: Math.round(x.median), fill: SIGN_FILL[x.sign], title: monthName(x.ym),
    tip: [ui("tip_pct", { p: Math.round(x.median) }), ...(x.sig ? [ui("tip_dry", { x: in10(x.pDry) }), ui("tip_wet", { x: in10(x.pWet) }), ...(x.drought >= 0.3 ? [ui("tip_drought", { x: in10(x.drought) })] : [])] : [ui("tip_nosig")])],
  }));
  const tabs = [...m.periods, ...(m.year ? [m.year] : [])];
  const top = Math.max(150, Math.ceil(Math.max(...data.map((d) => d.v), 0) / 50) * 50);
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><CloudRain className="size-5 text-brand" />{t("s_expect")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{m.basis}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data.length > 0 && (
          <div>
            <p className="text-sm font-medium">{ui("c_out")}</p>
            <p className="mb-3 text-xs text-muted-foreground">{ui("c_out_d")}</p>
            <ChartContainer className="aspect-auto h-56">
              <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={narrow() ? 1 : 0} tickMargin={6} />
                <YAxis tickLine={false} axisLine={false} unit="%" width={48} domain={[0, top]} ticks={ticks} />
                <ReferenceLine y={100} strokeDasharray="4 4" />
                <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                <Bar dataKey="v" radius={[4, 4, 0, 0]}>{data.map((c, i) => <Cell key={i} fill={c.fill} />)}</Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {["dry", "wet", "mixed", "normal"].map((k) => <span key={k} className="flex items-center gap-1.5"><i className="inline-block size-3 rounded-sm" style={{ background: SIGN_FILL[k] }} />{t(`kf_${k}`)}</span>)}
            </div>
          </div>
        )}
        <Tabs defaultValue="0">
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs.map((p, i) => <TabsTrigger key={i} value={String(i)}>{p.label}</TabsTrigger>)}
          </TabsList>
          {tabs.map((p, i) => (
            <TabsContent key={i} value={String(i)} className="grid gap-2 rounded-md border bg-background/60 p-4 data-[state=inactive]:hidden">
              <p className="text-sm text-muted-foreground">{p.range}</p>
              {p.lines.map((l, j) => <p key={j} className="text-[15px]">{l}</p>)}
              {p.adv.map((a, j) => <p key={j} className="text-[15px] font-semibold">{a}</p>)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function AskCard({ m }) {
  if (!m.ask?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircleQuestion className="size-5 text-brand" />{t("ask_title")}</CardTitle>
        <CardDescription>{t("ask_lede")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="q0">
          {m.ask.map((x, i) => (
            <AccordionItem key={i} value={`q${i}`} className={cn(i === m.ask.length - 1 && "border-b-0")}>
              <AccordionTrigger>{x.q}</AccordionTrigger>
              <AccordionContent className="grid gap-2 text-foreground/90">{x.a.map((l, j) => <p key={j} className={cn(j === 0 && "font-medium text-foreground")}>{l}</p>)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function PlantCard({ m }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><Sprout className="size-5 text-brand" />{t("s_plant")}<NasaTag>NASA GPM IMERG + MERRA-2</NasaTag></CardTitle>
        <CardDescription>{t("pl_note")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {m.plant.map((p, i) => (
          <div key={i} className={cn("grid content-start gap-2 rounded-md border p-4", p.sign === "dry" ? "bg-[#f6ecd2] dark:bg-[#332d1a]" : p.sign === "wet" ? "bg-[#e2eff2] dark:bg-[#15303a]" : "bg-background/60")}>
            <div className="flex items-baseline justify-between gap-2"><p className="font-display text-lg font-semibold">{p.title}</p><p className="text-sm text-muted-foreground">{p.range}</p></div>
            {p.lines.map((l, j) => <p key={j} className="text-[15px]">{l}</p>)}
            <Separator className="my-1" />
            <p className="text-[15px] font-medium">{p.adv}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function YearsCard({ m, DATA, name, className }) {
  const s = DATA.districts[name].seasons;
  const strong = new Set(DATA.meta?.strong_el_nino_years || []);
  const series = (k) => s[k].years.map((y, i) => {
    const p = s[k].rain_pct[i];
    const sign = p == null ? "normal" : p < 85 ? "dry" : p > 115 ? "wet" : "normal";
    return { name: String(y), v: p == null ? 0 : Math.round(p - 100), fill: SIGN_FILL[sign], nino: strong.has(y),
      title: k === "maha" ? t("season_maha", { a: y, b: String(y + 1).slice(2) }) : t("season_yala", { a: y }),
      tip: [ui("tip_pct", { p: Math.round(p) }), ...(strong.has(y) ? [ui("el_nino")] : [])] };
  });
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><Satellite className="size-5 text-brand" />{t("s_years")}<NasaTag>NASA MERRA-2 + GPM IMERG</NasaTag></CardTitle>
        <CardDescription>{ui("c_years_d")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Tabs defaultValue="maha">
          <TabsList><TabsTrigger value="maha">{t("s_maha")}</TabsTrigger><TabsTrigger value="yala">{t("s_yala")}</TabsTrigger></TabsList>
          {["maha", "yala"].map((k) => {
            const data = series(k);
            return (
              <TabsContent key={k} value={k}>
                <ChartContainer className="aspect-auto h-56">
                  <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={narrow() ? 9 : 4} tickMargin={6} />
                    <YAxis tickLine={false} axisLine={false} unit="%" width={48} />
                    <ReferenceLine y={0} />
                    <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                    <Bar dataKey="v" radius={2}>{data.map((c, i) => <Cell key={i} fill={c.fill} stroke={c.nino ? "hsl(var(--foreground))" : "none"} strokeWidth={c.nino ? 2 : 0} />)}</Bar>
                  </BarChart>
                </ChartContainer>
              </TabsContent>
            );
          })}
        </Tabs>
        {m.years.note && <p className="rounded-md bg-secondary p-3 text-[15px] font-medium">{m.years.note}</p>}
        <p className="text-xs text-muted-foreground">{t("yr_src")}</p>
      </CardContent>
    </Card>
  );
}

export function AlertsCard({ m, lv, setLv }) {
  const n = Number(lv);
  const href = m.bot ? `https://t.me/${m.bot}?start=${slug(m.name)}-${getLang()}-${n}` : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="size-5 text-brand" />{t("s_alerts", { d: m.district })}</CardTitle>
        <CardDescription>{t("al_note")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1.5 text-sm text-muted-foreground">{t("al_from")}
          <Select value={lv} onValueChange={setLv}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3].map((k) => <SelectItem key={k} value={String(k)}>{t(`lvl_${k}`)}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <p className="text-sm text-muted-foreground">{t("al_preview")}</p>
        <pre className="whitespace-pre-wrap rounded-md bg-secondary p-3 font-sans text-sm">{alertMessage(m, n)}</pre>
        {href ? <Button asChild><a href={href} target="_blank" rel="noopener">{t("al_btn")}</a></Button>
          : <p className="text-sm text-muted-foreground">{t("al_soon")}</p>}
      </CardContent>
    </Card>
  );
}

// Safer places, each one opening directions in Google Maps
const MAPS = { en: "Directions in Google Maps", si: "Google Maps හි මාර්ගය", ta: "Google Maps இல் வழி" };
export const mapsLink = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`;
export function SafePlaces({ top, showHeight = true }) {
  return (
    <ol className="grid gap-2">
      {top.slice(0, 5).map((c, i) => (
        <li key={i}>
          <a href={mapsLink(c)} target="_blank" rel="noopener"
            className="group flex items-center gap-3 rounded-lg border bg-background/60 p-3 transition-colors hover:bg-secondary/70">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug">{c[3]}</span>
              <span className="block text-xs text-muted-foreground">{t("kind_" + c[2])}{showHeight && c[4] != null ? `, ${c[4]} m` : ""}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-deep dark:text-brand"><MapPin className="size-4" /><span className="hidden sm:inline">{MAPS[getLang()] || MAPS.en}</span><ExternalLink className="size-3.5" /></span>
          </a>
        </li>
      ))}
    </ol>
  );
}
