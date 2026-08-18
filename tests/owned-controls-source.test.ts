import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const selectSource=readFileSync(new URL('../src/components/AppSelectInput.tsx',import.meta.url),'utf8');
const dateSource=readFileSync(new URL('../src/components/AppDateInput.tsx',import.meta.url),'utf8');

describe('app-owned entry controls',()=>{
  it('keeps Escape dismissal in both popovers',()=>{
    expect(selectSource).toContain("event.key==='Escape'");
    expect(dateSource).toContain("event.key==='Escape'");
  });
  it('keeps accessible listbox and calendar roles',()=>{
    expect(selectSource).toContain('role="listbox"');
    expect(selectSource).toContain('role="option"');
    expect(dateSource).toContain('role="grid"');
    expect(dateSource).toContain('role="gridcell"');
  });
});
