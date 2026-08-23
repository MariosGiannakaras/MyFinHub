import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/CategoryIconPicker.tsx',import.meta.url),'utf8');

describe('category icon picker accessibility contract',()=>{
  it('uses native selectable buttons instead of an incomplete ARIA listbox pattern',()=>{
    expect(source).toContain('role="group"');
    expect(source).toContain('aria-pressed={value===option.key}');
    expect(source).not.toContain('role="listbox"');
    expect(source).not.toContain('role="option"');
  });

  it('keeps search and inherited state textually exposed',()=>{
    expect(source).toContain('Αναζήτηση εικονιδίου');
    expect(source).toContain('aria-pressed={!value}');
    expect(source).toContain('role="status"');
  });
});
