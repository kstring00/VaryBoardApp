/**
 * pnpm content:audit — the content gate. Fails (exit 1) when:
 *   1. A published program uses a movement Eric has not reviewed (reviewed_by_eric = false).
 *      Published = not archived, and a clinician program or a reviewed starter plan.
 *      Checks the seed always, and the live database when SUPABASE_SERVICE_ROLE_KEY (or
 *      DATABASE_URL) is set.
 *   2. App copy contains: cure, heal, guarantee, live longer, diagnos..., the word "free"
 *      (anywhere, which also keeps it away from the VA wording), lorem, outcome or adherence
 *      claims ("improves adherence", "faster recovery", "reduces pain", "prevents falls", a
 *      percentage next to "adherence"), or billing terms. Comments are skipped for the copy
 *      rules; billing terms are checked everywhere, comments included.
 *   3. An <img> has no alt attribute.
 *   4. An unreviewed seed movement is not labeled "[DRAFT]", or the genres are not the fixed six.
 * Lists (without failing) every app-copy string in content/app-copy.json still waiting for Eric.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { GENRES, MOVEMENTS, STARTER_PROGRAMS } from "../content/seed";
import { WORKOUTS } from "../content/workouts";

const root = process.cwd();
const failures: string[] = [];
const warnings: string[] = [];
const fail = (m: string) => failures.push(m);

/* 1. Published programs vs unreviewed movements ------------------------------------------- */
const reviewed = new Set(MOVEMENTS.filter((m) => m.reviewedByEric).map((m) => m.slug));
for (const p of STARTER_PROGRAMS) {
  const slugs = p.sessions.flatMap((s) => s.blocks.map((b) => b.movementSlug));
  const drafts = slugs.filter((s) => !reviewed.has(s));
  if (p.reviewedByEric && drafts.length) fail(`seed: starter plan ${p.code} is published (reviewed) but uses unreviewed movements: ${drafts.join(", ")}`);
  else if (drafts.length) warnings.push(`seed: starter plan ${p.code} is unreviewed, so it stays hidden in production (${drafts.length} draft movements)`);
}

/* 1b. Self-guided workouts: same rule, plus every movement must exist and drafts are labeled. */
const known = new Set(MOVEMENTS.map((m) => m.slug));
for (const w of WORKOUTS) {
  const slugs = w.blocks.map((b) => b.movementSlug);
  const missing = slugs.filter((s) => !known.has(s));
  if (missing.length) fail(`workouts: ${w.slug} uses unknown movements: ${missing.join(", ")}`);
  const drafts = slugs.filter((s) => !reviewed.has(s));
  if (w.reviewedByEric && drafts.length) fail(`workouts: ${w.slug} is published (reviewed) but uses unreviewed movements: ${drafts.join(", ")}`);
  if (!w.reviewedByEric && !w.name.startsWith("[DRAFT] ")) fail(`workouts: unreviewed workout "${w.name}" must be labeled [DRAFT]`);
  if (w.blocks.length > 6) fail(`workouts: ${w.slug} has ${w.blocks.length} exercises (six at most)`);
}
if (WORKOUTS.some((w) => !w.reviewedByEric)) warnings.push(`workouts: ${WORKOUTS.filter((w) => !w.reviewedByEric).length} of ${WORKOUTS.length} workouts await Eric's review (hidden in production)`);

async function databaseCheck() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let rows: { program_code: string; program_kind: string; movement_slug: string }[] | null = null;
  let texts: { where: string; text: string }[] = [];
  if (url && service) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, service, { auth: { persistSession: false } });
    const r = await sb.rpc("content_audit");
    if (r.error) return fail(`database: content_audit() failed: ${r.error.message}`);
    rows = r.data;
    const mv = await sb.from("movements").select("slug, name, cues, safety_note");
    texts = (mv.data ?? []).flatMap((m) => [m.name, m.safety_note ?? "", ...(m.cues ?? [])].map((t) => ({ where: `database movement ${m.slug}`, text: t })));
  } else if (process.env.DATABASE_URL) {
    const pg = (await import("pg")).default;
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    rows = (await client.query("select * from public.content_audit()")).rows;
    const mv = await client.query("select slug, name, cues, safety_note from public.movements");
    texts = mv.rows.flatMap((m) => [m.name, m.safety_note ?? "", ...(m.cues ?? [])].map((t: string) => ({ where: `database movement ${m.slug}`, text: t })));
    await client.end();
  } else {
    warnings.push("database: not checked (set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL, or DATABASE_URL, to check the live data)");
    return;
  }
  for (const r of rows ?? []) fail(`database: ${r.program_kind} program ${r.program_code} uses unreviewed movement ${r.movement_slug}`);
  for (const t of texts) checkCopy(t.where, t.text);
  console.log(`✓ database checked (${(rows ?? []).length} violations)`);
}

