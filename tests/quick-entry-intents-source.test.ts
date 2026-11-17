import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quickAdd=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');

describe('Quick Entry intent UI source contract',()=>{
  it('uses shared cent-exact validation in multi-source, commission and contextual owners',()=>{
    expect(quickAdd).toContain('const share=parseMoneyInputAmount(row.amountText)');
    expect(quickAdd).toContain('if(share===null||share<=0)throw');
    expect(quickAdd).toContain('parseMoneyInputAmount(feeAmount,true)');
    expect(contextual).toContain('const numeric=parseMoneyInputAmount(amount)');
    expect(contextual).toContain('parseMoneyInputAmount(paymentFee,true)');
    expect(contextual).not.toContain("const numeric=Number(amount.replace(',','.'))");
    expect(quickAdd).not.toContain("amount:Number(row.amountText.replace(',','.'))");
  });

  it('stages real-browser malformed notation guards without relying on unit assertions alone',()=>{
    const browser=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(browser).toContain('quick-entry-nondecimal-rejected-desktop');
    expect(browser).toContain('contextual-entry-hex-rejected-desktop');
    expect(browser).toContain('generic exponent notation never posts a finance event');
    expect(browser).toContain('contextual hex notation never posts a savings event');
  });

  it('keeps raw split-part values visible but maps only valid cents to finance state',()=>{
    expect(quickAdd).toContain('const [splitAmountText,setSplitAmountText]=useState<Record<string,string>>({})');
    expect(quickAdd).toContain('value={rawSplitAmount??(p.amount||\'\')}');
    expect(quickAdd).toContain('setSplitAmountText(current=>({...current,[p.id]:text}))');
    expect(quickAdd).toContain('amount:parsed??0');
    expect(quickAdd).toContain('parseMoneyInputAmount(statementMovement,true)');
    expect(quickAdd).not.toContain("const parsed=Number(e.target.value.replace(',','.'))");
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('quick-entry-split-nondecimal-rejected-desktop');
    expect(qa).toContain('split malformed entry stays in draft without a posted event');
  });

  it('guards all ordinary Quick Entry account legs and prevents coerced multi-funding previews',()=>{
    expect(quickAdd).toContain("const numeric=kind==='split'||kind==='reconciliation'?0:parseMoneyInputAmount(amount)");
    expect(quickAdd).toContain("const actual=kind==='reconciliation'?parseMoneyInputAmount(actualBalance,true):undefined");
    expect(quickAdd).toContain("if(kind==='withdrawal'){");
    expect(quickAdd).toContain("const error=transferDraftError(data,{fromAccountId:from,toAccountId:to,amount:numeric})");
    expect(quickAdd).toContain('singleAccountDraftError(data,accountId)');
    expect(quickAdd).toContain('singleAccountDraftError(data,from)');
    expect(quickAdd).toContain('const fundingPreview=sumValidMoneyInputAmounts');
    expect(quickAdd).toContain("fundingPreview===null?'—':money.format(fundingPreview)");
    expect(quickAdd).not.toContain("money.format(fundingRows.reduce((sum,row)=>sum+(Number(");
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('quick-entry-multi-funding-invalid-subtotal-desktop');
    expect(qa).toContain('quick-entry-multi-funding-invalid-subtotal-preview-desktop');
    expect(qa).toContain('multi-source validation focus and alert are actually onscreen');
    expect(qa).toContain('invalid funding subtotal never posts a finance event');
  });

  it('does not erase lending due-date, saving source or original provenance during ordinary edits',()=>{
    expect(quickAdd).toContain("import { preserveEntryEditProvenance } from '../lib/eventEditProvenance'");
    expect(quickAdd).toContain('preserveEntryEditProvenance(event,initial)');
  });

  it('renders the approved intent registry instead of maintaining a second label list',()=>{
    expect(quickAdd).toContain('ENTRY_INTENTS.map');
    expect(quickAdd).toContain('intentIcons');
    expect(quickAdd).toContain("saving:<PiggyBank/>");
    expect(quickAdd).not.toContain("label:'Πήρα χρήματα'");
    expect(quickAdd).not.toContain("label:'Πήρα μετρητά'");
  });

  it('applies frequent suggestions as structured presets without turning the suggestion label into the user comment',()=>{
    expect(quickAdd).toContain('structuredPresetFromFrequent(f)');
    expect(quickAdd).not.toContain('setNote(f.label)');
  });

  it('keeps the comment field explicitly user-owned and optional',()=>{
    expect(quickAdd).toContain('Σχόλιο <em>προαιρετικό</em>');
    expect(quickAdd).toContain('Σύντομη περιγραφή μόνο αν χρειάζεται');
  });
});
