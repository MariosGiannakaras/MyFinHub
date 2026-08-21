import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(path:string):string[]{
  return readdirSync(path).flatMap(name=>{
    const full=join(path,name);
    return statSync(full).isDirectory()?files(full):/\.(?:ts|tsx)$/.test(name)?[full]:[];
  });
}

const source=(path:string)=>readFileSync(path,'utf8');

describe('shared UI contracts',()=>{
  it('keeps modal Escape handling centralized instead of page-level duplicates',()=>{
    const offenders=files('src/pages').filter(file=>/onKeyDown\s*=\s*\{[^}]*Escape/s.test(source(file)));
    expect(offenders).toEqual([]);
    const hook=source('src/hooks/useModalFocus.ts');
    expect(hook).toContain("event.key === 'Escape'");
    expect(hook).toContain('onCloseRef.current()');
  });

  it('reuses the owned date/select controls across finance entry flows',()=>{
    for(const file of ['src/pages/SavingsPage.tsx','src/pages/CreditCardPage.tsx','src/pages/LoansPage.tsx','src/pages/LendingPage.tsx','src/pages/RecurringPage.tsx']){
      const text=source(file);
      expect(text,`${file} should use AppDateInput`).toContain('AppDateInput');
      expect(text,`${file} should use AppSelectInput`).toContain('AppSelectInput');
    }
  });

  it('reuses one explicit ASC/DESC control wherever user-selectable sorting exists',()=>{
    for(const file of ['src/pages/TransactionsPage.tsx','src/pages/CreditCardPage.tsx','src/pages/LoansPage.tsx']){
      expect(source(file),`${file} should use SortDirectionControl`).toContain('SortDirectionControl');
    }
  });

  it('keeps shared tooltip, form-error and readability primitives single-sourced',()=>{
    for(const file of ['src/components/Tooltip.tsx','src/components/FormError.tsx','src/components/ReadabilitySettings.tsx'])expect(source(file).length).toBeGreaterThan(80);
    for(const file of ['src/pages/SavingsPage.tsx','src/pages/LendingPage.tsx','src/pages/CardsPage.tsx'])expect(source(file)).toContain('FormError');
  });

  it('guards recovered account, refresh and page-error contracts',()=>{
    const recurring=source('src/pages/RecurringPage.tsx');
    expect(recurring).toContain('recurringAccountChoice');
    expect(recurring).toContain('recurringAccountError');
    const savings=source('src/pages/SavingsPage.tsx');
    expect(savings).toContain('sourceAccounts.some(account=>account.id===from)');
    expect(savings).toContain('savingsAccounts.some(account=>account.id===to)');
    const boundary=source('src/components/PageErrorBoundary.tsx');
    expect(boundary).toContain('errorRef.current?.focus');
    expect(boundary).toContain("this.setState({ failed: false }, this.props.onDashboard)");
    const app=source('src/App.tsx');
    expect(app).toContain('onRefresh={()=>{void finance.reload()}}');
    expect(app).not.toContain('onRefresh={()=>location.reload()');
    const qa=source('src/qa.tsx');
    expect(qa).toContain('onRefresh={refresh}');
    expect(qa).toContain('<PageSkeleton/>');
  });
});
