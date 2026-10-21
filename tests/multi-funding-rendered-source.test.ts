import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('multi-source purchase browser contract (#588 B1)',()=>{
  it('uses real owned credit selection, one expense event and only credit share in card history',()=>{
    const browser=readFileSync('scripts/ledger-foundations-qa.mjs','utf8');
    const qa=readFileSync('src/qa.tsx','utf8');
    expect(browser).toContain('Ledger QA: one multi-funded purchase, only real credit share on statement');
    expect(browser).toContain('card history reports only the actual 60 EUR financed share');
    expect(browser).toContain('ledger-multi-funded-credit-desktop.png');
    expect(browser).toContain('one parent 100 EUR expense');
    expect(browser).toContain(".transactions-approved-table tbody tr[data-transaction-kind=expense][data-transaction-source=event]");
    expect(browser).toContain('visible mixed purchase rows');
    expect(qa).toContain('const prepared=prepareCreditStatementEvent(current,ruledEvent)');
  });
});
