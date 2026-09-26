/**
 * Database tests against a real Postgres (run with `pnpm db:test`, which sets DATABASE_URL and
 * loads the migration, seed.sql and seed.test.sql). Each check runs in a transaction that is
 * rolled back, acting as the Supabase API roles:
 *   anon           a patient device (no login)
 *   authenticated  a clinician (auth.uid() = the JWT sub)
 *   service_role   the build-time content audit
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { MOVEMENTS, TEST_CLINICIAN, TEST_PROGRAMS } from "../../content/seed";

const url = process.env.DATABASE_URL;
const skip = !url ? "DATABASE_URL not set (run `pnpm db:test`)" : false;

const A = TEST_CLINICIAN.id; // seeded test clinician, owns VBTEST
const B = "b0000000-0000-4000-8000-00000000000b";
const TEST = TEST_PROGRAMS[0];
const S1 = TEST.sessions[0];
const S2 = TEST.sessions[1];
const mv = (slug: string) => MOVEMENTS.find((m) => m.slug === slug)!.id;

let pool: pg.Pool;
type As = { role: "anon" } | { role: "authenticated"; uid: string } | { role: "service_role" };

/** Run fn in a transaction as the given API role; rolled back unless fn commits. */
async function as<T>(who: As, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${who.role}`);
    const claims = who.role === "authenticated" ? { sub: who.uid, role: "authenticated" } : { role: who.role };
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
}

const sessionsJson = (movementId: string) => JSON.stringify([{ name: "Morning", est_minutes: 10, blocks: [{ movement_id: movementId, sets: 1, reps: 12, anchor: { section: 2, row: 16, col: 2 } }] }]);

describe("database", { skip }, () => {
  let codeB = "";

  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    const c = await pool.connect();
    try {
      await c.query("insert into auth.users (id, email) values ($1, 'b@clinic.test') on conflict do nothing", [B]);
      await c.query("insert into public.clinicians (id, display_name, clinic_name) values ($1, 'Clinician B', 'Clinic B') on conflict do nothing", [B]);
    } finally {
      c.release();
    }
    codeB = await as({ role: "authenticated", uid: B }, async (c) => {
      const r = await c.query("select public.create_program('Group plan B', 'Clinic B', '(555) 010-0000', 2, $1::jsonb) as code", [sessionsJson(mv("draft-strengthen-standing-band-row"))]);
      await c.query("commit");
      await c.query("begin");
      return r.rows[0].code as string;
    });
  });
  after(async () => {
    await pool?.end();
  });

  it("generates 6-character codes without look-alike characters", () => {
    assert.match(codeB, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("seeds the six genres, zero Loosen movements, draft movements and one starter plan", async () => {
    await as({ role: "anon" }, async (c) => {
      const g = await c.query("select slug from public.genres order by sort");
      assert.deepEqual(g.rows.map((r) => r.slug), ["climb", "strengthen", "stretch", "loosen", "steady", "rise"]);
      const loosen = await c.query("select count(*)::int n from public.movements m join public.genres g on g.id = m.genre_id where g.slug = 'loosen'");
      assert.equal(loosen.rows[0].n, 0);
      const drafts = await c.query("select bool_and(not reviewed_by_eric) all_draft, bool_and(name like '[DRAFT] %') labeled from public.movements");
      assert.deepEqual(drafts.rows[0], { all_draft: true, labeled: true });
      const starters = await c.query("select p.code, p.name, count(b.id)::int n from public.programs p join public.program_sessions ps on ps.program_id = p.id join public.session_blocks b on b.program_session_id = ps.id group by 1, 2");
      assert.deepEqual(starters.rows, [{ code: "START1", name: "[DRAFT] Shoulder mobility", n: 4 }], "anon sees only the starter plan, with 4 exercises");
    });
  });

  it("RLS: a clinician cannot read another clinician's programs, sessions, blocks or profile", async () => {
    await as({ role: "authenticated", uid: A }, async (c) => {
      const own = await c.query("select code from public.programs where clinician_id is not null");
      assert.deepEqual(own.rows.map((r) => r.code), ["VBTEST"]);
      assert.equal((await c.query("select * from public.programs where code = $1", [codeB])).rowCount, 0);
      const sessions = await c.query("select ps.* from public.program_sessions ps join public.programs p on p.id = ps.program_id where p.clinician_id = $1", [B]);
      assert.equal(sessions.rowCount, 0);
      const blocks = await c.query("select b.* from public.session_blocks b join public.program_sessions ps on ps.id = b.program_session_id join public.programs p on p.id = ps.program_id where p.clinician_id = $1", [B]);
      assert.equal(blocks.rowCount, 0);
      assert.deepEqual((await c.query("select id from public.clinicians")).rows.map((r) => r.id), [A]);
    });
  });

  it("RLS: a clinician cannot change another clinician's program or claim one", async () => {
    await as({ role: "authenticated", uid: A }, async (c) => {
      assert.equal((await c.query("update public.programs set archived = true where code = $1", [codeB])).rowCount, 0);
    });
    await as({ role: "authenticated", uid: A }, async (c) => {
      await assert.rejects(c.query("insert into public.programs (clinician_id, name) values ($1, 'Sneaky')", [B]), /row-level security/);
    });
    await as({ role: "authenticated", uid: A }, async (c) => {
      await assert.rejects(c.query("update public.programs set code = 'AAAAAA' where code = 'VBTEST'"), /permission denied/);
    });
    await as({ role: "authenticated", uid: A }, async (c) => {
      const ps = await c.query("select ps.id from public.program_sessions ps join public.programs p on p.id = ps.program_id where p.code = $1", [codeB]);
      assert.equal(ps.rowCount, 0);
    });
  });

  it("RLS: patient devices cannot read programs, completions or clinicians directly", async () => {
    await as({ role: "anon" }, async (c) => {
      assert.equal((await c.query("select * from public.programs where code = 'VBTEST'")).rowCount, 0);
    });
    for (const table of ["completions", "exercise_events", "clinicians", "push_subscriptions"]) {
      await as({ role: "anon" }, async (c) => {
        await assert.rejects(c.query(`select * from public.${table}`), /permission denied/, table);
      });
    }
  });

  it("only the service role can run the content audit", async () => {
    for (const who of [{ role: "anon" } as As, { role: "authenticated", uid: A } as As]) {
      await as(who, async (c) => {
        await assert.rejects(c.query("select * from public.content_audit()"), /permission denied/);
      });
    }
  });

  it("get_program returns the plan with sessions, saved anchors and clinic contact", async () => {
    await as({ role: "anon" }, async (c) => {
      const p = (await c.query("select public.get_program('vbtest') as p")).rows[0].p;
      assert.equal(p.code, "VBTEST");
      assert.equal(p.name, "Home program A");
      assert.equal(p.clinic_phone, "555-0100");
      assert.equal(p.is_starter, false);
      assert.deepEqual(p.sessions.map((s: { name: string }) => s.name), ["Shoulder mobility", "Standing and balance"]);
      assert.equal(p.sessions[0].blocks.length, 4);
      assert.deepEqual(p.sessions[0].blocks[0].anchor, { section: 3, row: 6, col: 2 });
      assert.equal((await c.query("select public.get_program('ZZZZZZ') as p")).rows[0].p, null);
    });
  });

  it("round trip: code -> plan -> session -> events + completion -> adherence visible only to the owner", async () => {
    const completionId = randomUUID();
    const device = randomUUID();
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      const ev = "insert into public.exercise_events (client_event_id, program_code, device_id, session_block_id, event, occurred_at) values ($1, 'VBTEST', $2, $3, $4, now())";
      await c.query(ev, [randomUUID(), device, S1.blocks[0].id, "done"]);
      await c.query(ev, [randomUUID(), device, S1.blocks[1].id, "made_easier"]);
      await c.query(ev, [randomUUID(), device, S1.blocks[1].id, "done"]);
      await c.query(ev, [randomUUID(), device, S1.blocks[2].id, "skipped"]);
      await c.query(ev, [randomUUID(), device, S1.blocks[3].id, "done"]);
      await c.query("insert into public.completions (id, program_code, device_id, program_session_id, completed_at, feel) values ($1, 'VBTEST', $2, $3, now(), 1)", [completionId, device, S1.id]);
      await c.query("commit");
    } finally {
      c.release();
    }

    await as({ role: "authenticated", uid: A }, async (c) => {
      const r = await c.query(
        `select count(*) filter (where event = 'done')::int done, count(*) filter (where event = 'skipped')::int skipped,
                count(*) filter (where event = 'made_easier')::int eased
         from public.exercise_events where program_code = 'VBTEST'`,
      );
      assert.deepEqual(r.rows[0], { done: 3, skipped: 1, eased: 1 });
      const comp = await c.query("select feel from public.completions where program_code = 'VBTEST'");
      assert.deepEqual(comp.rows, [{ feel: 1 }]);
    });
    await as({ role: "authenticated", uid: B }, async (c) => {
      assert.equal((await c.query("select * from public.completions where program_code = 'VBTEST'")).rowCount, 0, "B cannot read A's completions");
      assert.equal((await c.query("select * from public.exercise_events where program_code = 'VBTEST'")).rowCount, 0, "B cannot read A's exercise events");
    });
    // Insert-only: the patient device cannot read back, update or delete.
    for (const sql of ["select * from public.exercise_events", "update public.completions set feel = 3", "delete from public.exercise_events"]) {
      await as({ role: "anon" }, async (c) => {
        await assert.rejects(c.query(sql), /permission denied/, sql);
      });
    }
  });

  it("exercise events are idempotent: a retried client_event_id never duplicates", async () => {
    const id = randomUUID();
    const device = randomUUID();
    const insert = (c: pg.PoolClient) =>
      c.query("insert into public.exercise_events (client_event_id, program_code, device_id, session_block_id, event, occurred_at) values ($1, 'VBTEST', $2, $3, 'done', now())", [id, device, S2.blocks[0].id]);
    await as({ role: "anon" }, async (c) => {
      await insert(c);
      await c.query("savepoint s");
      await assert.rejects(insert(c), /duplicate key/);
      await c.query("rollback to savepoint s");
      await c.query("set local role service_role");
      const n = await c.query("select count(*)::int n from public.exercise_events where client_event_id = $1", [id]);
      assert.equal(n.rows[0].n, 1);
    });
  });

  it("exercise events: only for an active code, an exercise of that program, and a plausible time", async () => {
    const q = "insert into public.exercise_events (client_event_id, program_code, device_id, session_block_id, event, occurred_at) values ($1, $2, $3, $4, $5, $6)";
    const cases: [string, unknown[]][] = [
      ["unknown code", [randomUUID(), "ZZZZZZ", randomUUID(), S1.blocks[0].id, "done", new Date()]],
      ["block from another program", [randomUUID(), "START1", randomUUID(), S1.blocks[0].id, "done", new Date()]],
      ["bad event name", [randomUUID(), "VBTEST", randomUUID(), S1.blocks[0].id, "cheered", new Date()]],
      ["future time", [randomUUID(), "VBTEST", randomUUID(), S1.blocks[0].id, "done", new Date(Date.now() + 864e5)]],
      ["older than 30 days", [randomUUID(), "VBTEST", randomUUID(), S1.blocks[0].id, "done", new Date(Date.now() - 31 * 864e5)]],
    ];
    for (const [name, args] of cases) {
      await as({ role: "anon" }, async (c) => {
        await assert.rejects(c.query(q, args), /row-level security|check constraint|foreign key/, name);
      });
    }
  });

  it("therapist note: 120 characters max, no identifiers, timestamped", async () => {
    await as({ role: "authenticated", uid: A }, async (c) => {
      await c.query("savepoint s");
      await assert.rejects(c.query("update public.programs set therapist_note = $1 where code = 'VBTEST'", ["x".repeat(121)]), /check constraint/);
      await c.query("rollback to savepoint s");
      await assert.rejects(c.query("update public.programs set therapist_note = 'Call me at 5550100' where code = 'VBTEST'"), /check constraint/);
      await c.query("rollback to savepoint s");
      await c.query("update public.programs set therapist_note = $1 where code = 'VBTEST'", ["y".repeat(120)]);
      const r = await c.query("select note_updated_at is not null as stamped from public.programs where code = 'VBTEST'");
      assert.equal(r.rows[0].stamped, true);
    });
    await as({ role: "anon" }, async (c) => {
      const p = (await c.query("select public.get_program('VBTEST') as p")).rows[0].p;
      assert.equal(p.therapist_note, "Keep the band light this week. Slow and steady beats fast.");
      assert.equal(p.assigned_by, "Test Clinician");
    });
  });

  it("create_program blocks a 7th exercise in a session", async () => {
    const ids = Array.from({ length: 7 }, () => ({ movement_id: mv("draft-strengthen-standing-band-row"), reps: 5 }));
    await as({ role: "authenticated", uid: A }, async (c) => {
      await assert.rejects(c.query("select public.create_program('Plan D', null, null, 3, $1::jsonb)", [JSON.stringify([{ name: "Long", blocks: ids }])]), /1 to 6 exercises/);
    });
    await as({ role: "authenticated", uid: A }, async (c) => {
      const r = await c.query("select public.create_program('Plan E', null, null, 3, $1::jsonb, 'Go gently') as code", [JSON.stringify([{ name: "Six", blocks: ids.slice(0, 6) }])]);
      assert.match(r.rows[0].code, /^[A-Z0-9]{6}$/);
    });
  });

  it("push subscriptions: devices write only through the RPCs, nobody reads but the server", async () => {
    const device = randomUUID();
    const endpoint = "https://push.example.test/abc";
    await as({ role: "anon" }, async (c) => {
      await c.query("select public.save_push_subscription($1, $2, 'p256', 'auth', '08:00', 'America/Chicago', '{1,3,5}')", [device, endpoint]);
      await c.query("savepoint s");
      await assert.rejects(c.query("select * from public.push_subscriptions"), /permission denied/);
      await c.query("rollback to savepoint s");
      await assert.rejects(c.query("update public.push_subscriptions set active = false"), /permission denied/);
      await c.query("rollback to savepoint s");
      const wrong = await c.query("select public.set_push_active($1, $2, false) as ok", [randomUUID(), endpoint]);
      assert.equal(wrong.rows[0].ok, false, "another device id cannot switch it off");
      const right = await c.query("select public.set_push_active($1, $2, false) as ok", [device, endpoint]);
      assert.equal(right.rows[0].ok, true);
      await c.query("set local role service_role");
      const row = (await c.query("select active, reminder_days, timezone from public.push_subscriptions where endpoint = $1", [endpoint])).rows[0];
      assert.deepEqual(row, { active: false, reminder_days: [1, 3, 5], timezone: "America/Chicago" });
    });
    await as({ role: "authenticated", uid: A }, async (c) => {
      await assert.rejects(c.query("select * from public.push_subscriptions"), /permission denied/, "clinicians cannot read them either");
    });
    await as({ role: "anon" }, async (c) => {
      await assert.rejects(c.query("select public.save_push_subscription($1, 'https://x.test/1', 'p', 'a', '08:00', 'Mars/Olympus', null)", [randomUUID()]), /time zone/);
    });
  });

  it("completions: rejects unknown codes, sessions from another program, bad feel", async () => {
    await as({ role: "anon" }, async (c) => {
      await assert.rejects(c.query("insert into public.completions (program_code, device_id, program_session_id, completed_at) values ('ZZZZZZ', $1, $2, now())", [randomUUID(), S1.id]));
    });
    await as({ role: "anon" }, async (c) => {
      const other = await c.query("select public.get_program($1) as p", [codeB]);
      const sessionOfB = other.rows[0].p.sessions[0].id;
      await assert.rejects(c.query("insert into public.completions (program_code, device_id, program_session_id, completed_at) values ('VBTEST', $1, $2, now())", [randomUUID(), sessionOfB]), /row-level security/);
    });
    const cid = randomUUID();
    await as({ role: "anon" }, async (c) => {
      await c.query("insert into public.completions (id, program_code, device_id, program_session_id, completed_at) values ($1, 'VBTEST', $2, $3, now())", [cid, randomUUID(), S1.id]);
      await assert.rejects(c.query("insert into public.completions (program_code, device_id, program_session_id, completed_at, feel) values ('VBTEST', $1, $2, now(), 4)", [randomUUID(), S1.id]), /check constraint/);
    });
    await as({ role: "authenticated", uid: B }, async (c) => {
      await c.query("update public.programs set archived = true where code = $1", [codeB]);
      const sid = (await c.query("select ps.id from public.program_sessions ps join public.programs p on p.id = ps.program_id where p.code = $1", [codeB])).rows[0].id;
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      await assert.rejects(c.query("insert into public.completions (program_code, device_id, program_session_id, completed_at) values ($1, $2, $3, now())", [codeB, randomUUID(), sid]), /row-level security/, "archived codes accept nothing");
    });
  });

  it("labels keep patient names, emails and numbers out", async () => {
    for (const bad of ["jane@x.com", "Mr Smith", "DOB 1950", "555-1234 plan", "A very long program name that goes past forty chars"]) {
      await as({ role: "authenticated", uid: A }, async (c) => {
        await assert.rejects(c.query("select public.create_program($1, null, null, 3, $2::jsonb)", [bad, sessionsJson(mv("draft-strengthen-standing-band-row"))]), /check constraint/i, bad);
      });
    }
    await as({ role: "authenticated", uid: A }, async (c) => {
      const s = JSON.stringify([{ name: "Mrs Jones knee", blocks: [{ movement_id: mv("draft-strengthen-standing-band-row"), reps: 5 }] }]);
      await assert.rejects(c.query("select public.create_program('Plan C', null, null, 3, $1::jsonb)", [s]), /check constraint/i, "session names too");
    });
  });

  it("anchors must match the real board geometry", async () => {
    const bad = [{ section: 1, row: 1, col: 3 }, { section: 5, row: 2, col: 1 }, { section: 1, row: 20, col: 1 }, { section: 1, row: 2 }];
    for (const anchor of bad) {
      await as({ role: "service_role" }, async (c) => {
        await assert.rejects(c.query("update public.session_blocks set anchor = $1::jsonb where id = $2", [JSON.stringify(anchor), S1.blocks[0].id]), /check constraint/, JSON.stringify(anchor));
      });
    }
    await as({ role: "service_role" }, async (c) => {
      await c.query("update public.movements set default_anchor = '{\"section\":4,\"row\":2,\"col\":3}' where slug = 'draft-strengthen-standing-band-row'");
    });
  });

  it("content audit flags published programs that use unreviewed movements", async () => {
    await as({ role: "service_role" }, async (c) => {
      const codes = new Set((await c.query("select * from public.content_audit()")).rows.map((x) => x.program_code));
      assert.ok(codes.has("VBTEST") && codes.has(codeB), "clinician programs with draft movements are flagged");
      assert.ok(!codes.has("START1"), "an unreviewed starter plan is not published, so it is not flagged");
      await c.query("update public.movements set reviewed_by_eric = true");
      assert.equal((await c.query("select * from public.content_audit()")).rowCount, 0);
      assert.equal((await c.query("select count(*)::int n from public.movements where reviewed_at is null")).rows[0].n, 0, "reviewed_at is stamped");
    });
  });
});
