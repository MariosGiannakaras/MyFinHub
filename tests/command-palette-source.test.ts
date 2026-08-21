import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const palette=readFileSync(new URL('../src/components/CommandPalette.tsx',import.meta.url),'utf8');
const search=readFileSync(new URL('../src/lib/commandSearch.ts',import.meta.url),'utf8');

describe('unified command palette source contracts',()=>{
  it('keeps Quick Add and unified search as distinct entry points',()=>{
    expect(shell).toContain('onQuickAdd:()=>void;onCommand:()=>void');
    expect(shell).toContain('className="primary-action" onClick={onQuickAdd}');
    expect(shell).toContain('className="command-search-action" onClick={onCommand}');
    expect(shell).toContain('aria-label="Αναζήτηση και εντολές" onClick={onCommand}');
    expect(app).toContain('onQuickAdd={() => openGeneric(\'expense\')} onCommand={openCommand}');
  });

  it('uses global shortcut interception before modal-state guards',()=>{
    const start=app.indexOf('const onKey = (event: KeyboardEvent) =>');
    const end=app.indexOf("addEventListener('keydown', onKey)",start);
    const block=app.slice(start,end);
    expect(block).toContain('event.preventDefault();');
    expect(block).toContain('if (quickOpen || commandOpen) return;');
    expect(block).toContain('setCommandOpen(true);');
    expect(block.indexOf('event.preventDefault();')).toBeLessThan(block.indexOf('if (quickOpen || commandOpen) return;'));
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