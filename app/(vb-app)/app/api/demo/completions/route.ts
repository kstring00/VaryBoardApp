import { NextResponse } from "next/server";
import { demo, type DemoCompletion } from "@/lib/demo/store";
import { demoBackend } from "@/lib/env";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Local demo backend only (see lib/env.ts). Mirrors the completions insert policy. */
export async function POST(req: Request) {
  if (!demoBackend) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const ok =
    typeof b.id === "string" && UUID.test(b.id) &&
    typeof b.device_id === "string" && UUID.test(b.device_id) &&
    typeof b.program_code === "string" &&
    typeof b.program_session_id === "string" &&
    typeof b.completed_at === "string" && !Number.isNaN(Date.parse(b.completed_at));
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const c: DemoCompletion = {
    id: b.id as string,
    programCode: b.program_code as string,
    deviceId: b.device_id as string,
    programSessionId: b.program_session_id as string,
    completedAt: b.completed_at as string,
    feel: typeof b.feel === "number" ? b.feel : null,
  };
  const r = demo.insertCompletion(c);
  if (r === "duplicate") return NextResponse.json({ error: "duplicate" }, { status: 409 });
  if (r === "rejected") return NextResponse.json({ error: "rejected" }, { status: 403 });
  return new NextResponse(null, { status: 201 });
}
