import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

// A narrow static reachability gate; runtime save/reload and owner/AAL2 proofs
// belong to isolated real-stack and rendered suites, not this source test.
const source=(path:string)=>readFileSync(path,'utf8');
const app=source('src/App.tsx');
const server=source('server/index.ts');
const api=source('src/lib/api.ts');
const settings=source('src/pages/SettingsPage.tsx');
const recurring=source('src/pages/RecurringPage.tsx');
const credit=source('src/pages/CreditCardPage.tsx');
const planning=source('src/pages/PlanningPage.tsx');
const attention=source('src/pages/AttentionPage.tsx');
const trace=source('docs/completion/FULL_SYSTEM_TRACEABILITY_MATRIX.md');

describe('post-v1.4 frontend/backend capability reachability map (DV-FB01/02)',()=>{
  it('connects the routed finance pages to app handlers, not local-only side effects',()=>{
    for(const route of ['transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports']){
      expect(app).toContain("page === '"+route+"'");
    }
    for(const link of ['onUpsert={upsertRecurring}','onUpsertDurably={upsertRecurringDurably}','onUpsertLoan={upsertLoan}','onUpsertBudget={upsertBudget}','onUpsertRule={upsertRule}','onDeleteEvent={deleteEvent}','onDecision={decideAttention}']){
      expect(app).toContain(link);
    }
  });
  it('maps durable finance writes and history/import/backup to canonical server routes',()=>{
    for(const [verb,path] of [['get','/api/data'],['put','/api/data'],['get','/api/history'],['post','/api/history'],['post','/api/import'],['post','/api/backup']] as const){
      expect(server).toContain("app."+verb+"('"+path+"'");
      expect(api).toContain("'"+path+"'");
    }
    expect(app).toContain('finance.updateDurably');
  });
  it('keeps owner-session auth, vault, metadata and Settings tab routes reachable',()=>{
    for(const path of ['/api/auth/login','/api/auth/mfa/enroll','/api/auth/mfa/verify','/api/auth/session','/api/auth/logout','/api/account-metadata','/api/card-secrets','/api/auth/devices']){
      expect(server).toContain("'"+path+"'");
    }
    expect(settings).toContain('<AccountManagementSettings');
    expect(settings).toContain('<FinancialProviderManagementSettings');
    expect(settings).toContain('<TransactionRulesWorkspace');
    expect(settings).toContain('onChangeDurably=');
    expect(app).toContain('onFinanceDurably={finance.updateDurably}');
  });
  it('does not let recorded recurring and credit capabilities disappear from reachable pages',()=>{
    expect(recurring).toContain('await onUpsertDurably(normalized)');
    expect(recurring).toContain('await deleteRecurringServiceAsset(oldKey)');
    expect(recurring).toContain("onUpsert({...item,status,active:status==='active'})");
    expect(credit).toContain('Προσθήκη πιστωτικής');
    expect(credit).toContain('onEditDetails={openCardDetails}');
    expect(planning).toContain('onCompleteScheduled(completed, event)');
    expect(attention).toContain('onDecision(item.id,decision)');
  });
  it('tracks atomic card vault cleanup and still-pending acceptance evidence explicitly',()=>{
    expect(trace).toContain('## 9. DV-FB source-to-operation reachability matrix');
    expect(trace).toContain('permanent card deletion');
    expect(trace).toContain('rheomiq_delete_committed_card_secret');
    expect(trace).toContain('row');
    expect(trace).toContain('DV-FB07/10 remain unchecked');
  });
});
