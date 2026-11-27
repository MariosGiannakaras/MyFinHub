import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/AttentionPage.tsx',import.meta.url),'utf8');
const target=readFileSync(new URL('../src/styles/attention-approved-target.css',import.meta.url),'utf8');
const refinement=readFileSync(new URL('../src/styles/attention-approved-refinement.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');

describe('Attention post-v1.4 remediation contracts',()=>{
  it('retains previously accepted #649 I13 urgent/due/privacy/action proof without new page forks',()=>{
    const model=readFileSync(new URL('../src/lib/attention.ts',import.meta.url),'utf8');
    const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
    for(const scenario of [
      'desktop hierarchy, privacy and deterministic queue',
      'legacy review keep semantics never mutate reports implicitly',
      'exact recurring and loan deep actions',
      'exact credit statement context',
      'exact scheduled completion is atomic',
      'snooze, undo, empty state and responsive accessibility',
    ])expect(qa).toContain(scenario);
    expect(qa).toContain("navigate('attention','extreme',375,812)");
    expect(qa).toContain("touchTargets('attention mobile extreme')");
    expect(qa).toContain("assertActionLabelContained");
    expect(qa).toContain("noUnnamed('attention mobile extreme')");
    expect(model).toContain('allAttentionItems');
    expect(app).toContain('attentionDecisions: { ...(current.state.attentionDecisions ?? {}), [id]: decision }');
  });

  it('routes each alert to its existing exact entity or source, not an inferred merchant (#649 I13.02)',()=>{
    const model=readFileSync(new URL('../src/lib/attention.ts',import.meta.url),'utf8');
    const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
    const reports=readFileSync(new URL('../src/pages/ReportsPage.tsx',import.meta.url),'utf8');
    const transactions=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
    for(const token of [
      "scheduledId:item.id,action:'complete_scheduled'",
      "recurringId:item.id,action:'pay_recurring'",
      "loanId:loan.id,action:'pay_loan'",
      "cardId:card.id,statementId:statement.id,action:'pay_credit'",
      "budgetId:row.id,action:'open_budgets'",
      "transactionId:item.id,transactionSource:item.source,action:'categorize_transaction'",
      "transactionId:primary.id,transactionSource:primary.source,action:'review_duplicate'"
    ])expect(model).toContain(token);
    for(const token of [
      "focusRecurringPayment(item.recurringId)",
      "openSpecial({ mode: 'loan', loanId: item.loanId",
      "openSpecial({ mode: 'credit', action: 'payment', cardId: item.cardId, statementId:item.statementId",
      "openSpecial({ mode: 'scheduled', scheduledId: item.scheduledId })",
      "url.searchParams.set('reportSection','budgets')"
    ])expect(app).toContain(token);
    expect(page).toContain("url.searchParams.set('attentionTx',item.transactionId)");
    expect(page).toContain("url.searchParams.set('attentionSource',item.transactionSource)");
    expect(page).toContain("url.hash='#/transactions'");
    expect(transactions).toContain("params.get('attentionTx')");
    expect(transactions).toContain("params.get('attentionSource')");
    expect(reports).toContain("url.searchParams.get('reportSection')!=='budgets'");
    expect(reports).toContain('id="report-budgets"');
    for(const label of ['exact recurring and loan deep actions','exact credit statement context','exact scheduled completion is atomic'])expect(qa).toContain(label);
  });

  it('keeps due/forecast advisory sources and owner review choices distinct from postings (#649 I13.04)',()=>{
    const model=readFileSync(new URL('../src/lib/attention.ts',import.meta.url),'utf8');
    const domain=readFileSync(new URL('../src/lib/domain.ts',import.meta.url),'utf8');
    const review=readFileSync(new URL('../src/components/LegacyConfirmationPanel.tsx',import.meta.url),'utf8');
    const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
    expect(model).toContain("budgetProgress(data,asOf.slice(0,7),asOf,false)");
    expect(model).toContain('const balances=accountBalances(data,asOf)');
    expect(model).toContain('const forecast=cashFlowForecast(data,asOf,30)');
    expect(model).toContain("action:'open_forecast'");
    expect(model).toContain("if(item.severity==='danger')throw new Error");
    expect(model).toContain('decision.fingerprint!==item.fingerprint');
    expect(review).toContain("onDecision(id,{status,semanticKind,decidedAt:now.toISOString(),snoozedUntil});");
    expect(review).toContain("onClick={()=>act(s.transaction.id,'kept')}");
    expect(review).toContain("disabled={s.semanticKind==='iris_context'}");
    expect(domain).toContain("if (decision?.status === 'confirmed' && decision.semanticKind)");
    expect(domain).toContain("existingDecision?.status==='kept'");
    expect(app).toContain('reviewDecisions: { ...(current.state.reviewDecisions ?? {}), [id]: decision }');
  });

  it('offers group expansion only when rows are actually truncated',()=>{
    expect(page).toContain('const canExpand=items.length>4');
    expect(page).toContain('{canExpand?<Button');
    expect(page).toContain("expanded?'Σύμπτυξη':`Προβολή όλων (${items.length})`");
    expect(page).not.toContain('const showAll=');
    expect(page).not.toContain("document.getElementById(rowsId)?.scrollIntoView");
  });

  it('reserves true all-clear language for zero active actionable items',()=>{
    expect(page).toContain('const activeActionable=items.length');
    expect(page).toContain("counts.danger?'Εκκρεμούν επείγοντα θέματα':activeActionable?'Δεν υπάρχουν επείγοντα θέματα':'Όλα υπό έλεγχο!'");
    expect(page).toContain('counts.danger?<AlertTriangle/>:activeActionable?<CircleAlert/>:<CheckCircle2/>');
    expect(page).toContain("activeActionable?`Υπάρχουν ${activeActionable} ενεργά θέματα χαμηλότερης προτεραιότητας παραπάνω.`");
    expect(page).toContain("activeActionable?'has-active':'is-clear'");
  });

  it('keeps zero-count groups discoverable without a table shell',()=>{
    expect(page).toContain("${items.length?'':'is-empty'}");
    expect(page).toContain("{items.length?<div className={`attention-approved-table-head");
    expect(target).toContain('.attention-approved-group.is-empty .attention-approved-group-head{min-height:50px;border-bottom:0}');
    expect(target).toContain('.attention-approved-empty-row{min-height:46px');
  });

  it('keeps the domain action primary while snooze and dismiss use the shared quiet icon variant',()=>{
    expect(page.match(/className="attention-approved-icon-action"/g)?.length).toBe(2);
    expect(page).toContain('variant="primary" className="compact" onClick={()=>onAction(item)}');
    expect(target).toContain('background:transparent!important');
    expect(target).toContain('color:var(--text-secondary)!important');
  });

  it('bounds wide desktop row measure and removes tiny dense-data overrides',()=>{
    expect(target).toContain('width:min(100%,1480px);margin-inline:auto');
    expect(refinement).toContain('.attention-approved-copy>p{font-size:var(--ux-dense-label-size)}');
    expect(refinement).toContain('.attention-approved-date>small{font-size:var(--ux-dense-label-size)}');
    expect(refinement).toContain('.attention-approved-actions>.save-button{min-height:34px;padding-inline:9px;font-size:var(--ux-dense-label-size)}');
    expect(refinement).not.toMatch(/font-size:(?:7(?:\.\d+)?|8(?:\.\d+)?)px/);
    expect(target).toContain('.attention-approved-actions{display:grid;grid-template-columns:minmax(0,1fr) 38px;');
    expect(target).toContain('.attention-approved-actions>.save-button{grid-column:1;grid-row:1/span 2;');
    expect(target).toContain('white-space:normal;overflow-wrap:break-word;word-break:normal;line-height:1.25');
    expect(target).toContain('.attention-approved-actions>.app-tooltip{grid-column:2;');
    expect(target).toContain('.attention-approved-actions>.save-button svg{width:13px;height:13px;flex-shrink:0}');
    expect(qa).toContain('assertActionLabelContained');
    expect(qa).toContain('long action labels must stay inside button boundaries and readable line count');
    expect(qa).toContain('lineCount>maxLines');
    expect(qa).toContain("[1100,900,'1100']");

  });
});
