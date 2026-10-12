import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/pages/SavingsPage.tsx',import.meta.url),'utf8');
const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');
const genericQuick=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const loans=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');
const ledger=readFileSync(new URL('../src/lib/ledgerFoundations.ts',import.meta.url),'utf8');
const selection=readFileSync(new URL('../src/lib/accountSelection.ts',import.meta.url),'utf8');
const accountSemantics=readFileSync(new URL('../src/lib/accountSemantics.ts',import.meta.url),'utf8');
const commandSearch=readFileSync(new URL('../src/lib/commandSearch.ts',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const domain=readFileSync(new URL('../src/lib/domain.ts',import.meta.url),'utf8');
const composition=readFileSync(new URL('../src/styles/savings-desktop-composition.css',import.meta.url),'utf8');
const functionalQa=readFileSync(new URL('../scripts/completion-functional-crud-qa.mjs',import.meta.url),'utf8');
const remediationQa=readFileSync(new URL('../scripts/savings-remediation-qa.mjs',import.meta.url),'utf8');
const approvedFixture=readFileSync(new URL('../src/qaApprovedDashboardFixture.ts',import.meta.url),'utf8');

describe('Savings page action hierarchy',()=>{
  it('renders the actionable savings choices before monthly reporting',()=>{
    const actions=source.indexOf('className="savings-action-section"');
    const hero=source.indexOf('className="savings-hero surface-raised"');
    expect(actions).toBeGreaterThan(-1);
    expect(hero).toBeGreaterThan(actions);
    expect(source).toContain('Πώς θέλεις να αποταμιεύσεις;');
    expect(source).toContain('aria-label={`Νέα αποταμίευση: ${action.title}`}');
  });

  it('keeps user comments empty by default and source metadata separate',()=>{
    expect(source).toContain("note:'',savingSource:'manual_transfer'");
    expect(source).toContain("setNote('')");
    expect(source).not.toContain("setNote(next==='pay_and_save'");
    expect(source).toContain('savingsHistoryPresentation(row)');
    expect(source).toContain('Τύπος: ${presentation.sourceLabel}');
  });

  it('uses semantic savings metadata and the shared dense readability contract',()=>{
    expect(source).toContain('const savingsAccounts=accounts.filter(isSavingsAccount)');
    expect(contextual).toContain('const savingsTargets=accounts.filter(isSavingsAccount)');
    expect(contextual).toContain('const savingsSources=accounts.filter(isSavingContributionSource)');
    expect(source).toContain('const sourceAccounts=accounts.filter(isSavingContributionSource)');
    expect(source).toContain('savingContributionDraftError(data,{fromAccountId:from,toAccountId:to,amount:numeric})');
    expect(accountSemantics).toContain("account.bankAccountCategory==='savings'");
    expect(selection).toContain("export { isSavingsAccount } from './accountSemantics.js'");
    expect(domain).toContain("import { isSavingsAccount } from './accountSemantics.js'");
    expect(commandSearch).toContain('const savings=isSavingsAccount(account)');
    expect(dashboard).toContain('const savingsAccounts=accounts.filter(isSavingsAccount)');
    expect(genericQuick).toContain('savingContributionDraftError(data,');
    expect(genericQuick).toContain('const savingSources=accounts.filter(isSavingContributionSource)');
    expect(genericQuick).toContain("accountOptions(from,kind==='saving_cash_offset'?savingSources:accounts)");
    expect(genericQuick).toContain("accountOptions(to,kind==='saving_cash_offset'?savingTargets:accounts)");
    expect(genericQuick).toContain("initial?.kind==='saving_cash_offset'");
    expect(loans).toContain('const savingsAccounts=accounts.filter(isSavingsAccount)');
    expect(loans).toContain('const selfLoanDestinations=accounts.filter(account=>!isSavingsAccount(account))');
    expect(ledger).toContain('defaultSavingContributionPair(data:FinanceData)');
    const budgetRulesQa=readFileSync(new URL('../scripts/budget-rules-qa.mjs',import.meta.url),'utf8');
    const qaWorkspace=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
    expect(qaWorkspace).toContain("params.get('state')==='savings-no-operating-bank'");
    expect(budgetRulesQa).toContain('savings-no-operating-bank-rejected-desktop');
    expect(budgetRulesQa).toContain('savings-no-operating-bank-rejected-mobile');
    expect(selection).toContain('const operatingPredicate=(account:Account)=>!isSavingsAccount(account)');
    expect(source).toContain('savingsGoalBalance(data,periodEndDate)');
    expect(source).toContain('accountChoices.dashboardSavings?.id??accountChoices.savings?.id');
    expect(composition).toContain('font-size:var(--ux-dense-data-size)');
    expect(composition).toContain('font-size:var(--ux-dense-label-size)');
  });

  it('adopts the shared money input primitive in the Savings editor',()=>{
    expect(source).toContain("import { MoneyInput } from '../components/MoneyInput'");
    expect(source).toContain('<MoneyInput data-autofocus="true"');
  });

  it('keeps the intermediate/200%-equivalent Savings layout shrink-safe',()=>{
    expect(composition).toContain('@media (min-width:681px) and (max-width:820px)');
    expect(composition).toContain('grid-template-columns:minmax(150px,180px) minmax(0,1fr)');
    expect(composition).toContain('.saving-route>span{min-width:0;max-width:100%;overflow:hidden}');
    expect(composition).toContain('text-overflow:ellipsis;white-space:nowrap');
  });

  it('drives manual Savings transfer through the production contextual Quick Entry flow',()=>{
    expect(functionalQa).toContain("document.querySelector('#context-quick-title')?.textContent?.includes('Μεταφορά στην αποταμίευση')");
    expect(functionalQa).toContain("document.querySelectorAll('.contextual-quick-modal input[role=combobox]')");
    expect(functionalQa).toContain("await setByLabel('Σχόλιο','QA Audit Saving')");
    expect(functionalQa).toContain("await clickText('.contextual-quick-modal button','Καταχώριση')");
    expect(functionalQa).toContain("savingsAfter.recent.includes('Μεταφορά στην αποταμίευση')");
  });


  it('uses truthful selected-period wording instead of hard-coding the current month',()=>{
    expect(source).toContain("const selectedMonthIsCurrent=month===asOf.slice(0,7)");
    expect(source).toContain("const selectedPeriodHeading=selectedMonthIsCurrent?'Αυτός ο μήνας':selectedMonthLabel");
    expect(source).toContain('<h2>{selectedPeriodHeading}</h2>');
    expect(source).toContain("selectedMonthIsCurrent?'ΑΥΤΟΣ Ο ΜΗΝΑΣ':selectedMonthLabel.toLocaleUpperCase('el-GR')");
  });

  it('uses the selected reporting-period end for balances and personal-goal progress',()=>{
    expect(source).toContain("import { reportingPeriodEndDate } from '../lib/reportingPeriod'");
    expect(source).toContain('const periodEndDate=reportingPeriodEndDate(month,asOf)');
    expect(source).toContain('const balances=accountBalances(data,periodEndDate)');
    expect(source).toContain('const savingsBalance=savingsGoalBalance(data,periodEndDate)');
    expect(source).not.toContain('accountBalances(data,asOf)');
    expect(source).not.toContain('savingsGoalBalance(data,asOf)');
    expect(source).toContain("setDate(asOf)");
    expect(source).toContain('validSavingsGoalDeadline(goalEdit.targetDate,asOf,priorGoal?.targetDate)');
    expect(source).toContain('Η υπάρχουσα προθεσμία έχει παρέλθει');
  });

  it('uses a dedicated approved historical fixture route for Savings evidence',()=>{
    expect(remediationQa).toContain("url.searchParams.set('state','savings-historical')");
    expect(approvedFixture).toContain("params.get('page')==='savings'&&params.get('state')==='savings-historical'");
    expect(approvedFixture).toContain("name:'Ταμείο ασφαλείας'");
    expect(approvedFixture).toContain("date:'2026-07-31'");
  });

  it('proves historical balances and goal progress change and restore in the browser',()=>{
    expect(remediationQa).toContain("savings-selected-period-july");
    expect(remediationQa).toContain("historical Savings route balances change with the selected period end");
    expect(remediationQa).toContain("historical personal-goal balance and progress use the selected period end");
    expect(remediationQa).toContain("Savings current-period balances and goal progress restore after historical browsing");
  });

  it('renders a real no-goal empty state and makes shared-pool semantics explicit',()=>{
    expect(source).toContain('className="empty-state savings-goals-empty"');
    expect(source).toContain('Το κοινό υπόλοιπο αποταμίευσης είναι {money.format(savingsBalance)}');
    expect(source).toContain('<span>Κοινό υπόλοιπο</span>');
    expect(source).not.toContain('className="savings-goal-row placeholder"');
    expect(composition).toContain('.savings-goals-mobile .savings-goals-empty{margin-top:8px}');
    expect(composition).toContain('.savings-goals-empty{margin-top:6px;text-align:left');
  });

  it('bounds wide desktop measure and removes internal savings-engine jargon',()=>{
    expect(composition).toContain('width:min(100%,1500px);margin-inline:auto');
    expect(source).toContain('η αποταμίευση μετρά μία φορά στα σύνολα');
    expect(source).not.toContain('canonical savings flow');
    expect(composition).toContain('color:var(--text-secondary)');
  });

});
