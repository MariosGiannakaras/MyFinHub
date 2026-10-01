import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const rendered=read('scripts/category-icon-adoption-qa.mjs');

describe('cross-app category icon adoption',()=>{
  it('lets the shared FinanceIcon prefer explicit category metadata while preserving heuristic fallback',()=>{
    const source=read('src/components/FinanceIcon.tsx');
    expect(source).toContain('resolveFinanceCategoryVisual');
    expect(source).toContain("const visual=settings?resolveFinanceCategoryVisual(settings,input)")
    expect(source).toContain("data-icon-source={explicitKey?'category-preference':resolvedKey?'category-family':'heuristic'}");
    expect(source).toContain('financeIconSpec(input)');
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
    expect(resolver).toContain('resolveFinanceCategoryVisual');
    expect(resolver).toContain('const target=canonicalTarget(settings,input)');
    expect(resolver).toContain('explicitSubcategoryIcon');
    expect(resolver).toContain('resolvedCategoryIconColor');
    expect(resolver).toContain('explicitCategoryIcon');
    const identities=read('src/lib/categoryIdentity.ts');
    expect(identities).toContain('const normalizedSettingsCache=new WeakMap<FinanceSettings,FinanceSettings>()');
    expect(identities).toContain('const cached=normalizedSettingsCache.get(settings);if(cached)return cached');
  });

  it('keeps the representative coffee transaction in the food category fixture',()=>{
    const fixture=read('src/qaFixture.ts');
    expect(fixture).toMatch(/note:'Freddo espresso\\n[^']*',category:'Τρόφιμα'/);
  });

  it('waits for stable icon-ready rows instead of coupling adoption proof to page-one paint timing',()=>{
    expect(rendered).toContain('const waitForIcon=');
    expect(rendered).toContain("const transactionSemanticRows='.transaction-semantic-table .transaction-row'");
    expect(rendered).toContain("waitForIcon(transactionSemanticRows,'Freddo espresso'");
    expect(rendered).toContain("waitForIcon('.recurring-workspace-table tbody tr','Internet'");
    expect(rendered).toContain("waitForIcon('.report-category-list > div','Σούπερ Μάρκετ'");
    expect(rendered).toContain("waitForIcon('.mobile-transaction-row','Σούπερ Μάρκετ'");
    expect(rendered).toContain("mobileFood.key==='groceries'");
  });
});
