/**
 * Rules for clinician-written labels (program name, session names, clinic name). They must
 * never carry a patient name or health detail about a person. Mirrors public.label_is_safe()
 * in the migration, which enforces the same rules in the database.
 */
export const LABEL_MAX = { program: 40, session: 40, clinic: 80 } as const;

export function labelProblem(raw: string, max: number): string | null {
  const n = raw.trim();
  if (!n) return "Required.";
  if (n.length > max) return `Keep it to ${max} characters or fewer.`;
  if (n.includes("@")) return "No email addresses.";
  if ((n.match(/[0-9]/g) ?? []).length > 2) return "No numbers like dates, phone or record numbers.";
  if (/(^|[^a-z])(mr|mrs|ms|miss|mx)([^a-z]|$)/i.test(n)) return "No patient names or titles.";
  return null;
}

export function phoneProblem(raw: string): string | null {
  const p = raw.trim();
  if (!p) return null;
  return /^[0-9+() .-]{7,20}$/.test(p) ? null : "Use digits, spaces, dashes or brackets only.";
}

export const NOTE_MAX = 120;

/** Therapist note rules. Mirrors public.note_is_safe() and the 120-character check. */
export function noteProblem(raw: string): string | null {
  const n = raw.trim();
  if (!n) return null;
  if (n.length > NOTE_MAX) return `Keep it to ${NOTE_MAX} characters or fewer.`;
  if (n.includes("@")) return "No email addresses.";
  if (/[0-9]{4,}/.test(n) || /[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}/.test(n)) return "No dates, phone or record numbers.";
  if (/(^|[^a-z])(mr|mrs|ms|miss|mx)([^a-z]|$)/i.test(n)) return "No patient names or titles.";
  return null;
}
