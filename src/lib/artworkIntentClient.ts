import { apiRequest } from './api.js';
import { assertCurrentAuthScope, authScopeEpoch } from './authScopedCache.js';

export type ArtworkIntentTarget=
  |{kind:'provider';targetId:string;role:'logo'|'wordmark'|'card-mark';variant:string}
  |{kind:'recurring';targetId:string};
type Action='acknowledge'|'cancel'|'retire';
type Identity={intentId:string;assetKey:string};
export type PendingArtworkIntent=Identity&{
  fileName:string;dispatchClaimed:boolean;registrationRecorded:boolean;verifiedAsset:boolean;
};

function endpoint(target:ArtworkIntentTarget){
  return '/api/account-metadata?'+new URLSearchParams({resource:'artwork-upload-intents',...target}).toString();
}
function unverified(){return new Error('Η εκκρεμής μεταφόρτωση δεν επιβεβαιώθηκε. Δεν έγινε επανάληψη της εγγραφής.')}
function validIdentity(target:ArtworkIntentTarget,identity:Record<string,unknown>){
  const prefix=target.kind==='provider'?target.targetId+'-asset-':'service-asset-';
  return typeof identity.intentId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(identity.intentId)&&
    typeof identity.assetKey==='string'&&identity.assetKey.startsWith(prefix)&&
    (target.kind==='provider'?/^[a-f0-9]{12}$/:/^[a-f0-9]{24}$/).test(identity.assetKey.slice(prefix.length));
}
export async function readArtworkIntent(target:ArtworkIntentTarget,scope=authScopeEpoch()):Promise<PendingArtworkIntent|null>{
  assertCurrentAuthScope(scope);
  const response=await apiRequest(endpoint(target),{method:'GET',credentials:'same-origin',cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  assertCurrentAuthScope(scope);
  if(!response.ok||!payload||typeof payload!=='object'||!Object.hasOwn(payload,'intent'))throw unverified();
  if(payload.intent===null)return null;
  const row=payload.intent as Record<string,unknown>;
  if(!row||typeof row!=='object'||Array.isArray(row)||!validIdentity(target,row)||
    row.kind!==target.kind||row.targetId!==target.targetId||
    row.role!==(target.kind==='provider'?target.role:'')||row.variant!==(target.kind==='provider'?target.variant:'')||
    typeof row.fileName!=='string'||typeof row.dispatchClaimed!=='boolean'||typeof row.registrationRecorded!=='boolean'||
    row.registrationRecorded&&!row.dispatchClaimed||
    row.asset!==null&&(!row.registrationRecorded||!row.asset||typeof row.asset!=='object'||
      (row.asset as Record<string,unknown>).assetKey!==row.assetKey))throw unverified();
  return {intentId:row.intentId as string,assetKey:row.assetKey as string,fileName:row.fileName,
    dispatchClaimed:row.dispatchClaimed,registrationRecorded:row.registrationRecorded,verifiedAsset:row.asset!==null};
}
export async function resolveArtworkIntent(target:ArtworkIntentTarget,identity:Identity,action:Action,scope=authScopeEpoch()){
  assertCurrentAuthScope(scope);
  if(!validIdentity(target,identity))throw unverified();
  const response=await apiRequest(endpoint(target),{method:'PATCH',credentials:'same-origin',
    headers:{accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({...identity,action})});
  const payload=await response.json().catch(()=>null);
  assertCurrentAuthScope(scope);
  const disposition=action==='acknowledge'?'acknowledged':action==='cancel'?'abandoned':'retired';
  if(!response.ok||payload?.intentId!==identity.intentId||payload?.assetKey!==identity.assetKey||
    payload?.disposition!==disposition)throw unverified();
}
