import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration=readFileSync('supabase/migrations/20261001220945_reject_cross_account_id_collisions.sql','utf8');

describe('cross-account identity database boundary',()=>{
  it('rejects seed/custom id collisions before canonical state writes commit',()=>{
    expect(migration).toContain('create or replace function private.rheomiq_reject_account_id_collisions()');
    expect(migration).toContain("new.data #> '{seed,accounts}'");
    expect(migration).toContain("new.data #> '{state,settings,customAccounts}'");
    expect(migration).toContain("message = 'ACCOUNT_ID_CONFLICT'");
    expect(migration).toContain('before insert or update of data on public.rheomiq_app_state');
  });

  it('keeps the validator private, invoker-safe and non-destructive',()=>{
    expect(migration).toContain('security invoker');
    expect(migration).toContain("set search_path = 'pg_catalog'");
    expect(migration).toContain('revoke all on function private.rheomiq_reject_account_id_collisions() from public, anon, authenticated');
    expect(migration).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
  });
});
