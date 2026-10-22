import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('receipt editable line review UI contract (#588 C)',()=>{
  it('uses shared controls, local item state, strict EUR-cent checks and owner-only persistence',()=>{
    const ui=readFileSync('src/components/ReceiptInbox.tsx','utf8');
    const css=readFileSync('src/styles/receipt-inbox.css','utf8');
    expect(ui).toContain("import { normalizeReceiptLineReview } from '../lib/receiptItemReview'");
    expect(ui).toContain('const [reviewItemAmounts,setReviewItemAmounts]');
    expect(ui).toContain('const lineReview=useMemo(');
    expect(ui).toContain('return normalizeReceiptLineReview(reviewProposal,reviewItemAmounts,reviewTotal)');
    expect(ui).toContain('reviewed.items.map((item,index)=>');
    expect(ui).toContain('Διόρθωση ποσού γραμμής');
    expect(ui).toContain('CategorySelectInput settings={data.state.settings} kind="expense"');
    expect(ui).toContain('itemsBalanced:');
    expect(ui).toContain('reviewLinesInvalid');
    expect(ui).toContain('await saveReceiptProposal(selected.id,normalized)');
    expect(css).toContain('.receipt-items-review');
    expect(ui).not.toContain('createEvent(');
  });
});
