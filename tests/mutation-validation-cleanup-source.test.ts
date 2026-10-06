import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../scripts/mutation-validation-qa.mjs',import.meta.url),'utf8');

describe('mutation validation browser cleanup',()=>{
  it('waits for Chromium exit and retries transient ENOTEMPTY profile cleanup',()=>{
    expect(source).toContain("child.kill('SIGTERM')");
    expect(source).toContain("child.once('exit',resolve)");
    expect(source).toContain("child.kill('SIGKILL')");
    expect(source).toContain("error?.code!=='ENOTEMPTY'");
    expect(source).toContain("await stopBrowser();await removeProfile()");
    expect(source).not.toContain("child.kill('SIGTERM');await sleep(200);rmSync(profile");
  });
});
