"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarsIcon, ClipboardIcon, HouseIcon, PeopleIcon, PlayHexIcon } from "@/components/app/icons";

/** Five tabs. In the thumb zone, 64px tall, labels always visible. */
const TABS = [
  { href: "/app", label: "Today", Icon: HouseIcon, match: (p: string) => p === "/app" },
  { href: "/app/plan", label: "My plan", Icon: ClipboardIcon, match: (p: string) => /^\/app\/(plan|starter)/.test(p) },
  { href: "/app/workouts", label: "Workouts", Icon: PlayHexIcon, match: (p: string) => /^\/app\/(workouts|find|library|movement)/.test(p) },
  { href: "/app/progress", label: "Progress", Icon: BarsIcon, match: (p: string) => p.startsWith("/app/progress") },
  { href: "/app/care", label: "Care", Icon: PeopleIcon, match: (p: string) => /^\/app\/(care|code)/.test(p) },
];

export function TabBar() {
  const path = usePathname() ?? "/app";
  return (
    <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ href, label, Icon, match }) => {
          const on = match(path);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm leading-tight no-underline ${on ? "font-bold text-teal" : "text-muted"}`}>
                <Icon className={`h-6 w-6 ${on ? "text-teal" : ""}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
