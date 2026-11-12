#!/usr/bin/env bash
# Only a disposable local PostgreSQL database on the CI runner. Never remote.
set -euo pipefail
if env | grep -Eq '^(SUPABASE_URL|DATABASE_URL|PGHOST|PGSERVICE|PGSERVICEFILE)='; then
  echo "Refusing configured external PostgreSQL/Supabase connections" >&2
  exit 1
fi
command -v psql >/dev/null || { echo 'Local psql is required' >&2; exit 1; }
sudo service postgresql start >/dev/null
QA_DB="myfinhub_repay_chronology_$$"
cleanup() { sudo -u postgres dropdb --if-exists "$QA_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
sudo -u postgres createdb "$QA_DB"
sudo -u postgres psql --no-psqlrc -X -v ON_ERROR_STOP=1 -d "$QA_DB" <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA private;
CREATE SCHEMA qa;
GRANT USAGE ON SCHEMA private, qa TO authenticated;
SQL
MIGRATION="supabase/migrations/20261112220000_guard_mutable_receivable_chronology.sql"
sed -n '/^-- BEGIN I22.05 ISOLATED LOCAL POSTGRES HELPERS/,/^-- END I22.05 ISOLATED LOCAL POSTGRES HELPERS/p' "$MIGRATION" |
  sudo -u postgres psql --no-psqlrc -X -v ON_ERROR_STOP=1 -d "$QA_DB" >/dev/null
sudo -u postgres psql --no-psqlrc -X -v ON_ERROR_STOP=1 -d "$QA_DB"   -f scripts/recovery-fixtures/repayment-chronology-local.sql
echo "I22.05 disposable local PostgreSQL chronology helper proofs passed."
