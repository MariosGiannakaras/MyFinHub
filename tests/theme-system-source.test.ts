import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main=readFileSync('src/main.tsx','utf8');
const theme=readFileSync('src/lib/theme.ts','utf8');
const settings=readFileSync('src/components/ReadabilitySettings.tsx','utf8');
const types=readFileSync('src/types.ts','utf8');
const runner=readFileSync('scripts/run-rendered-qa.mjs','utf8');
const rendered=readFileSync('scripts/theme-system-qa.mjs','utf8');

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

  it('exposes explicit System Light Dark choices',()=>{
    expect(settings).toContain("value: 'system'");
    expect(settings).toContain("value: 'light'");
    expect(settings).toContain("value: 'dark'");
    expect(settings).toContain('aria-label="Θέμα εμφάνισης"');
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
