"use client";

/**
 * Everything the patient side keeps lives on this device, in localStorage under `vb.*`.
 *
 *  - Personalization (first name, next appointment, notes for the therapist, skip reasons)
 *    NEVER leaves the device. It is only used on screen and in the progress summary PDF,
 *    which is also made on the device.
 *  - What syncs (when Supabase is configured): program code, a random device id, which
 *    exercises were done / skipped / made easier, when, and how movement felt.
 *
 * Every access is wrapped in try/catch: private windows and locked-down browsers can throw,
 * and the app keeps working (memory only for this visit).
 */
import { useSyncExternalStore } from "react";
import type { BoardModel, Feel, PatientProgram } from "@/lib/types";

export interface LocalItem {
  id: string;
  blockId: string;
  movementId: string;
  movementName: string;
  done: boolean;
  skipped: boolean;
  /** Device only. */
  skipReason: string | null;
  /** Which movement was used: the plan's, its easier alternative, or its seated alternative. */
  variant: "plan" | "easier" | "seated";
  /** "Make it easier" with no alternative: one step down in dose. */
  doseEased: boolean;
  /** A made_easier event was already logged for this exercise in this session. */
  easedLogged: boolean;
}

export interface LocalCompletion {
  id: string;
  programCode: string;
  programSessionId: string;
  sessionName: string;
  startedAt: string;
  completedAt: string;
  feel: Feel | null;
  items: LocalItem[];
}

/** The session in progress, saved after every exercise so nothing is lost. */
export interface ActiveSession {
  id: string;
  programCode: string;
  programSessionId: string;
  sessionName: string;
  startedAt: string;
  /** Block ids in the order they will be done ("Do this later" moves one to the end). */
  queue: string[];
  index: number;
  phase: "setup" | "exercise" | "feel" | "done";
  items: Record<string, LocalItem>;
  /** Where the timer was, so a screen lock or app switch never loses a rep. */
  timer?: { blockId: string; step: number };
  /** Set when the session is saved (phase "done"). */
  completionId?: string;
}

export type TextSize = "default" | "large" | "largest";
export type MotionPref = "system" | "reduce";

export interface Settings {
  textSize: TextSize;
  motion: MotionPref;
  boardModel: BoardModel;
  /** "I use a chair or wheelchair": seated alternatives are used automatically. */
  chairUser: boolean;
  /** Speak the exercise name and target when it starts. */
  spokenCues: boolean;
}

/** Device only, never sent anywhere. */
/** The habit anchor and commitment (device only). */
export type HabitAnchor = "coffee" | "walk" | "tv" | "bed" | "custom";
export interface Habit {
  programCode: string;
  anchor: HabitAnchor;
  /** "HH:MM", local. */
  time: string;
  /** ISO weekdays, 1 = Monday ... 7 = Sunday. */
  days: number[];
  committedAt: string | null;
}

export interface Profile {
  firstName: string;
  /** Local date-time "2026-10-02T14:30", or "" */
  appointment: string;
  notes: string;
}

const KEYS = {
  deviceId: "vb.deviceId",
  program: "vb.program",
  completions: "vb.completions",
  active: "vb.active",
  outbox: "vb.outbox",
  settings: "vb.settings",
  profile: "vb.profile",
  habit: "vb.habit",
  a2hsShown: "vb.a2hsShown",
} as const;

const memory = new Map<string, string>();
const EVENT = "vb-store";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
  }
  cache.delete(key);
  window.dispatchEvent(new Event(EVENT));
}

