import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/pages/SavingsPage.tsx',import.meta.url),'utf8');
const composition=readFileSync(new URL('../src/styles/savings-desktop-composition.css',import.meta.url),'utf8');
const functionalQa=readFileSync(new URL('../scripts/completion-functional-crud-qa.mjs',import.meta.url),'utf8');

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
    expect(source).toContain("account.kind==='savings'||(account.kind==='bank'&&account.bankAccountCategory==='savings')");
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

});
