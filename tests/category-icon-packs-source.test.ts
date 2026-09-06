import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('category icon pack source contract',()=>{
  it('renders namespaced packs through the canonical category glyph',()=>{
    const source=read('src/components/CategoryIconGlyph.tsx');
    expect(source).toContain("decodeCategoryIconValue(iconKey)");
    expect(source).toContain("decoded.pack==='tabler'");
    expect(source).toContain('TablerCategoryGlyph');
    expect(source).toContain('data-icon-pack="lucide"');
    expect(source).toContain('data-icon-pack="tabler"');
  });

  it('keeps the connected Tabler subset local, attributed and offline',()=>{
    const source=read('src/components/TablerCategoryGlyph.tsx');
    expect(source).toContain('MIT License');
    expect(source).toContain('Copyright (c) 2020-2026 Paweł Kuna');
    expect(source).toContain('Keeping the SVG paths local');
    expect(source).not.toMatch(/<img/);
  });
});
