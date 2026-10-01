import type { FinancialProvider, FinancialProviderAsset, FinancialProviderAssetBinding, FinancialProviderAssetRole, FinancialProviderKind } from './lib/financialProviders.js';

const PROJECT_URL='https://ahsukppxwaiagampsuzb.supabase.co';
const UPDATED_AT='2026-09-30 19:58:48.46408+00';

type AssetSeed={
  key:string;
  role:FinancialProviderAssetRole;
  variant:string;
  file:string;
  mime:string;
  bytes:number;
};

function asset(providerId:string,seed:AssetSeed):FinancialProviderAsset{
  const path=`providers/${providerId}/${seed.file}`;
  return {
    assetKey:seed.key,
    role:seed.role,
    variant:seed.variant,
    fileName:seed.file,
    mimeType:seed.mime,
    sizeBytes:seed.bytes,
    updatedAt:UPDATED_AT,
    url:`${PROJECT_URL}/storage/v1/object/public/financial-provider-assets/${path}?v=${encodeURIComponent(UPDATED_AT)}`,
  };
}

function binding(role:FinancialProviderAssetRole,variant:'universal'|'light'|'dark',assetKey:string):FinancialProviderAssetBinding{
  return {role,variant,assetKey};
}

function provider(input:{
  id:string;
  displayName:string;
  shortName:string;
  kind:FinancialProviderKind;
  countryCode:string;
  logoAssetKey:string;
  wordmarkAssetKey:string;
  sortOrder:number;
  assets:AssetSeed[];
  bindings:FinancialProviderAssetBinding[];
}):FinancialProvider{
  const assets=input.assets.map(seed=>asset(input.id,seed));
  const byKey=new Map(assets.map(item=>[item.assetKey,item] as const));
  return {
    id:input.id,
    displayName:input.displayName,
    shortName:input.shortName,
    kind:input.kind,
    kindLabel:input.kind==='bank'?'Τράπεζα':input.kind==='fintech'?'Ψηφιακός πάροχος':input.kind==='wallet'?'Ψηφιακό πορτοφόλι':'Πάροχος πληρωμών',
    countryCode:input.countryCode,
    logoAssetKey:input.logoAssetKey,
    wordmarkAssetKey:input.wordmarkAssetKey,
    logoUrl:byKey.get(input.logoAssetKey)?.url??null,
    wordmarkUrl:byKey.get(input.wordmarkAssetKey)?.url??null,
    assets,
    bindings:input.bindings,
    sortOrder:input.sortOrder,
  };
}

/**
 * Deterministic QA mirror of the production financial-provider registry.
 *
 * Keep this fixture synchronized with the public Supabase provider assets whenever
 * production branding changes. It intentionally uses the real public Storage URLs
 * so rendered QA validates the same artwork users see in the application.
 */
