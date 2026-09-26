"use client";

/**
 * Sends finished sessions (completions) to the server. Insert-only:
 *  - Supabase configured: straight to its REST API with the public anon key. RLS accepts
 *    inserts for an active code and nothing else (no reads, updates or deletes).
 *  - Local demo backend (no Supabase, local testing): POST /app/api/demo/completions.
 *  - Neither: completions stay on the device.
 * Completions wait in the device outbox until accepted, so a session done offline syncs later
 * and still counts toward the week (the week is counted from the device's own records).
 * Only ids, timestamps and the feel rating are sent: never names, notes or skip reasons.
 * Per-exercise done / skipped / made easier travels separately as exercise events
 * (lib/client/events.ts), saved the instant each happens.
 */
import { getDeviceId, getOutbox, setOutbox, type LocalCompletion } from "@/lib/client/store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = Boolean(url && key);
const demo = !supabase && (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_VB_DEMO === "true");
export const canSync = supabase || demo;

export function queueCompletion(c: LocalCompletion) {
  if (!canSync) return;
  setOutbox([...getOutbox().filter((e) => e.completion.id !== c.id), { completion: c, deviceId: getDeviceId() }]);
  void flushOutbox();
}

type Result = "sent" | "retry" | "drop";

async function send(path: string, headers: Record<string, string>, body: unknown): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  } catch {
    return "retry"; // offline
  }
  if (res.ok || res.status === 409) return "sent"; // 409: already stored (a retry after a lost response)
  if (res.status >= 500 || res.status === 429) return "retry";
  return "drop"; // e.g. the program was archived: it will never be accepted
}

async function sendOne(e: OutboxEntry): Promise<Result> {
  const c = e.completion;
  const row = { id: c.id, program_code: c.programCode, device_id: e.deviceId, program_session_id: c.programSessionId, completed_at: c.completedAt, feel: c.feel };
  if (!supabase) return send("/app/api/demo/completions", {}, row);
  return send(`${url}/rest/v1/completions`, { apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" }, row);
}

type OutboxEntry = ReturnType<typeof getOutbox>[number];

let flushing = false;
export async function flushOutbox(): Promise<void> {
  if (!canSync || flushing) return;
  flushing = true;
  try {
    for (const entry of getOutbox()) {
      const r = await sendOne(entry);
      if (r === "retry") break;
      setOutbox(getOutbox().filter((e) => e.completion.id !== entry.completion.id));
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") window.addEventListener("online", () => void flushOutbox());
