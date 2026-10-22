import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
describe('owner-confirmed writeoff through existing lending contextual dialog (#588 B3)',()=>{
  it('has a noncash durable confirmation path, actual as-of receivable and desktop/mobile triggers',()=>{
    const modal=readFileSync('src/components/ContextualQuickAdd.tsx','utf8');
    const page=readFileSync('src/pages/LendingPage.tsx','utf8');
    expect(modal).toContain("action:'lend'|'repay'|'writeoff'");
    expect(modal).toContain("lendingOutstandingFor(data,clean,date)");
    expect(modal).toContain("if(!writeoffConfirmed||confirmedWriteoffAmount!==amount)");
    expect(modal).toContain("kind:'lending_writeoff'");
    expect(modal).toContain("await onCreate(event)");
    expect(modal).toContain('data-lending-writeoff');
    expect(modal).toContain("checked={writeoffConfirmed&&confirmedWriteoffAmount===amount}");
    expect(modal).toContain("context.mode==='lending'&&context.action==='writeoff')?null");
    expect(page.match(/action:'writeoff'/g)).toHaveLength(2);
    expect(page).toContain('disabled={!selectedRow||selectedRow.outstanding<=0}');
  });
});
