import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css=readFileSync(new URL('../src/styles/lending-approved-target.css',import.meta.url),'utf8');

describe('Lending desktop theme surfaces',()=>{
  it('uses semantic theme tokens for dark-safe workspace surfaces',()=>{
    expect(css).toContain('.lending-people-search');
    expect(css).toContain('background:var(--control-bg)');
    expect(css).toContain('.lending-person-row.active{background:var(--surface-selected)');
    expect(css).toContain('background:var(--surface-2)');
    expect(css).toContain('background:var(--info-bg)');
    expect(css).toContain('.lending-approved-table th{padding:8px 10px;background:var(--surface-inset)');
    expect(css).toContain('background:var(--success-bg)');
    expect(css).toContain('.lending-quick-action.lending{background:var(--accent-soft)');
    expect(css).toContain('.lending-approved-table .receivable-action.lent{background:var(--accent-soft);color:var(--accent)}');
    expect(css).not.toContain('.lending-quick-action.lending{background:var(--error-bg)');
    expect(css).not.toMatch(/rgba\(248,251,255|rgba\(255,255,255,\.62\)|rgba\(237,244,253|rgba\(221,236,255/);
  });
});
