import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const source=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const surface=source('src/components/Surface.tsx');
const shortcuts=source('src/components/KeyboardShortcutsPanel.tsx');
const readability=source('src/components/ReadabilitySettings.tsx');
const desktopUpdate=source('src/components/DesktopUpdatePanel.tsx');
const settingsPage=source('src/pages/SettingsPage.tsx');
const appShell=source('src/components/AppShell.tsx');
const appSkeleton=source('src/components/AppSkeleton.tsx');

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

  it('moves the active Settings generic raised shells without changing their semantic hosts',()=>{
    expect(desktopUpdate).toContain("import { Surface } from './Surface'");
    expect(desktopUpdate).toContain('<Surface as="article" variant="raised" className="panel desktop-update-panel settings-general-app" aria-labelledby="desktop-update-title">');
    expect(desktopUpdate).not.toContain('neo-raised');
    expect(settingsPage).toContain("import { Surface } from '../components/Surface'");
    expect(settingsPage).toContain('<Surface as="section" variant="raised" className="panel settings-data-action-card">');
    expect(settingsPage).toContain('<Surface as="section" variant="raised" className="panel settings-data-action-card settings-data-import-card">');
    expect(settingsPage).not.toContain('neo-raised');
  });
  it('moves only the generic application chrome surfaces while preserving specialized overlays',()=>{
    expect(appShell).toContain("import { Surface } from './Surface'");
    expect(appShell).toContain('<Surface as="aside" variant="raised" className="sidebar">');
    expect(appShell).toContain('<Surface as="header" variant="flat" className="topbar">');
    expect(appShell).toContain('<Surface as="nav" variant="raised" className="mobile-nav" aria-label="Κύρια πλοήγηση κινητού">');
    expect(appShell).not.toContain('sidebar neo-raised');
    expect(appShell).not.toContain('topbar neo-flat');
    expect(appShell).not.toContain('mobile-nav neo-raised');
    expect(appShell).toContain('className="command-palette neo-raised"');
    expect(appShell).toContain('className="mobile-more-menu neo-raised"');
    expect(appShell).toContain('className="neo-inset history-row"');
    expect(appShell).toContain("saveState==='saved'?'is-quiet':'neo-inset is-active'");
    expect(appSkeleton).toContain("import { Surface } from './Surface'");
    expect(appSkeleton).toContain('<Surface as="aside" variant="raised" className="skeleton-sidebar">');
    expect(appSkeleton).not.toContain('skeleton-sidebar neo-raised');
  });

});
