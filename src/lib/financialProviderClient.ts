import { FINANCIAL_PROVIDERS, type FinancialProvider, type FinancialProviderKind } from './financialProviders';

export type FinancialProviderSnapshot={loaded:boolean;loading:boolean;providers:FinancialProvider[];error:string|null};

const QA_MODE=typeof location!=='undefined'&&location.pathname.endsWith('/qa.html');
const FALLBACK=FINANCIAL_PROVIDERS.map(provider=>({...provider}));
let snapshot:FinancialProviderSnapshot={loaded:false,loading:false,providers:FALLBACK,error:null};
let pending:Promise<FinancialProviderSnapshot>|null=null;
const listeners=new Set<()=>void>();

const kindLabels:Record<FinancialProviderKind,string>={
  bank:'Τράπεζα',
  fintech:'Ψηφιακός πάροχος',
  wallet:'Ψηφιακό πορτοφόλι',
  payment:'Πάροχος πληρωμών',
};

function publish(next:FinancialProviderSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getFinancialProviderSnapshot(){return snapshot}
export function subscribeFinancialProviders(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}

function parseProvider(value:unknown):FinancialProvider|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const row=value as Record<string,unknown>;
  const id=typeof row.id==='string'?row.id.trim():'';
  const displayName=typeof row.displayName==='string'?row.displayName.trim():'';
  const shortName=typeof row.shortName==='string'?row.shortName.trim():'';
  const kind=typeof row.providerKind==='string'?row.providerKind as FinancialProviderKind:'' as FinancialProviderKind;
  const countryCode=row.countryCode===null||row.countryCode===undefined?undefined:typeof row.countryCode==='string'?row.countryCode.trim():'';
  const logoAssetKey=typeof row.logoAssetKey==='string'?row.logoAssetKey.trim():'';
  const wordmarkAssetKey=typeof row.wordmarkAssetKey==='string'?row.wordmarkAssetKey.trim():'';
  const sortOrder=Number(row.sortOrder);
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)||!displayName||displayName.length>120||!shortName||shortName.length>80)return null;
  if(!['bank','fintech','wallet','payment'].includes(kind)||countryCode!==undefined&&!/^[A-Z]{2}$/.test(countryCode))return null;
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(logoAssetKey)||!/^[a-z][a-z0-9-]{0,63}$/.test(wordmarkAssetKey)||!Number.isSafeInteger(sortOrder))return null;
  return {id,displayName,shortName,kind,kindLabel:kindLabels[kind],countryCode,logoAssetKey,wordmarkAssetKey,sortOrder};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshFinancialProviders(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  if(QA_MODE)return publish({loaded:true,loading:false,providers:FALLBACK,error:null});
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await fetch('/api/account-metadata?resource=financial-providers',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(!response.ok)throw new Error(payload?.message||'Δεν ήταν δυνατή η φόρτωση των τραπεζών.');
      const parsed=(Array.isArray(payload?.providers)?payload.providers:[]).map(parseProvider).filter(Boolean) as FinancialProvider[];
      if(!parsed.length)throw new Error('Η λίστα τραπεζών είναι κενή.');
      return publish({loaded:true,loading:false,providers:parsed.sort((a,b)=>a.sortOrder-b.sortOrder||a.displayName.localeCompare(b.displayName,'el')),error:null});
    }catch{
      return publish({loaded:true,loading:false,providers:FALLBACK,error:'Χρησιμοποιείται η ενσωματωμένη λίστα τραπεζών.'});
    }finally{pending=null}
  })();
  return pending;
}
