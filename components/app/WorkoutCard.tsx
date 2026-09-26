import Link from "next/link";
import { GENRE_NAMES } from "@/lib/genres";
import { equipmentLine, LEVEL_NAMES, type WorkoutMeta } from "@/lib/workout-logic";

/** Minutes inside a hexagon: the honeycomb carries the one number people choose by. */
export function MinutesHex({ minutes, className = "h-16 w-14" }: { minutes: number; className?: string }) {
  return (
    <svg viewBox="0 0 56 64" className={`shrink-0 ${className}`} aria-hidden="true">
      <polygon points="28,2 54,17 54,47 28,62 2,47 2,17" className="fill-mint-wash stroke-mint" strokeWidth={2} />
      <text x="28" y="32" textAnchor="middle" className="fill-ink font-display" style={{ fontSize: 20, fontWeight: 600 }}>
        {minutes}
      </text>
      <text x="28" y="47" textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>
        min
      </text>
    </svg>
  );
}

export function WorkoutCard({ w, compact = false }: { w: WorkoutMeta; compact?: boolean }) {
  return (
    <Link
      href={`/app/workouts/${w.slug}`}
      aria-label={`${w.name}: ${w.minutes} minutes, ${LEVEL_NAMES[w.level].toLowerCase()}, ${w.exercises} exercises. ${equipmentLine(w)}.`}
      className="card flex min-h-16 items-center gap-4 p-4 text-ink no-underline transition-colors hover:bg-mint-wash"
    >
      <MinutesHex minutes={w.minutes} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl leading-snug">{w.name}</span>
        <span className="mt-0.5 block text-sm text-muted">
          {LEVEL_NAMES[w.level]} · {w.exercises} exercises · {equipmentLine(w)}
        </span>
        {!compact && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {w.seated && <span className="chip bg-teal text-white">Seated</span>}
            {w.genres.map((g) => (
              <span key={g} className="chip">
                {GENRE_NAMES[g]}
              </span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}
