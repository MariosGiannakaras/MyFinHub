import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BANK_ACCOUNT_CATEGORIES,
  CASH_ACCOUNT_TYPES,
  FINANCIAL_PROVIDERS,
  financialProviderId,
} from '../src/lib/financialProviders.js';
import { bankBrandAsset, bankBrandKey } from '../src/lib/bankBrands.js';
import { DEFAULT_CARD_BANKS } from '../src/lib/cards.js';

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

  it('never presents fabricated bank artwork as verified provider branding',()=>{
    const genericProviders=['piraeus','alpha','national','eurobank'];
    for(const id of genericProviders){
      const provider=FINANCIAL_PROVIDERS.find(item=>item.id===id);
      expect(provider?.logoAssetKey).toBe('generic');
      expect(provider?.wordmarkAssetKey).toBe('generic');
      expect(bankBrandAsset(id as 'piraeus'|'alpha'|'national'|'eurobank')).toBeNull();
    }
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='viva')?.logoAssetKey).toBe('generic');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='paypal')?.logoAssetKey).toBe('generic');
    expect(bankBrandAsset('revolut')?.source).toBe('local-image');
    expect(bankBrandAsset('payzy')?.source).toBe('local-image');
  });

  it('keeps the account creation taxonomy compact and behavior-oriented',()=>{
    expect(BANK_ACCOUNT_CATEGORIES.map(item=>item.id)).toEqual(['payroll','current','savings','term','payment','other']);
    expect(CASH_ACCOUNT_TYPES.map(item=>item.id)).toEqual(['cash','reserve','other']);
  });

  it('stores provider identity in an authenticated read-only RLS registry',()=>{
    const migration=source('supabase/migrations/20260904191500_add_financial_provider_registry.sql');
    const brandRefresh=source('supabase/migrations/20260905020000_refresh_financial_provider_brand_assets.sql');
    expect(migration).toContain('create table if not exists public.rheomiq_financial_providers');
    expect(migration).toContain('alter table public.rheomiq_financial_providers enable row level security');
    expect(migration).toContain('revoke all on table public.rheomiq_financial_providers from public, anon, authenticated');
    expect(migration).toContain('grant select on table public.rheomiq_financial_providers to authenticated');
    expect(migration).toContain('for select');
    expect(migration).not.toMatch(/service[_-]?role|secret[_-]?key/i);
    expect(brandRefresh).toContain("when 'piraeus' then 'generic'");
    expect(brandRefresh).toContain("when 'alpha' then 'generic'");
    expect(brandRefresh).toContain("when 'national' then 'generic'");
    expect(brandRefresh).toContain("when 'eurobank' then 'generic'");
  });

  it('reuses the existing metadata API instead of adding another Vercel function',()=>{
    const handler=source('server/accountMetadataHandler.ts');
    const store=source('server/accountMetadataStore.ts');
    const client=source('src/lib/financialProviderClient.ts');
    expect(handler).toContain("resource==='financial-providers'");
    expect(handler).toContain('readFinancialProviders(session.accessToken)');
    expect(store).toContain('rheomiq_financial_providers?select=');
    expect(store).toContain('authorization:`Bearer ${accessToken}`');
    expect(store).toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(store).not.toMatch(/service[_-]?role|secret[_-]?key/i);
    expect(client).toContain("/api/account-metadata?resource=financial-providers");
    expect(client).toContain('providers:FALLBACK');
    expect(fs.existsSync(path.join(root,'api/financial-providers.ts'))).toBe(false);
  });

  it('uses the shared brand registry in Account Management and preserves separate provider/category/cash semantics',()=>{
    const accounts=source('src/components/AccountManagementSettings.tsx');
    const providerStyles=source('src/components/AccountManagementProvider.css');
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
    expect(providerStyles).toContain('.account-management-modal.is-edit .account-management-edit-summary{display:none}');
    expect(providerStyles).toContain('.account-management-segment button:not(.active):focus-visible');
  });

  it('makes the shared provider set available to Cards without changing legacy bank labels',()=>{
    const ids=DEFAULT_CARD_BANKS.map(bank=>bank.id);
    expect(ids).toEqual(FINANCIAL_PROVIDERS.map(provider=>provider.id));
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='piraeus')?.name).toBe('ΠΕΙΡΑΙΩΣ');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='revolut')?.name).toBe('REVOLUT');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='national')?.name).toBe('Εθνική Τράπεζα');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='eurobank')?.name).toBe('Eurobank');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='paypal')?.name).toBe('PayPal');
  });

  it('backs Dashboard and card marks with the provider catalog while preserving local assets',()=>{
    const mark=source('src/components/BankBrandMark.tsx');
    const dashboard=source('src/pages/DashboardPage.tsx');
    const cards=source('src/lib/cards.ts');
    expect(mark).toContain('useFinancialProviders');
    expect(mark).toContain('logoAssetKey');
    expect(mark).toContain('wordmarkAssetKey');
    expect(mark).toContain("assetKey==='generic'?'generic'");
    expect(mark).toContain("data-provider-registry={provider?'shared':'fallback'}");
    expect(dashboard).toContain('<BankBrandMark');
    expect(cards).toContain("from './financialProviders.js'");
  });
});
