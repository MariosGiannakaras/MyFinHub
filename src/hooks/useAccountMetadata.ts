import { useEffect, useSyncExternalStore } from 'react';
import { getAccountMetadataSnapshot, refreshAccountMetadata, subscribeAccountMetadata } from '../lib/accountMetadataClient';

export function useAccountMetadata(){
  const snapshot=useSyncExternalStore(subscribeAccountMetadata,getAccountMetadataSnapshot,getAccountMetadataSnapshot);
  useEffect(()=>{if(!snapshot.loaded&&!snapshot.loading)void refreshAccountMetadata()},[snapshot.loaded,snapshot.loading]);
  return snapshot;
}
