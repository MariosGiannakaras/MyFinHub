from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def replace(rel,old,new,expected=1):
    p=ROOT/rel
    text=p.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=expected:
        raise RuntimeError(f'{rel}: expected {expected}, found {count}: {old!r}')
    p.write_text(text.replace(old,new),encoding='utf-8')

# Contracts that intentionally enumerated the former standalone Review surface.
replace('tests/primitives-adoption-source.test.ts',
"const review=readFileSync(new URL('../src/pages/ReviewPage.tsx',import.meta.url),'utf8');",
"const confirmation=readFileSync(new URL('../src/components/LegacyConfirmationPanel.tsx',import.meta.url),'utf8');")
replace('tests/primitives-adoption-source.test.ts',
"  it('uses shared split controls in Review without changing the ReviewDecision payload',()=>{\n    expect(review).toContain(\"from '../components/AppTextInput'\");\n    expect(review).toContain(\"from '../components/CategorySelectInput'\");\n    expect(review).toContain(\"from '../components/MoneyInput'\");\n    expect(review).toContain('<AppTextInput aria-label={`Περιγραφή μέρους ${i+1}`}');\n    expect(review).toContain('<CategorySelectInput settings={data.state.settings} kind=\"expense\"');\n    expect(review).toContain('<MoneyInput aria-label={`Ποσό μέρους ${i+1}`}');\n    expect(review).toContain(\"semanticKind:'split',parts,decidedAt:new Date().toISOString()\");\n    expect(review).not.toMatch(/<input\\b/);\n  });",
"  it('uses shared split controls in legacy confirmation without changing the ReviewDecision payload',()=>{\n    expect(confirmation).toContain(\"from './AppTextInput'\");\n    expect(confirmation).toContain(\"from './CategorySelectInput'\");\n    expect(confirmation).toContain(\"from './MoneyInput'\");\n    expect(confirmation).toContain('<AppTextInput aria-label={`Περιγραφή μέρους ${index+1}`}');\n    expect(confirmation).toContain('<CategorySelectInput settings={data.state.settings} kind=\"expense\"');\n    expect(confirmation).toContain('<MoneyInput aria-label={`Ποσό μέρους ${index+1}`}');\n    expect(confirmation).toContain(\"semanticKind:'split',parts,decidedAt:new Date().toISOString()\");\n    expect(confirmation).not.toMatch(/<input\\b/);\n  });")

replace('tests/cross-page-ui-consistency-source.test.ts', "  'src/pages/ReviewPage.tsx',\n", '')
replace('tests/final-ux-reconciliation-source.test.ts',
"for(const page of ['reports','transactions','review','savings','cards','credit','loans','lending','recurring','planning','attention','settings'])",
"for(const page of ['reports','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','settings'])")
replace('tests/skeleton-fidelity.test.ts',
"['DashboardSkeletonContent','TransactionsSkeleton','ReviewSkeleton','SavingsSkeleton','CardsSkeleton','CreditSkeleton','LoansSkeleton','LendingSkeleton','RecurringSkeleton','PlanningSkeleton','AttentionSkeleton','ReportsSkeleton','SettingsSkeleton']",
"['DashboardSkeletonContent','TransactionsSkeleton','SavingsSkeleton','CardsSkeleton','CreditSkeleton','LoansSkeleton','LendingSkeleton','RecurringSkeleton','PlanningSkeleton','AttentionSkeleton','ReportsSkeleton','SettingsSkeleton']")
replace('tests/release-readiness-source.test.ts', 'expect(lazyPages.length).toBeGreaterThanOrEqual(13);', 'expect(lazyPages.length).toBeGreaterThanOrEqual(12);')

print('Review consolidation stale contracts updated.')
