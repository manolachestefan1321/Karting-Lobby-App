#!/usr/bin/env bash
# Runs all migrations + seed + pgTAP tests against a throw-away local Postgres,
# WITHOUT Docker. Used in CI / cloud environments.
# On your Mac prefer:  npx supabase start  &&  npx supabase test db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="${TMPDIR:-/tmp}/kartapp-pg-$$"
PORT="${PGPORT_TEST:-54329}"
DB=kartapp_test

cleanup() { "$PGBIN/pg_ctl" -D "$WORK" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

RUNAS=()
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -r postgres
  RUNAS=(runuser -u postgres --)
fi
mkdir -p "$WORK" && chmod 777 "$WORK"
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" -l "$WORK/log" start >/dev/null
WORK_DATA="$WORK/data"
cleanup() { "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK_DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "create database $DB"
sed "s/current_database_placeholder/$DB/" "$ROOT/supabase/local-shim/supabase_shim.sql" | "${PSQL[@]}" -d "$DB" >/dev/null
"${PSQL[@]}" -d "$DB" -c "create extension if not exists pgtap with schema extensions" >/dev/null

echo "▶ Applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  - $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done
echo "▶ Seeding"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql" >/dev/null

echo "▶ Running pgTAP tests"
FAIL=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  OUT=$("${PSQL[@]}" -d "$DB" -X -t -A -f "$t" 2>&1) || FAIL=1
  if echo "$OUT" | grep -qE '^not ok|ERROR|Looks like'; then FAIL=1; fi
  PASSED=$(echo "$OUT" | grep -c '^ok' || true)
  TOTAL=$(echo "$OUT" | grep -cE '^(not )?ok' || true)
  echo "  $(basename "$t"): $PASSED/$TOTAL passed"
  echo "$OUT" | grep -E '^not ok|ERROR|#' | grep -v '^ok' | sed 's/^/      /' || true
done
exit $FAIL
