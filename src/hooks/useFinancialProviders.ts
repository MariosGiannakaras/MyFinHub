import { useEffect, useSyncExternalStore } from 'react';
import { getFinancialProviderSnapshot, refreshFinancialProviders, subscribeFinancialProviders } from '../lib/financialProviderClient';

export function useFinancialProviders(){
  const snapshot=useSyncExternalStore(subscribeFinancialProviders,getFinancialProviderSnapshot,getFinancialProviderSnapshot);
  useEffect(()=>{if(!snapshot.loaded&&!snapshot.loading)void refreshFinancialProviders()},[snapshot.loaded,snapshot.loading]);
  return snapshot;
}
