import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('database health RPC source',()=>{
  const grantMigration=source('supabase/migrations/20260930104535_add_database_health_check.sql');
  const migration=source('supabase/migrations/20260930115252_fix_database_health_history_state_check.sql');

  it('is invoker-security and owner/AAL2 gated',()=>{
    expect(migration).toContain('rheomiq_is_owner_aal2()');
    expect(migration).toContain("message = 'MFA_REQUIRED'");
    expect(grantMigration).toContain('revoke all on function public.rheomiq_database_health() from public, anon, authenticated');
    expect(grantMigration).toContain('grant execute on function public.rheomiq_database_health() to authenticated, service_role');
    expect(migration).not.toContain('security definer');
  });

  it('reports only integrity counts and checks core finance references',()=>{
    for(const marker of [
      'history_revision_mismatches',
      'history_current_point_state_mismatches',
      'duplicate_event_ids',
      'events_without_legs',
      'unknown_leg_accounts',
      'orphan_card_event_refs',
      'orphan_statement_event_refs',
      'stale_account_metadata',
      'provider_invalid_active_refs',
      'active_assets_missing_storage_object',
      'providers_missing_logo',
      'providers_missing_wordmark',
    ]) expect(migration).toContain(marker);
    expect(migration).toContain("'productionReady'");
    expect(migration).toContain("'ok'");
    expect(migration).not.toMatch(/card_secrets|iban\s*[,)]|note\s*[,)]/i);
  });
});
