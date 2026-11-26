import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api.js';
import { recurringFinanceWriteDefinitelyRejected } from '../src/lib/recurringFinanceAssetOutcome.js';

describe('#649 I19.04 recurring asset cleanup after finance receipt',()=>{
  it('purges new Storage only after server-proven precommit revision rejection',()=>{
    expect(recurringFinanceWriteDefinitelyRejected(new ApiError('Stale revision',409,'REVISION_CONFLICT'))).toBe(true);
  });
  it.each([
    {label:'network loss after commit',error:new ApiError('Offline',0,'NETWORK_ERROR')},
    {label:'timed out response',error:new ApiError('Timeout',0,'NETWORK_TIMEOUT')},
    {label:'server unavailable',error:new ApiError('Unavailable',503,'SERVICE_UNAVAILABLE')},
    {label:'postcommit history mismatch',error:new ApiError('Mismatch',409,'HISTORY_CURSOR_CONFLICT')},
    {label:'other conflict',error:new ApiError('Conflict',409,'CONFLICT')},
    {label:'untyped queue failure',error:new Error('Unknown failure')},
    {label:'other validation error',error:new ApiError('Invalid',400,'INVALID_DATA')},
  ])('does not treat $label as rollback proof',({error})=>{
    expect(recurringFinanceWriteDefinitelyRejected(error)).toBe(false);
  });
  it('checks finance readiness before upload, retains ambiguous Storage and blocks repeat PUT',()=>{
    const page=readFileSync('src/pages/RecurringPage.tsx','utf8');
    const qa=readFileSync('scripts/recurring-service-brand-qa.mjs','utf8');
    const app=readFileSync('src/App.tsx','utf8');
    expect(page.indexOf("financeState.saveState!=='saved'||financeState.savePending")).toBeLessThan(page.indexOf('uploaded=await uploadRecurringServiceAsset'));
    expect(page).toContain('if(recurringFinanceWriteDefinitelyRejected(reason))');
    expect(page).toContain('setFinanceReviewRequired(true)');
    expect(page).toContain('disabled={editBusy||financeReviewRequired}');
    expect(app).toContain('financeState={finance}');
    expect(qa).toContain('recurring-service-brand-finance-receipt-unverified');
    expect(qa).toContain("for(const [width,height,label] of [[1440,1100,'desktop'],[375,812,'mobile']])");
    expect(qa).toContain("await shot('recurring-service-brand-release-unverified-'+label)");
    expect(qa).toContain("blocked.includes('δεν επιβεβαιώθηκε')&&(await state()).deletes===1");
    expect(qa).toContain('current.writes===1&&current.deletes===0');
    expect(qa).toContain('uncertain.disabled&&uncertain.error.includes');
    expect(qa).toContain('same-turn recurring Save cannot launch two Storage PUTs');
    expect(qa).toContain("[[320,760,'dark'],[375,812,'light']]");
    expect(qa).toContain("facts.payLabel==='Πληρωμή '+longName");
    expect(qa).toContain('facts.contained&&facts.noOverlap&&facts.overflow<=1&&facts.nameWidthShare>=.5&&facts.amountStacked&&facts.markAtStart');
    const presentation=readFileSync('src/styles/mobile-finance-presentations.css','utf8');
    const domain=readFileSync('src/styles/mobile-finance-domain-layouts.css','utf8');
    expect(presentation).toContain('.mobile-recurring-amount{display:grid;justify-items:end;gap:2px;font-variant-numeric:tabular-nums}');
    expect(domain).toContain('.mobile-recurring-head .semantic-list-title{align-items:flex-start}');
    expect(presentation+domain).not.toContain('.mobile-recurring-head>strong{');
    expect(qa).toContain("'long-name linked recurring payment'");
    expect(readFileSync('src/qa.tsx','utf8')).toContain("params.has('recurring-branding-long-name')");
    expect(readFileSync('scripts/real-stack-browser-e2e.ts','utf8')).toContain("event.recurringId===row.id&&event.kind==='expense'");
  });
});
