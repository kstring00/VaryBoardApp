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
    for (const table of ["completions", "completion_items", "clinicians"]) {
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

  it("round trip: code -> plan -> session -> completion -> adherence visible only to the owner", async () => {
    const completionId = randomUUID();
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
      await c.query("insert into public.completions (id, program_code, device_id, program_session_id, completed_at, feel) values ($1, 'VBTEST', $2, $3, now(), 1)", [completionId, randomUUID(), S1.id]);
      await c.query(
        "insert into public.completion_items (completion_id, session_block_id, done, eased, seated) values ($1, $2, true, false, false), ($1, $3, true, true, false), ($1, $4, false, false, false), ($1, $5, true, false, true)",
        [completionId, S1.blocks[0].id, S1.blocks[1].id, S1.blocks[2].id, S1.blocks[3].id],
      );
      await c.query("commit");
    } finally {
      c.release();
    }

    await as({ role: "authenticated", uid: A }, async (c) => {
      const r = await c.query(
        `select count(distinct c.id)::int completions, min(c.feel) feel, count(*) filter (where i.done)::int done,
                count(*) filter (where not i.done)::int skipped, count(*) filter (where i.eased)::int eased, count(*) filter (where i.seated)::int seated
         from public.completions c join public.completion_items i on i.completion_id = c.id where c.program_code = 'VBTEST'`,
      );
      assert.deepEqual(r.rows[0], { completions: 1, feel: 1, done: 3, skipped: 1, eased: 1, seated: 1 });
    });
    await as({ role: "authenticated", uid: B }, async (c) => {
      assert.equal((await c.query("select * from public.completions where program_code = 'VBTEST'")).rowCount, 0, "B cannot read A's completions");
      assert.equal((await c.query("select * from public.completion_items where completion_id = $1", [completionId])).rowCount, 0);
    });
    // Insert-only: the patient device cannot read back, update or delete.
    await as({ role: "anon" }, async (c) => {
      await assert.rejects(c.query("update public.completions set feel = 3 where id = $1", [completionId]), /permission denied/);
    });
    await as({ role: "anon" }, async (c) => {
      await assert.rejects(c.query("delete from public.completion_items where completion_id = $1", [completionId]), /permission denied/);
    });
  });

  it("completions: rejects unknown codes, sessions from another program, blocks from another session, bad feel", async () => {
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
      await c.query("savepoint s");
      await assert.rejects(c.query("insert into public.completion_items (completion_id, session_block_id, done) values ($1, $2, true)", [cid, S2.blocks[0].id]), /row-level security/);
      await c.query("rollback to savepoint s");
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
