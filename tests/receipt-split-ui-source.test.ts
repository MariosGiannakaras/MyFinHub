import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('receipt split handoff cannot bypass canonical finance save',()=>{
 it('requires explicit owner choice and existing QuickAdd split builder',()=>{
 const inbox=readFileSync('src/components/ReceiptInbox.tsx','utf8');
 const bridge=readFileSync('src/components/ReceiptAwareQuickAdd.tsx','utf8');
 const quick=readFileSync('src/components/QuickAdd.tsx','utf8');
 expect(inbox).toContain('purchaseMatches.length&&!reviewNewPurchaseConfirmed');
 expect(inbox).toContain('Χρήση ως επιμερισμένη δαπάνη');
 expect(bridge).toContain("initialKind={receiptDraftId ? (receiptProposal?.reviewedSplit?'split':'expense') : initialKind}");
 expect(quick).toContain("setParts(initialKind==='split'&&prefill?.parts?.length?prefill.parts:freshParts())");
 expect(quick).toContain('event=createExpenseSplitEvent(data,{date,note:note||labelForKind(kind),accountId,parts})');
 expect(bridge.indexOf('await onCreate(event);')).toBeLessThan(bridge.indexOf('void deleteReceiptDraft(handledId)'));
 });
});
