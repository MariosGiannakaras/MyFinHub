import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ApiError} from '../server/http.js';

const owner=vi.hoisted(()=>({isOwner:vi.fn()}));
const devices=vi.hoisted(()=>({ensureDeviceSessionAccess:vi.fn()}));
const metadata=vi.hoisted(()=>({
  MAX_PROVIDER_ASSET_BYTES:2*1024*1024,
  MAX_RECURRING_SERVICE_ASSET_BYTES:2*1024*1024,
  readAccountMetadata:vi.fn(),
  writeAccountMetadata:vi.fn(),
  readFinancialProviders:vi.fn(),
  readRecurringServiceAssets:vi.fn(),
  readPendingArtworkUploadIntent:vi.fn(),
  writeFinancialProvider:vi.fn(),
  updateFinancialProvider:vi.fn(),
  uploadFinancialProviderAsset:vi.fn(),
  uploadRecurringServiceAsset:vi.fn(),
  deleteRecurringServiceAsset:vi.fn(),
  setFinancialProviderAssetBinding:vi.fn(),
}));
vi.mock('../server/storage.js',()=>owner);
vi.mock('../server/deviceSessionRegistry.js',()=>devices);
vi.mock('../server/accountMetadataStore.js',()=>metadata);

import {handleAccountMetadataRequest} from '../server/accountMetadataHandler.js';

const sessionId='123e4567-e89b-42d3-a456-426614174000';
const iban='GR1601101250000000012300695';
const records=[{accountId:'account-one',iban,revision:5,updatedAt:'2026-11-20T12:00:00Z'}];
const operations=[
  {label:'IBAN GET',method:'GET',resource:''},
  {label:'provider catalog GET',method:'GET',resource:'financial-providers'},
  {label:'recurring asset GET',method:'GET',resource:'recurring-service-assets'},
  {label:'IBAN PUT',method:'PUT',resource:''},
  {label:'provider POST',method:'POST',resource:'financial-providers'},
  {label:'provider PATCH',method:'PATCH',resource:'financial-providers'},
  {label:'provider asset PUT',method:'PUT',resource:'financial-provider-assets'},
  {label:'recurring asset PUT',method:'PUT',resource:'recurring-service-assets'},
  {label:'recurring asset DELETE',method:'DELETE',resource:'recurring-service-assets'},
  {label:'provider binding PUT',method:'PUT',resource:'financial-provider-asset-binding'},
  {label:'artwork intent GET',method:'GET',resource:'artwork-upload-intents'},
] as const;
type Operation=(typeof operations)[number];
const writes=operations.filter(op=>op.method!=='GET');

function tokenWithAal(aal:'aal1'|'aal2'){
  const header=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({aal,session_id:sessionId})).toString('base64url');
  return header+'.'+claims+'.test';
}
function response(status:number,body:unknown){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}
function resRecorder(){
  const headers=new Map<string,unknown>();
  return {
    statusCode:0,body:'',headers,
    setHeader(name:string,value:unknown){headers.set(name.toLowerCase(),value)},
    end(value=''){this.body=String(value)},
  };
}
function request(op:Operation,options:{
  aal?:'aal1'|'aal2';
  source?:'bearer'|'cookie'|'both';
  authorization?:string;
  origin?:string|null;
}={}){
  const source=options.source??'bearer';
  const token=tokenWithAal(options.aal??'aal2');
  const headers:Record<string,string>={host:'app.example'};
  if(source!=='cookie')headers.authorization=options.authorization??'Bearer '+token;
  if(source!=='bearer'){
    headers.cookie='rheomiq_access='+tokenWithAal('aal2');
    if(options.origin!==null)headers.origin=options.origin??'http://app.example';
  }
  if(op.method==='PUT'&&!op.resource)headers['if-match']='4';
  return {
    method:op.method,
    url:'/api/account-metadata',
    query:op.resource==='artwork-upload-intents'?{resource:op.resource,kind:'recurring',targetId:'qa-service'}:op.resource?{resource:op.resource}:{},
    headers,
    body:{accountId:'account-one',iban},
  };
}
function storeSpies(){
  return [
    metadata.readAccountMetadata,metadata.writeAccountMetadata,
    metadata.readFinancialProviders,metadata.readRecurringServiceAssets,metadata.readPendingArtworkUploadIntent,
    metadata.writeFinancialProvider,metadata.updateFinancialProvider,
    metadata.uploadFinancialProviderAsset,metadata.uploadRecurringServiceAsset,
    metadata.deleteRecurringServiceAsset,metadata.setFinancialProviderAssetBinding,
  ];
}
function assertNoMetadataAccess(){for(const fn of storeSpies())expect(fn).not.toHaveBeenCalled()}

