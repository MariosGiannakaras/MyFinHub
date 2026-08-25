import { assertValidIban, isValidIban } from './iban';

export type AccountMetadataRecord={accountId:string;iban:string|null;revision:number;updatedAt:string};
export type AccountMetadataSnapshot={loaded:boolean;loading:boolean;records:Record<string,AccountMetadataRecord>;error:string|null};

const QA_MODE=typeof location!=='undefined'&&location.pathname.endsWith('/qa.html');
const QA_UPDATED_AT='2026-08-17T12:00:00.000Z';
const QA_RECORDS:Record<string,AccountMetadataRecord>={
  'piraeus-payroll':{accountId:'piraeus-payroll',iban:'GR1601101250000000012300695',revision:1,updatedAt:QA_UPDATED_AT},
  'piraeus-savings':{accountId:'piraeus-savings',iban:'GR9608100010000001234567890',revision:1,updatedAt:QA_UPDATED_AT},
};

let snapshot:AccountMetadataSnapshot={loaded:false,loading:false,records:{},error:null};
let pending:Promise<AccountMetadataSnapshot>|null=null;
const listeners=new Set<()=>void>();

function publish(next:AccountMetadataSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getAccountMetadataSnapshot(){return snapshot}
export function subscribeAccountMetadata(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}

function errorMessage(error:unknown){
  if(error instanceof Error&&error.message)return error.message;
  return 'Τα στοιχεία λογαριασμών δεν είναι διαθέσιμα αυτή τη στιγμή.';
}

function parseRecord(value:unknown):AccountMetadataRecord|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const record=value as Partial<AccountMetadataRecord>;
  if(typeof record.accountId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(record.accountId))return null;
  if(record.iban!==null&&record.iban!==undefined&&(typeof record.iban!=='string'||!isValidIban(record.iban)))return null;
  if(!Number.isSafeInteger(record.revision)||Number(record.revision)<1||typeof record.updatedAt!=='string')return null;
  return {accountId:record.accountId,iban:record.iban??null,revision:Number(record.revision),updatedAt:record.updatedAt};
}

async function json(response:Response){return response.json().catch(()=>null) as Promise<any>}

export async function refreshAccountMetadata(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  if(QA_MODE)return publish({loaded:true,loading:false,records:snapshot.loaded?snapshot.records:{...QA_RECORDS},error:null});
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await fetch('/api/account-metadata',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(!response.ok)throw new Error(payload?.message||'Δεν ήταν δυνατή η φόρτωση των IBAN.');
      const records:Array<unknown>=Array.isArray(payload?.records)?payload.records:[];
      const byId:Record<string,AccountMetadataRecord>={};
      for(const value of records){const record=parseRecord(value);if(record)byId[record.accountId]=record}
      return publish({loaded:true,loading:false,records:byId,error:null});
    }catch(error){return publish({...snapshot,loaded:true,loading:false,error:errorMessage(error)})}
    finally{pending=null}
  })();
  return pending;
}

export async function saveAccountMetadata(accountId:string,iban:string|null){
  const normalized=assertValidIban(iban);
  const current=snapshot.records[accountId];
  if(QA_MODE){
    const record:AccountMetadataRecord={accountId,iban:normalized,revision:(current?.revision??0)+1,updatedAt:QA_UPDATED_AT};
    publish({...snapshot,loaded:true,loading:false,error:null,records:{...snapshot.records,[accountId]:record}});
    return record;
  }
  const response=await fetch('/api/account-metadata',{
    method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json','if-match':String(current?.revision??0)},
    body:JSON.stringify({accountId,iban:normalized}),
  });
  const payload=await json(response);
  if(!response.ok){
    if(response.status===409){await refreshAccountMetadata(true);throw new Error('Το IBAN άλλαξε από άλλη συσκευή. Φορτώθηκε η νεότερη τιμή· έλεγξέ την και δοκίμασε ξανά.');}
    throw new Error(payload?.message||'Δεν ήταν δυνατή η αποθήκευση του IBAN.');
  }
  const record=parseRecord(payload?.record);
  if(!record||record.accountId!==accountId)throw new Error('Η απάντηση αποθήκευσης IBAN δεν είναι έγκυρη.');
  publish({...snapshot,loaded:true,loading:false,error:null,records:{...snapshot.records,[accountId]:record}});
  return record;
}
