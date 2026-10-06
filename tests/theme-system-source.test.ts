import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main=readFileSync('src/main.tsx','utf8');
const theme=readFileSync('src/lib/theme.ts','utf8');
const settings=readFileSync('src/components/ReadabilitySettings.tsx','utf8');
const types=readFileSync('src/types.ts','utf8');
const runner=readFileSync('scripts/run-rendered-qa.mjs','utf8');
const rendered=readFileSync('scripts/theme-system-qa.mjs','utf8');
const darkSurfaces=readFileSync('src/styles/dark-theme-surfaces.css','utf8');
const rootCompat=readFileSync('src/styles/root-compat.css','utf8');
const workspaceCompat=readFileSync('src/styles/workspace-compat.css','utf8');
const qaHtml=readFileSync('qa.html','utf8');
const reportsStyles=readFileSync('src/pages/ReportsPage.css','utf8');

describe('theme architecture source contract',()=>{
  it('initializes theme before React mounts',()=>{
    expect(main.indexOf('initializeTheme();')).toBeGreaterThan(-1);
    expect(main.indexOf('initializeTheme();')).toBeLessThan(main.indexOf('createRoot('));
  });

  it('keeps theme preference outside FinanceData settings',()=>{
    const settingsBlock=types.slice(types.indexOf('export interface FinanceSettings'),types.indexOf('export interface RecurringItem'));
    expect(settingsBlock).not.toMatch(/theme\??\s*:/);
    expect(theme).toContain("THEME_STORAGE_KEY='myfinhub.theme'");
  });

  it('exposes localized System, light and dark choices while preserving stable preference values',()=>{
    expect(settings).toContain("value: 'system'");
    expect(settings).toContain("value: 'light'");
    expect(settings).toContain("value: 'dark'");
    expect(settings).toContain("label: 'Φωτεινό'");
    expect(settings).toContain("label: 'Σκούρο'");
    expect(settings).not.toContain("label: 'Light'");
    expect(settings).not.toContain("label: 'Dark'");
    expect(settings).toContain('aria-label="Θέμα εμφάνισης"');
  });

  it('binds interactive borders and formerly light-biased chrome to semantic theme roles',()=>{
    expect(theme).toContain("'--control-border':'#5a7092'");
    expect(theme).toContain('.eyebrow,.quick-modal>header small{color:var(--info)!important}');
    expect(theme).toContain('.mobile-more-menu{background:var(--surface-translucent)!important');
    expect(theme).toContain('.keyboard-shortcut-row kbd{background:var(--control-bg)!important');
    expect(rendered).toContain('dark control border contrast');
    expect(rendered).toContain('dark mobile More menu');
    expect(rendered).toContain("await sleep(220);const darkMoreMenu=");
    expect(darkSurfaces).toContain('html[data-theme="dark"] .approved-account-card');
    expect(darkSurfaces).toContain('html[data-theme="dark"] .transactions-approved-table td');
    expect(darkSurfaces).toContain('html[data-theme="dark"] .quick-modal:has(.generic-kind-grid)>footer');
    expect(rendered).toContain('dark high-fidelity surface parity');
    expect(rootCompat).not.toContain("dark-theme-surfaces.css");
    expect(workspaceCompat).toContain("@import './dark-theme-surfaces.css';");
    expect(qaHtml).toContain("await import('/src/styles/dark-theme-surfaces.css');");
    expect(reportsStyles).toContain('html[data-theme="dark"] .report-period-chip');
    expect(reportsStyles).toContain('background:var(--success-bg)');
    expect(reportsStyles).toContain('background:var(--warning-bg)');
    expect(reportsStyles).toContain('background:var(--error-bg)');
    expect(rendered).toContain('dark Reports period chip is a dark surface');
  });

  it('registers a dedicated rendered Light Dark matrix',()=>{
    expect(runner).toContain("scripts/theme-system-qa.mjs");
    expect(rendered).toContain("for(const theme of ['light','dark'])");
    expect(rendered).toContain("mode:'desktop'");
    expect(rendered).toContain("mode:'mobile'");
    expect(rendered).toContain('representative tablet parity');
    expect(rendered).toContain('grayscale');
  });
});
