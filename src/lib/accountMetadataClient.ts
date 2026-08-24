import { assertValidIban } from './iban';

export type AccountMetadataRecord={accountId:string;iban:string|null;revision:number;updatedAt:string};
export type AccountMetadataSnapshot={loaded:boolean;loading:boolean;records:Record<string,AccountMetadataRecord>;error:string|null};

let snapshot:AccountMetadataSnapshot={loaded:false,loading:false,records:{},error:null};
let pending:Promise<AccountMetadataSnapshot>|null=null;
const listeners=new Set<()=>void>();

function publish(next:AccountMetadataSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getAccountMetadataSnapshot(){return snapshot}
export function subscribeAccountMetadata(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener)}

function errorMessage(error:unknown){
  if(error instanceof Error&&error.message)return error.message;
  return 'Τα στοιχεία λογαριασμών δεν είναι διαθέσιμα αυτή τη στιγμή.';
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshAccountMetadata(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await fetch('/api/account-metadata',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(!response.ok)throw new Error(payload?.message||'Δεν ήταν δυνατή η φόρτωση των IBAN.');
      const records:Array<AccountMetadataRecord>=Array.isArray(payload?.records)?payload.records:[];
      const byId:Record<string,AccountMetadataRecord>={};
      for(const record of records){if(record&&typeof record.accountId==='string'&&Number.isInteger(record.revision))byId[record.accountId]=record}
      return publish({loaded:true,loading:false,records:byId,error:null});
    }catch(error){return publish({...snapshot,loaded:true,loading:false,error:errorMessage(error)})}
    finally{pending=null}
  })();
  return pending;
}

export async function saveAccountMetadata(accountId:string,iban:string|null){
  const normalized=assertValidIban(iban);
  const current=snapshot.records[accountId];
  const response=await fetch('/api/account-metadata',{
    method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json','if-match':String(current?.revision??0)},
    body:JSON.stringify({accountId,iban:normalized}),
  });
  const payload=await json(response);
  if(!response.ok){
    if(response.status===409){await refreshAccountMetadata(true);throw new Error('Το IBAN άλλαξε από άλλη συσκευή. Φορτώθηκε η νεότερη τιμή· έλεγξέ την και δοκίμασε ξανά.');}
    throw new Error(payload?.message||'Δεν ήταν δυνατή η αποθήκευση του IBAN.');
  }
  const record=payload?.record as AccountMetadataRecord|undefined;
  if(!record||record.accountId!==accountId||!Number.isInteger(record.revision))throw new Error('Η απάντηση αποθήκευσης IBAN δεν είναι έγκυρη.');
  publish({...snapshot,loaded:true,loading:false,error:null,records:{...snapshot.records,[accountId]:record}});
  return record;
}
