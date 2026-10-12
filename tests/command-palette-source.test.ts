import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const palette=readFileSync(new URL('../src/components/CommandPalette.tsx',import.meta.url),'utf8');
const shortcuts=readFileSync(new URL('../src/lib/shortcuts.ts',import.meta.url),'utf8');
const shortcutHook=readFileSync(new URL('../src/hooks/useAppShortcuts.ts',import.meta.url),'utf8');
const search=readFileSync(new URL('../src/lib/commandSearch.ts',import.meta.url),'utf8');
const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');

describe('unified command palette source contracts',()=>{
  it('keeps Quick Add and unified search as distinct entry points',()=>{
    expect(shell).toContain('onQuickAdd:()=>void;onCommand:()=>void');
    expect(shell).toContain('data-global-quick-entry="desktop"');
    expect(shell).not.toContain('primary-action');
    expect(shell).toContain('onClick={onQuickAdd}');
    expect(shell).not.toContain('className="command-search-action"');
    expect(shell).toContain('className="topbar-primary"');
    expect(shell).toContain('onClick={onCommand}');
    expect(shell).toContain('aria-label="Αναζήτηση και εντολές"');
    expect(app).toContain('onQuickAdd={() => openGeneric(\'expense\')} onCommand={openCommand}');
    expect(app).toContain('data={data} asOf={today} motionMode="full"');
    expect(palette).toContain('searchCommandItems(data,query,{recentIds,limit:14,asOf})');
  });

  it('single-sources global app shortcuts and makes them modal/input aware',()=>{
    expect(shell).toContain('useAppShortcuts({onCommand,onQuickEntry:onQuickAdd,onUndo,onRedo,canUndo,canRedo})');
    expect(shortcutHook).toContain('appShortcutFromEvent(event)');
    expect(shortcutHook).toContain('isEditableShortcutTarget(event.target)');
    expect(shortcutHook).toContain('modalOpen: hasVisibleModal()');
    expect(shortcutHook).toContain('event.stopImmediatePropagation()');
    expect(shortcuts).toContain("commandPalette: { label: 'Αναζήτηση / Command Palette'");
    expect(shortcuts).toContain("quickEntry: { label: 'Γρήγορη καταχώριση'");
    expect(shortcuts).toContain("undo: { label: 'Αναίρεση'");
    expect(shortcuts).toContain("redo: { label: 'Επαναφορά'");
    expect(shortcuts).toContain("dismiss: { label: 'Κλείσιμο παραθύρου / overlay'");
  });

  it('mounts a named credit-card route on the exact requested active card without an initial wrong-card frame',()=>{
    const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
    expect(credit).toContain('const [selectedCardId,setSelectedCardId]=useState(()=>{');
    expect(credit).toContain('commandCardId&&activeCredit.some(item=>item.id===commandCardId)');
    expect(credit).toContain('?commandCardId');
    expect(credit).toContain('setSelectedCardId(commandCardId)');
    expect(qa).toContain("if(action.type==='credit_card_focus')");
    expect(app).toContain("if(action.type==='credit_card_focus')");
  });
  it('keeps keyboard focus on an accessible combobox with listbox active-descendant semantics',()=>{
    expect(palette).toContain('role="combobox"');
    expect(palette).toContain('aria-controls="command-results"');
    expect(palette).toContain('aria-activedescendant={activeId}');
    expect(palette).toContain('role="listbox"');
    expect(palette).toContain('role="option"');
    expect(palette).toContain("event.key==='ArrowDown'");
    expect(palette).toContain("event.key==='ArrowUp'");
    expect(palette).toContain("event.key==='Enter'");
  });

  it('distinguishes exact named navigation from overlapping payment and completion commands',()=>{
    const rendered=readFileSync(new URL('../scripts/command-palette-qa.mjs',import.meta.url),'utf8');
    expect(rendered).toContain('const activateExactTitle=async title=>');
    expect(rendered).toContain("querySelector('.command-result-copy b')");
    expect(rendered).toContain("await activateExactTitle('QA Credit 3')");
    expect(rendered).toContain("'credit command palette exit completes'");
    expect(rendered).toContain("!document.querySelector('.card-details-dialog')");
    expect(rendered).toContain("!document.querySelector('.contextual-quick-modal')");
    expect(rendered).toContain("await activateExactTitle('QA Visa')");
    expect(rendered).toContain("await activateOption('Ολοκλήρωση · Ετήσια ασφάλεια')");
    expect(rendered).toContain("await activateExactTitle('Προγραμματισμένη κίνηση 18')");
    expect(rendered).toContain('visible-state');
  });
  it('stores only recent result ids and excludes sensitive card fields from indexed copy',()=>{
    expect(palette).toContain("sessionStorage.setItem(RECENTS_KEY,JSON.stringify(ids.slice(0,8)))");
    expect(search).toContain('allCards(data).filter(card=>card.active!==false)');
    expect(search).not.toContain('holderName');
    expect(search).not.toContain('vaultRef');
    expect(search).not.toContain('last4');
    expect(search).not.toContain('creditLimit');
    expect(search).toContain('const savings=isSavingsAccount(account)');
    expect(app).toContain('if(account&&isSavingsAccount(account)){');
    expect(qa).toContain('if(account&&isSavingsAccount(account)){');
  });
});
