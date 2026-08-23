import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/pages/SavingsPage.tsx',import.meta.url),'utf8');

describe('Savings page action hierarchy',()=>{
  it('renders the actionable savings choices before monthly reporting',()=>{
    const actions=source.indexOf('className="savings-action-section"');
    const hero=source.indexOf('className="savings-hero neo-raised"');
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

  it('adopts the shared money input primitive in the Savings editor',()=>{
    expect(source).toContain("import { MoneyInput } from '../components/MoneyInput'");
    expect(source).toContain('<MoneyInput data-autofocus="true"');
  });
});
