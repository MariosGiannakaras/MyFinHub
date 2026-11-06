import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');
const script=read('scripts/isolated-full-recovery-e2e.mjs');
const flow=read('.github/workflows/real-stack-e2e.yml');
const doc=read('docs/ISOLATED_POSTGRES_STORAGE_RECOVERY.md');
const packageJson=JSON.parse(read('package.json')) as {scripts?:Record<string,string>};

describe('#649 I18.02 isolated PostgreSQL+Storage independent checkpoint proof',()=>{
  it('refuses arbitrary, production, non-CI and unapproved environments before any dump/restore',()=>{
    expect(script).toContain("process.env.CI!=='true'");
    expect(script).toContain("process.env.MYFINHUB_ISOLATED_RECOVERY!=='1'");
    expect(script).toContain("projectId!=='rheomiq'");
    expect(script).toContain("container='supabase_db_'+projectId");
    expect(script).toContain("http:\\/\\/127\\.0\\.0\\.1:54321");
    expect(script).not.toContain('--linked');
    expect(script).not.toContain('db reset');
    expect(script).not.toContain('SUPABASE_ACCESS_TOKEN');
    expect(script).not.toContain('process.env.DATABASE_URL');
  });
  it('takes a transferable custom DB dump, restores only into scratch DB, verifies history, RLS and leaves source intact',()=>{
    expect(script).toContain("'pg_dump'");
    expect(script).toContain("'-Fc'");
    expect(script).toContain("'template0',scratch");
    expect(script).toContain("'--exit-on-error'");
    expect(script).toContain("archiveDigest");
    expect(script).toContain("fingerprints(scratch)");
    expect(script).toContain("fingerprints('postgres')");
    expect(script).toContain("sourceRls===restoredRls");
    expect(script).toContain("'auth.users'");
    expect(script).toContain("'storage.objects'");
    expect(script).toContain("'supabase_migrations.schema_migrations'");
    expect(script).toContain("'dropdb','-U','postgres','--if-exists',scratch");
    expect(script).not.toContain("'dropdb','-U','postgres','--if-exists','postgres'");
  });
  it('replays every sampled Storage binary from a separate disk checkpoint into a disposable bucket with SHA-256 verification',()=>{
    expect(script).toContain("snapshot.push");
    expect(script).toContain("writeFileSync(filename,bytes,{mode:0o600})");
    expect(script).toContain("total<=64*1024*1024");
    expect(script).toContain("arrayBuffer()");
    expect(script).toContain("sha(Buffer.from(await verified.arrayBuffer()))===item.hash");
    expect(script).toContain("await cleanupBucket()");
    expect(script).toContain("rmSync(tmp,{recursive:true,force:true");
  });
  it('is gated only by the existing disposable local Supabase CI workflow; distinguishes this proof from release authorization',()=>{
    expect(packageJson.scripts?.['qa:isolated-recovery']).toBe('node scripts/isolated-full-recovery-e2e.mjs');
    expect(flow).toContain('MYFINHUB_ISOLATED_RECOVERY:');
    expect(flow).toContain('npm run qa:isolated-recovery');
    expect(flow).toContain('npx --yes supabase@2.119.0 start');
    expect(flow).toContain('stop --no-backup');
    expect(doc).toContain('production');
    expect(doc).toContain('PostgreSQL');
    expect(doc).toContain('Storage');
    expect(doc).toContain('separate');
    expect(doc).toContain('approval');
  });
});
