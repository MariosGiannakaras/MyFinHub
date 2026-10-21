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
   expect(browser).toContain('responsive recurring list visibly labels the forecast amount as estimate');
 });
});
