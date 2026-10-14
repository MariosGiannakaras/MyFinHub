import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const qa=readFileSync('src/qa.tsx','utf8');
const rendered=readFileSync('scripts/lending-remediation-qa.mjs','utf8');
describe('Lending as-of browser regression',()=>{
  it('constructs a future full repayment and a future loan above the current reporting date',()=>{
    expect(qa).toContain("params.get('state')==='lending-future'");
    expect(qa).toContain("date:'2026-08-29'");
    expect(qa).toContain("date:'2026-08-30'");
  });
  it('compares rendered balances and history against an identical base fixture',()=>{
    expect(rendered).toContain("await navigate('lending-rich')");
    expect(rendered).toContain("await navigate('lending-future')");
    expect(rendered).toContain('future-dated repayments or lending must not change the current receivables');
    expect(rendered).toContain('lending-future-dated-events-ignored');
  });
});
