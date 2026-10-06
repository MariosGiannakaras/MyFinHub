import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mobile=readFileSync(new URL('../src/styles/mobile-reports-settings-editors.css',import.meta.url),'utf8');

describe('mobile Reports/Settings semantic theme surfaces',()=>{
  it('avoids light-only hard-coded surfaces in the audited mobile shells',()=>{
    for(const forbidden of [
      'background:#eef4fa',
      'background:#eef4fb',
      'background:#f8fbff!important',
      'background:#edf4fb!important',
      'background:rgba(248,251,255,.99)!important',
      'background:rgba(248,251,255,.97)',
      'background:rgba(248,251,255,.98)',
      'background:rgba(236,243,250,.64)',
    ])expect(mobile).not.toContain(forbidden);
  });

  it('uses semantic tokens for the dark-sensitive Reports and Settings surfaces',()=>{
    expect(mobile).toContain('.private-report-placeholder');
    expect(mobile).toContain('background:var(--surface-inset)');
    expect(mobile).toContain('background:var(--surface-elevated)');
    expect(mobile).toContain('background:var(--control-bg)!important');
    expect(mobile).toContain('border:1px solid var(--control-border)!important');
    expect(mobile).toContain('background:var(--surface-translucent)!important');
  });
});
