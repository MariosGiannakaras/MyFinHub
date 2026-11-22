import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {saveFinanceThenCleanupReceipt} from '../src/lib/receiptPostSave.js';

describe('#649 receipt post-save second-store boundary',()=>{
  it('uses one production cleanup owner and one warning contract in the real App and synthetic QA app',()=>{
    const app=readFileSync('src/App.tsx','utf8');
    const qa=readFileSync('src/qa.tsx','utf8');
    const owner=readFileSync('src/hooks/useReceiptCleanup.ts','utf8');
    const handoff=readFileSync('src/components/ReceiptAwareQuickAdd.tsx','utf8');
    const inbox=readFileSync('src/components/ReceiptInbox.tsx','utf8');
    const notice=readFileSync('src/components/ReceiptCleanupNotice.tsx','utf8');
    for(const consumer of [app,qa]){
      expect(consumer).toContain('const receiptCleanup=useReceiptCleanup();');
      expect(consumer).toContain('<ReceiptCleanupNotice pendingCount={receiptCleanup.pending.length} busy={receiptCleanup.busy} onRetry={receiptCleanup.retry}/>');
      expect(consumer).toContain('onReceiptCleanupFailure={receiptCleanup.onFailure}');
    }
    expect(owner).toContain('await deleteReceiptDraft(id)');
    expect(owner).toContain('setPending(current=>current.filter(id=>!completed.includes(id)))');
    expect(handoff).toContain('await markReceiptDraftPosted(handledId);await deleteReceiptDraft(handledId)');
    expect(handoff).toContain('if(handledId)await assertReceiptDraftUnposted(handledId)');
    expect(handoff.indexOf('if(handledId)await assertReceiptDraftUnposted(handledId)'))
      .toBeLessThan(handoff.indexOf('await saveFinanceThenCleanupReceipt('));
    const drafts=readFileSync('src/lib/receiptDrafts.ts','utf8');
    expect(drafts).toContain("export async function assertReceiptDraftUnposted(id: string)");
    expect(drafts).toContain("await withStore('readonly'");
    expect(drafts).toContain("draft.status === 'posted'");
    expect(owner).toContain("rows.filter(row=>row.status==='posted')");
    expect(inbox).toContain("selected.status==='posted' ? <div className");
    expect(inbox).toContain("selected.status!=='posted'?<Button");
    expect(inbox).toContain('Ήδη καταχωρισμένη · μόνο διαγραφή');
    expect(owner).not.toContain('addEvent(');
    expect(owner).not.toContain('onCreate(');
    expect(notice).toContain('Η οικονομική κίνηση έχει αποθηκευτεί');
    expect(notice).toContain('Μην καταχωρίσεις ξανά');
    expect(notice).toContain('Επανάληψη καθαρισμού');
    expect(notice).toContain('disabled={busy}');
  });
  it('replays failed IndexedDB cleanup and local-only retry in the real browser suite',()=>{
    const qa=readFileSync('scripts/receipt-local-ocr-qa.mjs','utf8');
    expect(qa).toContain('QA_RECEIPT_DELETE_BLOCKED');
    expect(qa).toContain('Η οικονομική κίνηση έχει αποθηκευτεί');
    expect(qa).toContain('Επανάληψη καθαρισμού');
    expect(qa).toContain('receipt-local-after-finance-cleanup-failed');
    expect(qa).toContain('receipt-local-retry-still-blocked');
    expect(qa).toContain('receipt-local-posted-after-reload');
    expect(qa).toContain('receipt-local-posted-no-repost-after-reload');
    expect(qa).toContain('receipt-stale-prefill-cross-tab-preflight-denied');
    expect(qa).toContain('another-tab synthetic receipt posted status committed before stale Quick Entry submit');
    expect(qa).toContain('stale receipt handoff was blocked before any finance write');
    expect(qa).toContain("receiptQaUrl.searchParams.set('receipt-persist-posted-qa','1')");
    expect(qa).toContain('restoredSyntheticFinance');
    const fixture=readFileSync('src/qa.tsx','utf8');
    expect(fixture).toContain("sessionStorage.setItem('myfinhub:qa-receipt-confirmed-event'");
    expect(fixture).toContain("sessionStorage.getItem('myfinhub:qa-receipt-confirmed-event')");
    expect(fixture).toContain("event.note.includes('QA CORRECTED MARKET')");
    expect(readFileSync('.github/workflows/fb-focused-rendered-qa.yml','utf8')).toContain('<!-- run-649-receipt-reload-qa -->');
    expect(qa).toContain('post-reload cleanup retry never posts finance');
    expect(qa).toContain('financeWritesAfterCommit===financeWritesBefore+1');
    expect(qa).toContain('failed local-only retry never re-posts');
    expect(qa).toContain('successful local-only cleanup retry does not post finance a second time');
    const qaApp=readFileSync('src/qa.tsx','utf8');
    expect(qaApp).toContain('document.documentElement.dataset.qaFinanceWrites=String(Number(document.documentElement.dataset.qaFinanceWrites||0)+1)');
    expect(readFileSync('src/App.tsx','utf8')).not.toContain('qaFinanceWrites');
  });
  it('never deletes local evidence when the finance commit was rejected',async()=>{
    const save=vi.fn(async()=>{throw new Error('conflict')});
    const cleanup=vi.fn(async()=>undefined),notify=vi.fn();
    await expect(saveFinanceThenCleanupReceipt(save,cleanup,notify)).rejects.toThrow('conflict');
    expect(cleanup).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
  it('reports only failed local cleanup after confirmed finance write; never posts the event twice',async()=>{
    const save=vi.fn(async()=>undefined),cleanup=vi.fn(async()=>{throw new Error('IndexedDB blocked')});
    const notify=vi.fn();
    await expect(saveFinanceThenCleanupReceipt(save,cleanup,notify)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('does not convert a confirmed finance save to failure when local cleanup reporting itself throws',async()=>{
    const save=vi.fn(async()=>undefined);
    const cleanup=vi.fn(async()=>{throw new Error('local receipt storage rejected')});
    const notify=vi.fn(()=>{throw new Error('notification UI unavailable')});
    await expect(saveFinanceThenCleanupReceipt(save,cleanup,notify)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('removes the local draft once after finance save and does not announce false errors',async()=>{
    const order:string[]=[];
    const save=vi.fn(async()=>{order.push('finance')});
    const cleanup=vi.fn(async()=>{order.push('local')});
    const notify=vi.fn();
    await saveFinanceThenCleanupReceipt(save,cleanup,notify);
    expect(order).toEqual(['finance','local']);
    expect(notify).not.toHaveBeenCalled();
  });
  it('accepts a non-receipt event without touching local storage',async()=>{
    const save=vi.fn(async()=>undefined),notify=vi.fn();
    await saveFinanceThenCleanupReceipt(save,null,notify);
    expect(save).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
});
