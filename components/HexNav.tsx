import Link from "next/link";
import type { Genre, GenreSlug } from "@/lib/types";

/**
 * The six genres as one six-sided hexagon: each edge's wedge is a genre, top edge first, then
 * clockwise (Climb, Strengthen, Stretch, Loosen, Steady, Rise). A genre with no published
 * movements (Loosen, for now) is shown dormant.
 */
export function HexNav({ genres, counts, current }: { genres: Genre[]; counts: Partial<Record<GenreSlug, number>>; current?: GenreSlug }) {
  const R = 160;
  const cx = 170;
  const cy = 150;
  // Flat-top hexagon: vertices at 0°, 60°, ... (0° = right). Top edge is between 240° and 300°.
  const v = (k: number) => {
    const a = (Math.PI / 180) * (60 * k);
    return [cx + R * Math.cos(a), cy + R * Math.sin(a) * 0.93] as const;
  };
  // Edge order clockwise from the top: (4,5) top, (5,0) upper right, (0,1) lower right,
  // (1,2) bottom, (2,3) lower left, (3,4) upper left.
  const edges: [number, number][] = [
    [4, 5],
    [5, 0],
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ];
  const sorted = [...genres].sort((a, b) => a.sort - b.sort);
  return (
    <nav aria-label="Movement genres">
      <svg viewBox="0 0 340 300" className="mx-auto w-full max-w-sm">
        {sorted.map((g, i) => {
          const [a, b] = edges[i];
          const [ax, ay] = v(a);
          const [bx, by] = v(b);
          const tx = (cx + ax + bx) / 3;
          const ty = (cy + ay + by) / 3;
          const n = counts[g.slug] ?? 0;
          const dormant = n === 0;
          const active = current === g.slug;
          return (
            <Link key={g.slug} href={`/app/library/${g.slug}`} aria-label={`${g.name}: ${g.clinicalName}. ${n ? `${n} ${n === 1 ? "movement" : "movements"}` : "Coming soon"}`} aria-current={active ? "page" : undefined} className="group outline-none">
              <path
                d={`M${cx} ${cy} L${ax} ${ay} L${bx} ${by} Z`}
                className={`${active ? "fill-mint" : dormant ? "fill-dormant" : "fill-mint-wash group-hover:fill-mint-soft"} stroke-plaster transition-colors group-focus-visible:stroke-teal`}
                strokeWidth={4}
                strokeLinejoin="round"
              />
              <text x={tx} y={ty - 4} textAnchor="middle" className="fill-ink font-display" style={{ fontSize: 19, fontWeight: 600 }}>
                {g.name}
              </text>
              <text x={tx} y={ty + 16} textAnchor="middle" className="fill-muted" style={{ fontSize: 13 }}>
                {dormant ? "Soon" : `${n} ${n === 1 ? "move" : "moves"}`}
              </text>
            </Link>
          );
        })}
        <polygon points={[0, 1, 2, 3, 4, 5].map((k) => v(k).join(",")).join(" ")} className="fill-none stroke-teal" strokeWidth={2} pointerEvents="none" />
      </svg>
    </nav>
  );
}
