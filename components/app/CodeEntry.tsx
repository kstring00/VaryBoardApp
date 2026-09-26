"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CodeInput } from "@/components/CodeInput";
import { setProgram } from "@/lib/client/store";
import type { PatientProgram } from "@/lib/types";

type State = { kind: "idle" } | { kind: "checking" } | { kind: "found"; program: PatientProgram } | { kind: "error"; message: string };

async function fetchProgram(c: string): Promise<State> {
  try {
    const r = await fetch(`/app/api/program/${c}`, { cache: "no-store" });
    if (r.status === 404) return { kind: "error", message: "We couldn't find that code. Check it with your therapist and try again." };
    if (!r.ok) return { kind: "error", message: "We couldn't check the code just now. Please try again in a moment." };
    return { kind: "found", program: (await r.json()) as PatientProgram };
  } catch {
    return { kind: "error", message: "You seem to be offline. Connect to the internet to add a new code." };
  }
}

/** Enter (or change) the therapist's code. `?c=XXXXXX` (from the handout QR) is looked up at once. */
export function CodeEntry({ submitLabel = "Find my plan" }: { submitLabel?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const fromQr = (params.get("c") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const [code, setCode] = useState(fromQr);
  const [state, setState] = useState<State>(() => (fromQr.length === 6 ? { kind: "checking" } : { kind: "idle" }));
  const lookUp = (c: string) => {
    setState({ kind: "checking" });
    void fetchProgram(c).then(setState);
  };

  // A code from the handout QR link (?c=XXXXXX) is looked up straight away.
  useEffect(() => {
    if (fromQr.length === 6) void fetchProgram(fromQr).then(setState);
  }, [fromQr]);

  if (state.kind === "found") {
    const p = state.program;
    const n = p.sessions.length;
    return (
      <div className="card mt-4 p-5" role="status">
        <p className="eyebrow">Plan found · {p.code}</p>
        <h3 className="mt-1 text-2xl">{p.name}</h3>
        <p className="mt-1 text-muted">
          {n} {n === 1 ? "session" : "sessions"} · {p.daysPerWeek} {p.daysPerWeek === 1 ? "day" : "days"} a week{p.clinicName ? ` · ${p.clinicName}` : ""}
        </p>
        <button
          type="button"
          className="btn btn-primary mt-5 w-full"
          onClick={() => {
            setProgram(p);
            router.push("/app/plan");
          }}
        >
          Use this plan
        </button>
        <button type="button" className="btn btn-quiet mt-1 w-full" onClick={() => setState({ kind: "idle" })}>
          Enter a different code
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) lookUp(code);
        else setState({ kind: "error", message: "The code has 6 characters." });
      }}
    >
      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (state.kind === "error") setState({ kind: "idle" });
        }}
        invalid={state.kind === "error"}
        describedBy="code-msg"
      />
      <p id="code-msg" role="alert" className="mt-2 min-h-7 text-danger">
        {state.kind === "error" ? state.message : ""}
      </p>
      <button type="submit" className="btn btn-primary mt-1 w-full" disabled={state.kind === "checking"}>
        {state.kind === "checking" ? "Checking…" : submitLabel}
      </button>
      <p className="mt-4 text-center">
        <Link href="/app/starter" className="text-teal underline">
          No code yet? Try a starter plan
        </Link>
      </p>
    </form>
  );
}
