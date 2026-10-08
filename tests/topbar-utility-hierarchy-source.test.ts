import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('AppShell utility hierarchy',()=>{
  it('exposes reusable IconButton emphasis variants without changing semantic button behavior',()=>{
    const primitive=read('src/components/IconButton.tsx');
    expect(primitive).toContain("type IconButtonVariant='default'|'accent'|'quiet'");
    expect(primitive).toContain("accent:'icon-button-accent'");
    expect(primitive).toContain("quiet:'icon-button-quiet'");
    expect(primitive).toContain("variant='default'");
  });

  it('groups global utilities by role while preserving every existing action',()=>{
    const shell=read('src/components/AppShell.tsx');
    expect(shell).toContain('aria-label="Αναζήτηση και εντολές" variant="accent"');
    expect(shell).toContain('className="top-action-group top-action-history" role="group" aria-label="Ιστορικό και αλλαγές"');
    expect(shell).toContain('className="top-action-group top-action-system" role="group" aria-label="Δεδομένα και συνεδρία"');
    for(const label of ['Αναίρεση τελευταίας αλλαγής','Επαναφορά τελευταίας αναιρεμένης αλλαγής','Ιστορικό αλλαγών','Ανανέωση δεδομένων','Αποσύνδεση']){
      expect(shell).toContain(`aria-label="${label}"`);
    }
    expect(shell.match(/variant="quiet"/g)?.length).toBe(5);
  });

  it('uses one shared theme contract and flattens utility groups on phone layouts',()=>{
    const theme=read('src/lib/theme.ts');
    const shellCss=read('src/styles/shell-navigation-foundations.css');
    const mobile=read('src/styles/mobile-app-shell.css');
    expect(theme).toContain('.icon-button-accent{background:var(--accent-soft)!important');
    expect(theme).toContain('.icon-button-quiet{background:transparent!important');
    expect(shellCss).toContain('.top-action-group{display:flex;align-items:center;gap:2px');
    expect(shellCss).toContain('.top-action-system{padding-inline:0;border-color:transparent;background:transparent;box-shadow:none}');
    expect(mobile).toContain('.top-action-group{display:contents}');
  });
});
