"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormState } from "@/app/(vb-app)/app/clinician/actions";

export function ProfileForm({ displayName, clinicName }: { displayName: string; clinicName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="card mt-6 space-y-4 p-5">
      <label className="block">
        <span className="label">Your name as patients know you</span>
        <input name="displayName" defaultValue={displayName} required maxLength={80} className="field" autoComplete="name" />
      </label>
      <label className="block">
        <span className="label">Clinic name (optional)</span>
        <input name="clinicName" defaultValue={clinicName} maxLength={80} className="field" autoComplete="organization" />
      </label>
      <p role="alert" className="min-h-6 text-danger">
        {state.message ?? ""}
      </p>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        Save profile
      </button>
    </form>
  );
}
