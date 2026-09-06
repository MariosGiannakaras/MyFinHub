import { describe, expect, it } from 'vitest';
import { categoryTree } from '../src/lib/categories.js';
import { resolvedCategoryIcon } from '../src/lib/categoryIconPreferences.js';
import { qaFinanceData } from '../src/qaFixture.js';

describe('category icon semantic coverage',()=>{
  it('gives the current expense taxonomy broad visual differentiation',()=>{
    const settings=qaFinanceData().state.settings;
    const categories=categoryTree(settings,'expense');
    const resolved=categories.map(category=>resolvedCategoryIcon(settings,'expense',category.name));
    const nonNull=resolved.filter((value):value is string=>Boolean(value));
    expect(nonNull.length).toBe(categories.length);
    expect(new Set(nonNull).size).toBeGreaterThanOrEqual(13);
  });

  it('does not collapse vehicle subcategories onto the parent car glyph',()=>{
    const settings=qaFinanceData().state.settings;
    const expected=new Map([
      ['Καύσιμα','fuel'],
      ['Συντήρηση & Service','service'],
      ['Ασφάλεια','insurance'],
      ['Parking & Διόδια','parking'],
    ]);
    for(const [subcategory,icon] of expected){
      expect(resolvedCategoryIcon(settings,'expense','Όχημα',subcategory)).toBe(icon);
    }
    expect(new Set([...expected.values()]).size).toBe(expected.size);
  });

  it('uses income semantics instead of the generic expense fallback',()=>{
    const settings=qaFinanceData().state.settings;
    expect(resolvedCategoryIcon(settings,'income','Μισθοδοσία')).toBe('salary');
    expect(resolvedCategoryIcon(settings,'income','Μισθός')).toBe('salary');
    expect(resolvedCategoryIcon(settings,'income','Άλλο')).toBe('income');
  });
});
