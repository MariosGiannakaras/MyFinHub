import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration=readFileSync('supabase/migrations/20260825005000_add_durable_history.sql','utf8');
const hardening=readFileSync('supabase/migrations/20260825063500_harden_durable_history.sql','utf8');
const pruning=readFileSync('supabase/migrations/20260825064000_bound_durable_history_pruning.sql','utf8');
const auditActions=readFileSync('supabase/migrations/20260825191000_allow_history_audit_actions.sql','utf8');
const grantHardening=readFileSync('supabase/migrations/20260825195500_tighten_history_metadata_grants.sql','utf8');
const perfHardening=readFileSync('supabase/migrations/20260825200500_optimize_durable_history_rls.sql','utf8');
const storage=readFileSync('server/storage.ts','utf8');
const api=readFileSync('src/lib/api.ts','utf8');
const hook=readFileSync('src/hooks/useFinance.ts','utf8');
const queue=readFileSync('src/lib/persistenceQueue.ts','utf8');

describe('durable finance history architecture',()=>{
  it('keeps history in dedicated owner+AAL2 protected tables outside FinanceData backups and card secrets',()=>{
    expect(migration).toContain('create table if not exists public.rheomiq_history_points');
    expect(migration).toContain('create table if not exists public.rheomiq_history_cursor');
    expect(migration).toContain('public.rheomiq_is_owner_aal2()');
    expect(migration).toContain('state jsonb not null');
    expect(migration).not.toMatch(/rheomiq_history_points[\s\S]{0,900}\b(pan|cvv|cvc|expiry|iban)\b/i);
  });

  it('uses finance revision plus canonical cursor generation and fails closed when they diverge',()=>{
    expect(migration).toContain('p_expected_revision bigint');
    expect(migration).toContain('p_expected_history_generation bigint');
    expect(migration).toContain('HISTORY_CURSOR_CONFLICT');
    expect(migration).toContain('v_cursor.finance_revision <> v_state_revision');
    expect(hardening).toContain("'financeRevision', v_cursor.finance_revision::text");
    expect(storage).toContain('financeRevision: string;');
    expect(storage).toContain("'HISTORY_CURSOR_CONFLICT'");
    expect(api).toContain('financeRevision:string;');
    expect(api).toContain("'x-rheomiq-history-generation':historyGeneration");
    expect(hook).toContain('history.financeRevision===revision');
    expect(hook).toContain('MAX_CONSISTENT_RELOAD_ATTEMPTS = 3');
  });

  it('creates one visible point per real mutation, moves Undo/Redo to existing points and invalidates redo descendants',()=>{
    const saveBody=hardening.slice(hardening.indexOf('create or replace function public.rheomiq_save_mutable_state_history'),hardening.indexOf('create or replace function public.rheomiq_move_history'));
    const moveBody=hardening.slice(hardening.indexOf('create or replace function public.rheomiq_move_history'),hardening.indexOf('revoke all on function'));
    expect(saveBody.match(/values\(v_owner, v_parent_point, p_state, v_label, v_result_revision\)/g)?.length).toBe(1);
    expect(saveBody).toContain('with recursive descendants');
    expect(saveBody).toContain('delete from public.rheomiq_history_points');
    expect(moveBody).not.toContain('insert into public.rheomiq_history_points');
    expect(moveBody).toContain("p_direction = 'undo'");
    expect(moveBody).toContain("p_direction not in ('undo', 'redo')");
  });

  it('allows the canonical Undo/Redo cursor moves through the audit-log constraint',()=>{
    expect(hardening).toContain("values(auth.uid(), p_direction, v_result_revision)");
    expect(auditActions).toContain("'save'::text");
    expect(auditActions).toContain("'import'::text");
    expect(auditActions).toContain("'backup'::text");
    expect(auditActions).toContain("'undo'::text");
    expect(auditActions).toContain("'redo'::text");
    expect(auditActions).toContain('rheomiq_audit_log_action_check');
  });

  it('removes inherited/default ACLs that could bypass the owner RLS boundary',()=>{
    expect(grantHardening).toContain('revoke all on table public.rheomiq_account_metadata from public, anon, authenticated');
    expect(grantHardening).toContain('grant select, insert, update on table public.rheomiq_account_metadata to authenticated');
    expect(grantHardening).toContain('revoke all on table public.rheomiq_history_points from public, anon, authenticated');
    expect(grantHardening).toContain('grant select, insert, update, delete on table public.rheomiq_history_points to authenticated');
    expect(grantHardening).toContain('revoke all on table public.rheomiq_history_cursor from public, anon, authenticated');
    expect(grantHardening).toContain('grant select, insert, update, delete on table public.rheomiq_history_cursor to authenticated');
    expect(grantHardening).toContain('revoke all on sequence public.rheomiq_history_points_id_seq from public, anon, authenticated');
    expect(grantHardening).toContain('grant usage, select on sequence public.rheomiq_history_points_id_seq to authenticated');
    expect(grantHardening).not.toMatch(/\bgrant\s+[^\n;]*\btruncate\b/i);
    expect(grantHardening).not.toMatch(/\bgrant\s+[^\n;]*\btrigger\b/i);
    expect(grantHardening).not.toMatch(/\bgrant\s+[^\n;]*\breferences\b/i);
  });

  it('keeps owner+AAL2 RLS semantics while avoiding per-row auth initplans and covers the cursor foreign key',()=>{
    expect(perfHardening).toContain('rheomiq_history_cursor_owner_point_idx');
    expect(perfHardening).toContain('on public.rheomiq_history_cursor(owner_user_id, current_point_id)');
    expect(perfHardening.match(/owner_user_id = \(select auth\.uid\(\)\)/g)?.length).toBe(10);
    expect(perfHardening.match(/\(select public\.rheomiq_is_owner_aal2\(\)\)/g)?.length).toBe(10);
    expect(perfHardening).not.toMatch(/owner_user_id\s*=\s*auth\.uid\(\)/);
  });

  it('enforces the 10-day and strict 100-point retention contract while preserving the current point',()=>{
    expect(migration).toContain("interval '10 days'");
    expect(pruning).toMatch(/id <> v_current[\s\S]*expires_at <= now\(\)/);
    expect(pruning).toContain('where owner_user_id = p_owner and id <> v_current');
    expect(pruning).toContain('limit 99');
    expect(hardening).toContain('select expires_at <= now() into v_current_expired');
    expect(hardening).toContain("'Αρχική κατάσταση ιστορικού', true, v_current.revision");
    expect(hardening).toContain('values(v_owner, v_parent_point, p_state, v_label, v_result_revision)');
  });

  it('prunes before Undo/Redo target selection and never resurrects an expired target',()=>{
    const moveBody=hardening.slice(hardening.indexOf('create or replace function public.rheomiq_move_history'),hardening.indexOf('revoke all on function'));
    const prune=moveBody.indexOf('perform public.rheomiq_prune_history(v_owner);');
    const target=moveBody.indexOf("if p_direction = 'undo' then");
    expect(prune).toBeGreaterThan(-1);
    expect(target).toBeGreaterThan(prune);
    expect(moveBody).toContain('target.expires_at > now()');
    expect(moveBody).toContain('and expires_at > now()');
  });

  it('serializes every accepted client mutation instead of coalescing durable history',()=>{
    expect(queue).toContain('export class SequentialQueue');
    expect(hook).toContain('new SequentialQueue<QueuedMutation>');
    expect(hook).not.toContain('MAX_UNDO_STATES');
    expect(hook).not.toContain('undoStackRef');
    expect(hook).not.toContain('redoStackRef');
    expect(hook).toContain('loadHistory()');
    expect(hook).toContain("moveHistory(direction,revisionRef.current,historyGenerationRef.current)");
  });
});
