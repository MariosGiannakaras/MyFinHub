import { Banknote, Landmark } from 'lucide-react';
import { useFinancialProviders } from '../hooks/useFinancialProviders';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { bankBrandAsset, bankBrandFallbackMark, bankBrandKey } from '../lib/bankBrands';
import { providerBrandUrl, type ProviderBrandSurfaceTone } from '../lib/providerBrandAssets';
import type { FinancialProviderAssetRole } from '../lib/financialProviders';

export function BankBrandMark({
  id,name,compact=true,role='auto',surfaceTone='app',
}:{
  id?:string;
  name?:string;
  compact?:boolean;
  role?:FinancialProviderAssetRole|'auto';
  surfaceTone?:ProviderBrandSurfaceTone|'app';
}){
  const providerCatalog=useFinancialProviders();
  const appTheme=useResolvedTheme();
  const inferredKey=bankBrandKey(id,name);
  const provider=providerCatalog.providers.find(item=>item.id===id||item.id===inferredKey);
  const identityKey=provider?.id||inferredKey;
  const resolvedRole:FinancialProviderAssetRole=role==='auto'?(compact?'logo':'wordmark'):role;
  const resolvedTone:ProviderBrandSurfaceTone=surfaceTone==='app'?appTheme:surfaceTone;
  const remoteUrl=providerBrandUrl(provider,resolvedRole,resolvedTone);
  const preferredAssetKey=resolvedRole==='logo'?provider?.logoAssetKey:provider?.wordmarkAssetKey;
  const assetKey=resolvedRole!=='logo'&&preferredAssetKey==='generic'&&provider?.logoAssetKey!=='generic'?provider?.logoAssetKey:preferredAssetKey;
  const registryVisualKey=assetKey==='generic'?'generic':bankBrandKey(assetKey||id,provider?.displayName||name);
  const visualKey=provider?registryVisualKey:bankBrandKey(identityKey,name);
  const asset=visualKey==='generic'?null:bankBrandAsset(visualKey);
  const registrySource=provider?'shared':'fallback';

  if(identityKey==='cash')return <span className="bank-brand-mark bankmark-cash" aria-hidden="true"><Banknote/></span>;
  if(remoteUrl)return <span className={`bank-brand-mark bankmark-${identityKey} ${resolvedRole==='logo'?'compact':'wordmark'}`} aria-hidden="true" data-bank-brand={identityKey} data-bank-logo-source="provider-storage" data-provider-registry={registrySource}>
    <img className="bank-logo-image" src={remoteUrl} alt="" draggable={false}/>
  </span>;
  if(visualKey==='generic'||!asset)return <span className={`bank-brand-mark bankmark-${identityKey==='generic'?'generic':identityKey} bank-logo-fallback`} aria-hidden="true" data-bank-brand={identityKey} data-bank-logo-source="generic" data-provider-registry={registrySource}><Landmark/></span>;

  return <span className={`bank-brand-mark bankmark-${identityKey} ${resolvedRole==='logo'?'compact':'wordmark'}`} aria-hidden="true" data-bank-brand={identityKey} data-bank-logo-source={asset.source} data-provider-registry={registrySource} data-bank-brand-tone={resolvedTone}>
    {asset.source==='local-image'
      ?<img className="bank-logo-image" src={resolvedRole==='logo'||resolvedTone==='dark'?asset.src:(asset.wordmarkSrc??asset.src)} alt="" draggable={false}/>
      :<span className="bank-logo-text">{bankBrandFallbackMark(asset)}</span>}
  </span>;
}
