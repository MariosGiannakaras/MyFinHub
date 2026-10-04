import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');

describe('migration recovery rehearsal source contract',()=>{
  const script=read('scripts/migration-recovery-e2e.ts');
  const partial=read('scripts/recovery-fixtures/partial-migration.sql');
  const forward=read('scripts/recovery-fixtures/roll-forward.sql');
  const workflow=read('.github/workflows/real-stack-e2e.yml');
  const pkg=JSON.parse(read('package.json')) as {scripts?:Record<string,string>};

  it('stays local-only and never uses destructive linked/production commands',()=>{
    expect(pkg.scripts?.['qa:migration-recovery']).toBe('tsx scripts/migration-recovery-e2e.ts');
    expect(script).toContain("expectedContainer='supabase_db_'+projectId");
    expect(script).not.toContain('--linked');
    expect(script).not.toContain('SUPABASE_ACCESS_TOKEN');
    expect(script).not.toContain('migration repair');
    expect(script).not.toContain('db reset');
    expect(workflow).toContain('npm run qa:migration-recovery');
  });

  it('limits schema mutation to the disposable probe and preserves the migration ledger',()=>{
    expect(partial).toContain('public.myfinhub_migration_recovery_probe');
    expect(forward).toContain('public.myfinhub_migration_recovery_probe');
    expect(forward).toContain('public.rheomiq_is_owner_aal2()');
    expect(forward).not.toMatch(/\b(truncate|delete\s+from)\b/i);
    expect(forward).not.toMatch(/drop\s+table/i);
    expect(script).toContain('supabase_migrations.schema_migrations');
    expect(script).toContain('ledgerAfter===ledgerBefore');
    expect(script).toContain('stage idempotent-rerun');
  });
});
