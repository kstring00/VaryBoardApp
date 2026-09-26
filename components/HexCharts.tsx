/**
 * Honeycomb progress. Filled hexes = progress: mint = done, outline = not yet, gray = dormant.
 * Fresh cells fill with a calm ease-out (static under reduced motion).
 */
import type { Bar } from "@/lib/progress";

const pointy = (cx: number, cy: number, w: number, h: number) => {
  const x = w / 2;
  const y = h / 2;
  return `${cx},${cy - y} ${cx + x},${cy - y / 2} ${cx + x},${cy + y / 2} ${cx},${cy + y} ${cx - x},${cy + y / 2} ${cx - x},${cy - y / 2}`;
};

/** Seven hexagons, Monday to Sunday. */
export function HexWeekRow({ days, fresh }: { days: { key: string; label: string; longLabel: string; done: boolean; today: boolean }[]; fresh?: string }) {
  const W = 38;
  const H = W * 1.1547;
  const gap = 8;
  const width = days.length * (W + gap);
  const summary = days.filter((d) => d.done).map((d) => d.longLabel);
  return (
    <svg viewBox={`-4 -4 ${width + 8} ${H + 36}`} className="w-full" role="img" aria-label={summary.length ? `Sessions this week on ${summary.join(", ")}.` : "No sessions yet this week."}>
      {days.map((d, i) => {
        const cx = W / 2 + i * (W + gap);
        const cy = H / 2;
        return (
          <g key={d.key}>
            <polygon points={pointy(cx, cy, W, H)} className={`${d.done ? "fill-mint stroke-mint" : "fill-surface stroke-line"} ${fresh === d.key ? "hex-fill-in" : ""}`} strokeWidth={2} />
            {d.done && <path d={`M${cx - 7} ${cy} l5 5 l9 -10`} className="fill-none stroke-white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
            <text x={cx} y={H + 24} textAnchor="middle" className={d.today ? "fill-ink" : "fill-muted"} style={{ fontSize: 15, fontWeight: d.today ? 800 : 500 }}>
              {d.label}
            </text>
            {d.today && <circle cx={cx} cy={H + 31} r={2.5} className="fill-teal" />}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Vertical bars made of stacked hexagons. Height = sessions; mint intensity = how much of those
 * sessions was done (skipped exercises lighten it).
 */
export function HexBarChart({ bars, max = 3, summary }: { bars: Bar[]; max?: number; summary: string }) {
  const W = 34;
  const H = W * 1.1547;
  const pitch = H * 0.8;
  const top = Math.max(max, ...bars.map((b) => b.sessions));
  const colW = 46;
  const chartH = (top - 1) * pitch + H;
  const width = bars.length * colW;
  const fill = (share: number) => (share >= 0.99 ? "fill-mint" : share >= 0.5 ? "fill-mint-soft" : "fill-mint-wash");
  return (
    <svg viewBox={`0 0 ${width} ${chartH + 34}`} className="w-full" role="img" aria-label={summary}>
      {bars.map((b, i) => {
        const cx = colW / 2 + i * colW;
        return (
          <g key={b.key}>
            {Array.from({ length: top }).map((_, level) => {
              const cy = chartH - H / 2 - level * pitch;
              const on = level < b.sessions;
              return <polygon key={level} points={pointy(cx, cy, W, H)} className={on ? `${fill(b.share)} stroke-teal` : b.future ? "fill-none stroke-line" : "fill-dormant/45 stroke-dormant"} strokeWidth={on ? 1.5 : 1} strokeOpacity={on ? 0.6 : 1} />;
            })}
            <text x={cx} y={chartH + 22} textAnchor="middle" className={b.today ? "fill-ink" : "fill-muted"} style={{ fontSize: 15, fontWeight: b.today ? 800 : 500 }}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
