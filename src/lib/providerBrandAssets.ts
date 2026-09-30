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

function pick(provider:FinancialProvider,role:FinancialProviderAssetRole,tone:ProviderBrandSurfaceTone){
  return [...(provider.assets??[])]
    .filter(asset=>asset.role===role&&Number.isFinite(rankedVariant(asset,tone)))
    .sort((a,b)=>rankedVariant(a,tone)-rankedVariant(b,tone)||a.variant.localeCompare(b.variant)||a.assetKey.localeCompare(b.assetKey))[0]?.url??null;
}

export function providerBrandUrl(provider:FinancialProvider|undefined,role:FinancialProviderAssetRole,tone:ProviderBrandSurfaceTone){
  if(!provider)return null;
  if(role==='logo')return pick(provider,'logo',tone)??provider.logoUrl??null;
  if(role==='wordmark')return pick(provider,'wordmark',tone)??provider.wordmarkUrl??pick(provider,'logo',tone)??provider.logoUrl??null;
  return pick(provider,'card-mark',tone)
    ??pick(provider,'wordmark',tone)
    ??provider.wordmarkUrl
    ??pick(provider,'logo',tone)
    ??provider.logoUrl
    ??null;
}
