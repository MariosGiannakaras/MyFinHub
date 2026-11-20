import { apiRequest } from './api.js';
import { trackDatabaseWrite } from './databaseSaveActivity.js';
import { assertValidIban, isValidIban } from './iban.js';
import { notifyAuthExpired } from './authExpiry.js';
import { userErrorMessage } from './userMessage.js';
import { watchAuthScope } from './authScopedCache.js';

type AccountMetadataRecord={accountId:string;iban:string|null;revision:number;updatedAt:string};
type AccountMetadataSnapshot={loaded:boolean;loading:boolean;records:Record<string,AccountMetadataRecord>;error:string|null};

const QA_MODE=typeof location!=='undefined'&&location.pathname.endsWith('/qa.html');
const QA_UPDATED_AT='2026-08-17T12:00:00.000Z';
const QA_RECORDS:Record<string,AccountMetadataRecord>={
  'piraeus-payroll':{accountId:'piraeus-payroll',iban:'GR1601101250000000012300695',revision:1,updatedAt:QA_UPDATED_AT},
  'piraeus-savings':{accountId:'piraeus-savings',iban:'GR9608100010000001234567890',revision:1,updatedAt:QA_UPDATED_AT},
};

let snapshot:AccountMetadataSnapshot={loaded:false,loading:false,records:{},error:null};
let pending:Promise<AccountMetadataSnapshot>|null=null;
const listeners=new Set<()=>void>();
// An IBAN PUT may commit before its acknowledgement is lost.
const unverifiedAccountWrites=new Set<string>();
export class UnverifiedAccountMetadataWrite extends Error{
  constructor(invalidReceipt=false){
    super((invalidReceipt?'Η απάντηση αποθήκευσης IBAN δεν είναι έγκυρη. ':'')+
      'Η εγγραφή IBAN ίσως ολοκληρώθηκε. Επαναφόρτωσε και έλεγξε την τρέχουσα τιμή πριν από νέα αποθήκευση.');
    this.name='UnverifiedAccountMetadataWrite';
  }
}

function publish(next:AccountMetadataSnapshot){snapshot=next;for(const listener of listeners)listener();return snapshot}
export function getAccountMetadataSnapshot(){return snapshot}
export function subscribeAccountMetadata(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
const authEpoch=watchAuthScope(()=>{
  pending=null;
  unverifiedAccountWrites.clear();
  publish({loaded:false,loading:false,records:{},error:null});
});

function markUnverifiedAccountWrite(accountId:string,epoch:number,invalidReceipt=false):never{
  if(epoch===authEpoch())unverifiedAccountWrites.add(accountId);
  throw new UnverifiedAccountMetadataWrite(invalidReceipt);
}

function errorMessage(error:unknown){
  return userErrorMessage(error,'Τα στοιχεία λογαριασμών δεν είναι διαθέσιμα αυτή τη στιγμή.');
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
function requestError(response:Response,payload:any,fallback:string){
  const code=typeof payload?.code==='string'?payload.code:'ACCOUNT_METADATA_ERROR';
  notifyAuthExpired(response.status,code);
  if(code==='DEVICE_ACCESS_REVOKED'||code==='AUTH_REQUIRED')return new Error('Η πρόσβαση αυτής της συσκευής έχει λήξει. Συνδέσου ξανά και ολοκλήρωσε την επαλήθευση MFA.');
  const candidate=typeof payload?.error==='string'?payload.error:typeof payload?.message==='string'?payload.message:'';
  return new Error(userErrorMessage(candidate?new Error(candidate):null,fallback));
}

export async function refreshAccountMetadata(force=false){
  if(snapshot.loaded&&!force)return snapshot;
  if(pending)return pending;
  if(QA_MODE)return publish({loaded:true,loading:false,records:snapshot.loaded?snapshot.records:{...QA_RECORDS},error:null});
  const epoch=authEpoch();
  publish({...snapshot,loading:true,error:null});
  pending=(async()=>{
    try{
      const response=await apiRequest('/api/account-metadata',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const payload=await json(response);
      if(epoch!==authEpoch())return snapshot;
      if(!response.ok)throw requestError(response,payload,'Δεν ήταν δυνατή η φόρτωση των IBAN.');
      const records=payload?.records;
      if(!Array.isArray(records))throw new Error('Η λίστα IBAN είναι μη έγκυρη.');
      const byId:Record<string,AccountMetadataRecord>={};
      for(const value of records){
        const record=parseRecord(value);
        if(!record||byId[record.accountId])throw new Error('Η λίστα IBAN είναι μη έγκυρη.');
        byId[record.accountId]=record;
      }
      return publish({loaded:true,loading:false,records:byId,error:null});
    }catch(error){
      if(epoch!==authEpoch())return snapshot;
      return publish({...snapshot,loaded:true,loading:false,error:errorMessage(error)});
    }
    finally{if(epoch===authEpoch())pending=null}
  })();
  return pending;
}

export async function saveAccountMetadata(accountId:string,iban:string|null){
  const normalized=assertValidIban(iban);
  if(QA_MODE){
    const current=snapshot.records[accountId];
    const record:AccountMetadataRecord={accountId,iban:normalized,revision:(current?.revision??0)+1,updatedAt:QA_UPDATED_AT};
    publish({...snapshot,loaded:true,loading:false,error:null,records:{...snapshot.records,[accountId]:record}});
    return record;
  }
  return trackDatabaseWrite(async()=>{
  if(unverifiedAccountWrites.has(accountId))throw new UnverifiedAccountMetadataWrite();
  // A failed/incomplete GET is not evidence that an account has no metadata
  // and can be written at revision zero. Reconcile by read-only GET first;
  // never create an uncertain duplicate versioned write on blind retry.
  if(!snapshot.loaded||snapshot.loading||snapshot.error){
    const recovered=await refreshAccountMetadata(true);
    if(!recovered.loaded||recovered.error)
      throw new Error('Η τρέχουσα έκδοση IBAN δεν έχει επιβεβαιωθεί. Φόρτωσε ξανά τα στοιχεία πριν από αποθήκευση.');
  }
  const current=snapshot.records[accountId];
  const epoch=authEpoch();
  let response:Response;
  try{
    response=await apiRequest('/api/account-metadata',{
      method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json','if-match':String(current?.revision??0)},
      body:JSON.stringify({accountId,iban:normalized}),
    });
  }catch{
    // Do not infer rollback: the server may have committed before reply loss.
    return markUnverifiedAccountWrite(accountId,epoch);
  }
  const payload=await json(response);
  if(epoch!==authEpoch())
    throw new Error('Η συνεδρία άλλαξε πριν επιβεβαιωθεί η αποθήκευση IBAN.');
  if(!response.ok){
    if(response.status===409){await refreshAccountMetadata(true);throw new Error('Το IBAN άλλαξε από άλλη συσκευή. Φορτώθηκε η νεότερη τιμή· έλεγξέ την και δοκίμασε ξανά.');}
    if(response.status===408||response.status===429||response.status>=500)
      return markUnverifiedAccountWrite(accountId,epoch);
    throw requestError(response,payload,'Δεν ήταν δυνατή η αποθήκευση του IBAN.');
  }
  const record=parseRecord(payload?.record);
  if(!record||record.accountId!==accountId||record.iban!==normalized||
    record.revision!==(current?.revision??0)+1)
    return markUnverifiedAccountWrite(accountId,epoch,true);
  publish({...snapshot,loaded:true,loading:false,error:null,records:{...snapshot.records,[accountId]:record}});
  return record;
  });
}
