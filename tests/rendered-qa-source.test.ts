import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coordinator = readFileSync('scripts/run-rendered-qa.mjs', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

describe('rendered browser QA reliability contract', () => {
  it('preflights primary Chromium through an isolated fixed headless CDP endpoint with diagnostics', () => {
    expect(coordinator).toContain("'--headless=new'");
    expect(coordinator).toContain('const port=9300+attempt');
    expect(coordinator).toContain('`--remote-debugging-port=${port}`');
    expect(coordinator).toContain("'--remote-debugging-address=127.0.0.1'");
    expect(coordinator).not.toContain('DevToolsActivePort');
    expect(coordinator).toContain('trimDiagnostics');
    expect(coordinator).toContain('Primary Chromium preflight passed');
  });

  it('retries only recognized bootstrap failures on primary before any fallback', () => {
    expect(coordinator).toContain('isBrowserBootstrapFailure(result.output)');
    expect(coordinator).toContain('retrying once with primary Chromium');
    expect(coordinator).toContain('FALLBACK ACTIVATED');
    expect(coordinator).toMatch(/process\.env\.MYFINHUB_QA_REQUIRE_PRIMARY\s*===\s*'1'/);
  });

  it('keeps the shared primitive adoption suite in the rendered merge gate',()=>{
    expect(coordinator).toContain("scripts/primitives-adoption-qa.mjs");
    expect(coordinator).toContain("/tmp/myfinhub-primitives-adoption-qa-chrome");
  });

  it('enforces primary Chromium in pull-request CI', () => {
    expect(ci).toContain('export MYFINHUB_QA_REQUIRE_PRIMARY=1');
    expect(ci).toContain('${MYFINHUB_QA_REQUIRE_PRIMARY:-0}');
  });
});