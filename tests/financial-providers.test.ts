import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BANK_ACCOUNT_CATEGORIES,
  CASH_ACCOUNT_TYPES,
  FINANCIAL_PROVIDERS,
  accountFinancialProviderId,
  accountMatchesFinancialProvider,
  financialProviderId,
} from '../src/lib/financialProviders.js';
import { bankBrandAsset, bankBrandKey } from '../src/lib/bankBrands.js';
import { DEFAULT_CARD_BANKS } from '../src/lib/cards.js';
import { providerAssetUrlAllowed } from '../src/lib/financialProviderClient.js';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('financial provider registry',()=>{
  it('keeps stable shared provider ids for account and card surfaces',()=>{
    const ids=FINANCIAL_PROVIDERS.map(provider=>provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['piraeus','alpha','national','eurobank','revolut','viva','payzy','paypal']));
    for(const provider of FINANCIAL_PROVIDERS){
      if(provider.id!=='payzy'){
        expect(provider.logoAssetKey).toBeTruthy();
        expect(provider.wordmarkAssetKey).toBeTruthy();
      }
      expect(bankBrandKey(provider.id,provider.displayName)).toBe(provider.id);
    }
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='payzy')?.logoAssetKey).toBeNull();
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='payzy')?.wordmarkAssetKey).toBeNull();
    expect(financialProviderId('Τράπεζα Πειραιώς')).toBe('piraeus');
    expect(financialProviderId('NBG')).toBe('national');
    expect(financialProviderId('PayPal')).toBe('paypal');
    expect(financialProviderId('Magenta Pay')).toBe('payzy');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='payzy')?.displayName).toBe('Magenta Pay');
  });

  it('matches Settings-created account ids by provider identity rather than legacy id prefixes',()=>{
    const seed={id:'piraeus-payroll',name:'Μισθοδοσία',kind:'bank'} as const;
    const created={id:'account-piraeus-1234',name:'Νέος λογαριασμός',kind:'bank',providerId:'piraeus'} as const;
    const other={id:'account-alpha-1234',name:'Άλλος λογαριασμός',kind:'bank',providerId:'alpha'} as const;
    expect(accountFinancialProviderId(seed)).toBe('piraeus');
    expect(accountFinancialProviderId(created)).toBe('piraeus');
    expect(accountMatchesFinancialProvider(seed,'piraeus')).toBe(true);
    expect(accountMatchesFinancialProvider(created,'piraeus')).toBe(true);
    expect(accountMatchesFinancialProvider(other,'piraeus')).toBe(false);
  });

  it('uses verified provider assets when available and remains generic when no canonical asset exists',()=>{
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='piraeus')?.logoAssetKey).toBe('piraeus-logo-green-on-yellow');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='piraeus')?.wordmarkAssetKey).toBe('piraeus-wordmark-green-on-white');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='alpha')?.logoAssetKey).toBe('alpha-logo-white-on-blue');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='alpha')?.wordmarkAssetKey).toBe('alpha-wordmark-color');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='revolut')?.logoAssetKey).toBe('revolut-logo-black-on-white');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='viva')?.logoAssetKey).toBe('viva-logo-navy-on-white');
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='payzy')?.logoAssetKey).toBeNull();
    expect(FINANCIAL_PROVIDERS.find(item=>item.id==='payzy')?.wordmarkAssetKey).toBeNull();
    for(const id of ['national','eurobank','paypal'] as const){
      const provider=FINANCIAL_PROVIDERS.find(item=>item.id===id);
      expect(provider?.logoAssetKey).toBe('generic');
      expect(provider?.wordmarkAssetKey).toBe('generic');
    }
    for(const id of ['piraeus','alpha','revolut','viva'] as const)expect(bankBrandAsset(id)?.source).toBe('local-image');
    for(const id of ['national','eurobank'] as const)expect(bankBrandAsset(id)).toBeNull();
  });

  it('keeps the account creation taxonomy compact and behavior-oriented',()=>{
    expect(BANK_ACCOUNT_CATEGORIES.map(item=>item.id)).toEqual(['payroll','current','savings','term','payment','other']);
    expect(CASH_ACCOUNT_TYPES.map(item=>item.id)).toEqual(['cash','reserve','other']);
  });

  it('stores provider identity in an authenticated read-only RLS registry',()=>{
    const migration=source('supabase/migrations/20260904193923_add_financial_provider_registry.sql');
    const brandRefresh=source('supabase/migrations/20260905020000_refresh_financial_provider_brand_assets.sql');
    const storageMigration=source('supabase/migrations/20260930103651_provider_asset_storage_metadata.sql');
    expect(migration).toContain('create table if not exists public.rheomiq_financial_providers');
    expect(migration).toContain('alter table public.rheomiq_financial_providers enable row level security');
    expect(migration).toContain('revoke all on table public.rheomiq_financial_providers from public, anon, authenticated');
    expect(migration).toContain('grant select on table public.rheomiq_financial_providers to authenticated');
    expect(migration).toContain('for select');
    expect(migration).not.toMatch(/service[_-]?role|secret[_-]?key/i);
    expect(brandRefresh).toContain("when 'piraeus' then 'generic'");
    const aligned=source('supabase/migrations/20260930075049_align_financial_provider_brand_assets.sql');
    expect(aligned).toContain("'piraeus-logo-green-on-yellow'");
    expect(aligned).toContain("'alpha-logo-white-on-blue'");
    expect(aligned).toContain("'revolut-wordmark-black-on-white'");
    expect(aligned).toContain("'viva-logo-navy-on-white'");
    expect(aligned).toContain("'payzy-logo-color'");
    expect(aligned).toContain('else logo_asset_key');
    expect(aligned).toContain('else wordmark_asset_key');
    expect(storageMigration).toContain("storage_bucket = 'financial-provider-assets'");
    expect(storageMigration).toContain('foreign key (logo_asset_key)');
    expect(storageMigration).toContain('foreign key (wordmark_asset_key)');
  });

  it('accepts secure provider assets and only loopback HTTP for local integration stacks',()=>{
    expect(providerAssetUrlAllowed('https://example.supabase.co/storage/v1/object/public/financial-provider-assets/providers/p/logo.svg')).toBe(true);
    expect(providerAssetUrlAllowed('http://127.0.0.1:54321/storage/v1/object/public/financial-provider-assets/providers/p/logo.svg')).toBe(true);
    expect(providerAssetUrlAllowed('http://localhost:54321/storage/v1/object/public/financial-provider-assets/providers/p/logo.svg')).toBe(true);
    expect(providerAssetUrlAllowed('http://[::1]:54321/storage/v1/object/public/financial-provider-assets/providers/p/logo.svg')).toBe(true);
    expect(providerAssetUrlAllowed('http://example.com/provider.svg')).toBe(false);
    expect(providerAssetUrlAllowed('javascript:alert(1)')).toBe(false);
    expect(providerAssetUrlAllowed('not-a-url')).toBe(false);
  });

  it('reuses the existing metadata API instead of adding another Vercel function',()=>{
    const handler=source('server/accountMetadataHandler.ts');
    const store=source('server/accountMetadataStore.ts');
    const client=source('src/lib/financialProviderClient.ts');
    expect(handler).toContain("resource==='financial-providers'");
    expect(handler).toContain('readFinancialProviders(session.accessToken)');
    expect(store).toContain('rheomiq_financial_providers?select=');
    expect(store).toContain('rheomiq_financial_provider_assets?select=');
    expect(store).toContain('storage/v1/object/public');
    expect(store).toContain('authorization:`Bearer ${accessToken}`');
    expect(store).toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(store).not.toMatch(/service[_-]?role|secret[_-]?key/i);
    expect(client).toContain("/api/account-metadata?resource=financial-providers");
    expect(client).toContain('providers:FALLBACK');
    expect(fs.existsSync(path.join(root,'api/financial-providers.ts'))).toBe(false);
  });

  it('matches Settings-created accounts to credit payment flows by provider identity instead of legacy id prefixes',()=>{
    const credit=source('src/pages/CreditCardPage.tsx');
    const contextual=source('src/components/ContextualQuickAdd.tsx');
    expect(credit).toContain("accountMatchesFinancialProvider(account,cardProviderId)");
    expect(contextual).toContain("accountMatchesFinancialProvider(account,card.bankId)");
    expect(credit).not.toContain("account.id.startsWith(`${bankPrefix}-`)");
    expect(contextual).not.toContain("account.id.startsWith(`${card.bankId}-`)");
  });

  it('uses the shared brand registry in Account Management and preserves separate provider/category/cash semantics',()=>{
    const accounts=source('src/components/AccountManagementSettings.tsx');
    const providerStyles=source('src/components/AccountManagementProvider.css');
    expect(accounts).toContain("from '../lib/financialProviders'");
    expect(accounts).toContain('<BankBrandMark');
    expect(accounts).toContain('1. Τύπος λογαριασμού');
    expect(accounts).toContain('2. Τράπεζα / πάροχος');
    expect(accounts).toContain('className="account-management-provider-picker"');
    expect(accounts).toContain('role="radiogroup" aria-label="Τράπεζα ή πάροχος"');
    expect(accounts).toContain('3. ');
    expect(accounts).toContain('bankAccountCategory');
    expect(accounts).toContain('providerId');
    expect(accounts).toContain('cashType');
    expect(accounts).toContain("editor.cashType==='reserve'");
    expect(accounts).toContain("editor.bankAccountCategory==='term'");
    expect(accounts).not.toContain('account-management-edit-summary');
    expect(providerStyles).not.toContain('account-management-edit-summary');
    expect(providerStyles).toContain('.account-management-segment button:not(.active):focus-visible');
  });

  it('makes the shared provider set available to Cards without changing legacy bank labels',()=>{
    const ids=DEFAULT_CARD_BANKS.map(bank=>bank.id);
    expect(ids).toEqual(FINANCIAL_PROVIDERS.map(provider=>provider.id));
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='piraeus')?.name).toBe('ΠΕΙΡΑΙΩΣ');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='revolut')?.name).toBe('REVOLUT');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='payzy')?.name).toBe('MAGENTA PAY');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='national')?.name).toBe('Εθνική Τράπεζα');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='eurobank')?.name).toBe('Eurobank');
    expect(DEFAULT_CARD_BANKS.find(bank=>bank.id==='paypal')?.name).toBe('PayPal');
  });

  it('backs Dashboard and card marks with the provider catalog while preserving approved local assets',()=>{
    const mark=source('src/components/BankBrandMark.tsx');
    const dashboard=source('src/pages/DashboardPage.tsx');
    const cards=source('src/lib/cards.ts');
    expect(mark).toContain('useFinancialProviders');
    expect(mark).toContain('logoAssetKey');
    expect(mark).toContain("preferredAssetKey==='generic'");
    expect(mark).toContain("provider?.logoAssetKey!=='generic'");
    expect(mark).toContain('wordmarkAssetKey');
    expect(mark).toContain('providerBrandUrl');
    expect(mark).toContain("role='auto'");
    expect(mark).toContain("surfaceTone='app'");
    expect(mark).toContain('data-bank-logo-source="provider-storage"');
    expect(mark).toContain("const registryVisualKey=assetKey==='generic'?'generic'");
    expect(mark).toContain('const visualKey=provider?registryVisualKey');
    expect(mark).toContain("const registrySource=provider?'shared':'fallback';");
    expect(mark).toContain('data-provider-registry={registrySource}');
    expect(mark).toContain('data-bank-logo-source="generic"');
    expect(dashboard).toContain('<BankBrandMark');
    expect(dashboard).toContain('account.providerId??account.provider??account.id');
    expect(cards).toContain("from './financialProviders.js'");
  });
});
