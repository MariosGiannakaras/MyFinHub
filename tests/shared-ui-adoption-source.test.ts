import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const lending=read('src/pages/LendingPage.tsx');
const recurring=read('src/pages/RecurringPage.tsx');
const loans=read('src/pages/LoansPage.tsx');
const budgetRules=read('src/components/BudgetRuleSettings.tsx');
const confirmDialog=read('src/components/ConfirmDialog.tsx');
const moneyEditDialog=read('src/components/MoneyEditDialog.tsx');
const cardCreateDialog=read('src/components/CardCreateDialog.tsx');
const modalFocus=read('src/hooks/useModalFocus.ts');
const hardening=read('src/styles/part30.css');
const sharedControls=read('src/styles/part57.css');
const baseStyles=read('src/styles/part1.css');
const rendered=read('scripts/ui-ux-hardening-qa.mjs');

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

  it('uses the shared AppTextInput for Lending editable text fields without flattening the dedicated search shell',()=>{
    expect(lending).toContain("from '../components/AppTextInput'");
    expect(lending).toContain('<AppTextInput data-autofocus="true" value={person}');
    expect(lending).toContain('<AppTextInput value={note}');
    expect(lending).toContain('className="lending-people-search"');
  });

  it('keeps non-money numeric controls semantically separate while adopting the shared visual primitive',()=>{
    expect(recurring).toMatch(/Συνηθισμένη ημέρα μήνα<\/span><AppTextInput type=\"number\"/);
    expect(recurring).toMatch(/<span>Κάθε<\/span><AppTextInput type=\"number\"/);
    expect(loans).toMatch(/Αριθμός δόσεων<\/span><AppTextInput type=\"number\"/);
    expect(budgetRules).toContain('Προειδοποίηση %');
    expect(budgetRules).toContain('<AppTextInput inputMode="decimal" value={budgetAlert}');
    expect(budgetRules).toContain('priority:editingRule?.priority??nextPriority');
    expect(budgetRules).not.toContain('<span>Προτεραιότητα</span>');
  });

  it('keeps current dialogs on the shared modal-focus behavior contract',()=>{
    for(const source of [confirmDialog,moneyEditDialog,cardCreateDialog]){
      expect(source).toContain('useModalFocus');
      expect(source).toContain('aria-modal="true"');
    }
    expect(modalFocus).toContain("shortcutMatches(event, 'dismiss')");
    expect(modalFocus).toContain("event.key !== 'Tab'");
    expect(modalFocus).toContain("document.querySelectorAll<HTMLElement>('[aria-modal=\"true\"]')");
    expect(modalFocus).toContain('opener.current?.focus');
    expect(modalFocus).toContain(".form-error[role=\"alert\"]");
  });

  it('keeps keyboard focus and pointer affordances visible without relying on hover alone',()=>{
    expect(sharedControls).toContain(':where(button,input,select,textarea,summary,[tabindex]):focus-visible{outline:0;box-shadow:var(--focus)!important}');
    expect(hardening).not.toContain('button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible');
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