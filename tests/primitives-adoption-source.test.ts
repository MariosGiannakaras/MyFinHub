import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const loans=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const planning=readFileSync(new URL('../src/pages/PlanningPage.tsx',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const receipts=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const quickAdd=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const contextualQuickAdd=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');

function expectNoNativeDialog(source:string){
  expect(source).not.toContain('window.prompt');
  expect(source).not.toContain('window.confirm');
}

describe('shared primitive adoption',()=>{
  it('uses app-owned dialogs and shared editable controls in Credit Card flows',()=>{
    expectNoNativeDialog(credit);
    expect(credit).toContain('<MoneyEditDialog');
    expect(credit).toContain('<ConfirmDialog');
    expect(credit).toContain('<MoneyInput data-autofocus="true"');
    expect(credit).toContain("from '../components/AppTextInput'");
    expect(credit).toContain('<AppTextInput data-autofocus="true" inputMode="numeric" type="number"');
    expect(credit).toContain('<AppTextInput inputMode="numeric" type="number"');
    expect(credit).toContain('<AppTextInput value={note}');
  });

  it('uses app-owned confirmation and shared generic text controls for Loans',()=>{
    expectNoNativeDialog(loans);
    expect(loans).toContain('<ConfirmDialog');
    expect(loans).toContain('motionMode={data.state.settings.motion}');
    expect(loans).toContain('forgivenAmount:Number(current.forgivenAmount||0)+remaining');
    expect(loans).toContain("from '../components/AppTextInput'");
    expect(loans).toContain('<AppTextInput data-autofocus="true" value={edit.name}');
    expect(loans).toContain('<AppTextInput type="number" min="1" step="1"');
    expect(loans).toContain('<AppTextInput value={edit.provider||\'\'}');
    expect(loans.match(/<input\b/g)?.length).toBe(1);
    expect(loans).toContain('<input type="checkbox" checked={Boolean(edit.longTermRecurring)}');
  });

  it('uses shared confirmation, money and generic text fields in Planning',()=>{
    expectNoNativeDialog(planning);
    expect(planning).toContain('<ConfirmDialog');
    expect(planning).toContain('<MoneyInput data-autofocus="true" value={draft.amount}');
    expect(planning).toContain('<MoneyInput data-autofocus="true" value={actualAmount}');
    expect(planning).toContain("transitionScheduled(item,status)");
    expect(planning).toContain("from '../components/AppTextInput'");
    expect(planning).toContain('<AppTextInput value={draft.note}');
    expect(planning).not.toMatch(/<input\b/);
  });

  it('keeps JSON import behind the app-owned confirmation without changing the import path',()=>{
    expectNoNativeDialog(settings);
    expect(settings).toContain('<ConfirmDialog');
    expect(settings).toContain('pendingImportFile');
    expect(settings).toContain('await onImport(JSON.parse(await file.text()))');
    expect(settings).toMatch(/file\.size\s*>\s*MAX_FINANCE_DOCUMENT_BYTES/);
  });

  it('uses app-owned local receipt deletion while preserving OCR cancellation ordering',()=>{
    expectNoNativeDialog(receipts);
    expect(receipts).toContain('<ConfirmDialog');
    expect(receipts).toContain("open&&!deleteRequest");
    expect(receipts).toContain('if(scanningId===request.draft.id)await cancelScan()');
    expect(receipts).toContain('if(scanningId&&request.ids.includes(scanningId))await cancelScan()');
    expect(receipts).toContain('await deleteReceiptDrafts(request.ids)');
  });

  it('uses app-owned dirty-close confirmation and shared editable controls in Quick Entry',()=>{
    expectNoNativeDialog(quickAdd);
    expect(quickAdd).toContain('<ConfirmDialog open={discardOpen}');
    expect(quickAdd).toContain("open&&!discardOpen");
    expect(quickAdd).toContain('<MoneyInput data-autofocus="true" value={amount}');
    expect(quickAdd).toContain('<MoneyInput data-autofocus="true" value={actualBalance}');
    expect(quickAdd).toContain("from './AppTextInput'");
    expect(quickAdd).toContain('<AppTextInput value={person}');
    expect(quickAdd).toContain('<AppTextInput value={note}');
  });

  it('uses shared contextual payment amounts and text controls while preserving computed loan-plan read-only behavior',()=>{
    expectNoNativeDialog(contextualQuickAdd);
    expect(contextualQuickAdd).toContain('<MoneyInput data-autofocus="true"');
    expect(contextualQuickAdd).toContain('value={loanPaymentPlan?String(loanPaymentPlan.amount):amount}');
    expect(contextualQuickAdd).toContain('readOnly={Boolean(loanPaymentPlan)}');
    expect(contextualQuickAdd).toContain('invalid={amountError}');
    expect(contextualQuickAdd).toContain('if(!loanPaymentPlan)setAmount(value)');
    expect(contextualQuickAdd).toContain("from './AppTextInput'");
    expect(contextualQuickAdd).toContain('<AppTextInput value={person}');
    expect(contextualQuickAdd).toContain('<AppTextInput value={note}');
  });

  it('keeps conflict recovery behind an on-demand app-owned confirmation and the existing reload path',()=>{
    expectNoNativeDialog(app);
    expect(app).toContain("const ConfirmDialog = lazy(() => import('./components/ConfirmDialog')");
    expect(app).toContain('{recoverOpen ? <Suspense fallback={null}><ConfirmDialog open');
    expect(app).toContain("finance.saveState === 'error' || finance.saveState === 'conflict'");
    expect(app).toContain('const confirmRecover=()=>{setRecoverOpen(false);void finance.reload()}');
  });
});
