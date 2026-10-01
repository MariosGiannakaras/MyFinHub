import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const reportsMobile=readFileSync(new URL('../src/styles/mobile-reports-settings-editors.css',import.meta.url),'utf8');
const icons=readFileSync(new URL('../src/components/CategoryIconAssignmentWorkspace.css',import.meta.url),'utf8');
const rules=readFileSync(new URL('../src/components/TransactionRulesWorkspace.css',import.meta.url),'utf8');
const security=readFileSync(new URL('../src/components/AccountSecuritySettings.css',import.meta.url),'utf8');
const devices=readFileSync(new URL('../src/components/DeviceAccessSettings.css',import.meta.url),'utf8');

describe('semantic theme surfaces for audited dark-mode states',()=>{
  it('keeps the Reports privacy placeholder on semantic dark/light tokens',()=>{
    const rule=reportsMobile.match(/\.private-report-placeholder\{[^}]+\}/)?.[0]??'';
    expect(rule).toContain('background:var(--surface-inset)');
    expect(rule).toContain('color:var(--text-secondary)');
    expect(rule).not.toMatch(/background:\s*#eef4fa/i);
  });

  it('keeps Settings Icons cards and editors off hard-coded light surfaces',()=>{
    expect(icons).toContain('.category-icon-unified-category');
    expect(icons).toContain('background:var(--surface-2)');
    expect(icons).toContain('background:var(--surface-inset)');
    expect(icons).toContain('background:var(--control-bg)');
    expect(icons).not.toMatch(/background:\s*rgba\(255\s*,\s*255\s*,\s*255\s*,\s*\.(?:58|62)\)/i);
    expect(icons).not.toMatch(/background:\s*rgba\(248\s*,\s*250\s*,\s*253\s*,\s*\.(?:56|68)\)/i);
  });

  it('keeps Rules empty state and access/security states theme-aware',()=>{
    const empty=rules.match(/\.rules-empty-state\{[^}]+\}/)?.[0]??'';
    expect(empty).toContain('background:var(--surface-inset)');
    expect(empty).toContain('color:var(--text-secondary)');

    expect(security).toContain('background:var(--control-bg)');
    expect(security).toContain('background:var(--surface-inset)');
    expect(devices).toContain('background:var(--surface-inset)');
    expect(devices).toContain('color:var(--text-secondary)');
  });
});
