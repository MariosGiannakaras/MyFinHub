import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ICON_CATALOG_COUNTS, iconCatalogAsset, isCatalogIconKey } from '../src/lib/categoryIconCatalog.js';
import { categoryIconPackOptionCount, categoryIconKeySupportedByPack } from '../src/lib/categoryIconPackSupport.js';
import { encodeCategoryIconValue, decodeCategoryIconValue } from '../src/lib/categoryIconRegistry.js';
import { explicitCategoryIcon, resolvedCategoryIcon, withCategoryIcon, withCategoryIconPack } from '../src/lib/categoryIconPreferences.js';
import type { FinanceSettings } from '../src/types.js';

const file=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const sourceCommit='c455eb6232ac0fa657550afb512af55fb8237ed6';
const packs=['lucide','tabler','phosphor','heroicons','bootstrap'] as const;
const expected=[1876,5166,1512,322,1404] as const;

describe('real distinct offline category icon packs',()=>{
  it('keeps exact audited catalog/asset count and pinned source/license contract',()=>{
    packs.forEach((pack,index)=>{
      const catalog=JSON.parse(file(`public/icon-packs/${pack}.json`)) as {pack:string;icons:string[];width:number;sourceCommit:string};
      const svg=file(`public/icon-packs/${pack}.svg`);
      expect(catalog.pack).toBe(pack);
      expect(catalog.sourceCommit).toBe(sourceCommit);
      expect(catalog.icons.length).toBe(expected[index]);
      expect(new Set(catalog.icons).size).toBe(catalog.icons.length);
      expect(CATEGORY_ICON_CATALOG_COUNTS[pack]).toBe(catalog.icons.length);
      expect(categoryIconPackOptionCount(pack)).toBe(catalog.icons.length);
      expect(iconCatalogAsset(pack,'svg')).toBe(`/icon-packs/${pack}.svg`);
      const symbols=[...svg.matchAll(/<symbol id="i-([a-z0-9-]+)" viewBox="0 0 ([0-9]+) ([0-9]+)">([\s\S]*?)<\/symbol>/g)];
      expect(symbols.length).toBe(catalog.icons.length);
      expect(symbols.map(match=>match[1])).toEqual(catalog.icons);
      expect(symbols.every(match=>Number(match[2])===catalog.width&&Number(match[3])===catalog.width)).toBe(true);
      const bodies=symbols.map(match=>match[4].replace(/\s+/g,' '));
      expect(new Set(bodies).size).toBe(bodies.length);
      expect(bodies.join(' ')).not.toMatch(/<script\b|<foreignObject\b|<image\b|<use\b|<defs\b|(?:xlink:)?href\s*=|javascript:|url\s*\(/i);
      expect(catalog.icons.every(name=>isCatalogIconKey(`icon/${name}`))).toBe(true);
    });
    const attribution=file('docs/ICON_CATALOG_SOURCES.md');
    expect(attribution).toContain(sourceCommit);
    expect(attribution).toContain('ISC');
    expect(attribution).toContain('MIT');
  });

  it('encodes new family-scoped names independently of old semantic values',()=>{
    expect(encodeCategoryIconValue('lucide','coffee')).toBe('coffee');
    expect(encodeCategoryIconValue('lucide','icon/alarm-clock')).toBe('lucide:icon/alarm-clock');
    expect(decodeCategoryIconValue('lucide:icon/alarm-clock')).toEqual({pack:'lucide',key:'icon/alarm-clock'});
    expect(categoryIconKeySupportedByPack('tabler','icon/abc')).toBe(true);
    expect(isCatalogIconKey('icon/../../bad')).toBe(false);
    expect(isCatalogIconKey('icon/a?x')).toBe(false);
  });

  it('persists native choices per family, and restores old preferences and fallback',()=>{
    let state={
      excludedFromAvailable:[],accountNames:{},expenseCategories:['Φαγητό'],incomeCategories:['Μισθός'],
      customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash',
    } as FinanceSettings;
    state=withCategoryIconPack(state,'lucide');
    state=withCategoryIcon(state,'expense','Φαγητό','lucide:icon/alarm-clock');
    expect(explicitCategoryIcon(state,'expense','Φαγητό')).toBe('lucide:icon/alarm-clock');
    expect(resolvedCategoryIcon(state,'expense','Φαγητό')).toBe('lucide:icon/alarm-clock');
    state=withCategoryIconPack(state,'tabler');
    state=withCategoryIcon(state,'expense','Φαγητό','tabler:icon/abacus');
    expect(resolvedCategoryIcon(state,'expense','Φαγητό')).toBe('tabler:icon/abacus');
    state=withCategoryIconPack(state,'lucide');
    expect(resolvedCategoryIcon(state,'expense','Φαγητό')).toBe('lucide:icon/alarm-clock');
    state=withCategoryIconPack(state,'tabler');
    expect(resolvedCategoryIcon(state,'expense','Φαγητό')).toBe('tabler:icon/abacus');
    state=withCategoryIcon(state,'expense','Φαγητό','tabler:shopping');
    expect(resolvedCategoryIcon(state,'expense','Φαγητό')).toBe('tabler:shopping');
    state=withCategoryIcon(state,'expense','Φαγητό','tabler:icon/../bad');
    expect(resolvedCategoryIcon(state,'expense','Φαγητό')).not.toContain('../bad');
  });

  it('renders native names as local SVG <use> rather than legacy semantic aliases',()=>{
    const glyph=file('src/components/CategoryIconGlyph.tsx');
    const picker=file('src/components/CategoryIconPicker.tsx');
    expect(glyph).toContain("isCatalogIconKey(decoded.key)");
    expect(glyph).toContain("<use width=\"24\" height=\"24\"");
    expect(picker).toContain('const PAGE_SIZE=96');
    expect(picker).toContain('getCatalog(pack)');
    expect(picker).toContain('const shown=matches.slice(0,visibleCount)');
    expect(picker).toContain('new Set(names).size!==names.length');
  });
});
