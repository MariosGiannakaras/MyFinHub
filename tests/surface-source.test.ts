import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const surface=readFileSync(new URL('../src/components/Surface.tsx',import.meta.url),'utf8');
const shortcuts=readFileSync(new URL('../src/components/KeyboardShortcutsPanel.tsx',import.meta.url),'utf8');
const readability=readFileSync(new URL('../src/components/ReadabilitySettings.tsx',import.meta.url),'utf8');

describe('canonical Surface ownership',()=>{
  it('owns only the generic raised flat and inset compatibility classes',()=>{
    expect(surface).toContain("export type SurfaceVariant='raised'|'flat'|'inset'");
    expect(surface).toContain("export type SurfaceElement='div'|'section'|'article'|'aside'");
    expect(surface).toContain("as='div',variant='raised'");
    expect(surface).toContain('`neo-${variant}`');
    expect(surface).toContain('createElement(as,{...props,className:surfaceClassName})');
    expect(surface).not.toContain('panel');
  });

  it('moves the generic keyboard shortcuts panel to Surface without changing its section or ARIA contract',()=>{
    expect(shortcuts).toContain("from './Surface'");
    expect(shortcuts).toContain('<Surface as="section" className="panel keyboard-shortcuts-panel" aria-labelledby="keyboard-shortcuts-title">');
    expect(shortcuts).toContain('id="keyboard-shortcuts-title"');
    expect(shortcuts).toContain('role="list"');
    expect(shortcuts).not.toContain('neo-raised');
  });

  it('moves the generic appearance settings panel to Surface while retaining domain-neutral settings controls',()=>{
    expect(readability).toContain("from './Surface'");
    expect(readability).toContain('<Surface as="section" className="panel readability-settings settings-general-appearance" aria-labelledby="readability-title">');
    expect(readability).toContain('id="readability-title"');
    expect(readability).toContain('role="radiogroup" aria-label="Μέγεθος κειμένου"');
    expect(readability).toContain('role="radiogroup" aria-label="Θέμα εμφάνισης"');
    expect(readability).not.toContain('neo-raised');
  });
});
