"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AnchorPicker } from "@/components/AnchorPicker";
import { createProgramAction } from "@/app/(vb-app)/app/clinician/actions";
import { phiWarning } from "@/content/site";
import { GENRE_NAMES } from "@/lib/genres";
import { t } from "@/lib/copy";
import { LABEL_MAX, NOTE_MAX, labelProblem, noteProblem, phoneProblem } from "@/lib/labels";
import { LONG_SESSION_MINUTES, MAX_EXERCISES, WARN_EXERCISES, estimateSeconds, prescription } from "@/lib/program";
import type { AnchorCell, Genre, GenreSlug, Movement, PatientProgram } from "@/lib/types";

interface BlockDraft {
  key: string;
  movementId: string;
  sets: string;
  reps: string;
  holdSeconds: string;
  bandColor: string;
  anchor: AnchorCell | null;
  open: boolean;
}
interface SessionDraft {
  key: string;
  name: string;
  estMinutes: string;
  blocks: BlockDraft[];
}

let seq = 0;
const k = () => `k${++seq}`;
const str = (n: number | null | undefined) => (n == null ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const BAND_COLORS = ["Yellow", "Red", "Green", "Blue", "Black"];

function blockFrom(m: Movement, over?: Partial<BlockDraft>): BlockDraft {
  return { key: k(), movementId: m.id, sets: str(m.defaultSets ?? 2), reps: str(m.defaultReps), holdSeconds: str(m.defaultHoldSeconds), bandColor: "", anchor: m.defaultAnchor, open: false, ...over };
}

export function ProgramBuilder({
  movements,
  genres,
  sources,
  initial,
  initialFrom,
  clinicName,
}: {
  movements: Movement[];
  genres: Genre[];
  sources: { code: string; name: string; kind: "template" | "mine" }[];
  initial: PatientProgram | null;
  initialFrom: string | null;
  clinicName: string | null;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(movements.map((m) => [m.id, m])), [movements]);
  const dropped = initial ? initial.sessions.flatMap((s) => s.blocks).filter((b) => !byId.has(b.movement.id)).length : 0;

  const [name, setName] = useState(initial && !initial.isStarter ? `${initial.name}`.slice(0, LABEL_MAX.program) : "");
  const [clinic, setClinic] = useState(initial?.clinicName ?? clinicName ?? "");
  const [phone, setPhone] = useState(initial?.clinicPhone ?? "");
  const [days, setDays] = useState(String(initial?.daysPerWeek ?? 3));
  const [note, setNote] = useState(initial && !initial.isStarter ? initial.therapistNote ?? "" : "");
  const [sessions, setSessions] = useState<SessionDraft[]>(() =>
    initial
      ? initial.sessions.map((s) => ({
          key: k(),
          name: s.name.replace(/^\[DRAFT\]\s*/, ""),
          estMinutes: str(s.estMinutes),
          blocks: s.blocks.filter((b) => byId.has(b.movement.id)).map((b) => blockFrom(byId.get(b.movement.id)!, { sets: str(b.sets), reps: str(b.reps), holdSeconds: str(b.holdSeconds), bandColor: b.bandColor ?? "", anchor: b.anchor })),
        }))
      : [{ key: k(), name: "", estMinutes: "", blocks: [] }],
  );
  const [picker, setPicker] = useState<string | null>(null);
  const [genre, setGenre] = useState<GenreSlug | "all">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const drag = useRef<{ s: string; i: number } | null>(null);

  const patchSession = (key: string, f: (s: SessionDraft) => SessionDraft) => setSessions((xs) => xs.map((s) => (s.key === key ? f(s) : s)));
  const patchBlock = (sk: string, bk: string, patch: Partial<BlockDraft>) => patchSession(sk, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.key === bk ? { ...b, ...patch } : b)) }));
  const move = (sk: string, from: number, to: number) =>
    patchSession(sk, (s) => {
      if (to < 0 || to >= s.blocks.length) return s;
      const blocks = [...s.blocks];
      const [b] = blocks.splice(from, 1);
      blocks.splice(to, 0, b);
      return { ...s, blocks };
    });

  const nameErr = labelProblem(name, LABEL_MAX.program);
  const clinicErr = clinic.trim() ? labelProblem(clinic, LABEL_MAX.clinic) : null;
  const phoneErr = phoneProblem(phone);
  const noteErr = noteProblem(note);
  const sessionErrs = sessions.map((s) => labelProblem(s.name, LABEL_MAX.session) ?? (s.blocks.length === 0 ? "Add at least one exercise." : s.blocks.length > MAX_EXERCISES ? t("builder.max") : null));
  const blockErr = (b: BlockDraft) => (!b.reps.trim() && !b.holdSeconds.trim() ? "Set reps, a hold, or both." : null);
  const valid = !nameErr && !clinicErr && !phoneErr && !noteErr && sessionErrs.every((e) => !e) && sessions.every((s) => s.blocks.every((b) => !blockErr(b)));
  const totalExercises = sessions.reduce((n, s) => n + s.blocks.length, 0);

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!valid) {
      setError("Check the highlighted fields.");
      return;
    }
    setBusy(true);
    const r = await createProgramAction({
      name: name.trim(),
      clinicName: clinic.trim() || null,
      clinicPhone: phone.trim() || null,
      therapistNote: note.trim() || null,
      daysPerWeek: Number(days),
      sessions: sessions.map((s) => ({
        name: s.name.trim(),
        estMinutes: num(s.estMinutes),
        blocks: s.blocks.map((b) => ({ movementId: b.movementId, sets: num(b.sets), reps: num(b.reps), holdSeconds: num(b.holdSeconds), bandColor: b.bandColor.trim() || null, anchor: b.anchor })),
      })),
    });
    setBusy(false);
    if (r.code) router.push(`/app/clinician/${r.code}?created=1`);
    else setError(r.error ?? "Could not create the program.");
  };

  const shownMovements = movements.filter((m) => (genre === "all" || m.genreSlug === genre) && m.name.toLowerCase().includes(query.trim().toLowerCase()));
  const err = (msg: string | null) => (touched && msg ? <p className="mt-1 text-sm text-danger">{msg}</p> : null);

  return (
    <div className="space-y-6">
      <p role="note" className="rounded-xl border-2 border-warn-ink/30 bg-warn-bg p-4 font-semibold text-warn-ink">
        {phiWarning} Name the program for what it is, like &ldquo;Home program A&rdquo;.
      </p>

      <section className="card p-5" aria-labelledby="start-h">
        <h2 id="start-h" className="text-2xl">
          Start from
        </h2>
        <p className="mt-1 text-muted">A starter template from Dr. Eric, or one of your own programs to duplicate.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`chip min-h-12 border-2 px-4 ${!initialFrom ? "border-teal bg-mint-wash font-semibold" : "border-line bg-surface"}`} onClick={() => router.push("/app/clinician/new")}>
            Blank
          </button>
          {sources.map((s) => (
            <button key={s.code} type="button" className={`chip min-h-12 border-2 px-4 ${initialFrom === s.code ? "border-teal bg-mint-wash font-semibold" : "border-line bg-surface"}`} onClick={() => router.push(`/app/clinician/new?from=${s.code}`)}>
              {s.kind === "template" ? "Template: " : "Duplicate: "}
              {s.name}
            </button>
          ))}
        </div>
        {dropped > 0 && <p className="mt-3 text-warn-ink">{dropped} exercise(s) from that program are not available and were left out.</p>}
      </section>

      <section className="card space-y-4 p-5" aria-labelledby="details-h">
        <h2 id="details-h" className="text-2xl">
          Program
        </h2>
        <label className="block">
          <span className="label">Program name (the patient sees this)</span>
          <input className="field" value={name} maxLength={LABEL_MAX.program} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!nameErr} placeholder="Home program A" />
          {err(nameErr)}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Clinic name</span>
            <input className="field" value={clinic} maxLength={LABEL_MAX.clinic} onChange={(e) => setClinic(e.target.value)} autoComplete="organization" />
            {err(clinicErr)}
          </label>
          <label className="block">
            <span className="label">Clinic phone (patients can tap to call)</span>
            <input className="field" type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            {err(phoneErr)}
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="block">
            <span className="label">Note to your patient (optional)</span>
            <textarea className="field min-h-24" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Keep the band light this week." aria-describedby="builder-note-warning" />
            <span className="mt-1 block text-sm text-muted">
              {note.length}/{NOTE_MAX}
            </span>
            {err(noteErr)}
          </label>
          <p id="builder-note-warning" role="note" className="rounded-xl bg-warn-bg p-3 text-sm font-semibold text-warn-ink">
            {t("note.helper")}
          </p>
        </div>
        <label className="block">
          <span className="label">Sessions a week</span>
          <select className="field" value={days} onChange={(e) => setDays(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </section>

      {sessions.map((s, si) => (
        <section key={s.key} className="card p-5" aria-label={`Session ${si + 1}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-2xl">Session {si + 1}</h2>
            {sessions.length > 1 && (
              <button type="button" className="btn btn-quiet" onClick={() => setSessions((xs) => xs.filter((x) => x.key !== s.key))}>
                Remove session
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_10rem]">
            <label className="block">
              <span className="label">Session name</span>
              <input className="field" value={s.name} maxLength={LABEL_MAX.session} placeholder="Shoulder mobility" onChange={(e) => patchSession(s.key, (x) => ({ ...x, name: e.target.value }))} />
              {err(sessionErrs[si])}
            </label>
            <label className="block">
              <span className="label">Minutes</span>
              <input
                className="field"
                inputMode="numeric"
                value={s.estMinutes}
                placeholder={String(Math.max(1, Math.ceil(estimateSeconds(s.blocks.map((b) => ({ sets: num(b.sets), reps: num(b.reps), holdSeconds: num(b.holdSeconds) }))) / 60)))}
                onChange={(e) => patchSession(s.key, (x) => ({ ...x, estMinutes: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) }))}
              />
            </label>
          </div>

          <ol className="mt-4 space-y-2">
            {s.blocks.map((b, bi) => {
              const m = byId.get(b.movementId)!;
              const bErr = blockErr(b);
              return (
                <li
                  key={b.key}
                  draggable
                  onDragStart={() => (drag.current = { s: s.key, i: bi })}
                  onDragOver={(e) => drag.current?.s === s.key && e.preventDefault()}
                  onDrop={() => {
                    if (drag.current?.s === s.key) move(s.key, drag.current.i, bi);
                    drag.current = null;
                  }}
                  className={`rounded-xl border bg-white ${touched && bErr ? "border-danger" : "border-line"}`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 p-2">
                    <span aria-hidden="true" className="cursor-grab select-none px-1 text-xl text-muted" title="Drag to reorder">
                      ⋮⋮
                    </span>
                    <button type="button" className="min-h-12 min-w-0 flex-1 basis-56 text-left" aria-expanded={b.open} onClick={() => patchBlock(s.key, b.key, { open: !b.open })}>
                      <span className="block font-semibold">
                        {bi + 1}. {m.name}
                      </span>
                      <span className="block text-sm text-muted">
                        {GENRE_NAMES[m.genreSlug]} · {prescription({ sets: num(b.sets), reps: num(b.reps), holdSeconds: num(b.holdSeconds) })}
                        {b.bandColor ? ` · ${b.bandColor} band` : ""} · {b.anchor ? "anchor saved" : "no anchor"}
                      </span>
                    </button>
                    <span className="ml-auto flex">
                    <button type="button" className="h-12 w-12 rounded-lg text-xl hover:bg-mint-wash disabled:opacity-30" aria-label={`Move ${m.name} up`} disabled={bi === 0} onClick={() => move(s.key, bi, bi - 1)}>
                      ↑
                    </button>
                    <button type="button" className="h-12 w-12 rounded-lg text-xl hover:bg-mint-wash disabled:opacity-30" aria-label={`Move ${m.name} down`} disabled={bi === s.blocks.length - 1} onClick={() => move(s.key, bi, bi + 1)}>
                      ↓
                    </button>
                    <button type="button" className="h-12 w-12 rounded-lg text-xl hover:bg-mint-wash" aria-label={`Remove ${m.name}`} onClick={() => patchSession(s.key, (x) => ({ ...x, blocks: x.blocks.filter((y) => y.key !== b.key) }))}>
                      ×
                    </button>
                    </span>
                  </div>
                  {b.open && (
                    <div className="space-y-4 border-t border-line p-3">
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["sets", "Sets"],
                            ["reps", "Reps"],
                            ["holdSeconds", "Hold (s)"],
                          ] as const
                        ).map(([f, label]) => (
                          <label key={f} className="block">
                            <span className="label text-sm">{label}</span>
                            <input className="field" inputMode="numeric" value={b[f]} onChange={(e) => patchBlock(s.key, b.key, { [f]: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })} />
                          </label>
                        ))}
                      </div>
                      {touched && bErr && <p className="text-sm text-danger">{bErr}</p>}
                      <label className="block">
                        <span className="label text-sm">Band color {m.needsBand ? "" : "(if any)"}</span>
                        <input className="field" list="band-colors" value={b.bandColor} maxLength={16} onChange={(e) => patchBlock(s.key, b.key, { bandColor: e.target.value.replace(/[^A-Za-z ]/g, "") })} />
                      </label>
                      <AnchorPicker value={b.anchor} suggested={m.defaultAnchor} onChange={(a) => patchBlock(s.key, b.key, { anchor: a })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {(() => {
            const minutes = Math.ceil(estimateSeconds(s.blocks.map((b) => ({ sets: num(b.sets), reps: num(b.reps), holdSeconds: num(b.holdSeconds) }))) / 60);
            const shown = num(s.estMinutes) ?? minutes;
            return (
              <div className="mt-3 space-y-2" aria-live="polite">
                <p className={`text-sm font-semibold ${shown > LONG_SESSION_MINUTES ? "rounded-lg bg-warn-bg p-2 text-warn-ink" : "text-muted"}`} data-testid="session-minutes">
                  About {shown} min · {s.blocks.length} of {MAX_EXERCISES} exercises
                  {shown > LONG_SESSION_MINUTES ? `. ${t("builder.overTime")}` : ""}
                </p>
                {s.blocks.length >= WARN_EXERCISES && s.blocks.length < MAX_EXERCISES && <p className="rounded-lg bg-warn-bg p-2 text-sm text-warn-ink">{t("builder.warnLong")}</p>}
                {s.blocks.length >= MAX_EXERCISES && (
                  <p role="status" className="rounded-lg bg-warn-bg p-2 text-sm font-semibold text-warn-ink">
                    {t("builder.max")}
                  </p>
                )}
              </div>
            );
          })()}

          {picker === s.key ? (
            <div className="mt-4 rounded-xl border-2 border-teal p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Add from the library</p>
                <button type="button" className="btn btn-quiet" onClick={() => setPicker(null)}>
                  Done
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Genre">
                {(["all", ...genres.map((g) => g.slug)] as const).map((g) => (
                  <button key={g} type="button" aria-pressed={genre === g} className={`chip min-h-12 border-2 px-3 ${genre === g ? "border-teal bg-mint-wash font-semibold" : "border-line bg-surface"}`} onClick={() => setGenre(g)}>
                    {g === "all" ? "All" : GENRE_NAMES[g]}
                  </button>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="sr-only">Search movements</span>
                <input className="field" type="search" placeholder="Search movements" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                {shownMovements.length === 0 && <li className="p-2 text-muted">{genre === "loosen" ? "No Loosen movements are published yet." : "No movements match."}</li>}
                {shownMovements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-mint-wash">
                    <span>
                      <span className="block font-medium">{m.name}</span>
                      <span className="block text-sm text-muted">
                        {GENRE_NAMES[m.genreSlug]} · level {m.level}
                        {m.seatedAlternativeId ? " · has a seated version" : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-12 px-4 text-base"
                      disabled={s.blocks.length >= MAX_EXERCISES}
                      aria-label={`Add ${m.name}`}
                      onClick={() => patchSession(s.key, (x) => (x.blocks.length >= MAX_EXERCISES ? x : { ...x, blocks: [...x.blocks, blockFrom(m)] }))}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setPicker(s.key)} disabled={s.blocks.length >= MAX_EXERCISES}>
              Add exercise
            </button>
          )}
        </section>
      ))}

      {sessions.length < 7 && (
        <button type="button" className="btn btn-quiet w-full" onClick={() => setSessions((xs) => [...xs, { key: k(), name: "", estMinutes: "", blocks: [] }])}>
          Add another session
        </button>
      )}

      <datalist id="band-colors">
        {BAND_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        {error && (
          <p role="alert" className="mb-2 text-danger">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary w-full" onClick={submit} disabled={busy}>
          {busy ? "Creating…" : `Create program and get code (${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}, ${totalExercises} exercises)`}
        </button>
      </div>
    </div>
  );
}
