import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');

describe('zero-cost real-stack E2E source contract',()=>{
  const workflow=read('.github/workflows/real-stack-e2e.yml');
  const script=read('scripts/real-stack-e2e.ts');
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
  });

  it('keeps the harness synthetic and proves the real auth, persistence and active-device boundaries',()=>{
    expect(pkg.scripts?.['qa:real-stack']).toBe('tsx scripts/real-stack-e2e.ts');
    expect(script).toContain("const TEST_EMAIL_DOMAIN='example.com'");
    expect(script).toContain('qaFinanceData');
    expect(script).toContain("spawn(tsxBin,['server/index.ts']");
    expect(script).not.toContain("['run','dev:server']");
    expect(script).toContain('/api/auth/mfa/enroll');
    expect(script).toContain("[real-stack] stage auth-valid-password");
    expect(script).toContain("[real-stack] stage mfa-enroll");
    expect(script).toContain("stage='request'");
    expect(script).toContain('/api/auth/mfa/verify');
    expect(script).toContain('/api/auth/devices');
    expect(script).toContain("'DEVICE_ACCESS_REVOKED'");
    expect(script).toContain('/api/import');
    expect(script).toContain('/api/data');
    expect(script).toContain("'REVISION_CONFLICT'");
    expect(script).toContain('/api/backup');
    expect(script).toContain('rheomiq_app_state');
    expect(script).toContain("finance_storage_mode==='relational_v1'");
    expect(script).not.toContain('ahsukppxwaiagampsuzb');
    expect(script).not.toContain('SUPABASE_ACCESS_TOKEN');
  });
});
