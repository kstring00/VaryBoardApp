"use client";

/**
 * Exercise events: saved on the device the instant an exercise is done, skipped or made
 * easier, then synced when online. Each event carries a client_event_id generated here, so a
 * retry after a lost response (or a double flush) never creates a duplicate on the server.
 * IndexedDB first; localStorage if IndexedDB is unavailable (private windows).
 */
import { idbAll, idbDelete, idbPut } from "@/lib/idb";
import { getDeviceId, uuid } from "@/lib/client/store";
import type { ExerciseEventKind } from "@/lib/types";

export interface QueuedEvent {
  client_event_id: string;
  program_code: string;
  device_id: string;
  session_block_id: string;
  event: ExerciseEventKind;
  occurred_at: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = Boolean(url && key);
const demo = !supabase && (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_VB_DEMO === "true");
const FALLBACK = "vb.eventQueue";

function lsRead(): QueuedEvent[] {
  try {
    return JSON.parse(localStorage.getItem(FALLBACK) ?? "[]") as QueuedEvent[];
  } catch {
    return [];
  }
}
function lsWrite(xs: QueuedEvent[]) {
  try {
    if (xs.length) localStorage.setItem(FALLBACK, JSON.stringify(xs));
    else localStorage.removeItem(FALLBACK);
  } catch {
    /* nothing more we can do */
  }
}

export async function logEvent(programCode: string, sessionBlockId: string, event: ExerciseEventKind): Promise<void> {
  const e: QueuedEvent = { client_event_id: uuid(), program_code: programCode, device_id: getDeviceId(), session_block_id: sessionBlockId, event, occurred_at: new Date().toISOString() };
  if (!(await idbPut("events", e))) lsWrite([...lsRead(), e]);
  void flushEvents();
}

async function send(e: QueuedEvent): Promise<"sent" | "retry" | "drop"> {
  if (!supabase && !demo) return "drop"; // nowhere to send: the device keeps its own records
  let res: Response;
  try {
    res = supabase
      ? await fetch(`${url}/rest/v1/exercise_events`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(e) })
      : await fetch("/app/api/demo/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) });
  } catch {
    return "retry";
  }
  if (res.ok || res.status === 409) return "sent";
  if (res.status >= 500 || res.status === 429) return "retry";
  return "drop";
}

let flushing: Promise<void> | null = null;
export function flushEvents(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (const e of await idbAll<QueuedEvent>("events")) {
        const r = await send(e);
        if (r === "retry") return;
        await idbDelete("events", e.client_event_id);
      }
      for (const e of lsRead()) {
        const r = await send(e);
        if (r === "retry") return;
        lsWrite(lsRead().filter((x) => x.client_event_id !== e.client_event_id));
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

export async function pendingEvents(): Promise<number> {
  return (await idbAll("events")).length + lsRead().length;
}

if (typeof window !== "undefined") window.addEventListener("online", () => void flushEvents());
