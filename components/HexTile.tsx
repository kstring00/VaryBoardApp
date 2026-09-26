/**
 * Placeholder for a movement's video or thumbnail: a neutral mint hex tile with the movement
 * name. Never a person (no generated people, ever).
 */
export function HexTile({ name, portrait = false, className = "" }: { name: string; portrait?: boolean; className?: string }) {
  return (
    <div
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-mint-wash ${portrait ? "mx-auto aspect-[4/5] max-h-[60dvh] max-w-sm" : "aspect-video"} ${className}`}
      role="img"
      aria-label={`${name}: video coming soon`}
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="hextile-pattern" width="26" height="45" patternUnits="userSpaceOnUse">
            <path d="M13 0 L26 7.5 L26 22.5 L13 30 L0 22.5 L0 7.5 Z M13 30 L13 45" fill="none" className="stroke-mint" strokeOpacity="0.35" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hextile-pattern)" />
      </svg>
      <svg viewBox="0 0 100 110" className="absolute h-[78%] max-w-[78%]" aria-hidden="true">
        <polygon points="50,3 97,29 97,81 50,107 3,81 3,29" className="fill-surface stroke-mint" strokeWidth="2" />
      </svg>
      <p className="relative max-w-[60%] text-center font-display text-base leading-snug text-ink">
        {name}
        <span className="mt-1 block font-sans text-sm text-muted">Video coming soon</span>
      </p>
    </div>
  );
}
