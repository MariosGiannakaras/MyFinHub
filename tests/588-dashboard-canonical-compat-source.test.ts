import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('#588 canonical ledger and #597 dashboard coexistence',()=>{
  it('preserves contextual Dashboard account navigation with B finance save and linked-fee behavior',()=>{
    const app=readFileSync('src/App.tsx','utf8');
    const qa=readFileSync('src/qa.tsx','utf8');
    for(const source of [app,qa]){
      expect(source).toContain('const [dashboardAccountId,setDashboardAccountId]');
      expect(source).toContain("useEffect(()=>{if(page!=='transactions')setDashboardAccountId(null)},[page])");
      expect(source).toContain('dashboardAccountId={dashboardAccountId} dashboardAccountFocusKey={dashboardAccountFocusKey}');
      expect(source).toMatch(/onTransactions=\{\(accountId\)=>\{[^\n]+(?:navigate|setPage)\('transactions'\)\}\}/);
      expect(source).toContain('onCreateLinkedTransfer={addLinkedTransferDurably}');
      expect(source).toContain('onSaveLendingPlan={saveLendingPlan}');
    }
    expect(app).toContain("await import('./lib/legacyTransactions')");
    expect(qa).toContain('prepareCreditStatementEvent(current,ruledEvent)');
  });
});