// Parsed values are cached per raw string so useSyncExternalStore gets stable snapshots.
const cache = new Map<string, { raw: string | null; value: unknown }>();
function readJson<T>(key: string, fallback: T): T {
  const raw = read(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith("vb.")) {
      cache.clear();
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function uuid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Older browsers without randomUUID: RFC 4122 v4 from getRandomValues.
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getDeviceId(): string {
  let id = read(KEYS.deviceId);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = uuid();
    write(KEYS.deviceId, id);
  }
  return id;
}

/* Program ---------------------------------------------------------------------------------- */

export const getProgram = () => readJson<PatientProgram | null>(KEYS.program, null);
export function setProgram(p: PatientProgram | null) {
  const prev = getProgram();
  write(KEYS.program, p ? JSON.stringify(p) : null);
  // A different program cannot resume the old program's session.
  if (!p || p.code !== prev?.code) write(KEYS.active, null);
}

/* Completions ------------------------------------------------------------------------------ */

const NONE: LocalCompletion[] = [];
export const getCompletions = () => readJson<LocalCompletion[]>(KEYS.completions, NONE);
export function addCompletion(c: LocalCompletion) {
  write(KEYS.completions, JSON.stringify([...getCompletions().filter((x) => x.id !== c.id), c].slice(-500)));
}

/* Active session --------------------------------------------------------------------------- */

export const getActive = () => readJson<ActiveSession | null>(KEYS.active, null);
export const setActive = (a: ActiveSession | null) => write(KEYS.active, a ? JSON.stringify(a) : null);

/* Outbox: completions waiting to sync ------------------------------------------------------ */

export interface OutboxEntry {
  completion: LocalCompletion;
  deviceId: string;
}
const NO_OUTBOX: OutboxEntry[] = [];
export const getOutbox = () => readJson<OutboxEntry[]>(KEYS.outbox, NO_OUTBOX);
export const setOutbox = (xs: OutboxEntry[]) => write(KEYS.outbox, xs.length ? JSON.stringify(xs) : null);

/* Settings --------------------------------------------------------------------------------- */

export const DEFAULT_SETTINGS: Settings = { textSize: "default", motion: "system", boardModel: "vb", chairUser: false, spokenCues: true };
let settingsSnap: { raw: unknown; value: Settings } = { raw: null, value: DEFAULT_SETTINGS };
export function getSettings(): Settings {
  const s = readJson<Partial<Settings> | null>(KEYS.settings, null);
  if (s !== settingsSnap.raw) settingsSnap = { raw: s, value: s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS };
  return settingsSnap.value;
}
export function updateSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, JSON.stringify(next));
  applySettingsToDocument(next);
}
export function applySettingsToDocument(s: Settings) {
  const html = document.documentElement;
  if (s.textSize === "default") html.removeAttribute("data-text-size");
  else html.setAttribute("data-text-size", s.textSize);
  if (s.motion === "reduce") html.setAttribute("data-motion", "reduce");
  else html.removeAttribute("data-motion");
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (getSettings().motion === "reduce") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/* Profile (device only) -------------------------------------------------------------------- */

export const EMPTY_PROFILE: Profile = { firstName: "", appointment: "", notes: "" };
let profileSnap: { raw: unknown; value: Profile } = { raw: null, value: EMPTY_PROFILE };
export function getProfile(): Profile {
  const p = readJson<Partial<Profile> | null>(KEYS.profile, null);
  if (p !== profileSnap.raw) profileSnap = { raw: p, value: p ? { ...EMPTY_PROFILE, ...p } : EMPTY_PROFILE };
  return profileSnap.value;
}
export function updateProfile(patch: Partial<Profile>) {
  write(KEYS.profile, JSON.stringify({ ...getProfile(), ...patch }));
}

/* Habit + commitment (device only) --------------------------------------------------------- */

export const getHabit = () => readJson<Habit | null>(KEYS.habit, null);
export const setHabit = (h: Habit | null) => write(KEYS.habit, h ? JSON.stringify(h) : null);

export function getA2hsShown(): boolean {
  return read(KEYS.a2hsShown) === "1";
}
export const setA2hsShown = () => write(KEYS.a2hsShown, "1");

/* Clear ------------------------------------------------------------------------------------ */

export async function clearDeviceData() {
  for (const k of Object.values(KEYS)) write(k, null);
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("vb.")) window.localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable: memory is cleared below */
  }
  memory.clear();
  cache.clear();
  try {
    if ("caches" in window) await caches.delete("vb-videos");
  } catch {
    /* ignore */
  }
  applySettingsToDocument(DEFAULT_SETTINGS);
  window.dispatchEvent(new Event(EVENT));
}

/* React hooks ------------------------------------------------------------------------------ */
// Server snapshots are "not loaded yet" (undefined) so SSR and the first paint match.

export const useProgram = (): PatientProgram | null | undefined => useSyncExternalStore(subscribe, getProgram, () => undefined);
export const useCompletions = (): LocalCompletion[] | undefined => useSyncExternalStore(subscribe, getCompletions, () => undefined);
export const useActive = (): ActiveSession | null | undefined => useSyncExternalStore(subscribe, getActive, () => undefined);
export const useSettings = (): Settings => useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
export const useProfile = (): Profile | undefined => useSyncExternalStore(subscribe, getProfile, () => undefined);
export const useHabit = (): Habit | null | undefined => useSyncExternalStore(subscribe, getHabit, () => undefined);
export const useOutboxCount = (): number => useSyncExternalStore(subscribe, () => getOutbox().length, () => 0);
