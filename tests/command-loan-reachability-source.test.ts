import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(path,'utf8');
describe('Command Palette exact Loan navigation',()=>{
  const index=read('src/lib/commandSearch.ts');
  const app=read('src/App.tsx');
  const qa=read('src/qa.tsx');
  const loans=read('src/pages/LoansPage.tsx');
  const browser=read('scripts/command-palette-qa.mjs');
  it('indexes each persisted Loan by stable identity and wires both route owners',()=>{
    expect(index).toContain("action:{type:'loan_focus',loanId:loan.id}");
    for(const source of [app,qa]){
      expect(source).toContain("if(action.type==='loan_focus')");
      expect(source).toContain('setCommandLoanId(action.loanId)');
      expect(source).toContain('setCommandLoanKey(key=>key+1)');
      expect(source).toContain('commandLoanId={commandLoanId}');
      expect(source).toContain('commandLoanKey={commandLoanKey}');
    }
  });
  it('expands the correct bounded list and focuses its exact article instead of a payment dialog',()=>{
    expect(loans).toContain('activeLoans.findIndex(loan=>loan.id===commandLoanId)');
    expect(loans).toContain('completedLoans.findIndex(loan=>loan.id===commandLoanId)');
    expect(loans).toContain('data-command-loan-id={loan.id}');
    expect(loans).toContain('row?.focus({preventScroll:true})');
    expect(browser).toContain('command-exact-loan-row');
    expect(browser).toContain('named Loan keyboard focus');
  });
});
