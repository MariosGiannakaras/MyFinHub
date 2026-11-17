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
