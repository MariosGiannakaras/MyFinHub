import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/AccountManagementSettings.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/components/AccountManagementSettings.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/settings-tabs-qa.mjs',import.meta.url),'utf8');

describe('Accounts owner UI contract',()=>{
  it('keeps cash creation limited to daily cash and reserve without removing legacy type compatibility',()=>{
    expect(source).toContain("const VISIBLE_CASH_ACCOUNT_TYPES=CASH_ACCOUNT_TYPES.filter(type=>type.id!=='other')");
    expect(source).toContain('VISIBLE_CASH_ACCOUNT_TYPES.map');
    expect(source).toContain("if(account.cashType==='reserve'||account.cashRole==='reserve')return 'reserve'");
    expect(source).not.toContain("editor.cashType==='other'?'π.χ. Φάκελος διακοπών'");
  });

  it('shows compact badges for the real default account roles',()=>{
    expect(source).toContain("settings.defaultExpenseAccount===id?'Έξοδα':null");
    expect(source).toContain("settings.defaultIncomeAccount===id?'Έσοδα':null");
    expect(source).toContain("settings.defaultLoanAccount===id?'Δόσεις':null");
    expect(source).toContain('account-management-default-badge');
    expect(styles).toContain('.account-management-default-badge{');
  });

  it('keeps Accounts dropdown styling simple and scoped',()=>{
    expect(source).toContain('className="account-management-select"');
    expect(styles).toContain('.account-management-select>.owned-input{');
    expect(styles).toContain('.owned-select-popover:is(');
  });

  it('captures the choice-driven account states for owner review',()=>{
    expect(qa).toContain("settings-accounts-default-dropdown-desktop");
    expect(qa).toContain("settings-accounts-new-bank-empty-desktop");
    expect(qa).toContain("settings-accounts-new-bank-provider-dropdown-desktop");
    expect(qa).toContain("settings-accounts-new-bank-selected-desktop");
    expect(qa).toContain("settings-accounts-new-cash-daily-desktop");
    expect(qa).toContain("settings-accounts-new-modal-desktop");
  });
});
