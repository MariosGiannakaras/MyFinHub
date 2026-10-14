import { useState } from 'react';
import { useRecurringServiceAssets } from '../hooks/useRecurringServiceAssets';
import { recurringServiceAssetByKey } from '../lib/recurringServiceAssetClient';
import type { FinanceSettings, RecurringItem } from '../types';
import { FinanceIcon } from './FinanceIcon';
import '../styles/recurring-brand-mark.css';

export function RecurringBrandMark({
  item,settings,size=34,className='',
}:{
  item:Pick<RecurringItem,'name'|'category'|'logoAssetKey'>;
  settings?:FinanceSettings;
  size?:number;
  className?:string;
}){
  const assetKey=item.logoAssetKey?.trim()||null;
  const assets=useRecurringServiceAssets(Boolean(assetKey));
  const asset=assetKey?recurringServiceAssetByKey(assetKey):null;
  const [failedAssetKey,setFailedAssetKey]=useState<string|null>(null);
  const failed=Boolean(assetKey&&failedAssetKey===assetKey);
  const style={width:size,height:size,flexBasis:size};

  if(asset&&!failed)return <span className={`recurring-brand-mark has-image ${className}`.trim()} style={style} aria-hidden="true" data-recurring-brand-source="service-storage" data-recurring-brand-key={asset.assetKey}>
    <img src={asset.url} alt="" draggable={false} onError={()=>setFailedAssetKey(asset.assetKey)}/>
  </span>;

  return <span className={`recurring-brand-mark fallback ${className}`.trim()} style={style} aria-hidden="true" data-recurring-brand-source={assetKey?(assets.loading?'loading':'fallback'):'fallback'}>
    <FinanceIcon settings={settings} kind="expense" category={item.category} note={item.name} size={Math.max(14,Math.round(size*.5))}/>
  </span>;
}
