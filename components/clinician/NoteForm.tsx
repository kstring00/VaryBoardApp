"use client";

import { useActionState, useState } from "react";
import { updateNoteAction, type FormState } from "@/app/(vb-app)/app/clinician/actions";
import { t } from "@/lib/copy";
import { NOTE_MAX, noteProblem } from "@/lib/labels";

/** Therapist note: shown to the patient under the session card. */
export function NoteForm({ code, note, updatedAt }: { code: string; note: string | null; updatedAt: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateNoteAction.bind(null, code), {});
  const [value, setValue] = useState(note ?? "");
  const problem = noteProblem(value);
  return (
    <form action={action} className="card p-5" aria-labelledby="note-h">
      <h2 id="note-h" className="text-2xl">
        Note to your patient
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label className="block">
          <span className="sr-only">Note</span>
          <textarea name="note" rows={3} maxLength={NOTE_MAX} value={value} onChange={(e) => setValue(e.target.value)} className="field min-h-28" placeholder="Keep the band light this week." aria-describedby="note-warning note-count" />
          <span id="note-count" className={`mt-1 block text-sm ${value.length > NOTE_MAX ? "text-danger" : "text-muted"}`}>
            {value.length}/{NOTE_MAX}
          </span>
        </label>
        <p id="note-warning" role="note" className="rounded-xl bg-warn-bg p-3 text-sm font-semibold text-warn-ink">
          {t("note.helper")}
        </p>
      </div>
      <p role={state.ok ? "status" : "alert"} className={`mt-2 min-h-6 ${state.ok ? "text-teal" : "text-danger"}`}>
        {problem ?? state.message ?? ""}
      </p>
      {updatedAt && <p className="text-sm text-muted">Last changed {new Date(updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</p>}
      <button type="submit" className="btn btn-secondary mt-3" disabled={pending || !!problem}>
        Save note
      </button>
    </form>
  );
}
