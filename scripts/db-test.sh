#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the Supabase shim, the migration and the seed,
# then runs the database tests (RLS, RPCs, constraints, the code -> session -> adherence round trip).
#
#   pnpm db:test            needs Postgres 15+ binaries (initdb, pg_ctl) on PATH or in /usr/lib/postgresql/*/bin
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | sort -V | tail -1)")"
DIR="${PGTEST_DIR:-$(mktemp -d)}"
PORT="${PGTEST_PORT:-55432}"
AS=()
if [ "$(id -u)" = "0" ]; then AS=(runuser -u postgres --); chown postgres "$DIR"; fi

"${AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
cleanup() { "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.test.sql"
echo "✓ migration and seed applied"

cd "$ROOT"
DATABASE_URL="postgresql://postgres@localhost/postgres?host=$DIR&port=$PORT" node --import tsx --test tests/db/*.test.ts
