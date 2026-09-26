/** Line icons (24px grid, 2px stroke). Decorative: labels always travel with them. */
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const HouseIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
  </svg>
);
export const ClipboardIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5h6V3H9zM8.5 10h7M8.5 14h7M8.5 18h4" />
  </svg>
);
export const BarsIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M5 20V12M10 20V6M15 20v-9M20 20V9M3 20h19" />
  </svg>
);
export const PeopleIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="8.5" cy="8" r="3" />
    <circle cx="16.5" cy="9" r="2.5" />
    <path d="M3 20c0-3.3 2.5-5.5 5.5-5.5S14 16.7 14 20M14.5 14.8c.6-.2 1.3-.3 2-.3 2.6 0 4.5 1.9 4.5 5" />
  </svg>
);
export const ProfileIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="10" r="3.2" />
    <path d="M6.3 18.4c1.3-2 3.3-3 5.7-3s4.4 1 5.7 3" />
  </svg>
);
export const CalendarIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const ChevronIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
export const ArrowIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);
export const CheckIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const PhoneIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
  </svg>
);
