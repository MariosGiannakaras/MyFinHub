import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
describe('Lending settlement plans honor save receipt and privacy (#588 B3)',()=>{
 it('uses a single revisioned state recipe in production and one history point in QA',()=>{
  const app=read('src/App.tsx'),qa=read('src/qa.tsx'),page=read('src/pages/LendingPage.tsx');
  expect(app).toContain('finance.updateDurably(current=>withConfirmedLendingPlan(current,draft,true))');
  expect(qa).toContain('update(current=>withConfirmedLendingPlan(current,draft,true))');
  expect(page).toContain('onSaveLendingPlan={');
  expect(page).toContain('data-confirmed-lending-plan');
  expect(page).toContain('logic-note private-text');
 });
 it('displays an explicit nonposting schedule and keeps the dialog open after a rejected save',()=>{
  const modal=read('src/components/LendingSettlementDialog.tsx');
  expect(modal).toContain('lendingSettlementProjection(data,draft)');
  expect(modal).toContain('await onSave(draft)');
  expect(modal.indexOf('await onSave(draft)')).toBeLessThan(modal.indexOf('onClose();'));
  expect(modal).toContain('data-lending-plan-preview');
  expect(modal).toContain('checked={confirmed}');
  expect(modal).toContain('setConfirmed(false)');
  expect(modal).toContain('role="status"');
  expect(modal).toContain('Δεν αποθηκεύτηκε το πρόγραμμα');
 });
});
