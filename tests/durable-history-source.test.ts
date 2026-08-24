import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration=readFileSync('supabase/migrations/20260825005000_add_durable_history.sql','utf8');
const storage=readFileSync('server/storage.ts','utf8');
const api=readFileSync('src/lib/api.ts','utf8');
const hook=readFileSync('src/hooks/useFinance.ts','utf8');
const queue=readFileSync('src/lib/persistenceQueue.ts','utf8');

describe('durable finance history architecture',()=>{
  it('keeps history in dedicated owner+AAL2 protected tables outside FinanceData backups and card secrets',()=>{
    expect(migration).toContain('create table if not exists public.rheomiq_history_points');
    expect(migration).toContain('create table if not exists public.rheomiq_history_cursor');
    expect(migration).toContain('public.rheomiq_is_owner_aal2()');
    expect(migration).toContain("state jsonb not null");
    expect(migration).not.toMatch(/rheomiq_history_points[\s\S]{0,900}\b(pan|cvv|cvc|expiry|iban)\b/i);
  });

  it('uses finance revision plus canonical cursor generation and fails closed when they diverge',()=>{
    expect(migration).toContain('p_expected_revision bigint');
    expect(migration).toContain('p_expected_history_generation bigint');
    expect(migration).toContain('HISTORY_CURSOR_CONFLICT');
    expect(migration).toContain('v_cursor.finance_revision <> v_state_revision');
    expect(storage).toContain("'HISTORY_CURSOR_CONFLICT'");
    expect(api).toContain("'x-rheomiq-history-generation':historyGeneration");
  });

  it('creates one point per real mutation, moves Undo/Redo to existing points and invalidates redo descendants',()=>{
    const saveBody=migration.slice(migration.indexOf('create or replace function public.rheomiq_save_mutable_state_history'),migration.indexOf('create or replace function public.rheomiq_move_history'));
    const moveBody=migration.slice(migration.indexOf('create or replace function public.rheomiq_move_history'),migration.indexOf('-- Keep the legacy mutable-state RPC'));
    expect(saveBody.match(/insert into public\.rheomiq_history_points/g)?.length).toBe(1);
    expect(saveBody).toContain('with recursive descendants');
    expect(saveBody).toContain('delete from public.rheomiq_history_points');
    expect(moveBody).not.toContain('insert into public.rheomiq_history_points');
    expect(moveBody).toContain("p_direction = 'undo'");
    expect(moveBody).toContain("p_direction not in ('undo', 'redo')");
  });

  it('enforces the 10-day and 100-point retention contract without pruning the current point',()=>{
    expect(migration).toContain("interval '10 days'");
    expect(migration).toContain('limit 100');
    expect(migration).toMatch(/id <> v_current[\s\S]*expires_at <= now\(\)/);
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
