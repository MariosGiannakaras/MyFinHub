import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css=readFileSync(new URL('../src/styles/planning-approved-target.css',import.meta.url),'utf8');

describe('Planning desktop theme surfaces',()=>{
  it('uses semantic surfaces for scheduled and forecast content',()=>{
    expect(css).toContain('.planning-approved-desktop>.panel{border:1px solid var(--border-subtle);background:var(--surface)');
    expect(css).toContain('background:var(--surface-inset)');
    expect(css).toContain('background:var(--surface-2)');
    expect(css).toContain('background:var(--control-bg)');
    expect(css).toContain('background:var(--info-bg)');
    expect(css).toContain('background:var(--surface-elevated)');
    expect(css).not.toMatch(/rgba\(251,253,255|rgba\(244,248,253|rgba\(255,255,255,\.35\)|rgba\(252,254,255|#fbfdff|#eef4fb/);
  });
});
