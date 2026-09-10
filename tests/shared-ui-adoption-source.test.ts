import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const lending=read('src/pages/LendingPage.tsx');
const recurring=read('src/pages/RecurringPage.tsx');
const loans=read('src/pages/LoansPage.tsx');
const budgetRules=read('src/components/BudgetRuleSettings.tsx');
const button=read('src/components/Button.tsx');
const iconButton=read('src/components/IconButton.tsx');
const confirmDialog=read('src/components/ConfirmDialog.tsx');
const moneyEditDialog=read('src/components/MoneyEditDialog.tsx');
const cardCreateDialog=read('src/components/CardCreateDialog.tsx');
const desktopUpdatePanel=read('src/components/DesktopUpdatePanel.tsx');
const pageErrorBoundary=read('src/components/PageErrorBoundary.tsx');
const persistenceNotice=read('src/components/PersistenceNotice.tsx');
const accountMetadataSettings=read('src/components/AccountMetadataSettings.tsx');
const appDateInput=read('src/components/AppDateInput.tsx');
const appSelectInput=read('src/components/AppSelectInput.tsx');
const commandPalette=read('src/components/CommandPalette.tsx');
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

  it('defines typed Button and IconButton primitives without changing the approved class hooks',()=>{
    expect(button).toContain("export type ButtonVariant='primary'|'secondary'|'danger'|'ghost'");
    expect(button).toContain("primary:'save-button'");
    expect(button).toContain("secondary:'secondary'");
    expect(button).toContain("danger:'save-button destructive-action'");
    expect(button).toContain("type='button'");
    expect(iconButton).toContain("Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>");
    expect(iconButton).toContain("'aria-label':string");
    expect(iconButton).toContain("mergeClasses('icon-button',className)");
    expect(iconButton).toContain("type='button'");
  });

  it('adopts shared action primitives in representative dialogs while preserving intentional domain buttons',()=>{
    for(const source of [confirmDialog,moneyEditDialog,cardCreateDialog]){
      expect(source).toContain('Button');
      expect(source).toContain('IconButton');
    }
    expect(confirmDialog).not.toContain('<button');
    expect(moneyEditDialog).not.toContain('<button');
    expect(confirmDialog).toContain("variant={tone==='destructive'?'danger':'primary'}");
    expect(cardCreateDialog).toContain('<IconButton className="close-picker" aria-label="Κλείσιμο"');
    expect(cardCreateDialog).toContain('<Button variant="secondary" className="modal-secondary"');
    expect(cardCreateDialog).toContain('<Button variant="primary" className="modal-primary"');
    expect(cardCreateDialog).toContain('<button key={item.id} type="button" className="design-option" role="radio"');
  });

  it('adopts shared Button in the next bounded safe-action batch without changing native button semantics',()=>{
    for(const source of [desktopUpdatePanel,pageErrorBoundary,persistenceNotice,accountMetadataSettings]){
      expect(source).toContain("from './Button'");
      expect(source).not.toContain('<button');
      expect(source).toContain('type="button"');
    }
    expect(desktopUpdatePanel).toContain('<Button variant="primary"');
    expect(desktopUpdatePanel).toContain('<Button variant="secondary"');
    expect(pageErrorBoundary.match(/<Button/g)).toHaveLength(3);
    expect(persistenceNotice).toContain('<Button variant="secondary"');
    expect(accountMetadataSettings).toContain('<Button variant="secondary"');
    expect(accountMetadataSettings).toContain('<Button variant="primary"');
  });

  it('adopts shared IconButton in app-owned popovers and command overlay while preserving composite option buttons',()=>{
    for(const source of [appDateInput,appSelectInput,commandPalette]){
      expect(source).toContain("from './IconButton'");
      expect(source).not.toContain('className="icon-button"');
    }
    expect(appDateInput.match(/<IconButton/g)).toHaveLength(3);
    expect(appDateInput).toContain('<IconButton type="button" aria-label="Προηγούμενος μήνας"');
    expect(appDateInput).toContain('<button type="button" role="gridcell"');
    expect(appSelectInput.match(/<IconButton/g)).toHaveLength(1);
    expect(appSelectInput).toContain('<IconButton type="button" aria-label="Κλείσιμο επιλογών"');
    expect(appSelectInput).toContain('<button id={`${listboxId}-option-${index}`} type="button" role="option"');
    expect(commandPalette.match(/<IconButton/g)).toHaveLength(1);
    expect(commandPalette).toContain('<IconButton type="button" aria-label="Κλείσιμο αναζήτησης"');
    expect(commandPalette).toContain('return <button id={optionId} role="option"');
  });

  it('adopts shared action primitives for Lending generic actions while preserving domain and composite controls',()=>{
    expect(lending).toContain("from '../components/Button'");
    expect(lending).toContain("from '../components/IconButton'");
    expect(lending.match(/<Button/g)).toHaveLength(8);
    expect(lending.match(/<IconButton/g)).toHaveLength(1);
    expect(lending.match(/<button/g)).toHaveLength(4);
    expect(lending.match(/<Button variant="primary"/g)).toHaveLength(3);
    expect(lending.match(/<Button variant="secondary"/g)).toHaveLength(3);
    expect(lending.match(/<Button variant="ghost"/g)).toHaveLength(2);
    expect(lending).toContain('<IconButton type="button" aria-label="Κλείσιμο κίνησης δανεικών"');
    expect(lending).not.toContain('className="save-button"');
    expect(lending).not.toContain('className="secondary privacy-toggle"');
    expect(lending).not.toContain('className="icon-button"');
    expect(lending).not.toContain('className="text-button"');
    expect(lending).toContain('<button type="button" key={row.person} className={`lending-person-row');
    expect(lending).toContain('className="lending-quick-action repayment"');
    expect(lending).toContain('className="lending-quick-action lending"');
    expect(lending).toContain('<button type="button" role="option"');
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
