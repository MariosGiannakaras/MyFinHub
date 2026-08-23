import { Banknote, Landmark } from 'lucide-react';
import { bankBrandAsset, bankBrandFallbackMark, bankBrandKey } from '../lib/bankBrands';

export function BankBrandMark({id,name,compact=true}:{id?:string;name?:string;compact?:boolean}){
  const key=bankBrandKey(id,name);
  const asset=bankBrandAsset(key);

  if(key==='cash')return <span className="bank-brand-mark bankmark-cash" aria-hidden="true"><Banknote/></span>;
  if(key==='generic'||!asset)return <span className={`bank-brand-mark bankmark-${key==='generic'?'generic':key} bank-logo-fallback`} aria-hidden="true"><Landmark/></span>;

  return <span className={`bank-brand-mark bankmark-${key} ${compact?'compact':'wordmark'}`} aria-hidden="true" data-bank-brand={key} data-bank-logo-source={asset.source}>
    {asset.source==='local-image'
      ?<img className="bank-logo-image" src={asset.src} alt="" draggable={false}/>
      :<span className="bank-logo-text">{bankBrandFallbackMark(asset)}</span>}
  </span>;
}
