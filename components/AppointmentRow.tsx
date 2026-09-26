"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarIcon, ChevronIcon } from "@/components/app/icons";
import { useProfile } from "@/lib/client/store";

export function formatAppointment(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const hasTime = v.includes("T") && !v.endsWith("T");
  return hasTime ? `${date} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : date;
}

/** Next appointment (kept on this device only; edited in Care). */
export function AppointmentRow() {
  const profile = useProfile();
  const [now] = useState(() => Date.now());
  const when = profile ? formatAppointment(profile.appointment) : null;
  const past = profile?.appointment ? new Date(profile.appointment).getTime() < now - 12 * 3600e3 : false;
  return (
    <Link href="/app/care#appointment" className="card flex min-h-16 items-center gap-4 p-4 text-ink no-underline hover:bg-mint-wash">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mint-wash text-teal">
        <CalendarIcon />
      </span>
      <span className="flex-1">
        <span className="block text-sm text-muted">Next appointment</span>
        <span className="block font-semibold">{profile === undefined ? " " : when && !past ? when : "Add your next appointment"}</span>
      </span>
      <ChevronIcon className="h-5 w-5 text-muted" />
    </Link>
  );
}
