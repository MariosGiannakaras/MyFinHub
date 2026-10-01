import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const directJsonMutations=[
  {path:'api/auth/login.ts',origin:'assertSameOrigin(req)',body:'readJsonBody',limit:'16 * 1024'},
  {path:'api/auth/mfa/verify.ts',origin:'assertSameOrigin(req)',body:'readJsonBody',limit:'8 * 1024'},
  {path:'api/data.ts',origin:'assertMutationSessionOrigin(req, session)',body:'readJsonBody',limit:'MAX_FINANCE_DOCUMENT_BYTES'},
  {path:'api/history.ts',origin:'assertMutationSessionOrigin(req, session)',body:'readJsonBody',limit:'4096'},
  {path:'api/import.ts',origin:'assertMutationSessionOrigin(req, session)',body:'readJsonBody',limit:'MAX_FINANCE_DOCUMENT_BYTES'},
  {path:'server/accountSecurityHandler.ts',origin:'assertMutationSessionOrigin(req, session)',body:'readJsonBody',limit:'MAX_ACCOUNT_SECURITY_BODY_BYTES'},
  {path:'server/deviceSessionsHandler.ts',origin:'assertMutationSessionOrigin(req, session)',body:'readJsonBody',limit:'MAX_DEVICE_ACTION_BODY_BYTES'},
  {path:'server/cardVaultHandler.ts',origin:'assertMutationSessionOrigin(req,session)',body:'readJsonBody',limit:'MAX_CARD_VAULT_BODY_BYTES'},
];

describe('state-changing HTTP source boundaries',()=>{
  it.each(directJsonMutations)('$path keeps origin and bounded JSON parsing together',({path,origin,body,limit})=>{
    const source=read(path);
    expect(source).toContain(origin);
    expect(source).toContain(body);
    expect(source).toContain(limit);
  });

  it('keeps no-body browser mutations same-origin protected',()=>{
    for(const path of ['api/auth/logout.ts','api/auth/mfa/enroll.ts']){
      expect(read(path)).toContain('assertSameOrigin(req)');
    }
    expect(read('api/backup.ts')).toContain('assertMutationSessionOrigin(req, session)');
  });

  it('keeps account/provider writes bounded, same-origin and strict-query parsed',()=>{
    const source=read('server/accountMetadataHandler.ts');
    expect(source).toContain('assertMutationSessionOrigin(req,session)');
    expect(source).toContain('strictQueryValue');
    expect(source).toContain('readJsonBody(req,MAX_FINANCIAL_PROVIDER_BODY_BYTES)');
    expect(source).toContain('readJsonBody(req,MAX_ACCOUNT_METADATA_BODY_BYTES)');
    expect(source).toContain('readBinaryBody(req,MAX_PROVIDER_ASSET_BYTES)');
  });

  it('keeps explicit bearer authorization authoritative and cookie fallback forbidden',()=>{
    const source=read('server/auth.ts');
    expect(source).toContain('if (options.allowBearer)');
    expect(source).toContain('const bearerToken = bearerAccessToken(req)');
    expect(source).toContain("return await finalizeSession(req, bearerToken, user, 'bearer')");
    expect(source).toContain('An explicit native credential is authoritative. Never fall back to ambient cookies.');
    expect(source).toContain("throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.')");
  });

  it('keeps shared JSON/binary parsing strict for media type, content length and ambiguous query shapes',()=>{
    const source=read('server/http.ts');
    expect(source).toContain("'UNSUPPORTED_MEDIA_TYPE'");
    expect(source).toContain("'INVALID_CONTENT_LENGTH'");
    expect(source).toContain("'PAYLOAD_TOO_LARGE'");
    expect(source).toContain('export function strictQueryValue');
    expect(source).toContain("typeof value==='string'?value.trim():''");
  });
});
