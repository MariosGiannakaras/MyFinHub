import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const source=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const surface=source('src/components/Surface.tsx');
const shortcuts=source('src/components/KeyboardShortcutsPanel.tsx');
const readability=source('src/components/ReadabilitySettings.tsx');

describe('canonical Surface primitive',()=>{
  it('owns the three compatibility elevation variants without styling changes',()=>{
    expect(surface).toContain("export type SurfaceVariant='raised'|'flat'|'inset'");
    expect(surface).toContain("variant='raised'");
    expect(surface).toContain('`neo-${variant}`');
    expect(surface).not.toContain('<style');
  });

  it('preserves semantic element and native/ARIA props through the polymorphic host',()=>{
    expect(surface).toContain('as?:T');
    expect(surface).toContain('ComponentPropsWithoutRef<T>');
    expect(surface).toContain("const component=(as??'div') as ElementType");
    expect(surface).toContain('return createElement(component,{...props,className:surfaceClassName})');
  });

  it('moves the generic keyboard shortcuts panel shell to Surface',()=>{
    expect(shortcuts).toContain("import { Surface } from './Surface'");
    expect(shortcuts).toContain('<Surface as="section" variant="raised" className="panel keyboard-shortcuts-panel" aria-labelledby="keyboard-shortcuts-title">');
    expect(shortcuts).toContain('id="keyboard-shortcuts-title"');
    expect(shortcuts).toContain('role="list"');
    expect(shortcuts).not.toContain('neo-raised');
  });

  it('moves the generic readability settings shell while preserving radiogroup semantics',()=>{
    expect(readability).toContain("import { Surface } from './Surface'");
    expect(readability).toContain('<Surface as="section" variant="raised" className="panel readability-settings settings-general-appearance" aria-labelledby="readability-title">');
    expect(readability).toContain('role="radiogroup" aria-label="Μέγεθος κειμένου"');
    expect(readability).toContain('role="radiogroup" aria-label="Θέμα εμφάνισης"');
    expect(readability).not.toContain('neo-raised');
  });
});
