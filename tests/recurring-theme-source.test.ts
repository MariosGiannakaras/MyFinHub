import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const approved=readFileSync(new URL('../src/styles/recurring-approved-target.css',import.meta.url),'utf8');
const base=readFileSync(new URL('../src/styles/recurring-table-base.css',import.meta.url),'utf8');
const theme=readFileSync(new URL('../src/lib/theme.ts',import.meta.url),'utf8');

describe('Recurring theme surfaces',()=>{
  it('keeps desktop ledger/group surfaces semantic in dark mode',()=>{
    expect(approved).toContain('background:var(--surface-2)');
    expect(approved).toContain('background:var(--surface)');
    expect(approved).toContain('background:transparent;color:var(--text-secondary);box-shadow:none');
    expect(approved).toContain('.recurring-actions button:not(.save-button)');
    expect(theme).toContain('.save-button{background:var(--accent-gradient)!important;color:var(--on-accent)!important}');
    expect(approved).toContain('color-mix(in srgb,var(--accent-soft)');
    expect(approved).not.toMatch(/rgba\(250,252,255|rgba\(255,255,255,\.56\)|rgba\(248,251,255|rgba\(234,243,255/);
    expect(base).toContain('border-bottom:1px solid var(--border-subtle)');
    expect(base).toContain('background:var(--accent-soft);color:var(--accent)');
    expect(theme).toContain('.row-actions button:not(.save-button)');
    expect(theme).not.toContain('.row-actions button,.loan-actions button');
  });
});
