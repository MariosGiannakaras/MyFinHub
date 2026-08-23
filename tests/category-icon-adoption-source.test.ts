import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('cross-app category icon adoption',()=>{
  it('lets the shared FinanceIcon prefer explicit category metadata while preserving heuristic fallback',()=>{
    const source=read('src/components/FinanceIcon.tsx');
    expect(source).toContain('explicitFinanceCategoryIcon');
    expect(source).toContain("data-icon-source={explicitKey?'category-preference':'heuristic'}");
    expect(source).toContain('financeIconSpec({kind,category,subcategory,note})');
  });

  it('passes persisted settings through the primary category-driven surfaces',()=>{
    const files=[
      'src/components/QuickAdd.tsx',
      'src/pages/TransactionsPage.tsx',
      'src/pages/RecurringPage.tsx',
      'src/pages/ReportsPage.tsx',
    ];
    for(const file of files){
      const source=read(file);
      expect(source,`${file} must use explicit persisted category icon preferences`).toContain('settings={data.state.settings}');
    }
  });

  it('keeps category icon selection presentation-only',()=>{
    const resolver=read('src/lib/categoryFinanceIcon.ts');
    expect(resolver).not.toContain('FinanceData');
    expect(resolver).not.toContain('events');
    expect(resolver).not.toContain('legs');
    expect(resolver).toContain('return explicitSubcategoryIcon');
    expect(resolver).toContain('explicitCategoryIcon');
  });
});
