import { Banknote, Landmark } from 'lucide-react';
import { useFinancialProviders } from '../hooks/useFinancialProviders';
import { bankBrandAsset, bankBrandFallbackMark, bankBrandKey } from '../lib/bankBrands';
import '../styles/part53.css';

export function BankBrandMark({id,name,compact=true}:{id?:string;name?:string;compact?:boolean}){
  const providerCatalog=useFinancialProviders();
  const inferredKey=bankBrandKey(id,name);
  const provider=providerCatalog.providers.find(item=>item.id===id||item.id===inferredKey);
  const identityKey=provider?.id||inferredKey;
  const assetKey=compact?provider?.logoAssetKey:provider?.wordmarkAssetKey;
  const visualKey=assetKey==='generic'?'generic':bankBrandKey(assetKey||id,provider?.displayName||name);
  const asset=visualKey==='generic'?null:bankBrandAsset(visualKey);
  const registrySource=provider?'shared':'fallback';

  if(identityKey==='cash')return <span className="bank-brand-mark bankmark-cash" aria-hidden="true"><Banknote/></span>;
  if(visualKey==='generic'||!asset)return <span className={`bank-brand-mark bankmark-${identityKey==='generic'?'generic':identityKey} bank-logo-fallback`} aria-hidden="true" data-bank-brand={identityKey} data-bank-logo-source="generic" data-provider-registry={registrySource}><Landmark/></span>;

  return <span className={`bank-brand-mark bankmark-${identityKey} ${compact?'compact':'wordmark'}`} aria-hidden="true" data-bank-brand={identityKey} data-bank-logo-source={asset.source} data-provider-registry={registrySource}>
    {asset.source==='local-image'
      ?<img className="bank-logo-image" src={compact?asset.src:(asset.wordmarkSrc??asset.src)} alt="" draggable={false}/>
      :<span className="bank-logo-text">{bankBrandFallbackMark(asset)}</span>}
  </span>;
}
