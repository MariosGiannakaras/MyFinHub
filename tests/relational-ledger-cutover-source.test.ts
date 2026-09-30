import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');
const migration=source('supabase/migrations/20260930122054_relational_finance_ledger_cutover.sql');

describe('relational finance ledger cutover source',()=>{
  it('keeps the canonical relational ledger in the private schema and out of direct REST exposure',()=>{
    for(const table of [
      'private.rheomiq_accounts',
      'private.rheomiq_cards',
      'private.rheomiq_credit_statements',
      'private.rheomiq_transactions',
      'private.rheomiq_transaction_legs',
      'private.rheomiq_budgets',
      'private.rheomiq_recurring',
      'private.rheomiq_scheduled',
    ])expect(migration).toContain(`create table if not exists ${table}`);
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('rheomiq_is_owner_aal2()');
    expect(migration).not.toMatch(/create table if not exists public\.rheomiq_(accounts|cards|transactions|transaction_legs|budgets|recurring|scheduled)/);
  });

  it('enforces relational constraints and owner-scoped foreign keys',()=>{
    for(const marker of [
      'rheomiq_credit_statements_card_fk',
      'rheomiq_transactions_card_fk',
      'rheomiq_transactions_statement_fk',
      'rheomiq_transaction_legs_event_fk',
      'rheomiq_transaction_legs_account_fk',
      'rheomiq_budgets_logical_key_idx',
      'rheomiq_recurring_account_fk',
      'rheomiq_scheduled_account_shape',
    ])expect(migration).toContain(marker);
    expect(migration).toContain('amount numeric not null check (amount > 0)');
    expect(migration).toContain('amount numeric not null check (amount <> 0)');
  });

  it('moves authority once and verifies exact ledger round-trip before stripping JSON arrays',()=>{
    expect(migration).toContain('private.rheomiq_ledger_apply_state');
    expect(migration).toContain('private.rheomiq_ledger_compose_state');
    expect(migration).toContain('private.rheomiq_ledger_strip_state');
    expect(migration).toContain("message='LEDGER_ROUNDTRIP_MISMATCH'");
    expect(migration).toContain("finance_storage_mode='relational_v1'");
    expect(migration).toContain("'events','cards','deletedCards','creditStatements','budgets','recurringCustom','scheduled'");
    expect(migration).toContain("values(v_state.data,v_state.schema_version,v_state.revision,'manual')");
  });

  it('preserves the public FinanceData RPC contract while relational rows are authoritative',()=>{
    for(const fn of [
      'public.rheomiq_read_state()',
      'public.rheomiq_save_mutable_state_history(',
      'public.rheomiq_move_history(',
      'public.rheomiq_import_state(',
      'public.rheomiq_save_state(',
      'public.rheomiq_create_backup(',
      'public.rheomiq_database_health()',
    ])expect(migration).toContain(`create or replace function ${fn}`);
    expect(migration).toContain('private.rheomiq_effective_data');
    expect(migration).toContain("jsonb_set(v_current.data,'{state}',private.rheomiq_ledger_strip_state");
    expect(migration).toContain('insert into public.rheomiq_history_points');
    expect(migration).toContain('insert into public.rheomiq_audit_log');
  });

  it('does not introduce a security-definer finance mutation shortcut',()=>{
    expect(migration).not.toContain('security definer');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('revoke all on table');
    expect(migration).toContain('from public, anon');
  });

  it('makes health validation understand stripped app_state plus relational authority',()=>{
    expect(migration).toContain("'raw_state_ledger_keys'");
    expect(migration).toContain("'history_current_point_state_mismatches'");
    expect(migration).toContain("'storageMode','relational_v1'");
    expect(migration).toContain("'productionReady'");
  });
});
