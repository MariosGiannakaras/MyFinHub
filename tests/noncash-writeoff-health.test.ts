import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const migration=readFileSync('supabase/migrations/20261021211500_allow_noncash_writeoff_health.sql','utf8');
const localRealStack=readFileSync('scripts/real-stack-e2e.ts','utf8');

describe('noncash lending writeoff and relational health (#588 B3)',()=>{
  it('retains security invoker, owner/AAL2 gate, relational composed state and count-only diagnostics',()=>{
    expect(migration).toContain('security invoker');
    expect(migration).toContain('rheomiq_history_assert_access()');
    expect(migration).toContain('private.rheomiq_ledger_compose_state');
    expect(migration).not.toContain('security definer');
    expect(migration).toContain('begin;');
    expect(migration).toContain('commit;');
    expect(migration).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
  });
  it('permits zero legs only for noncash writeoffs while detecting malformed writeoff legs',()=>{
    expect(migration).toContain("coalesce(j->>'kind','')<>'lending_writeoff'");
    expect(migration).toContain("'events_without_legs'");
    expect(migration).toContain("'invalid_writeoff_legs'");
    expect(migration).toContain("j->>'kind'='lending_writeoff'");
    expect(migration).toContain("jsonb_typeof(j->'legs') is distinct from 'array'");
    expect(migration).toContain("(v_checks->>'invalid_writeoff_legs')::int,0)=0");
    expect(migration).toContain("v_state is distinct from v_current_point_state");
    expect(migration).toContain("'unknown_leg_accounts'");
    expect(migration).toContain("'history_revision_mismatches'");
    expect(migration).toContain("'unbalanced_internal_events'");
  });
  it('holds isolated owner AAL2 save/history and backup restore to the updated health contract',()=>{
    expect(localRealStack).toContain("stage backup-restore");
    expect(localRealStack).toContain('failingHealthChecks');
    expect(localRealStack).toContain("Number(health?.checks?.invalid_writeoff_legs)===0");
    expect(localRealStack).toContain("stage history-undo");
    expect(localRealStack).toContain("stage history-redo");
  });
});
