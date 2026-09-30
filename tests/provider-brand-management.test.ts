import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/http.js';
import { parseFinancialProviderWrite, parseProviderAssetUpload, validateProviderAssetContent } from '../server/accountMetadataHandler.js';
import { cardBrandSurfaceTone } from '../src/lib/cardDesigns.js';
import { providerBrandUrl } from '../src/lib/providerBrandAssets.js';
import type { FinancialProvider } from '../src/lib/financialProviders.js';

const migration=readFileSync(new URL('../supabase/migrations/20260930201200_manage_financial_provider_assets.sql',import.meta.url),'utf8');
const handler=readFileSync(new URL('../server/accountMetadataHandler.ts',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/lib/financialProviderClient.ts',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/components/FinancialProviderManagementSettings.tsx',import.meta.url),'utf8');

function provider():FinancialProvider{
  return {
    id:'demo',displayName:'Demo Bank',shortName:'Demo',kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',
    logoAssetKey:'demo-logo-light',wordmarkAssetKey:'demo-wordmark-light',
    logoUrl:'https://example.test/primary-logo.svg',wordmarkUrl:'https://example.test/primary-wordmark.svg',
    assets:[
      {assetKey:'demo-logo-light',role:'logo',variant:'light',url:'https://example.test/logo-light.svg'},
      {assetKey:'demo-logo-dark',role:'logo',variant:'dark',url:'https://example.test/logo-dark.svg'},
      {assetKey:'demo-wordmark-light',role:'wordmark',variant:'light',url:'https://example.test/wordmark-light.svg'},
      {assetKey:'demo-wordmark-dark',role:'wordmark',variant:'dark',url:'https://example.test/wordmark-dark.svg'},
      {assetKey:'demo-card-mark-dark',role:'card-mark',variant:'dark',url:'https://example.test/card-dark.svg'},
    ],
    sortOrder:1000,
  };
}

describe('provider branding management',()=>{
  it('resolves theme and card variants before primary compatibility URLs',()=>{
    const p=provider();
    expect(providerBrandUrl(p,'logo','light')).toBe('https://example.test/logo-light.svg');
    expect(providerBrandUrl(p,'logo','dark')).toBe('https://example.test/logo-dark.svg');
    expect(providerBrandUrl(p,'wordmark','dark')).toBe('https://example.test/wordmark-dark.svg');
    expect(providerBrandUrl(p,'card-mark','dark')).toBe('https://example.test/card-dark.svg');
    expect(providerBrandUrl(p,'card-mark','light')).toBe('https://example.test/wordmark-light.svg');
  });

  it('keeps neutral named card variants available without crossing to the opposite tone',()=>{
    const p=provider();
    p.assets=[...(p.assets??[]).filter(asset=>asset.role!=='card-mark'),{assetKey:'demo-card-telekom',role:'card-mark',variant:'telekom-t',url:'https://example.test/card-telekom.svg'}];
    expect(providerBrandUrl(p,'card-mark','light')).toBe('https://example.test/card-telekom.svg');
    expect(providerBrandUrl(p,'card-mark','dark')).toBe('https://example.test/card-telekom.svg');
  });

  it('derives artwork contrast from the card design rather than app theme',()=>{
    expect(cardBrandSurfaceTone({bankId:'piraeus',kind:'debit',network:'visa',formFactor:'physical',designId:'piraeus-yellow'})).toBe('light');
    expect(cardBrandSurfaceTone({bankId:'piraeus',kind:'credit',network:'visa',formFactor:'physical',designId:'piraeus-green'})).toBe('dark');
    expect(cardBrandSurfaceTone({bankId:'viva',kind:'debit',network:'mastercard',formFactor:'physical',designId:'viva'})).toBe('dark');
  });

  it('validates provider writes and binary upload metadata at the API boundary',()=>{
    expect(parseFinancialProviderWrite({id:'demo-bank',displayName:'Demo Bank',shortName:'Demo',providerKind:'bank',countryCode:'gr',sortOrder:900}))
      .toEqual({id:'demo-bank',displayName:'Demo Bank',shortName:'Demo',providerKind:'bank',countryCode:'GR',sortOrder:900});
    expect(()=>parseFinancialProviderWrite({id:'../bad',displayName:'Bad',shortName:'Bad',providerKind:'bank',sortOrder:1})).toThrow(ApiError);
    expect(parseProviderAssetUpload({query:{providerId:'demo-bank',role:'card-mark',variant:'dark',primary:'0'},headers:{'content-type':'image/svg+xml'}}))
      .toEqual({providerId:'demo-bank',role:'card-mark',variant:'dark',mimeType:'image/svg+xml',makePrimary:false});
    expect(()=>parseProviderAssetUpload({query:{providerId:'demo-bank',role:'card-mark',variant:'dark',primary:'1'},headers:{'content-type':'image/svg+xml'}})).toThrow(ApiError);
  });

  it('checks image signatures and rejects active SVG content',()=>{
    expect(()=>validateProviderAssetContent('image/png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/jpeg',Buffer.from([0xff,0xd8,0xff,0x00]))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/webp',Buffer.from('RIFFxxxxWEBP','ascii'))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/svg+xml',Buffer.from('<svg><script>alert(1)</script></svg>'))).toThrow(ApiError);
    expect(()=>validateProviderAssetContent('image/png',Buffer.from('not png'))).toThrow(ApiError);
  });

  it('keeps mutations owner+AAL2 and inside the existing API function budget',()=>{
    expect(migration).toContain('rheomiq_is_owner_aal2()');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('rheomiq_provider_storage_owner_aal2_insert');
    expect(migration).toContain('rheomiq_provider_storage_owner_aal2_update');
    expect(migration).toContain('rheomiq_create_financial_provider');
    expect(migration).toContain("message='PROVIDER_ID_CONFLICT'");
    expect(migration).toContain('rheomiq_register_financial_provider_asset');
    expect(migration).not.toMatch(/service[_-]?role|secret[_-]?key/i);
    expect(handler).toContain("resource==='financial-provider-assets'");
    expect(handler).toContain('readBinaryBody(req,MAX_PROVIDER_ASSET_BYTES)');
    expect(client).toContain("/api/account-metadata?resource=financial-providers");
    expect(client).toContain("resource:'financial-provider-assets'");
  });

  it('exposes one Settings flow for replacement and provider creation with artwork',()=>{
    expect(settings).toContain('ΤΡΑΠΕΖΕΣ & ΠΑΡΟΧΟΙ');
    expect(settings).toContain('Νέος πάροχος');
    expect(settings).toContain('Logo · Universal');
    expect(settings).toContain('Logo · Light');
    expect(settings).toContain('Logo · Dark');
    expect(settings).toContain('Wordmark · Light');
    expect(settings).toContain('Wordmark · Dark');
    expect(settings).toContain('Card mark · Light');
    expect(settings).toContain('Card mark · Dark');
    expect(settings).toContain('Για νέο πάροχο επίλεξε τουλάχιστον ένα Logo και ένα Wordmark.');
    expect(settings).toContain('await saveFinancialProvider');
    expect(settings).toContain('await uploadFinancialProviderAsset');
  });
});
