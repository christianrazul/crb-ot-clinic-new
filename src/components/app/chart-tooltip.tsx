import { formatPeso } from "@/lib/money";

type Entry = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  stroke?: string;
};

/** Tooltip card from the mockup: month, then one row per series. */
export function ChartTooltipCard({
  active,
  payload,
  label,
  money,
  suffix = "",
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  money?: boolean;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium text-foreground">
        {label}
        {suffix}
      </div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2 py-0.5">
          <span
            className="size-2 rounded-[2px]"
            style={{ background: entry.color ?? entry.stroke }}
          />
          <span className="text-muted-foreground capitalize">{entry.dataKey}</span>
          <span className="ml-auto font-medium text-foreground tabular-nums">
            {money ? formatPeso(Number(entry.value)) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
