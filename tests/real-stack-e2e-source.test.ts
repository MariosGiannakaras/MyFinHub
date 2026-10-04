import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');

describe('zero-cost real-stack E2E source contract',()=>{
  const workflow=read('.github/workflows/real-stack-e2e.yml');
  const script=read('scripts/real-stack-e2e.ts');
  const supabaseConfig=read('supabase/config.toml');
  const pkg=JSON.parse(read('package.json')) as {scripts?:Record<string,string>};

  it('uses only a pinned local Supabase CLI on the standard public GitHub runner',()=>{
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).toContain('supabase@2.119.0 start');
    expect(workflow).toContain('supabase@2.119.0 stop --no-backup');
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toContain('SUPABASE_ACCESS_TOKEN');
    expect(workflow).not.toContain('--linked');
    expect(workflow).not.toContain('ahsukppxwaiagampsuzb');
    expect(workflow).not.toContain('vercel');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('myfinhub-real-stack-browser-');
  });

  it('explicitly enables mandatory local TOTP parity',()=>{
    expect(supabaseConfig).toContain('[auth.mfa.totp]');
    expect(supabaseConfig).toMatch(/enroll_enabled\s*=\s*true/);
    expect(supabaseConfig).toMatch(/verify_enabled\s*=\s*true/);
  });

  it('keeps the harness synthetic and proves the real auth, persistence and active-device boundaries',()=>{
    expect(pkg.scripts?.['qa:real-stack']).toBe('tsx scripts/real-stack-e2e.ts');
    expect(script).toContain("const TEST_EMAIL_DOMAIN='example.com'");
    expect(script).toContain('realStackFinanceData');
    expect(script).toContain('validateCompleteFinanceData(fixture)');
    expect(script).toContain("spawn(tsxBin,['server/index.ts','--serve-dist']");
    expect(script).toContain("runRealStackBrowserProof({");
    expect(script).toContain("[real-stack] stage provider-storage-registration-failure-cleanup");
    expect(script).toContain("requestBinary");
    expect(script).toContain("/storage/v1/object/list/financial-provider-assets");
    expect(script).toContain("'INVALID_PROVIDER_DATA'");
    expect(script).toContain("Failed provider asset registration left an orphan Storage object.");
    expect(script).toContain("[real-stack] stage actual-browser-ui");
    expect(script).not.toContain("['run','dev:server']");
    expect(script).toContain('/api/auth/mfa/enroll');
    expect(script).toContain("[real-stack] stage auth-valid-password");
    expect(script).toContain("[real-stack] stage mfa-enroll");
    expect(script).toContain("[real-stack] stage import");
    expect(script).toContain("[real-stack] stage mutable-save");
    expect(script).toContain("[real-stack] stage device-lifecycle");
    expect(script).toContain("[real-stack] stage history-undo");
    expect(script).toContain("[real-stack] stage history-redo");
    expect(script).toContain("[real-stack] stage card-vault-write");
    expect(script).toContain("[real-stack] stage backup-restore");
    expect(script).toContain("[real-stack] stage direct-db-read");
    expect(script).toContain("String(stateRows[0]?.revision)===String(redone.body?.revision)");
    expect(script).not.toContain("String(stateRows[0]?.revision)===String(persisted.body?.revision)");
    expect(script).toContain("[real-stack] stage browser-finance-direct-read");
    expect(script).toContain("Canonical API read-back is missing one or more generic Quick Entry intents.");
    expect(script).toContain("Canonical API read-back is missing the persisted Attention dismissal decision.");
    expect(script).toContain("[real-stack] stage provider-storage-direct-read");
    expect(script).toContain("provider_id=eq.real-browser-provider");
    expect(script).toContain("rheomiq_financial_provider_asset_bindings");
    expect(script).toContain('rheomiq_database_health');
    expect(script).toContain("stage='request'");
    expect(script).toContain('/api/auth/mfa/verify');
    expect(script).toContain('/api/auth/devices');
    expect(script).toContain("'DEVICE_ACCESS_REVOKED'");
    expect(script).toContain('/api/import');
    expect(script).toContain('/api/data');
    expect(script).toContain("'REVISION_CONFLICT'");
    expect(script).toContain('/api/backup');
    expect(script).toContain('/api/card-secrets');
    expect(script).toContain('!serializedBackup.includes(TEST_PAN)');
    expect(script).toContain('rheomiq_app_state');
    expect(script).toContain("finance_storage_mode==='relational_v1'");
    expect(script).not.toContain('ahsukppxwaiagampsuzb');
    expect(script).not.toContain('SUPABASE_ACCESS_TOKEN');
  });
});
