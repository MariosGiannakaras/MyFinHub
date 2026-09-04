import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BANK_ACCOUNT_CATEGORIES,
  CASH_ACCOUNT_TYPES,
  FINANCIAL_PROVIDERS,
  financialProviderId,
} from '../src/lib/financialProviders.js';
import { bankBrandKey } from '../src/lib/bankBrands.js';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('financial provider registry',()=>{
  it('keeps stable shared provider ids for account and card surfaces',()=>{
    const ids=FINANCIAL_PROVIDERS.map(provider=>provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['piraeus','alpha','national','eurobank','revolut','viva','payzy','paypal']));
    for(const provider of FINANCIAL_PROVIDERS){
      expect(provider.logoAssetKey).toBeTruthy();
      expect(provider.wordmarkAssetKey).toBeTruthy();
      expect(bankBrandKey(provider.id,provider.displayName)).toBe(provider.id);
    }
    expect(financialProviderId('Τράπεζα Πειραιώς')).toBe('piraeus');
    expect(financialProviderId('NBG')).toBe('national');
    expect(financialProviderId('PayPal')).toBe('paypal');
  });

  it('keeps the account creation taxonomy compact and behavior-oriented',()=>{
    expect(BANK_ACCOUNT_CATEGORIES.map(item=>item.id)).toEqual(['payroll','current','savings','term','payment','other']);
    expect(CASH_ACCOUNT_TYPES.map(item=>item.id)).toEqual(['cash','reserve','other']);
  });

  it('stores provider identity in an authenticated read-only RLS registry',()=>{
    const migration=source('supabase/migrations/20260904191500_add_financial_provider_registry.sql');
    expect(migration).toContain('create table if not exists public.rheomiq_financial_providers');
    expect(migration).toContain('alter table public.rheomiq_financial_providers enable row level security');
    expect(migration).toContain('revoke all on table public.rheomiq_financial_providers from public, anon, authenticated');
    expect(migration).toContain('grant select on table public.rheomiq_financial_providers to authenticated');
    expect(migration).toContain('for select');
    expect(migration).not.toMatch(/service[_-]?role|secret[_-]?key/i);
  });

  it('uses the shared brand registry in Account Management and preserves separate provider/category/cash semantics',()=>{
    const accounts=source('src/components/AccountManagementSettings.tsx');
    expect(accounts).toContain("from '../lib/financialProviders'");
    expect(accounts).toContain('<BankBrandMark');
    expect(accounts).toContain('1. Τύπος λογαριασμού');
    expect(accounts).toContain('2. Τράπεζα / πάροχος');
    expect(accounts).toContain('3. ');
    expect(accounts).toContain('bankAccountCategory');
    expect(accounts).toContain('providerId');
    expect(accounts).toContain('cashType');
    expect(accounts).toContain("editor.cashType==='reserve'");
    expect(accounts).toContain("editor.bankAccountCategory==='term'");
  });
});