describe('#649 I22.02 account metadata/provider/Storage endpoint owner+AAL2 boundary',()=>{
  const originalUrl=process.env.SUPABASE_URL;
  const originalKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  beforeEach(()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
    vi.stubEnv('NODE_ENV','test');
    owner.isOwner.mockReset().mockResolvedValue(true);
    devices.ensureDeviceSessionAccess.mockReset().mockResolvedValue({});
    for(const fn of storeSpies())fn.mockReset();
    metadata.readAccountMetadata.mockResolvedValue(records);
    metadata.readFinancialProviders.mockResolvedValue([{id:'owner-bank'}]);
    metadata.readRecurringServiceAssets.mockResolvedValue([]);
    metadata.readPendingArtworkUploadIntent.mockResolvedValue({intent:null});
    metadata.writeAccountMetadata.mockResolvedValue(records[0]);
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      if(url.endsWith('/auth/v1/user')){
        const authorization=new Headers(init?.headers).get('authorization')??'';
        return response(authorization.includes('rejected-token')?401:200,
          authorization.includes('rejected-token')?{message:'Invalid session'}:{id:'owner-id'});
      }
      if(url.endsWith('/rest/v1/rpc/myfinhub_app_lock_ticket'))return response(200,true);
      throw new Error('Unexpected upstream endpoint in account boundary test: '+url);
    }));
  });
  afterEach(()=>{
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY=originalKey;
  });

  it.each(operations)('blocks $label with an AAL1 owner bearer before any metadata or Storage call',async op=>{
    const req=request(op,{aal:'aal1'});
    const res=resRecorder();
    await handleAccountMetadataRequest(req,res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({code:'MFA_REQUIRED'});
    expect(devices.ensureDeviceSessionAccess).not.toHaveBeenCalled();
    assertNoMetadataAccess();
  });

  it.each(operations)('blocks non-owner AAL2 bearer $label without clearing unrelated cookies',async op=>{
    owner.isOwner.mockResolvedValue(false);
    const res=resRecorder();
    await handleAccountMetadataRequest(request(op),res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({code:'AUTH_REQUIRED'});
    expect(res.headers.has('set-cookie')).toBe(false);
    assertNoMetadataAccess();
  });

  it.each(operations)('blocks revoked AAL2 bearer $label before authorization and downstream mutation',async op=>{
    devices.ensureDeviceSessionAccess.mockRejectedValue(new ApiError(401,'DEVICE_ACCESS_REVOKED','Device session revoked.'));
    const res=resRecorder();
    await handleAccountMetadataRequest(request(op),res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({code:'DEVICE_ACCESS_REVOKED'});
    expect(res.headers.has('set-cookie')).toBe(false);
    expect(owner.isOwner).not.toHaveBeenCalled();
    assertNoMetadataAccess();
  });

  it.each(writes)('denies cross-site cookie $label before reaching metadata or Storage',async op=>{
    const res=resRecorder();
    await handleAccountMetadataRequest(request(op,{source:'cookie',origin:'http://evil.example'}),res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({code:'ORIGIN_MISMATCH'});
    assertNoMetadataAccess();
  });

  it.each(writes)('denies cookie $label when Origin and Fetch Metadata are missing',async op=>{
    const res=resRecorder();
    await handleAccountMetadataRequest(request(op,{source:'cookie',origin:null}),res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({code:'ORIGIN_REQUIRED'});
    assertNoMetadataAccess();
  });

  it.each([operations[0],operations[3],operations[8]])('rejects malformed explicit Authorization on $label without cookie fallback',async op=>{
    const req=request(op,{source:'both',authorization:'Basic invalid'});
    const res=resRecorder();
    await handleAccountMetadataRequest(req,res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({code:'AUTH_REQUIRED'});
    expect(res.headers.has('set-cookie')).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    assertNoMetadataAccess();
  });

  it.each([operations[0],operations[3],operations[8]])('does not fall back to a valid cookie after a rejected bearer on $label',async op=>{
    const req=request(op,{source:'both',authorization:'Bearer rejected-token'});
    const res=resRecorder();
    await handleAccountMetadataRequest(req,res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({code:'AUTH_REQUIRED'});
    expect(res.headers.has('set-cookie')).toBe(false);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(devices.ensureDeviceSessionAccess).not.toHaveBeenCalled();
    assertNoMetadataAccess();
  });

  it.each([operations[0],operations[3]])('requires the session-bound app-unlock ticket for $label',async op=>{
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.endsWith('/auth/v1/user'))return response(200,{id:'owner-id'});
      if(url.endsWith('/rest/v1/rpc/myfinhub_app_lock_ticket'))return response(200,false);
      throw new Error('Unexpected endpoint');
    }));
    const res=resRecorder();
    await handleAccountMetadataRequest(request(op),res);
    expect(res.statusCode).toBe(423);
    expect(JSON.parse(res.body)).toMatchObject({code:'APP_LOCK_REQUIRED'});
    expect(owner.isOwner).not.toHaveBeenCalled();
    assertNoMetadataAccess();
  });

  it('permits authorized recovery GET and forwards only the active session; denies mutation resource',async()=>{
    const op=operations[operations.length-1];
    const req=request(op);
    const res=resRecorder();
    await handleAccountMetadataRequest(req,res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({intent:null});
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(metadata.readPendingArtworkUploadIntent).toHaveBeenCalledWith(
      {kind:'recurring',targetId:'qa-service',role:'',variant:''},tokenWithAal('aal2'));
    const denied=resRecorder();
    await handleAccountMetadataRequest({...req,method:'PUT'},denied);
    expect(denied.statusCode).toBe(400);
    expect(metadata.readPendingArtworkUploadIntent).toHaveBeenCalledTimes(1);
  });

  it('permits owner AAL2 bearer read and revisioned write without browser Origin while forwarding only the owner token',async()=>{
    const token=tokenWithAal('aal2');
    const get=resRecorder();
    await handleAccountMetadataRequest(request(operations[0]),get);
    expect(get.statusCode).toBe(200);
    expect(JSON.parse(get.body)).toEqual({records});
    expect(metadata.readAccountMetadata).toHaveBeenCalledWith(token);
    expect(get.headers.has('access-control-allow-origin')).toBe(false);
    const put=resRecorder();
    await handleAccountMetadataRequest(request(operations[3]),put);
    expect(put.statusCode).toBe(200);
    expect(JSON.parse(put.body)).toEqual({record:records[0]});
    expect(metadata.writeAccountMetadata).toHaveBeenCalledWith('account-one',iban,4,token);
    expect(devices.ensureDeviceSessionAccess).toHaveBeenCalledWith(expect.anything(),token,'owner-id');
    expect(put.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('permits same-origin owner AAL2 cookie metadata mutation, but still requires an exact If-Match revision',async()=>{
    const res=resRecorder();
    await handleAccountMetadataRequest(request(operations[3],{source:'cookie'}),res);
    expect(res.statusCode).toBe(200);
    expect(metadata.writeAccountMetadata).toHaveBeenCalledWith('account-one',iban,4,tokenWithAal('aal2'));
    const missing=request(operations[3],{source:'cookie'});
    delete (missing.headers as Record<string,string>)['if-match'];
    const denied=resRecorder();
    await handleAccountMetadataRequest(missing,denied);
    expect(denied.statusCode).toBe(428);
    expect(JSON.parse(denied.body)).toMatchObject({code:'REVISION_REQUIRED'});
    expect(metadata.writeAccountMetadata).toHaveBeenCalledTimes(1);
  });
});
