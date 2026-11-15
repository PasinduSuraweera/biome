// shadcn/ui chart: a themed wrapper and tooltip around Recharts
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

const ChartContext = React.createContext(null);

export function ChartContainer({ config = {}, className, children, ...props }) {
  const vars = Object.fromEntries(Object.entries(config).filter(([, v]) => v.color).map(([k, v]) => [`--color-${k}`, v.color]));
  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn("aspect-video w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-reference-line_line]:stroke-foreground/40 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-none", className)} style={vars} {...props}>
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

// tooltip body: a title and the lines the chart gives it (row.tip), so text stays translated
export function ChartTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="grid min-w-[10rem] max-w-[16rem] gap-1 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold">{row.title}</p>
      {(row.tip || []).map((l, i) => <p key={i} className="text-muted-foreground">{l}</p>)}
    </div>
  );
}
