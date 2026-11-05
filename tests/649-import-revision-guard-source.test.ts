import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261105204000_guard_stale_import_revision.sql');
const importRoute=read('api/import.ts');
const storage=read('server/storage.ts');
const client=read('src/lib/api.ts');
const hook=read('src/hooks/useFinance.ts');
const fixture=read('src/qa.tsx');
const browser=read('scripts/save-progress-qa.mjs');

describe('#649 I18.04 guarded web import vs legacy native compatibility',()=>{
  it('passes current finance revision from the acknowledged hook through browser If-Match to the guarded RPC',()=>{
    expect(hook).toContain('importData(productData(incoming), revisionRef.current)');
    expect(client).toContain("export async function importData(data: FinanceData, revision: string)");
    expect(client).toContain("'if-match': revision");
    expect(importRoute).toContain("const revision=requestHeader(req,'if-match')");
    expect(importRoute).toContain('writeStore(body, revision||undefined, true, session.accessToken)');
    expect(importRoute).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(importRoute).toContain("assertImportConfirmation(requestHeader(req, 'x-rheomiq-confirm-import'))");
    expect(importRoute).toContain('validateCompleteFinanceData(body)');
    expect(storage).toContain("guardedImport?'rpc/rheomiq_import_state_checked':'rpc/rheomiq_import_state'");
    expect(storage).toContain('p_expected_revision:parseExpectedRevision(expectedRevision)');
    expect(storage).toContain('guardedImport=force&&expectedRevision!==undefined');
  });
  it('atomically compares a locked owner-authorized revision before the established import/backup transaction',()=>{
    expect(migration).toContain('create or replace function public.rheomiq_import_state_checked(');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('perform public.rheomiq_history_assert_access()');
    expect(migration).toContain('for update of s');
    expect(migration).toContain("message='REVISION_CONFLICT'");
    const lock=migration.indexOf('for update of s');
    const conflict=migration.indexOf("message='REVISION_CONFLICT'");
    const importCall=migration.indexOf('from public.rheomiq_import_state(p_data)');
    expect(lock).toBeGreaterThan(-1);
    expect(importCall).toBeGreaterThan(conflict);
    expect(conflict).toBeGreaterThan(lock);
    expect(migration).toContain('revoke all on function public.rheomiq_import_state_checked(jsonb,bigint) from public, anon');
    expect(migration).toContain('grant execute on function public.rheomiq_import_state_checked(jsonb,bigint) to authenticated, service_role');
    expect(migration).not.toContain('security definer');
    expect(migration).not.toMatch(/drop\s+function/i);
  });
  it('keeps genuine 409 stale-revision rejection distinct from forced 409/503 and committed-import history failure',()=>{
    const handler=fixture.slice(fixture.indexOf("if(url.pathname==='/api/import'"),fixture.indexOf("if(url.pathname==='/api/history'"));
    expect(handler).toContain("new Headers(init.headers).get('if-match')!==String(revision)");
    expect(handler.indexOf("new Headers(init.headers).get('if-match')")).toBeLessThan(handler.indexOf("backend=JSON.parse"));
    expect(fixture).toContain('__myfinhubQaAdvanceRemoteRevision');
    expect(browser).toContain("server If-Match conflict rejects stale import");
    expect(browser).toContain('history-stale-import-revision-conflict-1440-dark');
    expect(browser).toContain("stale.attempts===1&&stale.commits===0");
    expect(browser).toContain('remote revision recovery never repeats stale import');
    expect(browser).toContain("for(const preCommitFailure of ['conflict','unavailable'])");
    expect(browser).toContain("for(const historyFailure of ['read-failure','revision-mismatch'])");
  });
});