/* 2. Copy rules ----------------------------------------------------------------------------- */
const COPY_RULES: { name: string; re: RegExp }[] = [
  { name: "cure language", re: /\bcur(e|es|ed|ing)\b/i },
  { name: "heal language", re: /\bheal(s|ed|ing|er)?\b/i },
  { name: "guarantee", re: /\bguarantee/i },
  { name: "lifespan claim", re: /live longer|lifespan|add(s|ed)? years/i },
  { name: "diagnosis language", re: /diagnos/i },
  { name: 'the word "free"', re: /\bfree\b/i },
  { name: "lorem ipsum", re: /lorem/i },
  { name: "outcome claim", re: /improv(e|es|ed|ing) adherence|faster recovery|reduc(e|es|ed|ing) pain|prevent(s|ed|ing)? falls/i },
  { name: "percentage next to adherence", re: /\d+\s?%[^.\n]{0,40}adherence|adherence[^.\n]{0,40}\d+\s?%/i },
];
const BILLING = { name: "billing term", re: /\bRTM\b|\bCPT\b|reimburs|billable/i };

function checkCopy(where: string, text: string) {
  for (const r of COPY_RULES) if (r.re.test(text)) fail(`${where}: ${r.name}: "${text.trim().slice(0, 120)}"`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|json|sql)$/.test(name)) out.push(p);
  }
  return out;
}

const files = ["app", "components", "content", "lib"].flatMap((d) => walk(path.join(root, d))).concat(path.join(root, "supabase", "seed.sql"));
for (const file of files) {
  const rel = path.relative(root, file);
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  let inBlock = false;
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    if (BILLING.re.test(line)) fail(`${where}: ${BILLING.name}: "${line.trim().slice(0, 120)}"`);
    const t = line.trim();
    if (inBlock) {
      if (t.includes("*/")) inBlock = false;
      return;
    }
    if (t.startsWith("/*") || t.startsWith("{/*")) {
      if (!t.includes("*/")) inBlock = true;
      return;
    }
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("--")) return;
    checkCopy(where, line.replace(/\/\/ .*$/, ""));
  });
  // 3. <img> without alt (the tag may span lines).
  for (const m of text.matchAll(/<img\b[^>]*>/gs)) if (!/\balt=/.test(m[0])) fail(`${rel}: <img> without alt`);
}

/* 4. Seed integrity ------------------------------------------------------------------------- */
const SIX = ["climb:Climb", "strengthen:Strengthen", "stretch:Stretch", "loosen:Loosen", "steady:Steady", "rise:Rise"];
if (GENRES.map((g) => `${g.slug}:${g.name}`).join() !== SIX.join()) fail("seed: the genres must be exactly Climb, Strengthen, Stretch, Loosen, Steady, Rise");
if (MOVEMENTS.some((m) => m.genreSlug === "loosen" && !m.reviewedByEric)) warnings.push("seed: Loosen has draft movements");
for (const m of MOVEMENTS) if (!m.reviewedByEric && !m.name.startsWith("[DRAFT] ")) fail(`seed: unreviewed movement "${m.name}" must be labeled [DRAFT]`);

/* Unreviewed app copy (listed, not failing) ------------------------------------------------ */
try {
  const copy = JSON.parse(readFileSync(path.join(root, "content", "app-copy.json"), "utf8")) as Record<string, { text: string; reviewedByEric: boolean }>;
  const open = Object.entries(copy).filter(([, v]) => !v.reviewedByEric);
  for (const [k, v] of Object.entries(copy)) checkCopy(`content/app-copy.json ${k}`, v.text);
  if (open.length) warnings.push(`app copy: ${open.length} strings in content/app-copy.json await Eric's review`);
} catch {
  /* no copy file yet */
}

databaseCheck().then(() => {
  for (const w of warnings) console.log(`• ${w}`);
  if (failures.length) {
    for (const f of failures) console.error(`✗ ${f}`);
    console.error(`\nContent audit failed (${failures.length}).`);
    process.exit(1);
  }
  console.log(`✓ content audit passed (${files.length} files)`);
});
