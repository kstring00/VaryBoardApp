"use client";

import { useActionState } from "react";
import { sendMagicLink, type FormState } from "@/app/(vb-app)/app/clinician/actions";

export function MagicLinkForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMagicLink, {});
  return (
    <form action={action} className="card mt-6 p-5">
      <label htmlFor="email" className="label">
        Work email
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required className="field" aria-describedby="email-msg" />
      <p id="email-msg" role={state.ok ? "status" : "alert"} className={`mt-2 min-h-6 ${state.ok ? "text-teal" : "text-danger"}`}>
        {state.message ?? ""}
      </p>
      <button type="submit" className="btn btn-primary mt-2 w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="mt-3 text-sm text-muted">Email is used only to sign clinicians in. Patients never create accounts.</p>
    </form>
  );
}
