import { useEffect, useSyncExternalStore } from 'react';
import { getRecurringServiceAssetSnapshot, refreshRecurringServiceAssets, subscribeRecurringServiceAssets } from '../lib/recurringServiceAssetClient';

export function useRecurringServiceAssets(enabled=true){
  const snapshot=useSyncExternalStore(subscribeRecurringServiceAssets,getRecurringServiceAssetSnapshot,getRecurringServiceAssetSnapshot);
  useEffect(()=>{if(enabled&&!snapshot.loaded&&!snapshot.loading)void refreshRecurringServiceAssets()},[enabled,snapshot.loaded,snapshot.loading]);
  return snapshot;
}
