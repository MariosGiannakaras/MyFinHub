import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/App.tsx');
const qa=read('src/qa.tsx');
const page=read('src/pages/TransactionsPage.tsx');
const editor=read('src/components/LegacyTransactionEditor.tsx');
const rendered=read('scripts/legacy-transaction-management-qa.mjs');

describe('Transactions exact finance receipt and non-destructive history contract',()=>{
  it('reuses the canonical revisioned finance boundary for legacy override, tombstone, and current event deletion',()=>{
    expect(app).toContain('const deleteEventDurably=(id:string)=>finance.updateDurably');
    expect(app).toContain('const editLegacy=(transaction:LegacyTransaction)=>finance.updateDurably');
    expect(app).toContain('const deleteLegacy=(id:string)=>finance.updateDurably');
    expect(app).toContain('onDeleteEvent={deleteEventDurably}');
    expect(page).toContain('await onDeleteEvent(target.id)');
    expect(page).toContain('await onDeleteLegacy(target.id)');
    expect(page).toContain('await onEditLegacy(transaction)');
    expect(page).toContain('error={deleteError} busy={deleteBusy}');
    expect(page).toContain('setDeleteTarget(null)');
    expect(page).toContain('Η διαγραφή της κίνησης αποθηκεύτηκε.');
  });
  it('leaves the legacy edit draft and confirmation open when a receipt is rejected',()=>{
    expect(editor).toContain('await onSave(normalized)');
    expect(editor).toContain('onRequestClose={()=>{if(!saving)onClose()}}');
    expect(editor).toContain('<div className="form-grid" inert={saving}>');
    expect(qa).toContain("params.get('transaction-save-failure')==='1'");
    expect(qa).toContain("params.get('transaction-save-pending')==='1'");
    expect(rendered).toContain('legacy-transaction-receipt-failure-desktop');
    expect(rendered).toContain('legacy-transaction-receipt-pending-mobile');
  });
});
