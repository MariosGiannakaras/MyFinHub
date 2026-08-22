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
    expect(bridge).toContain('onCreate(event);');
    expect(bridge).toContain('void deleteReceiptDraft(handledId)');
  });

  it('keeps the draft when Quick Entry is cancelled and deletes it only after normal submit',()=>{
    const create=bridge.slice(bridge.indexOf('const create = (event'),bridge.indexOf('if (!open) return null'));
    expect(create).toContain('onCreate(event);');
    expect(create).toContain('deleteReceiptDraft(handledId)');
    expect(bridge).not.toMatch(/onClose[^\n]*deleteReceiptDraft/);
  });

  it('passes receipt date into the existing QuickAdd and blocks silent non-EUR amount prefill',()=>{
    expect(bridge).toContain("receiptProposal?.currency !== 'EUR'");
    expect(bridge).toContain('amount: explicitNonEur ? 0');
    expect(bridge).toContain('asOf={receiptProposal?.date ?? asOf}');
    expect(bridge).toContain("initialKind={receiptDraftId ? 'expense' : initialKind}");
  });
});