export const QA_FINANCIAL_PROVIDERS:FinancialProvider[]=[
  provider({
    id:'piraeus',displayName:'Τράπεζα Πειραιώς',shortName:'Πειραιώς',kind:'bank',countryCode:'GR',
    logoAssetKey:'piraeus-logo-universal',wordmarkAssetKey:'piraeus-wordmark-light',sortOrder:10,
    assets:[
      {key:'piraeus-logo-universal',role:'logo',variant:'universal',file:'piraeus-logo-universal.svg',mime:'image/svg+xml',bytes:8323},
      {key:'piraeus-wordmark-light',role:'wordmark',variant:'light',file:'piraeus-wordmark-light.png',mime:'image/png',bytes:32578},
      {key:'piraeus-wordmark-dark',role:'wordmark',variant:'dark',file:'piraeus-wordmark-dark.png',mime:'image/png',bytes:28715},
      {key:'piraeus-card-mark-light',role:'card-mark',variant:'light',file:'piraeus-card-mark-light.png',mime:'image/png',bytes:89585},
      {key:'piraeus-card-mark-dark',role:'card-mark',variant:'dark',file:'piraeus-card-mark-dark.png',mime:'image/png',bytes:8494},
    ],
    bindings:[
      binding('logo','universal','piraeus-logo-universal'),
      binding('wordmark','universal','piraeus-wordmark-light'),
      binding('wordmark','light','piraeus-wordmark-light'),
      binding('wordmark','dark','piraeus-wordmark-dark'),
      binding('card-mark','light','piraeus-card-mark-light'),
      binding('card-mark','dark','piraeus-card-mark-dark'),
    ],
  }),
  provider({
    id:'alpha',displayName:'Alpha Bank',shortName:'Alpha',kind:'bank',countryCode:'GR',
    logoAssetKey:'alpha-logo-universal',wordmarkAssetKey:'alpha-wordmark-light',sortOrder:20,
    assets:[
      {key:'alpha-logo-universal',role:'logo',variant:'universal',file:'alpha-logo-universal.svg',mime:'image/svg+xml',bytes:2559},
      {key:'alpha-wordmark-light',role:'wordmark',variant:'light',file:'alpha-wordmark-light.png',mime:'image/png',bytes:11012},
      {key:'alpha-wordmark-dark',role:'wordmark',variant:'dark',file:'alpha-wordmark-dark.png',mime:'image/png',bytes:11011},
    ],
    bindings:[
      binding('logo','universal','alpha-logo-universal'),
      binding('wordmark','universal','alpha-wordmark-light'),
      binding('wordmark','light','alpha-wordmark-light'),
      binding('wordmark','dark','alpha-wordmark-dark'),
    ],
  }),
  provider({
    id:'national',displayName:'Εθνική Τράπεζα',shortName:'Εθνική',kind:'bank',countryCode:'GR',
    logoAssetKey:'national-logo-universal',wordmarkAssetKey:'national-wordmark-light-stacked',sortOrder:30,
    assets:[
      {key:'national-logo-universal',role:'logo',variant:'universal',file:'national-logo-universal.png',mime:'image/png',bytes:33477},
      {key:'national-wordmark-light-stacked',role:'wordmark',variant:'light-stacked',file:'national-wordmark-light-stacked.png',mime:'image/png',bytes:81649},
      {key:'national-wordmark-dark-stacked',role:'wordmark',variant:'dark-stacked',file:'national-wordmark-dark-stacked.png',mime:'image/png',bytes:95623},
    ],
    bindings:[
      binding('logo','universal','national-logo-universal'),
      binding('wordmark','universal','national-wordmark-light-stacked'),
      binding('wordmark','light','national-wordmark-light-stacked'),
      binding('wordmark','dark','national-wordmark-dark-stacked'),
    ],
  }),
  provider({
    id:'eurobank',displayName:'Eurobank',shortName:'Eurobank',kind:'bank',countryCode:'GR',
    logoAssetKey:'eurobank-logo-universal',wordmarkAssetKey:'eurobank-wordmark-light',sortOrder:40,
    assets:[
      {key:'eurobank-logo-universal',role:'logo',variant:'universal',file:'eurobank-logo-universal.svg',mime:'image/svg+xml',bytes:556},
      {key:'eurobank-wordmark-light',role:'wordmark',variant:'light',file:'eurobank-wordmark-light.svg',mime:'image/svg+xml',bytes:2519},
      {key:'eurobank-wordmark-dark',role:'wordmark',variant:'dark',file:'eurobank-wordmark-dark.svg',mime:'image/svg+xml',bytes:2519},
    ],
    bindings:[
      binding('logo','universal','eurobank-logo-universal'),
      binding('wordmark','universal','eurobank-wordmark-light'),
      binding('wordmark','light','eurobank-wordmark-light'),
      binding('wordmark','dark','eurobank-wordmark-dark'),
    ],
  }),
  provider({
    id:'revolut',displayName:'Revolut',shortName:'Revolut',kind:'fintech',countryCode:'LT',
    logoAssetKey:'revolut-logo-light',wordmarkAssetKey:'revolut-wordmark-light',sortOrder:50,
    assets:[
      {key:'revolut-logo-light',role:'logo',variant:'light',file:'revolut-logo-light.svg',mime:'image/svg+xml',bytes:933},
      {key:'revolut-logo-dark',role:'logo',variant:'dark',file:'revolut-logo-dark.svg',mime:'image/svg+xml',bytes:864},
      {key:'revolut-wordmark-light',role:'wordmark',variant:'light',file:'revolut-wordmark-light.svg',mime:'image/svg+xml',bytes:4093},
      {key:'revolut-wordmark-dark',role:'wordmark',variant:'dark',file:'revolut-wordmark-dark.svg',mime:'image/svg+xml',bytes:3251},
    ],
    bindings:[
      binding('logo','universal','revolut-logo-light'),
      binding('logo','light','revolut-logo-light'),
      binding('logo','dark','revolut-logo-dark'),
      binding('wordmark','universal','revolut-wordmark-light'),
      binding('wordmark','light','revolut-wordmark-light'),
      binding('wordmark','dark','revolut-wordmark-dark'),
    ],
  }),
  provider({
    id:'viva',displayName:'Viva.com',shortName:'Viva',kind:'payment',countryCode:'GR',
    logoAssetKey:'viva-logo-universal',wordmarkAssetKey:'viva-logo-universal',sortOrder:60,
    assets:[
      {key:'viva-logo-universal',role:'logo',variant:'universal',file:'viva-logo-universal.svg',mime:'image/svg+xml',bytes:664},
      {key:'viva-card-mark-light',role:'card-mark',variant:'light',file:'viva-card-mark-light.svg',mime:'image/svg+xml',bytes:824},
      {key:'viva-card-mark-dark',role:'card-mark',variant:'dark',file:'viva-card-mark-dark.svg',mime:'image/svg+xml',bytes:812},
    ],
    bindings:[
      binding('logo','universal','viva-logo-universal'),
      binding('wordmark','universal','viva-logo-universal'),
      binding('card-mark','light','viva-card-mark-light'),
      binding('card-mark','dark','viva-card-mark-dark'),
    ],
  }),
  provider({
    id:'payzy',displayName:'Magenta Pay',shortName:'Magenta Pay',kind:'wallet',countryCode:'GR',
    logoAssetKey:'magenta-pay-logo-universal',wordmarkAssetKey:'magenta-pay-logo-universal',sortOrder:70,
    assets:[
      {key:'magenta-pay-logo-universal',role:'logo',variant:'universal',file:'magenta-pay-logo-universal.svg',mime:'image/svg+xml',bytes:1756},
      {key:'magenta-pay-card-mark-telekom-t',role:'card-mark',variant:'telekom-t',file:'magenta-pay-card-mark-telekom-t.svg',mime:'image/svg+xml',bytes:1525},
    ],
    bindings:[
      binding('logo','universal','magenta-pay-logo-universal'),
      binding('wordmark','universal','magenta-pay-logo-universal'),
      binding('card-mark','universal','magenta-pay-card-mark-telekom-t'),
    ],
  }),
  provider({
    id:'paypal',displayName:'PayPal',shortName:'PayPal',kind:'wallet',countryCode:'US',
    logoAssetKey:'paypal-logo-universal',wordmarkAssetKey:'paypal-wordmark-light',sortOrder:80,
    assets:[
      {key:'paypal-logo-universal',role:'logo',variant:'universal',file:'paypal-logo-universal.svg',mime:'image/svg+xml',bytes:559},
      {key:'paypal-wordmark-light',role:'wordmark',variant:'light',file:'paypal-wordmark-light.svg',mime:'image/svg+xml',bytes:2548},
      {key:'paypal-wordmark-dark',role:'wordmark',variant:'dark',file:'paypal-wordmark-dark.svg',mime:'image/svg+xml',bytes:2548},
    ],
    bindings:[
      binding('logo','universal','paypal-logo-universal'),
      binding('wordmark','universal','paypal-wordmark-light'),
      binding('wordmark','light','paypal-wordmark-light'),
      binding('wordmark','dark','paypal-wordmark-dark'),
    ],
  }),
];

export const QA_FINANCIAL_PROVIDER_ASSET_COUNT=QA_FINANCIAL_PROVIDERS.reduce((total,item)=>total+(item.assets?.length??0),0);
