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
    expect(direct).toContain("JSON.stringify(after.body)===JSON.stringify(before.body)");
    expect(direct).not.toMatch(/console\.(?:log|error).*token|process\.env\.SUPABASE_SECRET/);
  });
});
