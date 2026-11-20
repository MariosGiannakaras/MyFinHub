import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {ApiError} from '../src/lib/api.js';
import {financeWriteDefinitelyRejected,FINANCE_RECEIPT_UNVERIFIED} from '../src/lib/financeWriteOutcome.js';
import {recurringFinanceWriteDefinitelyRejected} from '../src/lib/recurringFinanceAssetOutcome.js';

describe('#649 I19.04 fail closed after uncertain finance write acknowledgments',()=>{
  it('recognizes only server-proven precommit revision rejection',()=>{
    expect(financeWriteDefinitelyRejected(new ApiError('stale',409,'REVISION_CONFLICT'))).toBe(true);
    expect(recurringFinanceWriteDefinitelyRejected(new ApiError('stale',409,'REVISION_CONFLICT'))).toBe(true);
  });
  it.each([
    {cause:'lost transport after commit',error:new ApiError('offline',0,'NETWORK_ERROR')},
    {cause:'timeout after commit',error:new ApiError('timeout',0,'NETWORK_TIMEOUT')},
    {cause:'HTTP 503',error:new ApiError('retry?',503,'UPSTREAM_UNAVAILABLE')},
    {cause:'429',error:new ApiError('rate',429,'RATE_LIMITED')},
    {cause:'history cursor mismatch after accepted finance',error:new ApiError('history',409,'HISTORY_CURSOR_CONFLICT')},
    {cause:'untyped client failure',error:new Error('untyped failure')},
    {cause:'unproven validation failure',error:new ApiError('invalid',400,'INVALID_DATA')},
  ])('does not misclassify $cause as proven rollback',({error})=>{
    expect(financeWriteDefinitelyRejected(error)).toBe(false);
    expect(recurringFinanceWriteDefinitelyRejected(error)).toBe(false);
  });
  it('keeps the operator-visible warning and an action to inspect persisted state',()=>{
    expect(FINANCE_RECEIPT_UNVERIFIED).toContain('ίσως έχει ήδη αποθηκευτεί');
    expect(FINANCE_RECEIPT_UNVERIFIED).toContain('Μην την καταχωρίσεις ξανά');
    expect(FINANCE_RECEIPT_UNVERIFIED).toContain('τελευταία αποθηκευμένη κατάσταση');
  });
  it('guards generic, linked-transfer, scheduled, and contextual writers only after dispatch',()=>{
    const quick=readFileSync('src/components/QuickAdd.tsx','utf8');
    const contextual=readFileSync('src/components/ContextualQuickAdd.tsx','utf8');
    for(const source of [quick,contextual]){
      expect(source).toContain('if(saving||submitInFlight.current||receiptUnverifiedRef.current)return');
      expect(source).toContain('let financeDispatched=false');
      expect(source).toContain('financeDispatched=true;');
      expect(source).toContain('financeDispatched&&!financeWriteDefinitelyRejected(');
      expect(source).toContain('setReceiptUnverified(true)');
      expect(source).toContain('disabled={saving||receiptUnverified}');
      expect(source).toContain('visibleError?<FormError id=');
      expect(source.indexOf('let financeDispatched=false')).toBeLessThan(source.indexOf('financeDispatched=true;'));
    }
    expect(contextual).toContain("await onCompleteScheduled(transitionScheduled(scheduled,'completed',event.id),event)");
    expect(contextual).toContain('await onCreateLinkedTransfer(event,fee)');
    expect(quick).toContain('await onCreateLinkedTransfer(event,fee)');
    const qa=readFileSync('src/qa.tsx','utf8');
    expect(qa.indexOf('addEvent(event);')).toBeLessThan(qa.indexOf("if(params.get('quick-event-save-ambiguous')==='1')"));
    expect(qa).toContain("params.get('quick-event-save-rejected')==='1'");
  });
});
