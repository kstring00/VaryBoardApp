/** The Vary Board mark: two teal bars (two board columns). */
export function HexMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="7" y="3" width="7" height="26" rx="2.5" className="fill-teal" />
      <rect x="18" y="3" width="7" height="26" rx="2.5" className="fill-teal" />
      <polygon points="21.5,12 24,13.5 24,16.5 21.5,18 19,16.5 19,13.5" className="fill-mint-soft" />
    </svg>
  );
}
