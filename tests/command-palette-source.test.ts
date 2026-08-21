import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const palette=readFileSync(new URL('../src/components/CommandPalette.tsx',import.meta.url),'utf8');
const shortcuts=readFileSync(new URL('../src/lib/shortcuts.ts',import.meta.url),'utf8');
const shortcutHook=readFileSync(new URL('../src/hooks/useAppShortcuts.ts',import.meta.url),'utf8');
const search=readFileSync(new URL('../src/lib/commandSearch.ts',import.meta.url),'utf8');

describe('unified command palette source contracts',()=>{
  it('keeps Quick Add and unified search as distinct entry points',()=>{
    expect(shell).toContain('onQuickAdd:()=>void;onCommand:()=>void');
    expect(shell).toContain('className="primary-action"');
    expect(shell).toContain('onClick={onQuickAdd}');
    expect(shell).toContain('className="command-search-action"');
    expect(shell).toContain('onClick={onCommand}');
    expect(shell).toContain('aria-label="Αναζήτηση και εντολές"');
    expect(app).toContain('onQuickAdd={() => openGeneric(\'expense\')} onCommand={openCommand}');
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

  it('stores only recent result ids and excludes sensitive card fields from indexed copy',()=>{
    expect(palette).toContain("sessionStorage.setItem(RECENTS_KEY,JSON.stringify(ids.slice(0,8)))");
    expect(search).toContain('allCards(data).filter(card=>card.active!==false)');
    expect(search).not.toContain('holderName');
    expect(search).not.toContain('vaultRef');
    expect(search).not.toContain('last4');
    expect(search).not.toContain('creditLimit');
  });
});
