import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const inbox=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../src/components/ReceiptAwareQuickAdd.tsx',import.meta.url),'utf8');
const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');

describe('receipt to Quick Entry contract',()=>{
  it('routes generic entry through the receipt-aware wrapper without changing special transaction flows',()=>{
    expect(contextual).toContain("if(context.mode==='generic')return <ReceiptAwareQuickAdd");
    expect(contextual).toContain('return <ContextModal');
  });

  it('capture persists a local draft before any optional OCR scan',()=>{
    const capture=inbox.slice(inbox.indexOf('const capture = async'),inbox.indexOf('const scan = async'));
    expect(capture).toContain('normalizeReceiptFile(file)');
    expect(capture).toContain('createReceiptDraft(normalized)');
    expect(capture).not.toContain('scanReceiptLocally');
    expect(capture).toContain('Αποθηκεύτηκε για αργότερα');
  });

  it('OCR only applies a prefill and never owns a finance create callback',()=>{
    expect(inbox).toContain('onApply: (draftId: string, proposal: ReceiptProposal) => void');
    expect(inbox).not.toContain('onCreate: (event: FinanceEvent)');
    expect(bridge).toContain('await saveFinanceThenCleanupReceipt(');
    expect(bridge).toContain('const create = async (event:FinanceEvent)=>completeWithReceipt(()=>onCreate(event));');
    expect(bridge).toContain('handledId?()=>deleteReceiptDraft(handledId):null');
    expect(bridge).not.toContain('void deleteReceiptDraft(handledId)');
  });

  it('keeps the draft when Quick Entry is cancelled and deletes it only after normal submit',()=>{
    const create=bridge.slice(bridge.indexOf('const completeWithReceipt = async'),bridge.indexOf('if (!open) return null'));
    expect(create).toContain('await saveFinanceThenCleanupReceipt(');
    expect(create).toContain('handledId?()=>deleteReceiptDraft(handledId):null');
    expect(create).toContain('onReceiptCleanupFailure?.(handledId)');
    expect(create).not.toContain('void deleteReceiptDraft');
    expect(bridge).not.toMatch(/onClose[^\n]*deleteReceiptDraft/);
  });

  it('keeps linked transfers on the same durable finance-then-local-cleanup boundary',()=>{
    expect(bridge).toContain('const createLinked = onCreateLinkedTransfer');
    expect(bridge).toContain('completeWithReceipt(()=>onCreateLinkedTransfer(principal,fee))');
    expect(bridge).toContain('onCreateLinkedTransfer={createLinked}');
    expect(contextual).toContain('onReceiptCleanupFailure={onReceiptCleanupFailure}');
  });

  it('keeps rejected local receipt deletion in an error state and never reports success',()=>{
    const deletion=inbox.slice(inbox.indexOf('const confirmRemove=async()=>'),inbox.indexOf('const toggleDelete'));
    expect(deletion).toContain('await deleteReceiptDraft(request.draft.id)');
    expect(deletion).toContain('await deleteReceiptDrafts(request.ids)');
    expect(deletion).toContain('}catch{');
    expect(deletion).toContain("setMessage('');");
    expect(deletion).toContain("setError('Η διαγραφή της τοπικής απόδειξης απέτυχε.");
    expect(inbox).toContain('<FormError id="receipt-inbox-error">{error}</FormError>');
  });

  it('passes receipt date and full category path into QuickAdd while blocking silent non-EUR prefill',()=>{
    expect(bridge).toContain("receiptProposal?.currency && receiptProposal.currency !== 'EUR'");
    expect(bridge).toContain('amount: explicitNonEur ? 0');
    expect(bridge).toContain('asOf={receiptProposal?.date ?? asOf}');
    expect(bridge).toContain('subcategory: receiptProposal?.subcategory');
    expect(inbox).not.toContain('Διόρθωση νομίσματος απόδειξης');
    expect(inbox).toContain("currency:reviewProposal.currency&&reviewProposal.currency!=='EUR'&&!correctedEurAmount?reviewProposal.currency:'EUR'");
    expect(inbox).toContain('disabled={scanning||reviewSaving||reviewTotalInvalid||reviewLinesInvalid||needsEurTotal||Boolean(linkedPurchase)||(purchaseMatches.length>0&&!reviewNewPurchaseConfirmed)}');
    expect(inbox).toContain('const correctedEurAmount=reviewTotalEdited&&totalText');
    expect(inbox).toContain('const needsEurTotal=nonEur&&!(reviewTotalEdited');
    expect(inbox).toContain('subcategory={reviewed.subcategory??\'\'}');
    expect(bridge).toContain("initialKind={receiptDraftId ? (receiptProposal?.reviewedSplit?'split':'expense') : initialKind}");
    expect(inbox).toContain('Χρήση ως επιμερισμένη δαπάνη');
    expect(inbox).toContain('purchaseMatches.length&&!reviewNewPurchaseConfirmed');
    expect(bridge).toContain('parts:receiptProposal?.reviewedSplit?receiptSplitParts');
  });
});
