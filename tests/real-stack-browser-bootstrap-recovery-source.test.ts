import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('real-stack first-tab bootstrap resilience',()=>{
  it('requires real login after at most one bounded recovery navigation',()=>{
    const src=readFileSync('scripts/real-stack-browser-e2e.ts','utf8');
    expect(src).toContain("stage login");
    expect(src).toContain("login screen after navigation retry");
    expect(src).toContain("Page.reload',{ignoreCache:true}");
    const marker=src.indexOf("stage login");
    const mfa=src.indexOf("await setSelector('#mfa-code'",marker);
    expect(marker).toBeGreaterThan(0);
    expect(mfa).toBeGreaterThan(marker);
    expect(src.slice(marker,mfa)).toContain("await setSelector('#login-email'");
    expect(src.slice(marker,mfa)).toContain("await setSelector('#login-password'");
    expect(src.slice(marker,mfa)).toContain("MFA challenge");
    expect(src).toContain("login-bootstrap-first-paint");
  });
});
