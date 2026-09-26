import { NextResponse, type NextRequest } from "next/server";
import { demo } from "@/lib/demo/store";
import { demoBackend } from "@/lib/env";
import type { ExerciseEventKind } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: ExerciseEventKind[] = ["done", "skipped", "made_easier"];

/** Local demo backend only. POST mirrors the exercise_events insert policy (409 on a repeated client_event_id). */
export async function POST(req: Request) {
  if (!demoBackend) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !b ||
    typeof b.client_event_id !== "string" || !UUID.test(b.client_event_id) ||
    typeof b.device_id !== "string" || !UUID.test(b.device_id) ||
    typeof b.program_code !== "string" || typeof b.session_block_id !== "string" ||
    !KINDS.includes(b.event as ExerciseEventKind) ||
    typeof b.occurred_at !== "string"
  )
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const r = demo.insertEvent({ clientEventId: b.client_event_id, deviceId: b.device_id, programCode: b.program_code, sessionBlockId: b.session_block_id, event: b.event as ExerciseEventKind, occurredAt: b.occurred_at });
  if (r === "duplicate") return NextResponse.json({ error: "duplicate" }, { status: 409 });
  if (r === "rejected") return NextResponse.json({ error: "rejected" }, { status: 403 });
  return new NextResponse(null, { status: 201 });
}

/** Test inspection (demo backend only): event counts for a code. */
export async function GET(req: NextRequest) {
  if (!demoBackend) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(demo.eventCounts(req.nextUrl.searchParams.get("code") ?? ""), { headers: { "Cache-Control": "no-store" } });
}
