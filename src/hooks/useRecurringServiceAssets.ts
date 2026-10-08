import { useEffect, useSyncExternalStore } from 'react';
import { getRecurringServiceAssetSnapshot, refreshRecurringServiceAssets, subscribeRecurringServiceAssets } from '../lib/recurringServiceAssetClient';

export function useRecurringServiceAssets(){
  const snapshot=useSyncExternalStore(subscribeRecurringServiceAssets,getRecurringServiceAssetSnapshot,getRecurringServiceAssetSnapshot);
  useEffect(()=>{if(!snapshot.loaded&&!snapshot.loading)void refreshRecurringServiceAssets()},[snapshot.loaded,snapshot.loading]);
  return snapshot;
}
