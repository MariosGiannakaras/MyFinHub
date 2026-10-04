import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, copyBoundedBinaryValue } from '../server/http.js';
import {
  parseFinancialProviderWrite,
  parseProviderAssetBindingWrite,
  parseProviderAssetUpload,
  validateProviderAssetContent,
} from '../server/accountMetadataHandler.js';
import { uploadFinancialProviderAsset } from '../server/accountMetadataStore.js';
import { cardBrandSurfaceTone } from '../src/lib/cardDesigns.js';
import { providerBrandUrl } from '../src/lib/providerBrandAssets.js';
import type { FinancialProvider } from '../src/lib/financialProviders.js';

const migration=readFileSync(new URL('../supabase/migrations/20261001192135_manage_financial_provider_assets.sql',import.meta.url),'utf8');
const handler=readFileSync(new URL('../server/accountMetadataHandler.ts',import.meta.url),'utf8');
const storeSource=readFileSync(new URL('../server/accountMetadataStore.ts',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/lib/financialProviderClient.ts',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/components/FinancialProviderManagementSettings.tsx',import.meta.url),'utf8');
const settingsStyles=readFileSync(new URL('../src/components/FinancialProviderManagementSettings.css',import.meta.url),'utf8');
const accountMetadataEntry=readFileSync(new URL('../api/account-metadata.ts',import.meta.url),'utf8');
const qaFinancialProviderSource=readFileSync(new URL('../src/qaFinancialProviders.ts',import.meta.url),'utf8');
const financialProviderClientSource=readFileSync(new URL('../src/lib/financialProviderClient.ts',import.meta.url),'utf8');
const providerBrandingQaSource=readFileSync(new URL('../scripts/provider-brand-management-qa.mjs',import.meta.url),'utf8');

function provider():FinancialProvider{
  return {
    id:'demo',displayName:'Demo Bank',shortName:'Demo',kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',
    logoAssetKey:'demo-logo-light',wordmarkAssetKey:'demo-wordmark-light',
    logoUrl:'https://example.test/primary-logo.svg',wordmarkUrl:'https://example.test/primary-wordmark.svg',
    assets:[
      {assetKey:'demo-shared',role:'logo',variant:'universal',url:'https://example.test/shared.svg',fileName:'shared.svg'},
      {assetKey:'demo-logo-light',role:'logo',variant:'light',url:'https://example.test/logo-light.svg'},
      {assetKey:'demo-logo-dark',role:'logo',variant:'dark',url:'https://example.test/logo-dark.svg'},
      {assetKey:'demo-wordmark-light',role:'wordmark',variant:'light',url:'https://example.test/wordmark-light.svg'},
      {assetKey:'demo-wordmark-dark',role:'wordmark',variant:'dark',url:'https://example.test/wordmark-dark.svg'},
      {assetKey:'demo-card-mark-dark',role:'card-mark',variant:'dark',url:'https://example.test/card-dark.svg'},
    ],
    bindings:[
      {role:'logo',variant:'universal',assetKey:'demo-shared'},
      {role:'wordmark',variant:'universal',assetKey:'demo-shared'},
      {role:'card-mark',variant:'universal',assetKey:'demo-shared'},
      {role:'logo',variant:'light',assetKey:'demo-logo-light'},
      {role:'logo',variant:'dark',assetKey:'demo-logo-dark'},
      {role:'wordmark',variant:'light',assetKey:'demo-wordmark-light'},
      {role:'wordmark',variant:'dark',assetKey:'demo-wordmark-dark'},
      {role:'card-mark',variant:'dark',assetKey:'demo-card-mark-dark'},
    ],
    sortOrder:1000,
  };
}

