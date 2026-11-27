import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const lending=read('src/pages/LendingPage.tsx');
const recurring=read('src/pages/RecurringPage.tsx');
const loans=read('src/pages/LoansPage.tsx');
const budgetRules=read('src/components/BudgetRuleSettings.tsx');
const rulesWorkspace=read('src/components/TransactionRulesWorkspace.tsx');
const button=read('src/components/Button.tsx');
const iconButton=read('src/components/IconButton.tsx');
const dialogShell=read('src/components/DialogShell.tsx');
const confirmDialog=read('src/components/ConfirmDialog.tsx');
const moneyEditDialog=read('src/components/MoneyEditDialog.tsx');
const cardCreateDialog=read('src/components/CardCreateDialog.tsx');
const desktopUpdatePanel=read('src/components/DesktopUpdatePanel.tsx');
const pageErrorBoundary=read('src/components/PageErrorBoundary.tsx');
const persistenceNotice=read('src/components/PersistenceNotice.tsx');
const appDateInput=read('src/components/AppDateInput.tsx');
const appSelectInput=read('src/components/AppSelectInput.tsx');
const commandPalette=read('src/components/CommandPalette.tsx');
const modalFocus=read('src/hooks/useModalFocus.ts');
const hardening=read('src/styles/ui-hardening-foundations.css');
const sharedControls=read('src/styles/app-controls.css');
const baseStyles=read('src/styles/shell-navigation-foundations.css');
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
    expect(budgetRules).toContain('<AppTextInput disabled={busy} inputMode="decimal" value={budgetAlert}');
    expect(budgetRules).toContain('await onUpsertBudget(next)');
    expect(rulesWorkspace).toContain('priority:editingRule?.priority??nextPriority');
    expect(budgetRules).not.toContain('nextPriority');
    expect(budgetRules).not.toContain('<span>Προτεραιότητα</span>');
  });

  it('defines typed Button and IconButton primitives without changing the approved class hooks',()=>{
    expect(button).toContain("type ButtonVariant='primary'|'secondary'|'danger'|'ghost'");
    expect(button).not.toContain('export type ButtonVariant');
    expect(button).toContain("primary:'save-button'");
    expect(button).toContain("secondary:'secondary'");
    expect(button).toContain("danger:'save-button destructive-action'");
    expect(button).toContain("type='button'");
    expect(iconButton).toContain("Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>");
    expect(iconButton).toContain("'aria-label':string");
    expect(iconButton).toContain("type IconButtonVariant='default'|'accent'|'quiet'");
    expect(iconButton).toContain("mergeClasses('icon-button',variantClass[variant],className)");
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
    for(const source of [desktopUpdatePanel,pageErrorBoundary,persistenceNotice]){
      expect(source).toContain("from './Button'");
      expect(source).not.toContain('<button');
      expect(source).toContain('type="button"');
    }
    expect(desktopUpdatePanel).toContain('<Button variant="primary"');
    expect(desktopUpdatePanel).toContain('<Button variant="secondary"');
    expect(pageErrorBoundary.match(/<Button/g)).toHaveLength(3);
    expect(persistenceNotice).toContain('<Button variant="secondary"');
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
    expect(lending.match(/<Button/g)).toHaveLength(15);
    expect(lending.match(/action:'writeoff'/g)).toHaveLength(2);
    expect(lending).toContain('onSaveLendingPlan?:(draft:LendingSettlementDraft)=>Promise<void>');
    expect(lending.match(/<IconButton/g)).toHaveLength(1);
    expect(lending.match(/<button/g)).toHaveLength(2);
    expect(lending.match(/<Button[^>]+variant="primary"/g)).toHaveLength(3);
    expect(lending.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(8);
    expect(lending.match(/<Button[^>]+variant="ghost"/g)).toHaveLength(4);
    expect(lending).toContain('<IconButton type="button" aria-label="Κλείσιμο κίνησης δανεικών"');
    expect(lending).not.toContain('className="save-button"');
    expect(lending).not.toContain('className="secondary privacy-toggle"');
    expect(lending).not.toContain('className="icon-button"');
    expect(lending).not.toContain('className="text-button"');
    expect(lending).toContain('<button type="button" key={row.person} className={`lending-person-row');
    expect(lending).toContain('<Button type="button" variant="secondary" className="lending-quick-action repayment"');
    expect(lending).toContain('<Button type="button" variant="secondary" className="lending-quick-action lending"');
    expect(lending).toContain('className="mobile-lending-history-more"');
    expect(lending).toContain('<button type="button" role="option"');
  });

  it('adopts shared action primitives for Recurring generic actions while preserving row and menu composites',()=>{
    expect(recurring).toContain("from '../components/Button'");
    expect(recurring).toContain("from '../components/IconButton'");
    expect(recurring.match(/<Button/g)).toHaveLength(10);
    expect(recurring.match(/<IconButton/g)).toHaveLength(6);
    expect(recurring.match(/<Button[^>]+variant="primary"/g)).toHaveLength(4);
    expect(recurring.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(5);
    expect(recurring).toContain('<Button type="button" variant="primary" onClick={startNew}');
    expect(recurring).toContain('variant="primary" className="mobile-pay-action"');
    expect(recurring).toContain('<IconButton type="button" aria-label="Κλείσιμο επεξεργασίας παγίου"');
    expect(recurring).not.toContain('className="save-button"');
    expect(recurring).not.toContain('className="secondary"');
    expect(recurring).not.toContain('className="icon-button"');
    expect(recurring).toContain('<Button type="button" variant="primary" className="pay-action"');
    expect(recurring).toContain('className="mobile-recurring-more"');
    expect(recurring).toContain('<details className="mobile-action-menu">');
    expect(recurring.match(/<button/g)).toHaveLength(3);
    expect(recurring).toContain('<IconButton type="button" aria-label={`Παύση ${item.name}`}');
    expect(recurring).toContain('<IconButton type="button" aria-label={`Ενεργοποίηση ${item.name}`}');
    expect(recurring).toContain('<IconButton type="button" aria-label={`Επεξεργασία ${item.name}`}');
  });

  it('adopts shared action primitives for Loans page and row controls',()=>{
    expect(loans).toContain("from '../components/Button'");
    expect(loans).toContain("from '../components/IconButton'");
    expect(loans.match(/<Button/g)).toHaveLength(9);
    expect(loans.match(/<IconButton/g)).toHaveLength(1);
    expect(loans.match(/<button/g)??[]).toHaveLength(0);
    expect(loans.match(/<Button[^>]+variant="primary"/g)).toHaveLength(3);
    expect(loans.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(6);
    expect(loans).toContain('<Button type="button" variant="secondary" onClick={()=>startNew(\'self-loan\')}');
    expect(loans).toContain('<Button type="button" variant="primary" onClick={()=>startNew(\'installment\')}');
    expect(loans).toContain('<IconButton type="button" aria-label="Κλείσιμο επεξεργασίας δόσεων"');
    expect(loans).not.toContain('className="save-button"');
    expect(loans).not.toContain('className="secondary"');
    expect(loans).not.toContain('className="icon-button"');
    expect(loans).toContain('<Button type="button" variant="secondary" onClick={()=>startEdit(loan)}');
    expect(loans).toContain('<Button type="button" variant="primary" className="pay"');
    expect(loans).toContain('<Button type="button" variant="secondary" className="forgive"');
    expect(loans.match(/className="loan-list-more"/g)).toHaveLength(2);
  });

  it('keeps current dialogs on the shared modal-focus behavior contract',()=>{
    for(const source of [confirmDialog,moneyEditDialog]){
      expect(source).toContain("from './DialogShell'");
      expect(source).not.toContain('useModalFocus');
      expect(source).not.toContain('aria-modal="true"');
    }
    expect(dialogShell).toContain('useModalFocus');
    expect(dialogShell).toContain('aria-modal="true"');
    expect(cardCreateDialog).toContain('useModalFocus');
    expect(cardCreateDialog).toContain('aria-modal="true"');
    expect(modalFocus).toContain("shortcutMatches(event, 'dismiss')");
    expect(modalFocus).toContain("event.key !== 'Tab'");
    expect(modalFocus).toContain('element.tabIndex>=0');
    expect(modalFocus).toContain('const currentIndex=current?items.indexOf(current):-1');
    expect(modalFocus).toContain("document.querySelectorAll<HTMLElement>('[aria-modal=\"true\"]')");
    expect(modalFocus).toContain('if(opener.current?.isConnected)opener.current.focus');
    expect(modalFocus).toContain('const hasDestination=focused instanceof HTMLElement');
    expect(modalFocus).toContain('requestAnimationFrame(()=>{');
    expect(modalFocus).toContain(".form-error[role=\"alert\"]");
  });

  it('keeps keyboard focus and pointer affordances visible without relying on hover alone',()=>{
    expect(sharedControls).toContain(':where(button,a[href],input,select,textarea,summary,[tabindex]):focus-visible{outline:0;box-shadow:var(--focus)!important}');
    expect(hardening).not.toContain('button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible');
    expect(hardening).toContain('.app-tooltip:hover .app-tooltip-bubble,.app-tooltip:focus-within .app-tooltip-bubble');
    expect(baseStyles).toContain('cursor:pointer');
    const tooltip=read('src/lib/tooltipPlacement.ts');
    expect(tooltip).toContain('const candidates=[side,opposite[side]');
    expect(tooltip).toContain("window.addEventListener('scroll',place,true)");
    expect(tooltip).toContain('observer.disconnect()');
    expect(tooltip).toContain('bubble.dataset.placedSide=chosen');
    expect(tooltip).toContain("bubble.style.removeProperty('max-width')");
    expect(hardening).toContain('.app-tooltip[data-tooltip-dismissed] .app-tooltip-bubble{display:none}');
    expect(hardening).toContain('.app-tooltip-bubble[data-positioned]::before');
    for(const side of ['top','bottom','left','right'])expect(hardening).toContain('data-placed-side="'+side+'"');
    const owner=read('src/components/Tooltip.tsx');
    expect(tooltip).toContain("if(event.key!=='Escape')return;");
    expect(tooltip).toContain("node.dataset.tooltipDismissed='true'");
    expect(tooltip).toContain('if(node.dataset.tooltipDismissed||!bubble.getClientRects().length)return;');
    expect(tooltip).toContain("const activate=()=>{delete node.dataset.tooltipDismissed;place()}");
    for(const event of ['mouseenter','focusin']){
      expect(tooltip).toContain("node.addEventListener('"+event+"',activate)");
      expect(tooltip).toContain("node.removeEventListener('"+event+"',activate)");
    }
    expect(tooltip).toContain("window.addEventListener('keydown',dismiss,true)");
    expect(tooltip).toContain("window.removeEventListener('keydown',dismiss,true)");
    expect(tooltip).toContain("bubble.removeEventListener('click',stopClick)");
    expect(tooltip).not.toContain('preventDefault');
    expect(owner).not.toContain('tooltipDismissed');
    expect(owner).not.toContain('setDismissed');
    expect(owner).toContain("import('../lib/tooltipPlacement')");
    expect(read('src/styles/reporting-period-controls.css')).not.toContain('.period-control span');
    expect(read('src/styles/mobile-more-navigation.css')).toContain('max-height:calc(100dvh');
    expect(read('scripts/keyboard-semantic-accessibility-qa.mjs')).toContain('last More destination scrolls into visible sheet');
    const keyboard=read('scripts/keyboard-semantic-accessibility-qa.mjs');
    expect(keyboard).toContain("['.period-control button','period']");
    expect(keyboard).toContain("['.top-actions .app-tooltip button','topbar']");
    expect(keyboard).toContain("name+' tooltip contained and clear of trigger '+width");
    expect(keyboard).toContain("r.width>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&contained");
    expect(keyboard).toContain("r.bottom<=a.top+1||r.top>=a.bottom-1||r.right<=a.left+1||r.left>=a.right-1");
    expect(keyboard).toContain("Tooltip geometry failure");
    expect(read('src/styles/mobile-app-shell.css')).toContain('.mobile-more-menu>header small{font-size:var(--ux-small-size)');
    expect(read('src/styles/mobile-more-menu-layout.css')).toContain('@media(max-width:390px){.mobile-more-menu>nav{grid-template-columns:1fr}}');
    expect(read('src/styles/mobile-more-menu-layout.css')).toContain('html[data-text-size="large"] .mobile-more-menu>nav{grid-template-columns:1fr}');
    expect(keyboard).toContain('readable More complete destination rows');
    expect(keyboard).toContain('readable More last destination visible');
    expect(keyboard).toContain('readable More Escape restores opener');
    expect(keyboard).toContain('tooltip Escape dismisses without moving keyboard focus');
    expect(keyboard).toContain('tooltip reopens on new keyboard focus');
    expect(rendered).toContain('hover tooltip remains open through anchor gap');
    expect(rendered).toContain('hover tooltip text remains reachable without focus');
    expect(rendered).toContain('hover tooltip Escape dismisses');
  });

  it('retains rendered accessibility checks for names, touch targets, focus and tooltip semantics',()=>{
    expect(rendered).toContain('noUnnamedControls');
    expect(rendered).toContain('noUndisclosedIconActions');
    expect(rendered).toContain('touchTargets');
    expect(rendered).toContain('keyboard tooltip semantics and focus');
    expect(rendered).toContain('touch layout suppresses sticky tooltip bubbles while retaining accessible names');
  });
});
