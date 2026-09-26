"use client";

import { useEffect, useState } from "react";
import { CodeEntry } from "@/components/app/CodeEntry";
import { PhoneIcon } from "@/components/app/icons";
import { updateProfile, useProfile, useProgram } from "@/lib/client/store";

export function CareView() {
  const program = useProgram();
  const profile = useProfile();
  const [changing, setChanging] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Notes save as you type (debounced), on this device only.
  useEffect(() => {
    if (notes === null) return;
    const t = window.setTimeout(() => {
      updateProfile({ notes });
      setSaved(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, [notes]);

  if (program === undefined || profile === undefined) return <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface" aria-busy="true" />;

  const [date, time] = profile.appointment ? profile.appointment.split("T") : ["", ""];
  const setAppointment = (d: string, t: string) => updateProfile({ appointment: d ? (t ? `${d}T${t}` : d) : "" });

  return (
    <div className="mt-6 space-y-5">
      <section id="code" aria-labelledby="code-h" className="card scroll-mt-4 p-5">
        <h2 id="code-h" className="text-2xl">
          Therapist code
        </h2>
        {program && !changing ? (
          <>
            <p className="mt-2">
              You are following <span className="font-semibold">{program.name}</span>.
            </p>
            <p className="mt-1 font-display text-3xl tracking-[0.2em]">{program.code}</p>
            <button type="button" className="btn btn-quiet -ml-4 mt-1" onClick={() => setChanging(true)}>
              Enter a new code
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted">Six letters and numbers, from your physical therapist.</p>
            <CodeEntry />
          </>
        )}
      </section>

      <section aria-labelledby="clinic-h" className="card p-5">
        <h2 id="clinic-h" className="text-2xl">
          Your clinic
        </h2>
        {program?.clinicName || program?.clinicPhone ? (
          <>
            {program.clinicName && <p className="mt-2 text-lg font-semibold">{program.clinicName}</p>}
            {program.clinicPhone && (
              <a href={`tel:${program.clinicPhone.replace(/[^0-9+]/g, "")}`} className="btn btn-primary mt-4 w-full">
                <PhoneIcon /> Call {program.clinicPhone}
              </a>
            )}
          </>
        ) : (
          <p className="mt-2 text-muted">{program?.isStarter ? "Starter plans are not linked to a clinic. Ask your therapist for a code to connect your plan." : "Your clinic's details appear here once you enter your therapist's code."}</p>
        )}
      </section>

      <section id="appointment" aria-labelledby="appt-h" className="card scroll-mt-4 p-5">
        <h2 id="appt-h" className="text-2xl">
          Next appointment
        </h2>
        <p className="mt-1 text-sm text-muted">Saved on this phone only.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            <span className="label">Date</span>
            <input type="date" className="field" value={date ?? ""} onChange={(e) => setAppointment(e.target.value, time ?? "")} />
          </label>
          <label>
            <span className="label">Time</span>
            <input type="time" className="field" value={time ?? ""} onChange={(e) => setAppointment(date ?? "", e.target.value)} disabled={!date} />
          </label>
        </div>
        {profile.appointment && (
          <button type="button" className="btn btn-quiet -ml-4 mt-1" onClick={() => updateProfile({ appointment: "" })}>
            Clear appointment
          </button>
        )}
      </section>

      <section aria-labelledby="notes-h" className="card p-5">
        <h2 id="notes-h" className="text-2xl">
          <label htmlFor="notes">Notes for my therapist</label>
        </h2>
        <p className="mt-1 text-sm text-muted">Stays on this phone. It is added to your progress summary when you export it.</p>
        <textarea
          id="notes"
          rows={5}
          maxLength={1200}
          className="field mt-3 min-h-40"
          value={notes ?? profile.notes}
          onChange={(e) => {
            setSaved(false);
            setNotes(e.target.value);
          }}
          placeholder="Questions for your next visit, or anything you noticed during the week."
        />
        <p className="mt-1 min-h-6 text-sm text-muted" aria-live="polite">
          {saved ? "Saved on this phone." : ""}
        </p>
      </section>
    </div>
  );
}
