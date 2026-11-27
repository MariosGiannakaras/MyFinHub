import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const migration=readFileSync(new URL('../supabase/migrations/20261112220000_guard_mutable_receivable_chronology.sql',import.meta.url),'utf8');
const storage=readFileSync(new URL('../server/storage.ts',import.meta.url),'utf8');
const ci=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const localSmoke=readFileSync(new URL('../scripts/repayment-chronology-local-postgres-smoke.sh',import.meta.url),'utf8');
const localFixtures=readFileSync(new URL('../scripts/recovery-fixtures/repayment-chronology-local.sql',import.meta.url),'utf8');
const base=readFileSync(new URL('../supabase/migrations/20260930122054_relational_finance_ledger_cutover.sql',import.meta.url),'utf8');
const boundary='create or replace function public.rheomiq_save_mutable_state_history(';
const previous=base.slice(base.indexOf(boundary),base.indexOf('create or replace function public.rheomiq_move_history(')).trim();
const current=migration.slice(migration.indexOf(boundary),migration.indexOf('revoke all on function public.rheomiq_save_mutable_state_history(')).trim();
const guard="  perform private.rheomiq_guard_mutable_receivable_chronology(v_current.data->'seed',v_current_full_state,p_state);";
describe('#649 I22.05 direct owner/AAL2 RPC mutation chronology boundary',()=>{
  it('keeps the existing revision-locked RPC byte-for-byte except one guard after composing current state',()=>{
    expect(current).toBe(previous.replace(
      "  v_current_full_state := private.rheomiq_ledger_compose_state(v_owner,v_current.data->'state');",
      "  v_current_full_state := private.rheomiq_ledger_compose_state(v_owner,v_current.data->'state');\n  -- I22.05: same locked owner revision, before backups, history, and ledger writes.\n"+guard
    ));
    expect(current.indexOf(guard)).toBeGreaterThan(current.indexOf("if p_expected_history_generation<>v_cursor.generation"));
    expect(current.indexOf(guard)).toBeLessThan(current.indexOf("perform private.rheomiq_ledger_apply_state(v_owner,p_state)"));
  });
  it('adds invoker-only private guards with no write, import, history or privilege bypass',()=>{
    expect(migration).toContain('private.rheomiq_legacy_receivable_cents_asof');
    expect(migration).toContain('private.rheomiq_chronology_date');
    expect(migration).toContain('RECEIVABLE_CHRONOLOGY_CONFLICT');
    expect(migration).toContain("left join jsonb_array_elements(");
    expect(migration).toContain("previous.value is distinct from proposed.value");
    expect(migration).toContain("round(v_delta*100)<>(case when");
    expect(migration.match(/\(\?:\[eE\]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("baseline.cents+next.event_cents<least(baseline.cents+prior.event_cents,0)");
    const privateGuards=migration.slice(migration.indexOf('-- BEGIN I22.05 ISOLATED LOCAL POSTGRES HELPERS'),migration.indexOf('-- END I22.05 ISOLATED LOCAL POSTGRES HELPERS'));
    expect(privateGuards).not.toMatch(/security definer|drop table|truncate|delete from|update public\.rheomiq_app_state set/i);
    expect(migration).toContain("delete from public.rheomiq_history_points"); // preserved original transactional pruning
    expect(migration).toContain('security invoker');
    expect(migration).toContain('revoke all on function private.rheomiq_guard_mutable_receivable_chronology');
    expect(migration).not.toContain('create or replace function public.rheomiq_import_state');
    expect(migration).not.toContain('create or replace function public.rheomiq_move_history');
    expect(migration).toContain("v_owner := public.rheomiq_history_assert_access()");
    expect(migration).toContain("if p_expected_revision<>v_current.revision");
  });
  it('executes a real isolated PostgreSQL regression without cloud or production data',()=>{
    expect(ci).toContain('bash scripts/repayment-chronology-local-postgres-smoke.sh');
    expect(localSmoke).toContain('Refusing configured external PostgreSQL/Supabase connections');
    expect(localSmoke).toContain('sudo -u postgres createdb');
    expect(localSmoke).toContain('trap cleanup EXIT');
    expect(localSmoke).toContain('BEGIN I22.05 ISOLATED LOCAL POSTGRES HELPERS');
    for(const phrase of ['cent beyond payoff','hidden dated deficit','same day additive lending','complete legacy intermediate deficit','incomplete legacy opening preserved','forged amount-vs-delta','invalid day denied','unchanged historic anomaly','scientific notation cannot hide overpayment']){
      expect(localFixtures).toContain(phrase);
    }
  });
  it('maps direct database refusals to user-visible 409 rather than false saving receipts',()=>{
    expect(storage).toContain("ApiError(409, 'RECEIVABLE_CHRONOLOGY_CONFLICT'");
    expect(storage).toContain("ApiError(400, 'INVALID_DATA', 'The receivable entry is invalid.')");
    expect(storage).toContain("'rpc/rheomiq_save_mutable_state_history'");
  });
});
