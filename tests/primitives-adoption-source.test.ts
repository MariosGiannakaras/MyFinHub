import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const loans=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const planning=readFileSync(new URL('../src/pages/PlanningPage.tsx',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const receipts=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const quickAdd=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');

function expectNoNativeDialog(source:string){
  expect(source).not.toContain('window.prompt');
  expect(source).not.toContain('window.confirm');
}

describe('shared primitive adoption',()=>{
  it('uses app-owned dialogs and MoneyInput in Credit Card flows',()=>{
    expectNoNativeDialog(credit);
    expect(credit).toContain('<MoneyEditDialog');
    expect(credit).toContain('<ConfirmDialog');
    expect(credit).toContain('<MoneyInput data-autofocus="true"');
  });

  it('uses app-owned confirmation for self-loan forgiveness',()=>{
    expectNoNativeDialog(loans);
    expect(loans).toContain('<ConfirmDialog');
    expect(loans).toContain('motionMode={data.state.settings.motion}');
    expect(loans).toContain('forgivenAmount:Number(current.forgivenAmount||0)+remaining');
  });

  it('uses shared confirmation and money fields in Planning',()=>{
    expectNoNativeDialog(planning);
    expect(planning).toContain('<ConfirmDialog');
    expect(planning).toContain('<MoneyInput data-autofocus="true" value={draft.amount}');
    expect(planning).toContain('<MoneyInput data-autofocus="true" value={actualAmount}');
    expect(planning).toContain("transitionScheduled(item,status)");
  });

  it('keeps JSON import behind the app-owned confirmation without changing the import path',()=>{
    expectNoNativeDialog(settings);
    expect(settings).toContain('<ConfirmDialog');
    expect(settings).toContain('pendingImportFile');
    expect(settings).toContain('await onImport(JSON.parse(await file.text()))');
    expect(settings).toContain('file.size>MAX_FINANCE_DOCUMENT_BYTES');
  });

  it('uses app-owned local receipt deletion while preserving OCR cancellation ordering',()=>{
    expectNoNativeDialog(receipts);
    expect(receipts).toContain('<ConfirmDialog');
    expect(receipts).toContain("open&&!deleteRequest");
    expect(receipts).toContain('if(scanningId===request.draft.id)await cancelScan()');
    expect(receipts).toContain('if(scanningId&&request.ids.includes(scanningId))await cancelScan()');
    expect(receipts).toContain('await deleteReceiptDrafts(request.ids)');
  });

  it('uses app-owned dirty-close confirmation and shared money fields in Quick Entry',()=>{
    expectNoNativeDialog(quickAdd);
    expect(quickAdd).toContain('<ConfirmDialog open={discardOpen}');
    expect(quickAdd).toContain("open&&!discardOpen");
    expect(quickAdd).toContain('<MoneyInput data-autofocus="true" value={amount}');
    expect(quickAdd).toContain('<MoneyInput data-autofocus="true" value={actualBalance}');
  });

  it('keeps conflict recovery behind app-owned confirmation and the existing reload path',()=>{
    expectNoNativeDialog(app);
    expect(app).toContain('<ConfirmDialog open={recoverOpen}');
    expect(app).toContain("finance.saveState === 'error' || finance.saveState === 'conflict'");
    expect(app).toContain('const confirmRecover=()=>{setRecoverOpen(false);void finance.reload()}');
  });
});
