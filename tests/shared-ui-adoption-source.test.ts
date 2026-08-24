import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const lending=read('src/pages/LendingPage.tsx');
const recurring=read('src/pages/RecurringPage.tsx');
const loans=read('src/pages/LoansPage.tsx');
const budgetRules=read('src/components/BudgetRuleSettings.tsx');
const hardening=read('src/styles/part30.css');
const baseStyles=read('src/styles/part1.css');
const rendered=read('scripts/frontend-qa.mjs');

describe('shared finance UI adoption contracts',()=>{
  it('uses the shared MoneyInput in the remaining core editable amount flows',()=>{
    expect(lending).toContain("from '../components/MoneyInput'");
    expect(recurring).toContain("from '../components/MoneyInput'");
    expect(loans).toContain("from '../components/MoneyInput'");
    expect(budgetRules).toContain("from './MoneyInput'");
    for(const source of [lending,recurring,loans,budgetRules])expect(source).toContain('<MoneyInput');
    expect(lending).not.toMatch(/<input[^>]+inputMode=\"decimal\"[^>]+value=\{amount\}/);
    expect(recurring).not.toMatch(/<input[^>]+type=\"number\"[^>]+value=\{edit\.amount/);
    expect(loans).not.toContain("value={edit.total||''}");
    expect(loans).not.toContain("value={edit.installment||''}");
    expect(budgetRules).not.toMatch(/<input[^>]+inputMode=\"decimal\"[^>]+value=\{budgetAmount\}/);
  });

  it('keeps non-money numeric controls separate from currency entry',()=>{
    expect(recurring).toMatch(/Συνηθισμένη ημέρα μήνα<\/span><input type=\"number\"/);
    expect(loans).toMatch(/Αριθμός δόσεων<\/span><input type=\"number\"/);
    expect(budgetRules).toContain('Προειδοποίηση %');
    expect(budgetRules).toContain('Προτεραιότητα');
  });

  it('keeps keyboard focus and pointer affordances visible without relying on hover alone',()=>{
    expect(hardening).toContain('button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,[tabindex]:focus-visible');
    expect(hardening).toContain('.app-tooltip:hover .app-tooltip-bubble,.app-tooltip:focus-within .app-tooltip-bubble');
    expect(baseStyles).toContain('cursor:pointer');
  });

  it('retains rendered accessibility checks for names, touch targets, focus and tooltip semantics',()=>{
    expect(rendered).toContain('noUnnamedControls');
    expect(rendered).toContain('noUndisclosedIconActions');
    expect(rendered).toContain('touchTargets');
    expect(rendered).toContain('keyboard tooltip semantics and focus');
    expect(rendered).toContain('touch layout suppresses sticky tooltip bubbles while retaining accessible names');
  });
});
