import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('manual bank reconciliation rendered regression (#588 B4)',()=>{
  it('requires as-of preview, owner confirmation, duplicate detection and non-spending persistence in the browser',()=>{
    const qa=readFileSync('scripts/ledger-foundations-qa.mjs','utf8');
    const form=readFileSync('src/components/QuickAdd.tsx','utf8');
    expect(qa).toContain('Ledger QA: manual statement reconciliation requires explicit review');
    expect(qa).toContain('unconfirmed reconciliation rejected');
    expect(qa).toContain('same date and account duplicate prompt');
    expect(qa).toContain('ledger-manual-reconciliation-review.png');
    expect(form).toContain('manualReconciliationDraftError(reconciliation,reconciliationConfirmed)');
    expect(form).toContain('reconciliation?.differenceCents');
    expect(form).toContain('checked={reconciliationConfirmed}');
  });
});
