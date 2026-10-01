import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const sources={
  login:read('api/auth/login.ts'),
  logout:read('api/auth/logout.ts'),
  enroll:read('api/auth/mfa/enroll.ts'),
  verify:read('api/auth/mfa/verify.ts'),
  session:read('api/auth/session.ts'),
  data:read('api/data.ts'),
  history:read('api/history.ts'),
  backup:read('api/backup.ts'),
  importData:read('api/import.ts'),
  accountMetadataEntry:read('api/account-metadata.ts'),
  cardSecretsEntry:read('api/card-secrets.ts'),
  health:read('api/health.ts'),
  accountMetadataHandler:read('server/accountMetadataHandler.ts'),
  cardVaultHandler:read('server/cardVaultHandler.ts'),
  accountSecurityHandler:read('server/accountSecurityHandler.ts'),
  deviceSessionsHandler:read('server/deviceSessionsHandler.ts'),
  vercel:read('vercel.json'),
};

function expectMethod(source:string,method:string){
  expect(source).toContain(`req.method !== '${method}'`);
  expect(source).toContain('methodNotAllowed');
}

describe('web API surface security contract',()=>{
  it('keeps public/auth endpoints on explicit methods and same-origin mutations',()=>{
    expectMethod(sources.health,'GET');
    expectMethod(sources.login,'POST');
    expectMethod(sources.logout,'POST');
    expectMethod(sources.enroll,'POST');
    expectMethod(sources.verify,'POST');
    expectMethod(sources.session,'GET');

    expect(sources.login).toContain('assertSameOrigin(req)');
    expect(sources.logout).toContain('assertSameOrigin(req)');
    expect(sources.enroll).toContain('assertSameOrigin(req)');
    expect(sources.verify).toContain('assertSameOrigin(req)');
    expect(sources.login).toContain('readJsonBody');
    expect(sources.verify).toContain('readJsonBody');
  });

  it('keeps finance read/write endpoints owner+AAL2 and mutations origin-bound',()=>{
    for(const source of [sources.data,sources.history,sources.backup,sources.importData]){
      expect(source).toContain('requireSession(req, res, { allowBearer: true })');
      expect(source).toContain('isOwner(session.accessToken)');
      expect(source).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    }
    expect(sources.data).toContain("req.method !== 'GET' && req.method !== 'PUT'");
    expect(sources.history).toContain("req.method !== 'GET' && req.method !== 'POST'");
    expect(sources.backup).toContain("req.method !== 'POST'");
    expect(sources.importData).toContain("req.method !== 'POST'");
    for(const source of [sources.data,sources.history,sources.backup,sources.importData]){
      expect(source).toContain('assertMutationSessionOrigin(req, session)');
    }
  });

  it('uses strict singular headers for finance preconditions and import confirmation',()=>{
    expect(sources.data).toContain("strictRequestHeader(req, 'if-match')");
    expect(sources.data).toContain("strictRequestHeader(req, 'x-rheomiq-history-generation')");
    expect(sources.history).toContain("strictRequestHeader(req, 'if-match')");
    expect(sources.history).toContain("strictRequestHeader(req, 'x-rheomiq-history-generation')");
    expect(sources.importData).toContain("strictRequestHeader(req, 'x-rheomiq-confirm-import')");
    expect(sources.data).not.toContain('Array.isArray(value) ? value[0]');
    expect(sources.history).not.toContain('Array.isArray(value) ? value[0]');
  });

  it('keeps account metadata and card secrets inside delegated owner+AAL2 handlers',()=>{
    expect(sources.accountMetadataEntry).toContain('handleAccountMetadataRequest(req,res)');
    expect(sources.accountMetadataEntry).toContain('bodyParser:false');
    expect(sources.accountMetadataHandler).toContain("accessTokenAal(session.accessToken)!=='aal2'");
    expect(sources.accountMetadataHandler).toContain('assertMutationSessionOrigin(req,session)');
    expect(sources.accountMetadataHandler).toContain("strictRequestHeader(req,'content-type')");
    expect(sources.accountMetadataHandler).toContain("strictRequestHeader(req,'if-match')");

    expect(sources.cardSecretsEntry).toContain('handleCardVaultRequest(req, res)');
    expect(sources.cardVaultHandler).toContain("method!=='POST'&&method!=='PUT'&&method!=='DELETE'");
    expect(sources.cardVaultHandler).toContain("accessTokenAal(session.accessToken)!=='aal2'");
    expect(sources.cardVaultHandler).toContain('assertMutationSessionOrigin(req,session)');
  });

  it('keeps account-security and device-session mutations cookie-session, owner+AAL2 and same-origin',()=>{
    expect(sources.accountSecurityHandler).toContain("method !== 'PATCH'");
    expect(sources.accountSecurityHandler).toContain('requireSession(req, res)');
    expect(sources.accountSecurityHandler).not.toContain('allowBearer:true');
    expect(sources.accountSecurityHandler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(sources.accountSecurityHandler).toContain('assertMutationSessionOrigin(req, session)');

    expect(sources.deviceSessionsHandler).toContain("method !== 'GET' && method !== 'POST'");
    expect(sources.deviceSessionsHandler).toContain('requireSession(req, res)');
    expect(sources.deviceSessionsHandler).not.toContain('allowBearer:true');
    expect(sources.deviceSessionsHandler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(sources.deviceSessionsHandler).toContain('assertMutationSessionOrigin(req, session)');
  });

  it('keeps function-budget compatibility rewrites explicit and production deploys main-only',()=>{
    const config=JSON.parse(sources.vercel);
    expect(config.git.deploymentEnabled).toEqual({'**':false,main:true});
    expect(config.rewrites).toEqual(expect.arrayContaining([
      {source:'/api/android-update',destination:'/api/data?__myfinhub_route=android-update'},
      {source:'/api/auth/account',destination:'/api/auth/session?__myfinhub_route=account'},
      {source:'/api/auth/devices',destination:'/api/auth/session?__myfinhub_route=devices'},
    ]));
  });
});