describe('provider branding management',()=>{
  const originalUrl=process.env.SUPABASE_URL;
  const originalKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  afterEach(()=>{
    vi.unstubAllGlobals();
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=originalKey;
  });

  it('resolves explicit slot bindings before compatibility fallbacks',()=>{
    const p=provider();
    expect(providerBrandUrl(p,'logo','light')).toBe('https://example.test/logo-light.svg');
    expect(providerBrandUrl(p,'logo','dark')).toBe('https://example.test/logo-dark.svg');
    expect(providerBrandUrl(p,'wordmark','dark')).toBe('https://example.test/wordmark-dark.svg');
    expect(providerBrandUrl(p,'card-mark','dark')).toBe('https://example.test/card-dark.svg');
    expect(providerBrandUrl(p,'card-mark','light')).toBe('https://example.test/shared.svg');
  });

  it('allows one uploaded asset to back several semantic slots',()=>{
    const p=provider();
    p.bindings=[
      {role:'logo',variant:'universal',assetKey:'demo-shared'},
      {role:'wordmark',variant:'universal',assetKey:'demo-shared'},
      {role:'card-mark',variant:'universal',assetKey:'demo-shared'},
    ];
    expect(providerBrandUrl(p,'logo','light')).toBe('https://example.test/shared.svg');
    expect(providerBrandUrl(p,'wordmark','dark')).toBe('https://example.test/shared.svg');
    expect(providerBrandUrl(p,'card-mark','light')).toBe('https://example.test/shared.svg');
    expect(providerBrandUrl(p,'card-mark','dark')).toBe('https://example.test/shared.svg');
  });

  it('derives card artwork from the card background rather than application theme',()=>{
    expect(cardBrandSurfaceTone({bankId:'piraeus',kind:'debit',network:'visa',formFactor:'physical',designId:'piraeus-yellow'})).toBe('light');
    expect(cardBrandSurfaceTone({bankId:'piraeus',kind:'credit',network:'visa',formFactor:'physical',designId:'piraeus-green'})).toBe('dark');
    expect(cardBrandSurfaceTone({bankId:'viva',kind:'debit',network:'mastercard',formFactor:'physical',designId:'viva'})).toBe('dark');
  });

  it('validates provider metadata, uploads and asset bindings at the API boundary',()=>{
    expect(parseFinancialProviderWrite({id:'demo-bank',displayName:'Demo Bank',shortName:'Demo',providerKind:'bank',countryCode:'gr',sortOrder:900}))
      .toEqual({id:'demo-bank',displayName:'Demo Bank',shortName:'Demo',providerKind:'bank',countryCode:'GR',sortOrder:900});
    expect(()=>parseFinancialProviderWrite({id:'../bad',displayName:'Bad',shortName:'Bad',providerKind:'bank',sortOrder:1})).toThrow(ApiError);
    expect(parseProviderAssetUpload({query:{providerId:'demo-bank',role:'card-mark',variant:'dark',primary:'0',fileName:'mark.svg'},headers:{'content-type':'image/svg+xml'}}))
      .toEqual({providerId:'demo-bank',role:'card-mark',variant:'dark',mimeType:'image/svg+xml',fileName:'mark.svg',makePrimary:false});
    expect(()=>parseProviderAssetUpload({query:{providerId:'demo-bank',role:'card-mark',variant:'dark',primary:'0'},headers:{'content-type':'image/svg+xml'}})).toThrow(ApiError);
    expect(()=>parseProviderAssetUpload({query:{providerId:['demo-bank','other'],role:'logo',variant:'dark',fileName:'logo.png'},headers:{'content-type':'image/png'}})).toThrow(ApiError);
    expect(()=>parseProviderAssetUpload({query:{providerId:'../escape',role:'logo',variant:'dark',fileName:'logo.png'},headers:{'content-type':'image/png'}})).toThrow(ApiError);
    expect(()=>parseProviderAssetUpload({query:{providerId:'demo-bank',role:'logo',variant:'dark',fileName:'logo.pdf'},headers:{'content-type':'application/pdf'}})).toThrow(ApiError);
    expect(parseProviderAssetBindingWrite({providerId:'demo-bank',role:'logo',variant:'dark',assetKey:'demo-shared'}))
      .toEqual({providerId:'demo-bank',role:'logo',variant:'dark',assetKey:'demo-shared'});
    expect(parseProviderAssetBindingWrite({providerId:'demo-bank',role:'logo',variant:'dark',assetKey:null}).assetKey).toBeNull();
    expect(()=>parseProviderAssetBindingWrite({providerId:'demo-bank',role:'logo',variant:'blue',assetKey:'demo-shared'})).toThrow(ApiError);
  });

  it('checks image signatures and rejects active SVG content',()=>{
    expect(()=>validateProviderAssetContent('image/png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/jpeg',Buffer.from([0xff,0xd8,0xff,0x00]))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/webp',Buffer.from('RIFFxxxxWEBP','ascii'))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'))).not.toThrow();
    expect(()=>validateProviderAssetContent('image/svg+xml',Buffer.from('<svg><script>alert(1)</script></svg>'))).toThrow(ApiError);
    expect(()=>validateProviderAssetContent('image/png',Buffer.from('not png'))).toThrow(ApiError);
    expect(()=>validateProviderAssetContent('image/png',['not','binary'] as unknown)).toThrow(ApiError);
    expect(()=>validateProviderAssetContent('image/png',Buffer.alloc(2*1024*1024+1))).toThrow(ApiError);
    expect(copyBoundedBinaryValue(Buffer.from([1,2,3]),3)).toEqual(Buffer.from([1,2,3]));
    expect(()=>copyBoundedBinaryValue({length:1},3)).toThrow(ApiError);
    expect(()=>copyBoundedBinaryValue(Buffer.alloc(4),3)).toThrow(ApiError);
  });

  it('keeps reusable asset mutations owner+AAL2 and inside the existing API budget',()=>{
    expect(migration).toContain('rheomiq_financial_provider_asset_bindings');
    expect(migration).toContain('primary key (provider_id,asset_role,variant)');
    expect(migration).toContain('rheomiq_set_financial_provider_asset_binding');
    expect(migration).toContain('rheomiq_update_financial_provider');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('rheomiq_is_owner_aal2()');
    expect(migration).toContain("case\n      when a.variant='universal' then 'universal'");
    expect(migration).not.toMatch(/service[_-]?role|secret[_-]?key/i);
    expect(storeSource).toContain('randomUUID');
    expect(storeSource).toContain('rheomiq_financial_provider_asset_bindings?select=');
    expect(storeSource).toContain('rheomiq_set_financial_provider_asset_binding');
    expect(storeSource).not.toContain('previousStoragePath');
    expect(storeSource).toContain("method:'DELETE'");
    expect(storeSource).toContain('provider asset cleanup');
    expect(handler).toContain("resource==='financial-provider-asset-binding'");
    expect(handler).toContain("method==='PATCH'");
    expect(accountMetadataEntry).toContain('bodyParser:false');
    expect(client).toContain('financial-provider-asset-binding');
  });

  it('keeps provider replacement Save on a deterministic QA write backend before cross-surface refresh proof',()=>{
    expect(providerBrandingQaSource).toContain('installProviderReplacementBackend');
    expect(providerBrandingQaSource).toContain('__myfinhubProviderReplaceOriginalFetch');
    expect(providerBrandingQaSource).toContain("resource==='financial-providers'&&method==='PATCH'");
    expect(providerBrandingQaSource).toContain("resource==='financial-provider-assets'&&method==='PUT'");
    expect(providerBrandingQaSource).toContain("resource==='financial-provider-asset-binding'&&method==='PUT'");
    expect(providerBrandingQaSource).toContain('provider.assets=[');
    expect(providerBrandingQaSource).toContain('provider.bindings=[');
    expect(providerBrandingQaSource).toContain('restoreProviderReplacementBackend');
    expect(providerBrandingQaSource).toContain('Dashboard refreshes the replaced provider artwork binding');
  });

  it('renders QA with the production provider asset registry instead of local bank-brand fallbacks',async()=>{
    const fixture=await import('../src/qaFinancialProviders.js');
    expect(fixture.QA_FINANCIAL_PROVIDER_ASSET_COUNT).toBe(26);
    const piraeus=fixture.QA_FINANCIAL_PROVIDERS.find(provider=>provider.id==='piraeus');
    expect(piraeus?.logoAssetKey).toBe('piraeus-logo-universal');
    expect(piraeus?.logoUrl).toContain('/financial-provider-assets/providers/piraeus/piraeus-logo-universal.svg');
    expect(piraeus?.assets?.map((asset:{assetKey:string})=>asset.assetKey)).toEqual(expect.arrayContaining([
      'piraeus-logo-universal','piraeus-wordmark-light','piraeus-wordmark-dark','piraeus-card-mark-light','piraeus-card-mark-dark',
    ]));
    expect(qaFinancialProviderSource).toContain("https://ahsukppxwaiagampsuzb.supabase.co");
    expect(financialProviderClientSource).toContain('QA_FINANCIAL_PROVIDERS');
    expect(financialProviderClientSource).toContain('providers:QA_MODE?QA_PROVIDERS:FALLBACK');
  });

  it('uses one edit/create provider editor with a visual asset library instead of native-file-input UX',()=>{
    expect(settings).toContain('ΕΠΕΞΕΡΓΑΣΙΑ ΠΑΡΟΧΟΥ');
    expect(settings).toContain('Στοιχεία');
    expect(settings).toContain('Εικόνες');
    expect(settings).toContain('Βιβλιοθήκη εικόνων');
    expect(settings).toContain('Ανέβασμα νέας');
    expect(settings).toContain('Η ίδια εικόνα μπορεί να ανατεθεί σε πολλές θέσεις.');
    expect(settings).toContain('Το θέμα της εφαρμογής δεν επηρεάζει τις κάρτες.');
    expect(settings).toContain('type="file" accept={ACCEPT} hidden');
    expect(settings).not.toContain('Choose File');
    expect(settings).not.toContain('Δεν επιλέχθηκε αρχείο');
    expect(settings).toContain('await setFinancialProviderAssetBinding');
    expect(settings).toContain("editor.source==='new'?'Δημιουργία παρόχου':'Αποθήκευση'");
    expect(settings).toContain('className="provider-management panel surface-raised"');
    expect(settings).not.toContain('className="provider-management panel neo-raised"');
    expect(settings).toContain('<Button type="button" variant="secondary" className="provider-edit-action"');
    expect(settings).not.toContain('<button type="button" className="provider-edit-action"');
  });

  it('keeps required provider slots visually separated with semantic tokens',()=>{
    expect(settings).toContain('className="required-badge">Απαραίτητο</span>');
    expect(settingsStyles).toContain('.provider-slot-copy>div:first-child{display:flex;align-items:center;gap:6px;flex-wrap:wrap}');
    expect(settingsStyles).toContain('.required-badge{display:inline-flex');
    expect(settingsStyles).toContain('background:var(--accent-soft)');
    expect(settingsStyles).toContain('color:var(--accent)');
    expect(settingsStyles).toContain('font-size:var(--ux-tiny-size)');
  });

  it('cleans up the uploaded Storage object when provider asset registration fails',async()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    const calls:Array<{url:string;method:string}>=[];
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);const method=String(init?.method||'GET');calls.push({url,method});
      if(calls.length===1)return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
      if(calls.length===2)return new Response(JSON.stringify({message:'temporary registration failure'}),{status:503,headers:{'content-type':'application/json'}});
      if(calls.length===3)return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
      throw new Error('unexpected provider asset request');
    });
    vi.stubGlobal('fetch',fetchMock);

    await expect(uploadFinancialProviderAsset({
      providerId:'demo-bank',role:'logo',variant:'light',mimeType:'image/png',fileName:'logo.png',makePrimary:true,
      content:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]),
    },'access-token')).rejects.toMatchObject({status:503,code:'ACCOUNT_METADATA_UNAVAILABLE'});

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({method:'POST'});
    expect(calls[0].url).toContain('/storage/v1/object/financial-provider-assets/providers/demo-bank/');
    expect(calls[1]).toMatchObject({method:'POST'});
    expect(calls[1].url).toContain('/rest/v1/rpc/rheomiq_register_financial_provider_asset');
    expect(calls[2]).toMatchObject({method:'DELETE'});
    expect(calls[2].url).toBe(calls[0].url);
  });

});
