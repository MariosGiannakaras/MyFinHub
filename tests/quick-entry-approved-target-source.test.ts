import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quickAdd=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const receiptAware=readFileSync(new URL('../src/components/ReceiptAwareQuickAdd.tsx',import.meta.url),'utf8');
const approvedCss=readFileSync(new URL('../src/styles/part55.css',import.meta.url),'utf8');
const approvedChain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');
const baseStyles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

describe('approved Quick Entry desktop target source contract',()=>{
  it('keeps the real eight-intent QuickAdd engine and canonical entry controls',()=>{
    expect(quickAdd).toContain('ENTRY_INTENTS.map');
    expect(quickAdd).toContain('generic-kind-grid');
    expect(quickAdd).toContain('structuredPresetFromFrequent(f)');
    expect(quickAdd).toContain('<MoneyInput');
    expect(quickAdd).toContain('<AppDateInput');
    expect(quickAdd).toContain('<AppSelectInput');
    expect(quickAdd).toContain('createTransferEvent');
    expect(quickAdd).toContain('createExpenseSplitEvent');
  });

  it('places the existing real receipt flow inside the Quick Entry footer without duplicating persistence',()=>{
    expect(receiptAware).toContain("createPortal(<button type=\"button\" className=\"receipt-quick-launch neo-raised\"");
    expect(receiptAware).toContain("document.querySelector<HTMLElement>('[aria-labelledby=\"quick-add-title\"] > footer')");
    expect(receiptAware).toContain('setReceiptOpen(true)');
    expect(receiptAware).toContain('deleteReceiptDraft(handledId)');
  });

  it('extends the existing approved-style chain instead of replacing Dashboard or Transactions styles',()=>{
    expect(baseStyles.trimEnd()).toMatch(/part46\.css';$/);
    expect(approvedChain).toContain("@import './part48.css';");
    expect(approvedChain).toContain("@import './part49.css';");
    expect(approvedChain).toContain("@import './part50.css';");
    expect(approvedChain).toContain("@import './part51.css';");
    expect(approvedChain).toContain("@import './part54.css';");
    expect(approvedChain).toContain("@import './part55.css';");
    expect(approvedCss).toContain('@media (min-width:1100px)');
    expect(approvedCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(approvedCss).toContain('.form-grid .wide{grid-column:span 2}');
    expect(approvedCss).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(approvedCss).toContain("content:'Σάρωση & αυτόματη συμπλήρωση'");
  });
});
