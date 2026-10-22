import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('variable recurring editor and status provenance (#588 #8)',()=>{
 it('exposes a controlled fixed/estimated amount selector and optional exact cent range',()=>{
   const ui=readFileSync('src/pages/RecurringPage.tsx','utf8');
   expect(ui).toContain("value={edit.amountMode??'fixed'}");
   expect(ui).toContain('<option value="variable">Μεταβλητό · εκτίμηση</option>');
   expect(ui).toContain('estimateMin:value===\'\'?undefined:Number');
   expect(ui).toContain('estimateMax:value===\'\'?undefined:Number');
   expect(ui).toContain('data-variable-recurring-explainer');
   expect(ui).toContain('await onUpsertDurably(normalized)');
   expect(ui).toContain('setMessage(cleanupWarning.trim())');
   expect(ui).toContain("document.getElementById('recurring-editor-error')?.scrollIntoView");
   expect(ui).toContain('onClick={closeEdit}><X/></IconButton></div>{editError?<FormError');
   expect(ui).not.toContain('</div></section>{editError?<FormError');
   expect(ui).not.toContain('Το πάγιο ενημερώθηκε και αποθηκεύτηκε.');
   expect(ui).not.toContain('Το νέο πάγιο δημιουργήθηκε και αποθηκεύτηκε.');
 });
 it('never labels a projected variable charge as a confirmed real transaction',()=>{
   const ui=readFileSync('src/pages/RecurringPage.tsx','utf8');
   expect(ui).toContain("'Εκτίμηση · όχι πραγματική πληρωμή'");
   expect(ui).toContain("' · περιλαμβάνει ρητές εκτιμήσεις'");
   expect(ui).toContain("' (εκτίμηση)'");
   expect(ui).toContain('Τελευταία');
   expect(ui).toContain('lastPayment.amount');
   const browser=readFileSync('scripts/recurring-cadence-qa.mjs','utf8');
   expect(browser).toContain('Recurring amount QA: variable estimate');
   expect(browser).toContain('recurring-variable-estimate-editor-desktop');
   expect(browser).toContain('recurring-variable-estimate-editor-mobile');
   expect(browser).toContain('recurring-variable-estimate-saved-mobile');
   expect(browser).toContain('recurring-variable-rejected-save-mobile');
   expect(browser).toContain('rejected save error fully visible above sticky footer at 375px');
   expect(browser).toContain("const menu=[...document.querySelectorAll('.mobile-recurring-row .mobile-action-menu')]");
   expect(browser).toContain('true top-edge save progress remains the only routine save confirmation');
   expect(browser).toContain('failed finance receipt retains editable variable draft');
   expect(browser).toContain("failureUrl.searchParams.set('recurring-save-failure','1')");
   expect(browser).toContain('responsive recurring list visibly labels the forecast amount as estimate');
 });
});
