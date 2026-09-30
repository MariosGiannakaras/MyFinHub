import type { FinancialProvider, FinancialProviderAsset, FinancialProviderAssetRole } from './financialProviders.js';

export type ProviderBrandSurfaceTone='light'|'dark';

function rankedVariant(asset:FinancialProviderAsset,tone:ProviderBrandSurfaceTone){
  if(asset.variant===tone)return 0;
  if(asset.variant.startsWith(`${tone}-`))return 1;
  if(asset.variant==='universal')return 2;
  if(asset.variant==='default')return 3;
  const opposite=tone==='light'?'dark':'light';
  if(asset.variant===opposite||asset.variant.startsWith(`${opposite}-`))return Number.POSITIVE_INFINITY;
  return 4;
}

function legacyPick(provider:FinancialProvider,role:FinancialProviderAssetRole,tone:ProviderBrandSurfaceTone){
  return [...(provider.assets??[])]
    .filter(asset=>asset.role===role&&Number.isFinite(rankedVariant(asset,tone)))
    .sort((a,b)=>rankedVariant(a,tone)-rankedVariant(b,tone)||a.variant.localeCompare(b.variant)||a.assetKey.localeCompare(b.assetKey))[0]?.url??null;
}

function boundAsset(provider:FinancialProvider,role:FinancialProviderAssetRole,variant:'universal'|'light'|'dark'){
  const key=provider.bindings?.find(binding=>binding.role===role&&binding.variant===variant)?.assetKey;
  return key?(provider.assets??[]).find(asset=>asset.assetKey===key):undefined;
}

function boundUrl(provider:FinancialProvider,role:FinancialProviderAssetRole,tone:ProviderBrandSurfaceTone){
  return boundAsset(provider,role,tone)?.url??boundAsset(provider,role,'universal')?.url??null;
}

function logoUrl(provider:FinancialProvider,tone:ProviderBrandSurfaceTone){
  return boundUrl(provider,'logo',tone)??legacyPick(provider,'logo',tone)??provider.logoUrl??null;
}

function wordmarkUrl(provider:FinancialProvider,tone:ProviderBrandSurfaceTone){
  return boundUrl(provider,'wordmark',tone)??legacyPick(provider,'wordmark',tone)??provider.wordmarkUrl??logoUrl(provider,tone);
}

export function providerBrandUrl(provider:FinancialProvider|undefined,role:FinancialProviderAssetRole,tone:ProviderBrandSurfaceTone){
  if(!provider)return null;
  if(role==='logo')return logoUrl(provider,tone);
  if(role==='wordmark')return wordmarkUrl(provider,tone);
  // For cards, tone describes the card background itself. The application theme is irrelevant.
  return boundUrl(provider,'card-mark',tone)
    ??legacyPick(provider,'card-mark',tone)
    ??wordmarkUrl(provider,tone)
    ??logoUrl(provider,tone);
}
