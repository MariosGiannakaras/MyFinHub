import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('receipt editable line review UI contract (#588 C)',()=>{
  it('uses shared controls, local item state, strict EUR-cent checks and owner-only persistence',()=>{
    const ui=readFileSync('src/components/ReceiptInbox.tsx','utf8');
    const css=readFileSync('src/styles/receipt-inbox.css','utf8');
    expect(ui).toContain("import { normalizeReceiptLineReview, receiptSplitParts } from '../lib/receiptItemReview'");
    expect(ui).toContain('const [reviewItemAmounts,setReviewItemAmounts]');
    expect(ui).toContain('const lineReview=useMemo(');
    expect(ui).toContain('()=>reviewProposal?normalizeReceiptLineReview(reviewProposal,reviewItemAmounts,reviewTotal):null');
    expect(ui).toContain('reviewed.items.map((item,index)=>');
    expect(ui).toContain('Διόρθωση ποσού γραμμής');
    expect(ui).toContain('CategorySelectInput settings={data.state.settings} kind="expense"');
    expect(ui).toContain('itemsBalanced:reviewProposal.items===undefined?undefined:');
    expect(ui).toContain('reviewLinesInvalid');
    expect(ui).toContain('(reviewed?.items?.length??0)>=2');
    expect(ui).toContain('const reviewedSplit=split?{...normalized,reviewedSplit:true}:normalized');
    expect(ui).toContain('await saveReceiptProposal(selected.id,reviewedSplit)');
    const browser=readFileSync('scripts/receipt-local-ocr-qa.mjs','utf8');
    expect(browser).toContain('receipt-local-reviewed-items-desktop');
    expect(browser).toContain('receipt-local-reviewed-items-mobile');
    expect(browser).toContain('sub-cent receipt item save guard');
    expect(browser).toContain('exact 2450 cents stored only as owner-reviewed local proposal');
    expect(browser).toContain("currency:'USD',itemsCurrency:'USD'");

    expect(css).toContain('.receipt-items-review');
    expect(ui).not.toContain('createEvent(');
  });
});
