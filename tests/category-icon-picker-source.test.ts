import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/CategoryIconPicker.tsx',import.meta.url),'utf8');

describe('category icon picker accessibility contract',()=>{

  it('proves approved Greek taxonomy icon-picker dark 320px search/focus/ARIA as rendered QA (#649 I17.06)',()=>{
    const qa=readFileSync(new URL('../scripts/icon-packs-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('Approved owner icon picker QA: 320px dark, Greek search, ARIA and focus');
    expect(qa).toContain("await openRow('Ταξίδι')");
    expect(qa).toContain('stress.theme===\'dark\'&&stress.within&&stress.inputAccessible');
    expect(qa).toContain('stress.options&&stress.overflow<=1');
    expect(qa).toContain('320px picker search receives keyboard focus');
    expect(qa).toContain("text:'σπίτι'");
    expect(qa).toContain('approved-taxonomy-icon-picker-dark-mobile-320');
  });

  it('uses native selectable buttons instead of an incomplete ARIA listbox pattern',()=>{
    expect(source).toContain('role="group"');
    expect(source).toContain('aria-pressed={value===iconValue}');
    expect(source).not.toContain('role="listbox"');
    expect(source).not.toContain('role="option"');
  });

  it('keeps search, inherited state and icon-pack selection textually exposed',()=>{
    expect(source).toContain('Αναζήτηση εικονιδίου');
    expect(source).toContain('Πακέτο εικονιδίων');
    expect(source).toContain('CATEGORY_ICON_PACKS');
    expect(source).toContain('aria-pressed={!value}');
    expect(source).toContain('role="status"');
  });

  it('supports a workspace-selected pack without duplicating the pack switcher per row',()=>{
    expect(source).toContain('selectedPack?:CategoryIconPack');
    expect(source).toContain('showPackSwitcher?:boolean');
    expect(source).toContain('const pack=selectedPack??localPack');
    expect(source).toContain('{showPackSwitcher?<div className="category-icon-pack-switcher"');
  });
});
