import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('category icon pack source contract',()=>{
  it('renders namespaced packs through the canonical category glyph',()=>{
    const source=read('src/components/CategoryIconGlyph.tsx');
    expect(source).toContain('decodeCategoryIconValue(iconKey)');
    expect(source).toContain("decoded.pack==='tabler'");
    expect(source).toContain("decoded.pack==='phosphor'");
    expect(source).toContain("decoded.pack==='heroicons'");
    expect(source).toContain("decoded.pack==='bootstrap'");
    expect(source).toContain('TablerCategoryGlyph');
    expect(source).toContain('MultiPackCategoryGlyph');
    expect(source).toContain('data-icon-pack="lucide"');
    expect(source).toContain('data-icon-pack="tabler"');
  });

  it('keeps connected third-party subsets local, attributed and offline',()=>{
    const tabler=read('src/components/TablerCategoryGlyph.tsx');
    const multi=read('src/components/MultiPackCategoryGlyph.tsx');
    expect(tabler).toContain('MIT License');
    expect(tabler).toContain('Keeping the SVG paths local');
    expect(multi).toContain('Phosphor Icons');
    expect(multi).toContain('Heroicons');
    expect(multi).toContain('Bootstrap Icons');
    expect(multi).toContain('Assets stay local');
    expect(tabler).not.toMatch(/<img/);
    expect(multi).not.toMatch(/<img/);
  });

  it('selects the library once above the dense Icons list',()=>{
    const workspace=read('src/components/CategoryIconsWorkspace.tsx');
    expect(workspace).toContain('Βιβλιοθήκη εικονιδίων');
    expect(workspace).toContain('CATEGORY_ICON_PACKS.map');
    expect(workspace).toContain('category-icon-pack-switcher-global');
    expect(workspace).toContain("showPackSwitcher={view!=='icons'}");
    expect(workspace).toContain("selectedPack={view==='icons'?iconPack:undefined}");
  });
});
