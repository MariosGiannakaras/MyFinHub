import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const real=readFileSync(new URL('../scripts/real-stack-e2e.ts',import.meta.url),'utf8');
const direct=readFileSync(new URL('../scripts/real-stack-receivable-rpc.ts',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/real-stack-e2e.yml',import.meta.url),'utf8');
describe('#649 I22.05 actual local Supabase owner+AAL2 direct PostgREST test',()=>{
  it('runs inside the established single isolated real-stack suite',()=>{
    expect(real).toContain("import { runDirectReceivableRpcProof }");
    expect(real).toContain('await runDirectReceivableRpcProof({');
    expect(real).toContain('generation:initialGeneration');
    expect(workflow).toContain('npm run qa:real-stack');
    expect(workflow).toContain("<!-- run-real-stack-e2e -->");
  });
  it('uses only loopback local Auth and owner session with no secret logging',()=>{
    expect(direct).toContain("http:\\/\\/127\\.0\\.0\\.1");
    expect(direct).toContain("aal1Claims.aal==='aal1'");
    expect(direct).toContain("aal2Claims.aal==='aal2'");
    expect(direct).toContain('/rest/v1/myfinhub_device_sessions');
    expect(direct).toContain('rheomiq_save_mutable_state_history');
    expect(direct).toContain('rheomiq_read_history');
    expect(direct).toContain("dated overpayment");
    expect(direct).toContain("future lending masks an intermediate deficit");
    expect(direct).toContain("forged receivable delta");
    expect(direct).toContain("nonownerClaims.aal==='aal2'");
    expect(direct).toContain("method:'rheomiq_upsert_account_metadata'");
    expect(direct).toContain("p_expected_revision:0");
    expect(direct).toContain("await selectMetadata(aal2Token)");
    expect(direct).toContain("await selectMetadata(token)");
    expect(direct).toContain("denied.body.length===0");
    expect(direct).toContain("prefer:'return=representation'");
    expect(direct).toContain("removed.length===1");
    expect(direct).toContain("nonownerUserId!==userId");
    expect(direct).toContain("await register(nonownerClaims.session_id!,nonownerUserId)");
    expect(direct).toContain("['rheomiq_read_state','rheomiq_read_history','rheomiq_save_mutable_state_history']");
    expect(direct).toContain("denied.status===403&&String(denied.body?.code)==='42501'");
    expect(real).toContain("totpCodeForSecret:(factorSecret,previousCode)=>nextTotp(factorSecret,previousCode)");
    expect(direct).toContain("JSON.stringify(after.body)===JSON.stringify(before.body)");
    expect(direct).toContain("new URLSearchParams({session_id:'eq.'+aal2Claims.session_id!,user_id:'eq.'+userId,revoked_at:'is.null'})");
    expect(direct).toContain("revokedRows.length===1");
    expect(direct).toContain("for(const method of ['rheomiq_read_state','rheomiq_read_history'])");
    expect(direct).toContain("deniedWrite.status===403&&String(deniedWrite.body?.code)==='42501'");
    expect(direct).toContain("revokedRead.body.length===0");
    expect(direct.indexOf("const revokedRead=await selectMetadata(aal2Token)")).toBeLessThan(
      direct.indexOf("const cleanup=await fetch(")
    );
    expect(direct).toContain("return aal1Claims.session_id===aal2Claims.session_id?[]:[aal1Claims.session_id!]");
    expect(real).toContain("for(const sessionId of directRpcSessions)");
    expect(real).toContain("action:'revoke',sessionId");
    expect(real).toContain("afterDirectDevices.body?.count===1");
    expect(real).toContain("devices.body?.count===2");
    expect(direct).not.toMatch(/console\.(?:log|error).*token|process\.env\.SUPABASE_SECRET/);
  });
});
