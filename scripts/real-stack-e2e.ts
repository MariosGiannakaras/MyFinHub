import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';
import { createEvent } from '../src/lib/domain.js';
import { runRealStackBrowserProof } from './real-stack-browser-e2e.js';
import { realStackFinanceData } from './real-stack-fixture.js';
import { runDirectReceivableRpcProof } from './real-stack-receivable-rpc.js';
import { financeBackupVaultPrivacyRisk } from './real-stack-vault-privacy.js';

const SUPABASE_CLI_VERSION='2.119.0';
const APP_ORIGIN='http://127.0.0.1:4317';
const TEST_EMAIL_DOMAIN='example.com';
const TEST_PASSWORD='Local-Only-Real-Stack-9f7!';
const TEST_CARD_ID='qa-vault-card';
const TEST_PAN=['4242','4242','4242','4242'].join('');
const TEST_EXPIRY=['12','30'].join('/');
const TEST_CVV=['1','2','3'].join('');

type Json=Record<string,unknown>;
type ApiResult={status:number;body:any;headers:Headers};

function fail(message:string):never{throw new Error(message)}
function assert(condition:unknown,message:string):asserts condition{if(!condition)fail(message)}

function normalizedKey(value:string){return value.replace(/[^a-z0-9]/gi,'').toUpperCase()}
function statusValue(payload:unknown,candidates:string[]):string{
  const wanted=new Set(candidates.map(normalizedKey));
  let found='';
  const visit=(value:unknown)=>{
    if(found||!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value as Json)){
      if((typeof item==='string'||typeof item==='number')&&wanted.has(normalizedKey(key))){
        found=String(item).trim();
        if(found)return;
      }
      if(item&&typeof item==='object')visit(item);
      if(found)return;
    }
  };
  visit(payload);
  return found;
}

function readLocalSupabaseStatus(){
  const cli=process.env.MYFINHUB_QA_SUPABASE_CLI;
  if(process.env.CI==='true'&&!cli)fail('Verified local Supabase CLI was not installed.');
  const raw=execFileSync(cli||'npx',cli?['status','-o','json']:['--yes',`supabase@${SUPABASE_CLI_VERSION}`,'status','-o','json'],{
    encoding:'utf8',
    stdio:['ignore','pipe','pipe'],
  });
  const parsed=JSON.parse(raw) as unknown;
  const apiUrl=statusValue(parsed,['API_URL','api_url','url']);
  const publishable=statusValue(parsed,['PUBLISHABLE_KEY','ANON_KEY']);
  const serviceRole=statusValue(parsed,['SERVICE_ROLE_KEY','SECRET_KEY']);
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl),'Local Supabase API URL was not detected.');
  assert(publishable.length>20,'Local Supabase publishable/anon key was not detected.');
  assert(serviceRole.length>20,'Local Supabase service-role/secret key was not detected.');
  return {apiUrl:apiUrl.replace(/\/$/,''),publishable,serviceRole};
}

async function upstreamJson(url:string,serviceRole:string,init:RequestInit={}){
  const response=await fetch(url,{
    ...init,
    headers:{
      apikey:serviceRole,
      authorization:`Bearer ${serviceRole}`,
      accept:'application/json',
      ...(init.body?{'content-type':'application/json'}:{}),
      ...(init.headers||{}),
    },
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok)fail(`Local Supabase bootstrap failed: HTTP ${response.status}`);
  return body;
}

async function upstreamStorageList(apiUrl:string,serviceRole:string,prefix:string,bucket:'financial-provider-assets'|'recurring-service-assets'='financial-provider-assets'){
  const endpoint=bucket==='recurring-service-assets'?'/storage/v1/object/list/recurring-service-assets':'/storage/v1/object/list/financial-provider-assets';
  const response=await fetch(apiUrl+endpoint,{
    method:'POST',
    headers:{apikey:serviceRole,authorization:'Bearer '+serviceRole,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({prefix,limit:100,offset:0,sortBy:{column:'name',order:'asc'}}),
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok)fail('Local Supabase Storage list failed: HTTP '+response.status);
  assert(Array.isArray(body),'Local Supabase Storage list returned an invalid payload.');
  return body as Array<{name?:string}>;
}

function redactServerLog(value:string){
  return value
    .replace(/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,'[JWT_REDACTED]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[SUPABASE_KEY_REDACTED]')
    .slice(-6000);
}

async function waitForHealth(child:ChildProcessWithoutNullStreams){
  let output='';
  child.stdout.on('data',(chunk)=>{output+=String(chunk)});
  child.stderr.on('data',(chunk)=>{output+=String(chunk)});
  for(let attempt=0;attempt<120;attempt++){
    if(child.exitCode!==null)fail(`MyFinHub test server exited before readiness.\n${redactServerLog(output)}`);
    try{
      const response=await fetch(`${APP_ORIGIN}/api/health`);
      if(response.ok)return;
    }catch{}
    await sleep(250);
  }
  fail(`MyFinHub test server did not become ready.\n${redactServerLog(output)}`);
}

class CookieClient{
  private cookies=new Map<string,string>();
  constructor(readonly deviceName:string,seed?:Map<string,string>){
    if(seed)for(const [key,value] of seed)this.cookies.set(key,value);
  }
  snapshot(){return new Map(this.cookies)}
  private remember(headers:Headers){
    const list=typeof (headers as any).getSetCookie==='function'
      ? (headers as any).getSetCookie() as string[]
      : headers.get('set-cookie')?[headers.get('set-cookie') as string]:[];
    for(const item of list){
      const pair=item.split(';',1)[0]||'';
      const index=pair.indexOf('=');
      if(index<1)continue;
      const name=pair.slice(0,index).trim();
      const value=pair.slice(index+1).trim();
      if(/Max-Age=0/i.test(item)||!value)this.cookies.delete(name);
      else this.cookies.set(name,value);
    }
  }
  async request(path:string,options:{method?:string;body?:unknown;headers?:Record<string,string>}={}):Promise<ApiResult>{
    const method=(options.method||'GET').toUpperCase();
    const headers:Record<string,string>={
      origin:APP_ORIGIN,
      'sec-fetch-site':'same-origin',
      'user-agent':'MyFinHub-Real-Stack-QA/1.0',
      'x-myfinhub-client-platform':'web',
      'x-myfinhub-device-name':this.deviceName,
      'x-myfinhub-app-version':'real-stack-qa',
      ...(options.headers||{}),
    };
    if(this.cookies.size)headers.cookie=[...this.cookies].map(([key,value])=>`${key}=${value}`).join('; ');
    let body:string|undefined;
    if(options.body!==undefined){
      headers['content-type']='application/json';
      body=JSON.stringify(options.body);
    }
    const response=await fetch(`${APP_ORIGIN}${path}`,{method,headers,body,redirect:'manual'});
    this.remember(response.headers);
    const payload=await response.json().catch(()=>null);
    return {status:response.status,body:payload,headers:response.headers};
  }
  async requestBinary(path:string,options:{method?:string;body:Uint8Array;headers?:Record<string,string>}):Promise<ApiResult>{
    const method=(options.method||'PUT').toUpperCase();
    const headers:Record<string,string>={
      origin:APP_ORIGIN,
      'sec-fetch-site':'same-origin',
      'user-agent':'MyFinHub-Real-Stack-QA/1.0',
      'x-myfinhub-client-platform':'web',
      'x-myfinhub-device-name':this.deviceName,
      'x-myfinhub-app-version':'real-stack-qa',
      ...(options.headers||{}),
    };
    if(this.cookies.size)headers.cookie=[...this.cookies].map(([key,value])=>key+'='+value).join('; ');
    const response=await fetch(APP_ORIGIN+path,{method,headers,body:options.body as any,redirect:'manual'});
    this.remember(response.headers);
    const payload=await response.json().catch(()=>null);
    return {status:response.status,body:payload,headers:response.headers};
  }
}

function expect(result:ApiResult,status:number,code?:string,stage='request'){
  assert(result.status===status,`${stage}: expected HTTP ${status}, received ${result.status} (${String(result.body?.code||'no-code')}).`);
  if(code)assert(result.body?.code===code,`${stage}: expected ${code}, received ${String(result.body?.code||'no-code')}.`);
}

const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(secret:string){
  const clean=secret.toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits='';
  for(const char of clean){
    const index=BASE32.indexOf(char);
    assert(index>=0,'TOTP secret contains invalid Base32 data.');
    bits+=index.toString(2).padStart(5,'0');
  }
  const out:number[]=[];
  for(let i=0;i+8<=bits.length;i+=8)out.push(Number.parseInt(bits.slice(i,i+8),2));
  return Buffer.from(out);
}
function totp(secret:string,counter=Math.floor(Date.now()/30000)){
  const key=decodeBase32(secret);
  const buffer=Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest=createHmac('sha1',key).update(buffer).digest();
  const offset=digest[digest.length-1]&0x0f;
  const binary=((digest[offset]&0x7f)<<24)|((digest[offset+1]&0xff)<<16)|((digest[offset+2]&0xff)<<8)|(digest[offset+3]&0xff);
  return String(binary%1_000_000).padStart(6,'0');
}
async function nextTotp(secret:string,previous?:string){
  let code=totp(secret);
  if(previous&&code===previous){
    const waitMs=(30-(Math.floor(Date.now()/1000)%30)+1)*1000;
    await sleep(waitMs);
    code=totp(secret);
  }
  return code;
}

async function loginAndVerify(client:CookieClient,email:string,password:string,secret:string,previousCode?:string){
  const login=await client.request('/api/auth/login',{method:'POST',body:{email,password}});
  expect(login,200);
  assert(login.body?.mfaRequired===true,'Existing TOTP login did not require MFA.');
  let code=await nextTotp(secret,previousCode);
  let verified=await client.request('/api/auth/mfa/verify',{method:'POST',body:{code}});
  if(verified.status===401&&verified.body?.code==='INVALID_MFA_CODE'){
    code=await nextTotp(secret,code);
    verified=await client.request('/api/auth/mfa/verify',{method:'POST',body:{code}});
  }
  expect(verified,200);
  assert(verified.body?.authenticated===true,'Existing TOTP login did not reach AAL2.');
  expect(await client.request('/api/auth/session'),200);
  return code;
}

async function main(){
  const local=readLocalSupabaseStatus();
  const email=`myfinhub-real-stack-${Date.now()}-${randomBytes(4).toString('hex')}@${TEST_EMAIL_DOMAIN}`;
  const created=await upstreamJson(`${local.apiUrl}/auth/v1/admin/users`,local.serviceRole,{
    method:'POST',
    body:JSON.stringify({email,password:TEST_PASSWORD,email_confirm:true}),
  }) as {id?:string};
  const userId=String(created.id||'');
  assert(/^[0-9a-f-]{36}$/i.test(userId),'Synthetic local Auth user was not created.');

  await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_owner`,local.serviceRole,{
    method:'POST',
    headers:{prefer:'return=representation'},
    body:JSON.stringify({singleton:true,user_id:userId}),
  });

  const tsxBin=process.platform==='win32'?'node_modules/.bin/tsx.cmd':'node_modules/.bin/tsx';
  const server=spawn(tsxBin,['server/index.ts','--serve-dist'],{
    env:{
      ...process.env,
      RHEOMIQ_PORT:'4317',
      RHEOMIQ_HOST:'127.0.0.1',
      SUPABASE_URL:local.apiUrl,
      SUPABASE_PUBLISHABLE_KEY:local.publishable,
      CARD_VAULT_KEY:'a'.repeat(64),
      CARD_VAULT_KEY_VERSION:'1',
      MYFINHUB_APP_VERSION:'real-stack-qa',
    },
    stdio:['ignore','pipe','pipe'],
  });

  try{
    await waitForHealth(server);
    console.log('[real-stack] local Supabase + MyFinHub API ready');

    const primary=new CookieClient('QA Browser A');
    const guardedAssetPath='/api/account-metadata?'+new URLSearchParams({resource:'recurring-service-assets',recurringId:'security-negative',fileName:'negative.svg'});
    const guardedAsset=Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M0 0'/></svg>",'utf8');
    console.log('[real-stack] stage service-storage-unauthenticated-denial');
    expect(await primary.requestBinary(guardedAssetPath,{method:'PUT',headers:{'content-type':'image/svg+xml'},body:guardedAsset}),401,'AUTH_REQUIRED','recurring-service-owner-unauth');
    expect(await primary.request('/api/account-metadata?resource=recurring-service-assets'),401,'AUTH_REQUIRED','recurring-service-owner-read-unauth');
    const guardedVaultDelete={method:'DELETE' as const,body:{cardId:'security-negative-card',requireCommittedDeletion:true}};
    expect(await primary.request('/api/card-secrets',guardedVaultDelete),401,'AUTH_REQUIRED','card-secret-guard-unauth');
    console.log('[real-stack] stage auth-invalid-password');
    const invalid=await primary.request('/api/auth/login',{method:'POST',body:{email,password:'Definitely-Wrong-Password-9!'}});
    expect(invalid,401,'INVALID_CREDENTIALS','auth-invalid-password');

    console.log('[real-stack] stage auth-valid-password');
    const login=await primary.request('/api/auth/login',{method:'POST',body:{email,password:TEST_PASSWORD}});
    expect(login,200,undefined,'auth-valid-password');
    assert(login.body?.mfaEnrollmentRequired===true,'First login did not require TOTP enrollment.');

    console.log('[real-stack] stage mfa-enroll');
    const enrollment=await primary.request('/api/auth/mfa/enroll',{method:'POST',body:{}});
    expect(enrollment,200,undefined,'mfa-enroll');
    const secret=String(enrollment.body?.secret||'');
    const factorId=String(enrollment.body?.factorId||'');
    assert(secret.length>=16&&factorId.length>5,'TOTP enrollment did not return the local test factor.');

    const correct=totp(secret);
    const wrong=String((Number(correct)+1)%1_000_000).padStart(6,'0');
    console.log('[real-stack] stage mfa-invalid-code');
    expect(await primary.request('/api/auth/mfa/verify',{method:'POST',body:{factorId,code:wrong}}),401,'INVALID_MFA_CODE','mfa-invalid-code');
    console.log('[real-stack] stage service-storage-pre-aal2-denial');
    const preAal2Upload=await primary.requestBinary(guardedAssetPath,{method:'PUT',headers:{'content-type':'image/svg+xml'},body:guardedAsset});
    assert((preAal2Upload.status===401||preAal2Upload.status===403)&&['AUTH_REQUIRED','MFA_REQUIRED'].includes(String(preAal2Upload.body?.code||'')),'Recurring service asset upload accepted pre-AAL2 session.');
    const preAal2Read=await primary.request('/api/account-metadata?resource=recurring-service-assets');
    assert((preAal2Read.status===401||preAal2Read.status===403)&&['AUTH_REQUIRED','MFA_REQUIRED'].includes(String(preAal2Read.body?.code||'')),'Recurring service metadata read accepted pre-AAL2 session.');
    console.log('[real-stack] stage card-vault-pre-aal2-guarded-denial');
    const preAal2VaultDelete=await primary.request('/api/card-secrets',guardedVaultDelete);
    assert((preAal2VaultDelete.status===401||preAal2VaultDelete.status===403)&&['AUTH_REQUIRED','MFA_REQUIRED'].includes(String(preAal2VaultDelete.body?.code||'')),'Guarded card-vault deletion accepted a pre-AAL2 session.');
    console.log('[real-stack] stage mfa-valid-code');
    const verified=await primary.request('/api/auth/mfa/verify',{method:'POST',body:{factorId,code:correct}});
    expect(verified,200,undefined,'mfa-valid-code');
    assert(verified.body?.authenticated===true,'TOTP verification did not reach AAL2.');

    console.log('[real-stack] stage session-bootstrap');
    const session=await primary.request('/api/auth/session');
    expect(session,200,undefined,'session-bootstrap');
    assert(session.body?.authenticated===true,'AAL2 session bootstrap failed.');

    const restored=new CookieClient('QA Browser A Restored',primary.snapshot());
    console.log('[real-stack] stage session-restore');
    const restoredSession=await restored.request('/api/auth/session');
    expect(restoredSession,200,undefined,'session-restore');
    assert(restoredSession.body?.authenticated===true,'Cookie session restoration failed.');

    const fixture=realStackFinanceData();
    validateCompleteFinanceData(fixture);
    console.log('[real-stack] stage import');
    const imported=await primary.request('/api/import',{
      method:'POST',
      headers:{'x-rheomiq-confirm-import':'replace'},
      body:fixture,
    });
    expect(imported,200,undefined,'import');
    assert(String(imported.body?.revision||'')==='1','Initial local import did not create revision 1.');

    console.log('[real-stack] stage data-read');
    const importRead=await primary.request('/api/data');
    expect(importRead,200,undefined,'data-read');
    assert(importRead.body?.data?.schemaVersion===3,'Real API read did not return canonical FinanceData.');
    // Distinct from the browser's early preview denial: the real API must
    // still reject malformed payloads on its own, with finance untouched.
    console.log('[real-stack] stage invalid-import-authoritative-validation');
    const invalidApiImport=await primary.request('/api/import',{
      method:'POST',
      headers:{'x-rheomiq-confirm-import':'replace','if-match':String(importRead.body?.revision||'')},
      body:{app:'RheomIQ',schemaVersion:3},
    });
    expect(invalidApiImport,400,'INVALID_DATA','invalid-import-authoritative-validation');
    const afterInvalidApiImport=await primary.request('/api/data');
    expect(afterInvalidApiImport,200,undefined,'invalid-import-finance-unchanged');
    assert(afterInvalidApiImport.body?.revision===importRead.body?.revision
      &&JSON.stringify(afterInvalidApiImport.body?.data)===JSON.stringify(importRead.body?.data),
      'Authoritatively rejected import mutated confirmed finance.');
    // Create a real reachable Redo before capturing the immutable direct-RPC
    // baseline. Do not advance revision/generation inside a denial callback.
    console.log('[real-stack] stage owner-aal2-history-redo-fixture');
    const importedHistory=await primary.request('/api/history');
    expect(importedHistory,200,undefined,'owner-aal2-fixture-before-history');
    const fixtureRevision=String(importRead.body?.revision||'');
    const fixtureGeneration=String(importedHistory.body?.generation||'');
    assert(/^\d+$/.test(fixtureRevision)&&/^\d+$/.test(fixtureGeneration)&&
      String(importedHistory.body?.financeRevision)===fixtureRevision,
      'History fixture requires matching current revision and generation.');
    const fixtureState=structuredClone(importRead.body.data.state);
    fixtureState.settings={...fixtureState.settings,accountNames:{...fixtureState.settings.accountNames,
      'qa-cash':'Synthetic reachable history probe'}};
    assert(JSON.stringify(fixtureState)!==JSON.stringify(importRead.body.data.state),
      'History fixture requires a non-noop owner save.');
    validateCompleteFinanceData({...importRead.body.data,state:fixtureState});
    const fixtureSave=await primary.request('/api/data',{
      method:'PUT',headers:{'if-match':fixtureRevision,'x-rheomiq-history-generation':fixtureGeneration},
      body:{state:fixtureState,updatedAt:new Date().toISOString(),historyLabel:'Synthetic reachable history probe'},
    });
    expect(fixtureSave,200,undefined,'owner-aal2-fixture-save');
    assert(Number(fixtureSave.body?.revision)>Number(fixtureRevision),
      'History fixture save did not advance revision.');
    const fixtureUndo=await primary.request('/api/history',{
      method:'POST',headers:{'if-match':String(fixtureSave.body?.revision||''),
        'x-rheomiq-history-generation':String(fixtureSave.body?.history?.generation||'')},
      body:{action:'undo',updatedAt:new Date().toISOString()},
    });
    expect(fixtureUndo,200,undefined,'owner-aal2-fixture-undo');
    const initial=await primary.request('/api/data');
    expect(initial,200,undefined,'owner-aal2-fixture-restored-data');
    assert(Number(initial.body?.revision)>Number(fixtureSave.body?.revision)&&
      JSON.stringify(initial.body?.data?.state)===JSON.stringify(importRead.body?.data?.state),
      'History fixture Undo did not restore original canonical finance state.');
    const initialRevision=String(initial.body?.revision||'');
    console.log('[real-stack] stage history-read');
    const history=await primary.request('/api/history');
    expect(history,200,undefined,'history-read');
    const initialGeneration=String(history.body?.generation||'');
    assert(/^\d+$/.test(initialRevision)&&/^\d+$/.test(initialGeneration)&&
      String(history.body?.financeRevision)===initialRevision&&history.body?.canRedo===true,
      'Direct RPC baseline requires current revision/generation and reachable Redo.');
    console.log('[real-stack] PASS owner-aal2-history-redo-fixture');
    console.log('[real-stack] stage card-vault-write');
    const vaultSaved=await primary.request('/api/card-secrets',{
      method:'PUT',
      body:{cardId:TEST_CARD_ID,pan:TEST_PAN,expiry:TEST_EXPIRY,cvv:TEST_CVV},
    });
    expect(vaultSaved,200,undefined,'card-vault-write');
    assert(vaultSaved.body?.last4==='4242','Card vault write did not return the synthetic last4.');

    console.log('[real-stack] stage card-vault-read');
    const vaultRead=await primary.request('/api/card-secrets',{method:'POST',body:{cardId:TEST_CARD_ID}});
    expect(vaultRead,200,undefined,'card-vault-read');
    assert(vaultRead.body?.pan===TEST_PAN&&vaultRead.body?.expiry===TEST_EXPIRY&&vaultRead.body?.cvv===TEST_CVV,'Card vault round-trip did not preserve the synthetic secret.');

    console.log('[real-stack] stage direct owner/AAL2 PostgREST receivable guard');
    const directRpcSessions=await runDirectReceivableRpcProof({
      apiUrl:local.apiUrl,publishable:local.publishable,serviceRole:local.serviceRole,
      email,password:TEST_PASSWORD,userId,factorId,
      totpCode:()=>nextTotp(secret,correct),
      totpCodeForSecret:(factorSecret,previousCode)=>nextTotp(factorSecret,previousCode),
      data:initial.body.data,revision:initialRevision,generation:initialGeneration,
      proveHttpDenial:async(identity,accessToken)=>{
        console.log('[real-stack] stage finance-http-owner-aal2-denial '+identity);
        // Both genuine non-authorized identities accompany an independently
        // valid owner cookie. The owner AAL1 token must fail MFA; a nonowner
        // AAL2 device is invisible to the owner-only device registry and
        // cannot register through its RLS boundary.
        const beforeData=await primary.request('/api/data');
        const beforeHistory=await primary.request('/api/history');
        expect(beforeData,200,undefined,'owner-aal2-before-data');
        expect(beforeHistory,200,undefined,'owner-aal2-before-history');
        const revision=String(beforeData.body?.revision||'');
        const generation=String(beforeHistory.body?.generation||'');
        assert(/^\d+$/.test(revision)&&/^\d+$/.test(generation)&&
          String(beforeHistory.body?.financeRevision)===revision&&beforeHistory.body?.canRedo===true,
          'HTTP owner/AAL2 proof requires a current finance revision, history generation and reachable Redo.');
        const snapshotEffects=async()=>({
          backups:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_backups?select=id,reason,revision&order=id.desc&limit=1',local.serviceRole),
          audit:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_audit_log?select=id&order=id.desc&limit=1',local.serviceRole),
          state:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_app_state?id=eq.primary&select=revision,updated_at',local.serviceRole),
        });
        const beforeDb=await snapshotEffects();
        const state=structuredClone(beforeData.body.data.state);
        state.settings={...state.settings,accountNames:{...state.settings.accountNames,
          'qa-cash':'Unauthorized identity must not save'}};
        const updatedAt=new Date().toISOString();
        const importData={...beforeData.body.data,state,updatedAt};
        validateCompleteFinanceData(importData);
        assert(JSON.stringify(state)!==JSON.stringify(beforeData.body.data.state),
          'HTTP owner/AAL2 proof requires a non-noop finance mutation.');
        const headers={authorization:'Bearer '+accessToken,
          'if-match':revision,'x-rheomiq-history-generation':generation};
        const cookies=JSON.stringify([...primary.snapshot()]);
        for(const [path,options,label] of [
          ['/api/data',{headers},'data-get'],
          ['/api/data',{method:'PUT',headers,body:{state,updatedAt,historyLabel:'Unauthorized identity'}},'data-put'],
          ['/api/history',{headers},'history-get'],
          ['/api/history',{method:'POST',headers,body:{action:'redo',updatedAt}},'history-redo'],
          ['/api/backup',{method:'POST',headers,body:{}},'backup-post'],
          ['/api/import',{method:'POST',headers:{...headers,'x-rheomiq-confirm-import':'replace'},body:importData},'import-post'],
        ] as const){
          const denied=await primary.request(path,options);
          expect(denied,identity==='owner-aal1'?403:401,
            identity==='owner-aal1'?'MFA_REQUIRED':'DEVICE_ACCESS_REVOKED',identity+'-'+label);
          assert(JSON.stringify([...primary.snapshot()])===cookies,
            'Unauthorized bearer changed independent owner cookies: '+identity+'-'+label);
        }
        const afterData=await primary.request('/api/data');
        const afterHistory=await primary.request('/api/history');
        expect(afterData,200,undefined,'owner-aal2-after-data');
        expect(afterHistory,200,undefined,'owner-aal2-after-history');
        assert(afterData.body?.revision===beforeData.body?.revision&&
          JSON.stringify(afterData.body?.data)===JSON.stringify(beforeData.body?.data),
          'Unauthorized bearer changed canonical finance or revision: '+identity);
        assert(JSON.stringify(afterHistory.body)===JSON.stringify(beforeHistory.body),
          'Unauthorized bearer changed canonical history: '+identity);
        assert(JSON.stringify(await snapshotEffects())===JSON.stringify(beforeDb),
          'Unauthorized bearer changed database state, backup or audit rows: '+identity);
        expect(await primary.request('/api/auth/session'),200,undefined,'owner-aal2-cookie-preserved');
        console.log('[real-stack] PASS finance-http-owner-aal2-denial '+identity);
      },
      proveAssetHttpDenial:async(identity,accessToken,assetFixture)=>{
        console.log('[real-stack] stage metadata-vault-http-owner-aal2-denial '+identity);
        const metadataPath='/api/account-metadata';
        const providerPath=metadataPath+'?resource=financial-providers';
        const recurringPath=metadataPath+'?resource=recurring-service-assets';
        const vaultPath='/api/card-secrets';
        const readVault=()=>primary.request(vaultPath,{method:'POST',body:{cardId:TEST_CARD_ID}});
        const readCatalogs=async()=>{
          const results=await Promise.all([primary.request(metadataPath),primary.request(providerPath),primary.request(recurringPath)]);
          for(const result of results)expect(result,200,undefined,'asset-http-positive-catalog');
          return {metadata:results[0].body,providers:results[1].body,recurring:results[2].body};
        };

        // A real pending upload must be visible and resolvable by the active
        // owner. A nonexistent intent would not prove a denial prevents a
        // terminal mutation when an ambient owner cookie is also present.
        const journalTarget='qa-auth-intent-'+identity;
        const journalId=randomUUID();
        const journalPath=metadataPath+'?'+new URLSearchParams({
          resource:'artwork-upload-intents',kind:'recurring',targetId:journalTarget,
        });
        const journalUpload=await primary.requestBinary(metadataPath+'?'+new URLSearchParams({
          resource:'recurring-service-assets',recurringId:journalTarget,fileName:'auth-intent.svg',intentId:journalId,
        }),{method:'PUT',headers:{'content-type':'image/svg+xml'},body:guardedAsset});
        expect(journalUpload,200,undefined,'asset-http-positive-intent-upload');
        const journalKey=String(journalUpload.body?.asset?.assetKey||'');
        assert(/^service-asset-[a-f0-9]{24}$/.test(journalKey)&&journalUpload.body?.intentId===journalId,
          'HTTP journal proof requires a real explicit upload receipt.');
        const journalBefore=await primary.request(journalPath);
        expect(journalBefore,200,undefined,'asset-http-positive-intent-read');
        assert(journalBefore.body?.intent?.intentId===journalId&&journalBefore.body.intent.assetKey===journalKey&&
          journalBefore.body.intent.registrationRecorded===true&&journalBefore.body.intent.asset?.assetKey===journalKey,
          'HTTP journal proof requires a pending registered asset with verified bytes.');
        const journalResolution={intentId:journalId,assetKey:journalKey,action:'acknowledge'};
        const before=await readCatalogs();
        const record=before.metadata?.records?.find((row:any)=>row.accountId===assetFixture.accountId);
        const provider=before.providers?.providers?.find((row:any)=>row.id===assetFixture.providerId);
        const recurring=before.recurring?.assets?.find((row:any)=>row.assetKey===assetFixture.recurringAssetKey);
        assert(record?.iban&&record.revision===1&&provider?.assets?.some((row:any)=>row.assetKey===assetFixture.providerAssetKey)&&
          provider.bindings?.some((row:any)=>row.role==='card-mark'&&row.variant==='dark'&&row.assetKey===assetFixture.providerAssetKey)&&recurring?.recurringId,
          'HTTP metadata negatives require populated, versioned owner fixtures and real artwork bindings.');
        const vaultBefore=await readVault();
        expect(vaultBefore,200,undefined,'asset-http-positive-vault');
        assert(vaultBefore.body?.pan===TEST_PAN&&vaultBefore.body?.expiry===TEST_EXPIRY&&vaultBefore.body?.cvv===TEST_CVV,
          'HTTP Card Vault negatives require a real readable encrypted fixture.');
        const snapshotRows=async()=>({
          metadata:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_account_metadata?select=*&order=account_id.asc',local.serviceRole),
          providers:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_providers?select=*&order=id.asc',local.serviceRole),
          artwork:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_assets?select=*&order=asset_key.asc',local.serviceRole),
          bindings:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?select=*&order=provider_id.asc,asset_role.asc,variant.asc',local.serviceRole),
          recurring:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_recurring_service_assets?select=*&order=asset_key.asc',local.serviceRole),
          intents:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_artwork_upload_intents?select=*&order=intent_id.asc',local.serviceRole),
          vault:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_card_secrets?select=*&card_id=eq.'+TEST_CARD_ID,local.serviceRole),
          providerObjects:await upstreamStorageList(local.apiUrl,local.serviceRole,'providers/'+assetFixture.providerId),
          recurringObjects:await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets'),
        });
        const rowsBefore=await snapshotRows();
        assert(Array.isArray(rowsBefore.vault)&&rowsBefore.vault.length===1,'HTTP Card Vault proof missing encrypted database row.');
        const headers={authorization:'Bearer '+accessToken};
        const cookies=JSON.stringify([...primary.snapshot()]);
        const reject=(result:ApiResult,label:string)=>{
          expect(result,identity==='owner-aal1'?403:401,
            identity==='owner-aal1'?'MFA_REQUIRED':'DEVICE_ACCESS_REVOKED',identity+'-'+label);
          assert(JSON.stringify([...primary.snapshot()])===cookies,
            'Unauthorized metadata bearer changed independent owner cookies: '+identity+'-'+label);
        };
        const providerWrite={id:provider.id,displayName:'Unauthorized metadata edit',shortName:provider.shortName,
          providerKind:provider.providerKind,countryCode:provider.countryCode,sortOrder:provider.sortOrder};
        for(const [path,options,label] of [
          [metadataPath,{headers},'iban-read'],
          [metadataPath,{method:'PUT',headers:{...headers,'if-match':String(record.revision)},body:{accountId:record.accountId,iban:null}},'iban-clear'],
          [providerPath,{headers},'provider-catalog-read'],
          [providerPath,{method:'POST',headers,body:{...providerWrite,id:'qa-denied-http-provider'}},'provider-create'],
          [providerPath,{method:'PATCH',headers,body:providerWrite},'provider-update'],
          [metadataPath+'?resource=financial-provider-asset-binding',{method:'PUT',headers,body:{providerId:provider.id,role:'card-mark',variant:'dark',assetKey:null}},'provider-unbind'],
          [recurringPath,{headers},'recurring-catalog-read'],
          [journalPath,{headers},'artwork-intent-read'],
          [journalPath,{method:'PATCH',headers,body:journalResolution},'artwork-intent-acknowledge'],
          [recurringPath+'&assetKey='+encodeURIComponent(assetFixture.recurringAssetKey),{method:'DELETE',headers},'recurring-release'],
          [vaultPath,{method:'POST',headers,body:{cardId:TEST_CARD_ID}},'vault-read'],
          [vaultPath,{method:'PUT',headers,body:{cardId:TEST_CARD_ID,cvv:'321'}},'vault-write'],
          [vaultPath,{method:'DELETE',headers,body:{cardId:TEST_CARD_ID}},'vault-delete'],
        ] as const)reject(await primary.request(path,options),label);
        const binaryHeaders={...headers,'content-type':'image/svg+xml'};
        reject(await primary.requestBinary(metadataPath+'?'+new URLSearchParams({
          resource:'financial-provider-assets',providerId:provider.id,role:'logo',variant:'universal',primary:'0',fileName:'denied.svg',
        }),{method:'PUT',headers:binaryHeaders,body:guardedAsset}),'provider-upload');
        reject(await primary.requestBinary(recurringPath+'&'+new URLSearchParams({
          recurringId:recurring.recurringId,fileName:'denied.svg',
        }),{method:'PUT',headers:binaryHeaders,body:guardedAsset}),'recurring-upload');
        assert(JSON.stringify(await readCatalogs())===JSON.stringify(before),
          'Unauthorized HTTP request changed owner-visible metadata catalog: '+identity);
        const vaultAfter=await readVault();
        expect(vaultAfter,200,undefined,'asset-http-vault-preserved');
        assert(JSON.stringify(vaultAfter.body)===JSON.stringify(vaultBefore.body),
          'Unauthorized HTTP request changed readable Card Vault fixture: '+identity);
        assert(JSON.stringify(await snapshotRows())===JSON.stringify(rowsBefore),
          'Unauthorized HTTP request changed metadata, artwork journal, encrypted vault rows or Storage object inventory: '+identity);
        const journalAfter=await primary.request(journalPath);
        expect(journalAfter,200,undefined,'asset-http-intent-preserved');
        assert(JSON.stringify(journalAfter.body)===JSON.stringify(journalBefore.body),
          'Unauthorized HTTP request changed the owner-visible pending artwork receipt: '+identity);
        expect(await primary.request('/api/auth/session'),200,undefined,'asset-http-cookie-preserved');
        // Prove the same exact resolution was valid (not rejected by an
        // unrelated precondition) and release only this unreferenced fixture.
        const journalAck=await primary.request(journalPath,{method:'PATCH',body:journalResolution});
        expect(journalAck,200,undefined,'asset-http-owner-intent-acknowledgement');
        assert(journalAck.body?.intentId===journalId&&journalAck.body?.assetKey===journalKey&&
          journalAck.body?.disposition==='acknowledged','Authorized exact journal resolution was not committed.');
        const journalResolved=await primary.request(journalPath);
        expect(journalResolved,200,undefined,'asset-http-owner-intent-terminal-read');
        assert(journalResolved.body?.intent===null,'Authorized journal resolution left a pending target.');
        expect(await primary.request(recurringPath+'&assetKey='+encodeURIComponent(journalKey),{method:'DELETE'}),
          200,undefined,'asset-http-owner-intent-fixture-release');
        const journalRows=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_artwork_upload_intents?intent_id=eq.'+
          encodeURIComponent(journalId)+'&select=intent_id,asset_key,disposition',local.serviceRole) as any[];
        assert(journalRows.length===1&&journalRows[0]?.intent_id===journalId&&journalRows[0]?.asset_key===journalKey&&
          journalRows[0]?.disposition==='acknowledged','Fixture release must preserve its terminal journal tombstone.');
        console.log('[real-stack] PASS artwork-intent-http-owner-aal2-denial '+identity);
        console.log('[real-stack] PASS metadata-vault-http-owner-aal2-denial '+identity);
      },
    });
    const directFinanceAfter=await primary.request('/api/data');
    const directHistoryAfter=await primary.request('/api/history');
    expect(directFinanceAfter,200,undefined,'direct-finance-rpc-owner-readback');
    expect(directHistoryAfter,200,undefined,'direct-history-rpc-owner-readback');
    assert(directFinanceAfter.body?.revision===initial.body?.revision&&
      JSON.stringify(directFinanceAfter.body?.data)===JSON.stringify(initial.body?.data)&&
      JSON.stringify(directHistoryAfter.body)===JSON.stringify(history.body),
      'Direct RPC authorization proof changed owner-visible finance or durable history.');
    console.log('[real-stack] PASS direct-finance-rpc-independent-owner-readback');
    // The direct proof uses a separate synthetic Auth session. Retire only its
    // session IDs through the existing owner+AAL2 API so the subsequent
    // two-device lifecycle test retains its original strict count.
    for(const sessionId of directRpcSessions){
      const retired=await primary.request('/api/auth/devices',{
        method:'POST',body:{action:'revoke',sessionId},
      });
      expect(retired,200,undefined,'direct-rpc-synthetic-device-retirement');
    }
    const afterDirectDevices=await primary.request('/api/auth/devices');
    expect(afterDirectDevices,200,undefined,'direct-rpc-synthetic-device-count');
    assert(afterDirectDevices.body?.count===1&&afterDirectDevices.body?.devices?.[0]?.current===true,
      'Direct RPC proof left synthetic test sessions active.');
    console.log('[real-stack] PASS direct PostgREST denied AAL1/overpayment/forgery without finance or history commit');

    const staleState=structuredClone(initial.body.data.state);
    const nextState=structuredClone(initial.body.data.state);
    nextState.settings={
      ...nextState.settings,
      accountNames:{...(nextState.settings?.accountNames||{}),'qa-cash':'Local Real Stack QA'},
    };
    // A non-cash writeoff must survive the real revisioned RPC, relational
    // transaction table, API reload, Undo and Redo without touching cash.
    const writeoff=createEvent({
      kind:'lending_writeoff',date:'2026-10-04',person:'Synthetic QA Receivable',
      amount:2.5,note:'Synthetic noncash settlement, not a cash movement',
    });
    nextState.events=[...(nextState.events??[]),writeoff];
    validateCompleteFinanceData({...initial.body.data,state:nextState});
    console.log('[real-stack] stage mutable-save');
    const saved=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':initialRevision,'x-rheomiq-history-generation':initialGeneration},
      body:{state:nextState,updatedAt:new Date().toISOString(),historyLabel:'Real-stack persistence probe'},
    });
    expect(saved,200,undefined,'mutable-save');
    assert(Number(saved.body?.revision)>Number(initialRevision),'Mutable save did not advance the revision.');

    staleState.settings={
      ...staleState.settings,
      accountNames:{...(staleState.settings?.accountNames||{}),'qa-cash':'Stale writer must lose'},
    };
    console.log('[real-stack] stage revision-conflict');
    const conflict=await restored.request('/api/data',{
      method:'PUT',
      headers:{'if-match':initialRevision,'x-rheomiq-history-generation':initialGeneration},
      body:{state:staleState,updatedAt:new Date().toISOString(),historyLabel:'Stale real-stack writer'},
    });
    assert(conflict.status===409&&['REVISION_CONFLICT','HISTORY_CURSOR_CONFLICT'].includes(String(conflict.body?.code||'')),'Stale real-stack mutation did not fail closed.');

    console.log('[real-stack] stage reload-read');
    const persisted=await restored.request('/api/data');
    expect(persisted,200,undefined,'reload-read');
    assert(persisted.body?.data?.state?.settings?.accountNames?.['qa-cash']==='Local Real Stack QA','Saved state was not durable after a restored-session reload.');
    assert(persisted.body?.data?.state?.events?.some((event:any)=>event.id===writeoff.id&&
      event.kind==='lending_writeoff'&&event.receivableDelta===-2.5&&event.legs.length===0),
      'Noncash writeoff did not round-trip through revisioned API and relational finance storage.');
    const savedGeneration=String(saved.body?.history?.generation||'');
    assert(/^\d+$/.test(savedGeneration),'Mutable save did not return a history generation.');
    console.log('[real-stack] stage history-undo');
    const undone=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(saved.body?.revision||''),'x-rheomiq-history-generation':savedGeneration},
      body:{action:'undo',updatedAt:new Date().toISOString()},
    });
    expect(undone,200,undefined,'history-undo');
    assert(undone.body?.data?.state?.settings?.accountNames?.['qa-cash']!=='Local Real Stack QA','Undo did not restore the previous finance state.');
    assert(!(undone.body?.data?.state?.events??[]).some((event:any)=>event.id===writeoff.id),
      'Finance Undo did not reverse the noncash writeoff in the same revision.');

    console.log('[real-stack] stage history-redo');
    const redone=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(undone.body?.revision||''),'x-rheomiq-history-generation':String(undone.body?.history?.generation||'')},
      body:{action:'redo',updatedAt:new Date().toISOString()},
    });
    expect(redone,200,undefined,'history-redo');
    assert(redone.body?.data?.state?.settings?.accountNames?.['qa-cash']==='Local Real Stack QA','Redo did not restore the saved finance state.');
    assert((redone.body?.data?.state?.events??[]).some((event:any)=>event.id===writeoff.id&&event.receivableDelta===-2.5),
      'Finance Redo did not restore the exact noncash writeoff.');

    console.log('[real-stack] stage backup');
    const backup=await primary.request('/api/backup',{method:'POST',body:{}});
    expect(backup,200,undefined,'backup');
    assert(/^supabase:\/\/rheomiq_backups\/\d+$/.test(String(backup.body?.path||'')),'Backup did not persist through the real RPC boundary.');

    console.log('[real-stack] stage direct-db-read');
    const stateRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_app_state?id=eq.primary&select=revision,finance_storage_mode,updated_at`,local.serviceRole) as any[];
    assert(Array.isArray(stateRows)&&stateRows.length===1,'Direct database read-back did not find the canonical state row.');
    assert(String(stateRows[0]?.revision)===String(redone.body?.revision),'API revision and persisted database revision disagree.');
    assert(stateRows[0]?.finance_storage_mode==='relational_v1','Relational finance storage mode is not active.');

    const backupId=String(backup.body?.path||'').split('/').pop()||'';
    const backupRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_backups?id=eq.${encodeURIComponent(backupId)}&select=id,reason,revision,data&limit=1`,local.serviceRole) as any[];
    assert(Array.isArray(backupRows)&&backupRows.length===1,'Direct database read-back did not find the real backup row.');
    const backupData=backupRows[0]?.data;
    validateCompleteFinanceData(backupData);
    // A three-digit CVV can appear coincidentally in legitimate amounts,
    // timestamps and opaque IDs. Reject real vault fields and long synthetic
    // secrets, not an unrelated substring like "123" in finance JSON.
    const vaultPrivacyRisk=financeBackupVaultPrivacyRisk(backupData,TEST_PAN,TEST_EXPIRY);
    assert(vaultPrivacyRisk===null,
      'Backup unexpectedly contains card-vault plaintext ('+vaultPrivacyRisk+').');

    console.log('[real-stack] stage post-backup-mutation');
    const postBackupHistory=await primary.request('/api/history');
    expect(postBackupHistory,200,undefined,'post-backup-history');
    const postBackupState=structuredClone(redone.body.data.state);
    postBackupState.settings={
      ...postBackupState.settings,
      accountNames:{...(postBackupState.settings?.accountNames||{}),'qa-cash':'Post-backup mutation'},
    };
    const postBackupSave=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(redone.body?.revision||''),'x-rheomiq-history-generation':String(postBackupHistory.body?.generation||'')},
      body:{state:postBackupState,updatedAt:new Date().toISOString(),historyLabel:'Post-backup mutation'},
    });
    expect(postBackupSave,200,undefined,'post-backup-mutation');

    // Exercise the revision-checked RPC through the real API + owner/AAL2 RLS
    // on disposable local Supabase, not a mocked 409 or production storage.
    console.log('[real-stack] stage import-stale-revision-denial');
    const priorImportData=await primary.request('/api/data');
    expect(priorImportData,200,undefined,'import-stale-prior-finance');
    const priorImportHistory=await primary.request('/api/history');
    expect(priorImportHistory,200,undefined,'import-stale-prior-history');
    const priorImportBackups=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_backups?select=id&order=id.desc&limit=1`,local.serviceRole) as any[];
    const priorImportAudit=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_audit_log?select=id&order=id.desc&limit=1`,local.serviceRole) as any[];
    const staleChecked=await restored.request('/api/import',{
      method:'POST',
      headers:{'x-rheomiq-confirm-import':'replace','if-match':String(redone.body?.revision||'')},
      body:backupData,
    });
    expect(staleChecked,409,'REVISION_CONFLICT','import-stale-revision');
    const malformedChecked=await restored.request('/api/import',{
      method:'POST',
      headers:{'x-rheomiq-confirm-import':'replace','if-match':'not-a-revision'},
      body:backupData,
    });
    expect(malformedChecked,400,'INVALID_REVISION','import-malformed-revision');
    const afterStaleData=await primary.request('/api/data');
    expect(afterStaleData,200,undefined,'import-stale-no-write');
    const afterStaleHistory=await primary.request('/api/history');
    expect(afterStaleHistory,200,undefined,'import-stale-history-unchanged');
    const afterStaleBackups=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_backups?select=id&order=id.desc&limit=1`,local.serviceRole) as any[];
    const afterStaleAudit=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_audit_log?select=id&order=id.desc&limit=1`,local.serviceRole) as any[];
    assert(afterStaleData.body?.revision===priorImportData.body?.revision
      &&afterStaleData.body?.data?.state?.settings?.accountNames?.['qa-cash']==='Post-backup mutation',
      'Stale checked import replaced confirmed finance or advanced its revision.');
    assert(afterStaleHistory.body?.generation===priorImportHistory.body?.generation
      &&afterStaleHistory.body?.currentPointId===priorImportHistory.body?.currentPointId,
      'Stale checked import moved the history cursor.');
    assert(JSON.stringify(afterStaleBackups)===JSON.stringify(priorImportBackups)
      &&JSON.stringify(afterStaleAudit)===JSON.stringify(priorImportAudit),
      'Stale checked import changed pre-import backup or audit history.');
    console.log('[real-stack] stage backup-restore revision-checked');
    const restoredFromBackup=await primary.request('/api/import',{
      method:'POST',
      headers:{'x-rheomiq-confirm-import':'replace','if-match':String(postBackupSave.body?.revision||'')},
      body:backupData,
    });
    expect(restoredFromBackup,200,undefined,'backup-restore');
    assert(Number(restoredFromBackup.body?.revision)>Number(postBackupSave.body?.revision),'Backup restore did not advance the canonical revision.');
    const preImportBackupRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_backups?reason=eq.pre-import&order=id.desc&limit=1&select=reason,revision`,local.serviceRole) as any[];
    assert(Array.isArray(preImportBackupRows)&&preImportBackupRows.length===1
      &&String(preImportBackupRows[0]?.revision)===String(postBackupSave.body?.revision),
      'Successful checked import did not atomically back up the prior confirmed revision.');

    const recovered=await primary.request('/api/data');
    expect(recovered,200,undefined,'backup-restore-read');
    assert(recovered.body?.data?.state?.settings?.accountNames?.['qa-cash']==='Local Real Stack QA','Backup restore did not recover the backed-up finance state.');

    const recoveredHistory=await primary.request('/api/history');
    expect(recoveredHistory,200,undefined,'backup-restore-history');
    assert(String(recoveredHistory.body?.financeRevision||'')===String(recovered.body?.revision||''),'Recovered history cursor does not match the finance revision.');
    assert(recoveredHistory.body?.points?.some((point:any)=>point.current===true&&point.label==='Εισαγωγή δεδομένων'),'Recovered history does not expose the import recovery point.');

    // The imported seed and state must never be partially reverted by Undo.
    assert(recoveredHistory.body?.undoDepth===0&&recoveredHistory.body?.canUndo===false,
      'Import history still advertises unsafe state-only Undo.');
    const refusedImportUndo=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(recovered.body.revision),'x-rheomiq-history-generation':String(recoveredHistory.body.generation)},
      body:{action:'undo',updatedAt:new Date().toISOString()},
    });
    expect(refusedImportUndo,409,'HISTORY_IRREVERSIBLE_BOUNDARY','import-history-boundary');
    const afterRefusedImport=await primary.request('/api/data');
    expect(afterRefusedImport,200,undefined,'import-history-boundary-reload');
    assert(afterRefusedImport.body.revision===recovered.body.revision&&
      afterRefusedImport.body.data.seed.sourceName===recovered.body.data.seed.sourceName,
      'Rejected import Undo changed the saved revision or imported seed.');

    const auditRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_audit_log?select=action,revision&order=id.desc&limit=12`,local.serviceRole) as any[];
    const auditActions=new Set(Array.isArray(auditRows)?auditRows.map(row=>String(row?.action||'')):[]);
    assert(auditActions.has('backup')&&auditActions.has('import')&&auditActions.has('undo')&&auditActions.has('redo'),'Recovery audit trail is missing expected actions.');

    const vaultAfterRestore=await primary.request('/api/card-secrets',{method:'POST',body:{cardId:TEST_CARD_ID}});
    expect(vaultAfterRestore,200,undefined,'card-vault-after-restore');
    assert(vaultAfterRestore.body?.pan===TEST_PAN&&vaultAfterRestore.body?.expiry===TEST_EXPIRY&&vaultAfterRestore.body?.cvv===TEST_CVV,'Finance backup restore unexpectedly changed the separate card vault.');

    const health=await upstreamJson(`${local.apiUrl}/rest/v1/rpc/rheomiq_database_health`,local.serviceRole,{method:'POST',body:'{}'}) as any;
    // Only count-based, non-sensitive integrity fields may appear in this
    // diagnostic. Never print backup contents, personal notes or card data.
    const failingHealthChecks=Object.entries(health?.checks??{})
      .filter(([,value])=>typeof value==='number'&&value!==0)
      .map(([key,value])=>`${key}:${value}`).join(',')||'none';
    assert(health?.ok===true&&health?.storageMode==='relational_v1',
      `Database health is not clean after backup restore (nonzero counts: ${failingHealthChecks}).`);
    assert(Number(health?.checks?.events_without_legs)===0
      &&Number(health?.checks?.invalid_writeoff_legs)===0,
      'Zero-leg noncash writeoff was not recognized by the relational health contract.');
    assert(Number(health?.checks?.history_revision_mismatches||0)===0&&Number(health?.checks?.history_current_point_state_mismatches||0)===0,'History/state integrity is not clean after backup restore.');

    console.log('[real-stack] stage card-profile-vault-durable-cleanup');
    const cleanupId='real-stack-cleanup-card';
    const nowCard=new Date().toISOString();
    const beforeCard=await primary.request('/api/data');
    const beforeCardHistory=await primary.request('/api/history');
    expect(beforeCard,200,undefined,'card-cleanup-before');
    expect(beforeCardHistory,200,undefined,'card-cleanup-history-before');
    const stagedCardState=structuredClone(beforeCard.body.data.state);
    stagedCardState.cards=[...(stagedCardState.cards||[]),{id:cleanupId,bankId:'piraeus',nickname:'Real Stack Vault Cleanup',kind:'debit',network:'visa',active:true,createdAt:nowCard,updatedAt:nowCard}];
    const stagedCardSave=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(beforeCard.body.revision),'x-rheomiq-history-generation':String(beforeCardHistory.body.generation)},
      body:{state:stagedCardState,updatedAt:nowCard,historyLabel:'Stage new card before vault write'},
    });
    expect(stagedCardSave,200,undefined,'card-cleanup-stage-profile');
    const stagedCardReload=await primary.request('/api/data');
    expect(stagedCardReload,200,undefined,'card-cleanup-stage-reload');
    assert(stagedCardReload.body?.data?.state?.cards?.some((item:any)=>item.id===cleanupId&&!item.vaultRef),'Staged card profile did not survive revisioned reload.');
    const createdVault=await primary.request('/api/card-secrets',{method:'PUT',body:{cardId:cleanupId,pan:TEST_PAN,expiry:TEST_EXPIRY,cvv:TEST_CVV}});
    expect(createdVault,200,undefined,'card-cleanup-stage-secret');
    expect(await primary.request('/api/card-secrets',{method:'DELETE',body:{cardId:cleanupId,requireCommittedDeletion:true}}),409,'CARD_SECRET_DELETE_NOT_COMMITTED','card-cleanup-guard-live-profile');
    const vaultStillPresent=await primary.request('/api/card-secrets',{method:'POST',body:{cardId:cleanupId}});
    expect(vaultStillPresent,200,undefined,'card-cleanup-vault-before-finance-delete');
    const beforeRemove=await primary.request('/api/data');
    const beforeRemoveHistory=await primary.request('/api/history');
    const pendingState=structuredClone(beforeRemove.body.data.state);
    pendingState.cards=pendingState.cards.filter((item:any)=>item.id!==cleanupId);
    pendingState.pendingCardSecretDeletes=[...(pendingState.pendingCardSecretDeletes||[]),cleanupId];
    const pendingSave=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(beforeRemove.body.revision),'x-rheomiq-history-generation':String(beforeRemoveHistory.body.generation)},
      body:{state:pendingState,updatedAt:new Date().toISOString(),historyLabel:'Commit card deletion and pending secret cleanup'},
    });
    expect(pendingSave,200,undefined,'card-cleanup-pending-receipt');
    const pendingReload=await primary.request('/api/data');
    expect(pendingReload,200,undefined,'card-cleanup-pending-reload');
    assert(!pendingReload.body.data.state.cards.some((item:any)=>item.id===cleanupId)&&pendingReload.body.data.state.pendingCardSecretDeletes.includes(cleanupId),'Card deletion cleanup intent did not survive reload.');
    console.log('[real-stack] stage card-vault-older-writer-intent-preservation');
    const beforeLegacyHistory=await primary.request('/api/history');
    expect(beforeLegacyHistory,200,undefined,'card-cleanup-legacy-history');
    const omittedMarkerState=structuredClone(pendingReload.body.data.state);
    delete omittedMarkerState.pendingCardSecretDeletes;
    const olderWrite=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(pendingReload.body.revision),'x-rheomiq-history-generation':String(beforeLegacyHistory.body.generation)},
      body:{state:omittedMarkerState,updatedAt:new Date().toISOString(),historyLabel:'Older client omitted cleanup marker'},
    });
    expect(olderWrite,409,'CARD_CLEANUP_INTENT_REQUIRED','card-cleanup-legacy-writer-rejected');
    const explicitPrematureState=structuredClone(pendingReload.body.data.state);
    explicitPrematureState.pendingCardSecretDeletes=explicitPrematureState.pendingCardSecretDeletes.filter((id:string)=>id!==cleanupId);
    const prematureWrite=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(pendingReload.body.revision),'x-rheomiq-history-generation':String(beforeLegacyHistory.body.generation)},
      body:{state:explicitPrematureState,updatedAt:new Date().toISOString(),historyLabel:'Premature secret cleanup acknowledgement'},
    });
    expect(prematureWrite,409,'CARD_CLEANUP_INTENT_REQUIRED','card-cleanup-premature-ack-rejected');
    const afterLegacyConflict=await primary.request('/api/data');
    expect(afterLegacyConflict,200,undefined,'card-cleanup-legacy-reload');
    assert(afterLegacyConflict.body.revision===pendingReload.body.revision&&(afterLegacyConflict.body.data.state.pendingCardSecretDeletes||[]).includes(cleanupId),'Legacy/premature finance save silently erased cleanup intent or advanced revision.');
    expect(await primary.request('/api/card-secrets',{method:'POST',body:{cardId:cleanupId}}),200,undefined,'card-cleanup-ciphertext-remains-after-legacy-conflict');
    console.log('[real-stack] stage card-vault-undo-protected-atomic-cleanup');
    const undoCardHistory=await primary.request('/api/history');
    expect(undoCardHistory,200,undefined,'card-cleanup-undo-history');
    const undoCard=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(pendingReload.body.revision),'x-rheomiq-history-generation':String(undoCardHistory.body.generation)},
      body:{action:'undo',updatedAt:new Date().toISOString()},
    });
    expect(undoCard,200,undefined,'card-cleanup-undo');
    assert(undoCard.body?.data?.state?.cards?.some((item:any)=>item.id===cleanupId)&&!(undoCard.body?.data?.state?.pendingCardSecretDeletes||[]).includes(cleanupId),'Undo did not restore the card profile and revoke cleanup intent.');
    expect(await primary.request('/api/card-secrets',{method:'DELETE',body:{cardId:cleanupId,requireCommittedDeletion:true}}),409,'CARD_SECRET_DELETE_NOT_COMMITTED','card-cleanup-undo-protects-vault');
    expect(await primary.request('/api/card-secrets',{method:'POST',body:{cardId:cleanupId}}),200,undefined,'card-cleanup-vault-survived-undo');
    const redoCard=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(undoCard.body.revision),'x-rheomiq-history-generation':String(undoCard.body.history.generation)},
      body:{action:'redo',updatedAt:new Date().toISOString()},
    });
    expect(redoCard,200,undefined,'card-cleanup-redo');
    assert(!redoCard.body?.data?.state?.cards?.some((item:any)=>item.id===cleanupId)&&(redoCard.body?.data?.state?.pendingCardSecretDeletes||[]).includes(cleanupId),'Redo failed to reinstate the same committed card cleanup intent.');
    const staleCardWrite=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(beforeRemove.body.revision),'x-rheomiq-history-generation':String(beforeRemoveHistory.body.generation)},
      body:{state:stagedCardState,updatedAt:new Date().toISOString(),historyLabel:'Stale re-create deleted card'},
    });
    assert(staleCardWrite.status===409,'Stale card re-create did not fail its expected revision.');
    const remainingSecret=await primary.request('/api/card-secrets',{method:'POST',body:{cardId:cleanupId}});
    expect(remainingSecret,200,undefined,'card-cleanup-secret-preserved-after-stale-conflict');
    expect(await primary.request('/api/card-secrets',{method:'DELETE',body:{cardId:cleanupId,requireCommittedDeletion:true}}),200,undefined,'card-cleanup-guarded-delete');
    expect(await primary.request('/api/card-secrets',{method:'POST',body:{cardId:cleanupId}}),404,'CARD_SECRET_NOT_FOUND','card-cleanup-secret-absent');
    const beforeClear=await primary.request('/api/data');
    const beforeClearHistory=await primary.request('/api/history');
    const clearedMarkerState=structuredClone(beforeClear.body.data.state);
    clearedMarkerState.pendingCardSecretDeletes=clearedMarkerState.pendingCardSecretDeletes.filter((id:string)=>id!==cleanupId);
    const clearedMarker=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(beforeClear.body.revision),'x-rheomiq-history-generation':String(beforeClearHistory.body.generation)},
      body:{state:clearedMarkerState,updatedAt:new Date().toISOString(),historyLabel:'Acknowledge card vault secret cleanup'},
    });
    expect(clearedMarker,200,undefined,'card-cleanup-marker-finalize');
    const finalReload=await primary.request('/api/data');
    expect(finalReload,200,undefined,'card-cleanup-final-reload');
    assert(!(finalReload.body?.data?.state?.pendingCardSecretDeletes||[]).includes(cleanupId),'Card vault cleanup marker was not removed after successful deletion.');

    // After final ciphertext removal, the preceding metadata profile may not
    // be resurrected. Allow only the safe marker-state Undo/Redo pair.
    const cardBoundaryHistory=await primary.request('/api/history');
    expect(cardBoundaryHistory,200,undefined,'final-card-history');
    assert(cardBoundaryHistory.body?.canUndo===true,'Expected one safe post-deletion marker Undo.');
    const cardMarkerUndo=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(finalReload.body.revision),'x-rheomiq-history-generation':String(cardBoundaryHistory.body.generation)},
      body:{action:'undo',updatedAt:new Date().toISOString()},
    });
    expect(cardMarkerUndo,200,undefined,'post-delete-marker-undo');
    const forbiddenCardHistory=await primary.request('/api/history');
    expect(forbiddenCardHistory,200,undefined,'post-delete-card-history');
    assert(forbiddenCardHistory.body?.undoDepth===0&&!forbiddenCardHistory.body?.canUndo,
      'Committed Card Vault deletion still advertises restoration of a dead profile.');
    const forbiddenCardUndo=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(cardMarkerUndo.body.revision),'x-rheomiq-history-generation':String(forbiddenCardHistory.body.generation)},
      body:{action:'undo',updatedAt:new Date().toISOString()},
    });
    expect(forbiddenCardUndo,409,'HISTORY_IRREVERSIBLE_BOUNDARY','post-delete-card-profile-boundary');
    expect(await primary.request('/api/card-secrets',{method:'POST',body:{cardId:cleanupId}}),
      404,'CARD_SECRET_NOT_FOUND','post-delete-card-secret-still-absent');
    const markerRedone=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(cardMarkerUndo.body.revision),'x-rheomiq-history-generation':String(forbiddenCardHistory.body.generation)},
      body:{action:'redo',updatedAt:new Date().toISOString()},
    });
    expect(markerRedone,200,undefined,'post-delete-marker-redo');
    assert(!(markerRedone.body?.data?.state?.pendingCardSecretDeletes||[]).includes(cleanupId),
      'Redo failed to restore the completed card-secret cleanup marker state.');


    // Ordinary metadata-only card creation has no vault secret; its Do/Undo/Redo
    // must remain reversible even though final cryptographic deletion is not.
    console.log('[real-stack] stage metadata-only-card-history-roundtrip');
    const metadataId='real-stack-metadata-only-card';
    const metadataBefore=await primary.request('/api/data');
    const metadataHistory=await primary.request('/api/history');
    expect(metadataBefore,200,undefined,'metadata-before');
    expect(metadataHistory,200,undefined,'metadata-history-before');
    const metadataAt=new Date().toISOString();
    const metadataState=structuredClone(metadataBefore.body.data.state);
    metadataState.cards=[...(metadataState.cards||[]),{
      id:metadataId,bankId:'piraeus',nickname:'Synthetic Metadata Only',
      kind:'debit',network:'visa',active:true,createdAt:metadataAt,updatedAt:metadataAt,
    }];
    const metadataDo=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(metadataBefore.body.revision),
        'x-rheomiq-history-generation':String(metadataHistory.body.generation)},
      body:{state:metadataState,updatedAt:metadataAt,historyLabel:'Metadata-only card creation'},
    });
    expect(metadataDo,200,undefined,'metadata-do');
    const historyAction=async(action:'undo'|'redo',receipt:any)=>primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(receipt.body.revision),
        'x-rheomiq-history-generation':String(receipt.body.history.generation)},
      body:{action,updatedAt:new Date().toISOString()},
    });
    const metadataUndo=await historyAction('undo',metadataDo);
    expect(metadataUndo,200,undefined,'metadata-undo');
    assert(!(metadataUndo.body.data.state.cards||[]).some((c:any)=>c.id===metadataId),
      'Metadata-only Undo failed to remove the card.');
    const metadataRedo=await historyAction('redo',metadataUndo);
    expect(metadataRedo,200,undefined,'metadata-redo');
    assert((metadataRedo.body.data.state.cards||[]).some((c:any)=>c.id===metadataId),
      'Metadata-only Redo was incorrectly treated as a permanent vault deletion.');
    expect(await primary.request('/api/card-secrets',{method:'POST',body:{cardId:metadataId}}),
      404,'CARD_SECRET_NOT_FOUND','metadata-no-vault-secret');
    const metadataFinish=await historyAction('undo',metadataRedo);
    expect(metadataFinish,200,undefined,'metadata-roundtrip-final-undo');
    assert(!(metadataFinish.body.data.state.cards||[]).some((c:any)=>c.id===metadataId),
      'Metadata-only QA card remains after Undo roundtrip.');


    // Counterparty IDs and selected posted-event associations must survive
    // the actual owner+AAL2, revisioned relational Supabase persistence layer.
    // Deliberately do not add an independent table or rewrite legacy notes.
    console.log('[real-stack] stage canonical-counterparty-real-db-roundtrip');
    const cpBefore=await primary.request('/api/data');
    const cpHistory=await primary.request('/api/history');
    expect(cpBefore,200,undefined,'counterparty-before');
    expect(cpHistory,200,undefined,'counterparty-history');
    const cpNow=new Date().toISOString();
    const cpId='cp-real-stack-merchant-1';
    const cpPurchase=createEvent({
      kind:'expense',date:'2026-10-05',accountId:'qa-cash',
      amount:12.34,note:'Synthetic exact merchant reference',
      category:'Synthetic expense',
    });
    const cpState=structuredClone(cpBefore.body.data.state);
    cpState.counterparties=[...(cpState.counterparties||[]),{
      id:cpId,kind:'merchant',displayName:'Synthetic reviewed merchant',
      aliases:['SYNTHETIC SHOP'],createdAt:cpNow,updatedAt:cpNow,
    }];
    cpState.events=[...(cpState.events||[]),{...cpPurchase,counterpartyId:cpId}];
    validateCompleteFinanceData({...cpBefore.body.data,state:cpState});
    const cpDo=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(cpBefore.body.revision),
        'x-rheomiq-history-generation':String(cpHistory.body.generation)},
      body:{state:cpState,updatedAt:cpNow,historyLabel:'Reviewed merchant identity'},
    });
    expect(cpDo,200,undefined,'counterparty-real-save');
    const cpRead=await restored.request('/api/data');
    expect(cpRead,200,undefined,'counterparty-real-reload');
    const cpRows=cpRead.body?.data?.state?.counterparties||[];
    const cpEvents=cpRead.body?.data?.state?.events||[];
    assert(cpRows.some((row:any)=>row.id===cpId&&row.kind==='merchant'&&
      row.displayName==='Synthetic reviewed merchant'&&row.aliases?.[0]==='SYNTHETIC SHOP'),
      'Reviewed counterparty identity did not survive revisioned DB reload.');
    assert(cpEvents.some((event:any)=>event.id===cpPurchase.id&&
      event.counterpartyId===cpId&&event.note===cpPurchase.note&&
      event.kind==='expense'&&event.amount===12.34),
      'Owner-selected merchant relation did not round-trip through the real relational event payload.');
    const cpStale=await restored.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(cpBefore.body.revision),
        'x-rheomiq-history-generation':String(cpHistory.body.generation)},
      body:{state:cpState,updatedAt:new Date().toISOString(),
        historyLabel:'Stale merchant overwrite must lose'},
    });
    assert(cpStale.status===409&&
      ['REVISION_CONFLICT','HISTORY_CURSOR_CONFLICT'].includes(String(cpStale.body?.code||'')),
      'Stale merchant identity writer was not rejected by revision/history protection.');
    const cpUndo=await historyAction('undo',cpDo);
    expect(cpUndo,200,undefined,'counterparty-real-undo');
    assert(!(cpUndo.body?.data?.state?.counterparties||[]).some((row:any)=>row.id===cpId)&&
      !(cpUndo.body?.data?.state?.events||[]).some((event:any)=>event.id===cpPurchase.id),
      'Undo did not atomically remove the owner identity and posted expense reference.');
    const cpRedo=await historyAction('redo',cpUndo);
    expect(cpRedo,200,undefined,'counterparty-real-redo');
    assert((cpRedo.body?.data?.state?.counterparties||[]).some((row:any)=>row.id===cpId)&&
      (cpRedo.body?.data?.state?.events||[]).some((event:any)=>
        event.id===cpPurchase.id&&event.counterpartyId===cpId),
      'Redo did not atomically restore the reviewed identity and posted expense reference.');
    const cpFinish=await historyAction('undo',cpRedo);
    expect(cpFinish,200,undefined,'counterparty-real-final-undo');
    const cpClean=await restored.request('/api/data');
    expect(cpClean,200,undefined,'counterparty-real-final-reload');
    assert(!(cpClean.body?.data?.state?.counterparties||[]).some((row:any)=>row.id===cpId)&&
      !(cpClean.body?.data?.state?.events||[]).some((event:any)=>event.id===cpPurchase.id),
      'Final merchant Undo did not leave the actual database history clean.');
    console.log('[real-stack] PASS selected merchant ID, relational payload, stale conflict and Undo/Redo');

    // Keep the synthetic Card Vault secret until the revoked-bearer negative
    // proves an unrelated valid owner browser cookie cannot authorize a purge.
    console.log('[real-stack] stage device-lifecycle');
    const secondary=new CookieClient('QA Browser B');
    let lastCode=await loginAndVerify(secondary,email,TEST_PASSWORD,secret,correct);
    const devices=await primary.request('/api/auth/devices');
    expect(devices,200);
    assert(devices.body?.count===2,'Two AAL2 device sessions were not registered.');
    const other=devices.body.devices.find((item:any)=>item.current===false);
    assert(other?.sessionId,'Secondary device session was not discoverable.');

    // Preserve the revoked AAL2 bearer for cross-domain endpoint negatives
    // with an otherwise valid, unrelated owner browser cookie.
    const revokedDeviceBearer=secondary.snapshot().get('rheomiq_access');
    assert(typeof revokedDeviceBearer==='string'&&revokedDeviceBearer.length>40,
      'Revoked device bearer fixture was unavailable before revocation.');
    const revokeOthers=await primary.request('/api/auth/devices',{method:'POST',body:{action:'revoke-others'}});
    expect(revokeOthers,200);
    assert(revokeOthers.body?.count===1,'Revoke-others did not retain only the current device.');
    expect(await secondary.request('/api/auth/session'),401,'DEVICE_ACCESS_REVOKED');

    const reauthenticated=new CookieClient('QA Browser B Reauthenticated');
    lastCode=await loginAndVerify(reauthenticated,email,TEST_PASSWORD,secret,lastCode);
    const devicesAfterReauth=await primary.request('/api/auth/devices');
    expect(devicesAfterReauth,200);
    const reauthOther=devicesAfterReauth.body.devices.find((item:any)=>item.current===false);
    assert(reauthOther?.sessionId,'Revoked device could not establish a new authenticated session.');

    const revokeOne=await primary.request('/api/auth/devices',{method:'POST',body:{action:'revoke',sessionId:reauthOther.sessionId}});
    expect(revokeOne,200);
    assert(revokeOne.body?.count===1,'Single-device revoke did not retain only the current device.');
    expect(await reauthenticated.request('/api/auth/session'),401,'DEVICE_ACCESS_REVOKED');

    console.log('[real-stack] stage revoked-bearer-finance-mutation-history-backup-import');
    // Use current valid revision/generation and a real reachable Redo, so a
    // fallback to the unrelated live cookie would actually authorize writes.
    const rejectedBeforeData=await primary.request('/api/data');
    const rejectedBeforeHistory=await primary.request('/api/history');
    expect(rejectedBeforeData,200,undefined,'revoked-mutation-before-data');
    expect(rejectedBeforeHistory,200,undefined,'revoked-mutation-before-history');
    assert(rejectedBeforeHistory.body?.canRedo===true,'Revoked history proof requires a reachable Redo.');
    const rejectedRevision=String(rejectedBeforeData.body?.revision||'');
    const rejectedGeneration=String(rejectedBeforeHistory.body?.generation||'');
    assert(/^\d+$/.test(rejectedRevision)&&/^\d+$/.test(rejectedGeneration)&&
      String(rejectedBeforeHistory.body?.financeRevision)===rejectedRevision,
      'Revoked mutation proof requires matching current revision and history generation.');
    const snapshotRejectedSideEffects=async()=>({
      backups:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_backups?select=id,reason,revision&order=id.desc&limit=1',local.serviceRole),
      audit:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_audit_log?select=id&order=id.desc&limit=1',local.serviceRole),
      state:await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_app_state?id=eq.primary&select=revision,updated_at',local.serviceRole),
    });
    const rejectedBeforeDb=await snapshotRejectedSideEffects();
    const rejectedWriteState=structuredClone(rejectedBeforeData.body.data.state);
    rejectedWriteState.settings={...rejectedWriteState.settings,
      accountNames:{...rejectedWriteState.settings.accountNames,'qa-cash':'Revoked device must not save'}};
    const rejectedUpdatedAt=new Date().toISOString();
    const rejectedImport={...rejectedBeforeData.body.data,state:rejectedWriteState,updatedAt:rejectedUpdatedAt};
    validateCompleteFinanceData(rejectedImport);
    const rejectedHeaders={authorization:'Bearer '+revokedDeviceBearer,
      'if-match':rejectedRevision,'x-rheomiq-history-generation':rejectedGeneration};
    const rejectedCookieSnapshot=JSON.stringify([...primary.snapshot()]);
    for(const [path,options,label] of [
      ['/api/data',{method:'PUT',headers:rejectedHeaders,body:{state:rejectedWriteState,updatedAt:rejectedUpdatedAt,historyLabel:'Revoked device write'}},'revoked-bearer-finance-put'],
      ['/api/history',{headers:rejectedHeaders},'revoked-bearer-history-read'],
      ['/api/history',{method:'POST',headers:rejectedHeaders,body:{action:'redo',updatedAt:rejectedUpdatedAt}},'revoked-bearer-history-redo'],
      ['/api/backup',{method:'POST',headers:rejectedHeaders,body:{}},'revoked-bearer-backup'],
      ['/api/import',{method:'POST',headers:{...rejectedHeaders,'x-rheomiq-confirm-import':'replace'},body:rejectedImport},'revoked-bearer-import'],
    ] as const){
      const rejected=await primary.request(path,options);
      expect(rejected,401,'DEVICE_ACCESS_REVOKED',label);
      assert(JSON.stringify([...primary.snapshot()])===rejectedCookieSnapshot,
        'Rejected bearer changed unrelated owner cookies: '+label);
    }
    const rejectedAfterData=await primary.request('/api/data');
    const rejectedAfterHistory=await primary.request('/api/history');
    expect(rejectedAfterData,200,undefined,'revoked-mutation-after-data');
    expect(rejectedAfterHistory,200,undefined,'revoked-mutation-after-history');
    assert(rejectedAfterData.body?.revision===rejectedBeforeData.body?.revision&&
      JSON.stringify(rejectedAfterData.body?.data)===JSON.stringify(rejectedBeforeData.body?.data),
      'Revoked bearer changed canonical finance data or revision.');
    assert(JSON.stringify(rejectedAfterHistory.body)===JSON.stringify(rejectedBeforeHistory.body),
      'Revoked bearer changed durable history or cursor.');
    assert(JSON.stringify(await snapshotRejectedSideEffects())===JSON.stringify(rejectedBeforeDb),
      'Revoked bearer changed database revision, backup or audit rows.');
    expect(await primary.request('/api/auth/session'),200,undefined,'revoked-mutation-valid-cookie-preserved');

    console.log('[real-stack] stage revoked-bearer-finance-vault-no-cookie-fallback');
    // A revoked native token is authoritative even when a separate, active
    // owner browser session accompanies the request as an ambient cookie.
    // Both APIs have their own sensitive read/destructive consequences.
    expect(await primary.request('/api/data',{
      headers:{authorization:'Bearer '+revokedDeviceBearer},
    }),401,'DEVICE_ACCESS_REVOKED','revoked-bearer-finance-read');
    expect(await primary.request('/api/card-secrets',{
      method:'DELETE',headers:{authorization:'Bearer '+revokedDeviceBearer},
      body:{cardId:TEST_CARD_ID},
    }),401,'DEVICE_ACCESS_REVOKED','revoked-bearer-card-vault-delete');
    const vaultAfterRevokedBearer=await primary.request('/api/card-secrets',{
      method:'POST',body:{cardId:TEST_CARD_ID},
    });
    expect(vaultAfterRevokedBearer,200,undefined,'card-vault-after-revoked-bearer');
    assert(vaultAfterRevokedBearer.body?.pan===TEST_PAN&&
      vaultAfterRevokedBearer.body?.expiry===TEST_EXPIRY&&
      vaultAfterRevokedBearer.body?.cvv===TEST_CVV,
      'Revoked bearer deleted or changed the surviving synthetic Card Vault secret.');
    console.log('[real-stack] stage card-vault-delete');
    expect(await primary.request('/api/card-secrets',{
      method:'DELETE',body:{cardId:TEST_CARD_ID},
    }),200,undefined,'card-vault-delete');

    console.log('[real-stack] stage recurring-service-asset-durability');
    const serviceId='real-stack-service-brand-a';
    const serviceSvg=Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><rect width='32' height='32' fill='#345'/></svg>",'utf8');
    const initialServiceObjects=await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets');
    const uploadService=async(fileName:string,explicitIntent?:string)=>{
      const params=new URLSearchParams({resource:'recurring-service-assets',recurringId:serviceId,fileName});
      if(explicitIntent)params.set('intentId',explicitIntent);
      const uploaded=await primary.requestBinary('/api/account-metadata?'+params,{
        method:'PUT',headers:{'content-type':'image/svg+xml'},body:serviceSvg,
      });
      expect(uploaded,200,undefined,'recurring-service-asset-upload');
      const key=String(uploaded.body?.asset?.assetKey||'');
      assert(/^service-asset-[a-f0-9]{24}$/.test(key),'Recurring service upload returned a non-canonical asset key.');
      if(explicitIntent)assert(uploaded.body?.intentId===explicitIntent,'Explicit upload lost its intent identity.');
      else assert(uploaded.body?.intentId===undefined,'Legacy upload changed its wire response.');
      return key;
    };
    const explicitServiceIntent=randomUUID();
    const serviceAssetKey=await uploadService('original.svg',explicitServiceIntent);
    const pendingServicePath='/api/account-metadata?'+new URLSearchParams({resource:'artwork-upload-intents',kind:'recurring',targetId:serviceId});
    // A second independently authenticated owner session observes the durable
    // pending receipt, not browser-local state; legacy requests share its slot.
    const pendingService=await restored.request(pendingServicePath);
    expect(pendingService,200,undefined,'artwork-intent-independent-owner-readback');
    assert(pendingService.body?.intent?.intentId===explicitServiceIntent&&
      pendingService.body.intent.assetKey===serviceAssetKey&&pendingService.body.intent.registrationRecorded===true&&
      pendingService.body.intent.asset?.assetKey===serviceAssetKey,
      'Durable pending artwork receipt did not verify the exact registry and binary.');
    const legacyConflict=await restored.requestBinary('/api/account-metadata?'+new URLSearchParams({
      resource:'recurring-service-assets',recurringId:serviceId,fileName:'duplicate.svg'}),{
      method:'PUT',headers:{'content-type':'image/svg+xml'},body:serviceSvg,
    });
    expect(legacyConflict,503,'ARTWORK_UPLOAD_INTENT_UNVERIFIED','artwork-intent-legacy-same-target-denial');
    const identity={intentId:explicitServiceIntent,assetKey:serviceAssetKey,action:'acknowledge'};
    expect(await restored.request(pendingServicePath,{method:'PATCH',body:identity}),200,undefined,'artwork-intent-independent-owner-acknowledgement');
    const ackRetry=await primary.request(pendingServicePath,{method:'PATCH',body:identity});
    expect(ackRetry,200,undefined,'artwork-intent-exact-terminal-retry');
    assert(ackRetry.body?.intentId===explicitServiceIntent&&ackRetry.body?.assetKey===serviceAssetKey&&ackRetry.body?.disposition==='acknowledged',
      'Exact terminal acknowledgement retry did not preserve journal identity.');
    const noPending=await primary.request(pendingServicePath);
    expect(noPending,200,undefined,'artwork-intent-no-pending-after-ack');
    assert(noPending.body?.intent===null,'Acknowledged reservation still blocked its slot.');
    console.log('[real-stack] PASS durable artwork pending receipt across active owner sessions, legacy exclusion and exact terminal acknowledgement');
    console.log('[real-stack] stage recurring-service-direct-rpc-path-provenance');
    // Test actual local AAL2 PostgREST, bypassing the trusted API parser,
    // so the database alone must reject cross-key and wrong-MIME metadata.
    const directToken=primary.snapshot().get('rheomiq_access');
    assert(typeof directToken==='string'&&directToken.length>40,
      'Local owner AAL2 JWT was unavailable for direct RPC provenance proof.');
    const originalPath='services/'+serviceAssetKey+'.svg';
    const directRequest=async(method:'POST'|'PATCH',path:string,body:unknown)=>{
      const response=await fetch(local.apiUrl+'/rest/v1/'+path,{
        method,
        headers:{apikey:local.publishable,authorization:'Bearer '+directToken,
          accept:'application/json','content-type':'application/json',
          prefer:'return=representation'},
        body:JSON.stringify(body),
      });
      return {status:response.status,body:await response.json().catch(()=>null)};
    };
    const forgedKey='service-asset-ffffffffffffffffffffffff';
    const crossKey=await directRequest('POST','rpc/rheomiq_register_recurring_service_asset',{
      p_recurring_id:serviceId,p_asset_key:forgedKey,p_file_name:'cross-key.svg',
      p_mime_type:'image/svg+xml',p_storage_path:originalPath,p_size_bytes:serviceSvg.byteLength,
    });
    assert(crossKey.status===400&&crossKey.body?.code==='23514',
      'Direct owner RPC misregistered a different Storage object under a forged key.');
    const wrongMime=await directRequest('PATCH',
      'rheomiq_recurring_service_assets?asset_key=eq.'+encodeURIComponent(serviceAssetKey),
      {mime_type:'image/png'});
    assert(wrongMime.status===400&&wrongMime.body?.code==='23514',
      'Direct owner table update accepted a MIME/Storage extension mismatch.');
    const directRows=await upstreamJson(local.apiUrl+
      '/rest/v1/rheomiq_recurring_service_assets?select=asset_key,mime_type,storage_path&asset_key=in.('+
      encodeURIComponent(serviceAssetKey)+','+encodeURIComponent(forgedKey)+')',
      local.serviceRole) as Array<{asset_key?:string;mime_type?:string;storage_path?:string}>;
    assert(Array.isArray(directRows)&&directRows.length===1&&
      directRows[0]?.asset_key===serviceAssetKey&&
      directRows[0]?.mime_type==='image/svg+xml'&&
      directRows[0]?.storage_path===originalPath,
      'Rejected direct RPC or MIME update modified persistent logo metadata.');
    const serviceObjectsAfterUpload=await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets');
    assert(serviceObjectsAfterUpload.length===initialServiceObjects.length+1,'Recurring service upload did not create exactly one Storage object.');
    console.log('[real-stack] stage recurring-unreferenced-asset-revoked-bearer-no-cookie-fallback');
    // Crucially, this asset has no finance reference yet: a false cookie
    // fallback would otherwise authorize release and irreversible Storage
    // deletion rather than merely hitting the in-use 409 guard.
    const serviceRowUrl=local.apiUrl+
      '/rest/v1/rheomiq_recurring_service_assets?select=asset_key,active,storage_path&asset_key=eq.'+
      encodeURIComponent(serviceAssetKey);
    const serviceRowsBeforeRevoked=await upstreamJson(serviceRowUrl,local.serviceRole) as
      Array<{asset_key:string;active:boolean;storage_path:string}>;
    assert(serviceRowsBeforeRevoked.length===1&&
      serviceRowsBeforeRevoked[0]?.asset_key===serviceAssetKey&&
      serviceRowsBeforeRevoked[0]?.active===true,
      'Revoked bearer asset test lacks a real active, unreferenced Storage registration.');
    const rejectedServiceRelease=await primary.request(
      '/api/account-metadata?'+new URLSearchParams({
        resource:'recurring-service-assets',assetKey:serviceAssetKey,
      }),{
        method:'DELETE',headers:{authorization:'Bearer '+revokedDeviceBearer},
      });
    expect(rejectedServiceRelease,401,'DEVICE_ACCESS_REVOKED','revoked-bearer-service-asset-delete');
    const serviceRowsAfterRevoked=await upstreamJson(serviceRowUrl,local.serviceRole);
    assert(JSON.stringify(serviceRowsAfterRevoked)===JSON.stringify(serviceRowsBeforeRevoked),
      'Revoked bearer changed a real recurring service Storage registration.');
    const serviceObjectsAfterRevoked=await upstreamStorageList(
      local.apiUrl,local.serviceRole,'services','recurring-service-assets');
    assert(JSON.stringify(serviceObjectsAfterRevoked.map(o=>o.name).sort())===
      JSON.stringify(serviceObjectsAfterUpload.map(o=>o.name).sort()),
      'Revoked bearer deleted or added a recurring service Storage object.');
    const original=await primary.request('/api/data');
    expect(original,200,undefined,'recurring-service-finance-before');
    const originalHistory=await primary.request('/api/history');
    expect(originalHistory,200,undefined,'recurring-service-history-before');
    const oldRevision=String(original.body?.revision||''),oldGeneration=String(originalHistory.body?.generation||'');
    assert(/^\d+$/.test(oldRevision)&&/^\d+$/.test(oldGeneration),'Recurring service mutation preconditions were unavailable.');
    const serviceState=structuredClone(original.body.data.state);
    const serviceAccount=String(serviceState.settings?.defaultExpenseAccount||original.body.data.seed.accounts?.[0]?.id||'');
    const serviceCategory=String(serviceState.settings?.expenseCategories?.[0]||'Άλλο');
    const serviceRow={id:serviceId,name:'Real Stack Service',amount:12,day:18,firstExpectedDate:'2026-08-18',endDate:null,accountId:serviceAccount,category:serviceCategory,active:true,status:'active',source:'user',recurrenceUnit:'month',recurrenceInterval:1,logoAssetKey:serviceAssetKey};
    serviceState.recurringCustom=[...(serviceState.recurringCustom||[]),serviceRow];
    const firstServiceSave=await primary.request('/api/data',{
      method:'PUT',headers:{'if-match':oldRevision,'x-rheomiq-history-generation':oldGeneration},
      body:{state:serviceState,updatedAt:new Date().toISOString(),historyLabel:'Real-stack service logo create'},
    });
    expect(firstServiceSave,200,undefined,'recurring-service-create-save');
    const reloadedServices=await restored.request('/api/data');
    expect(reloadedServices,200,undefined,'recurring-service-reload');
    assert(reloadedServices.body?.data?.state?.recurringCustom?.some((item:any)=>item.id===serviceId&&item.logoAssetKey===serviceAssetKey),'New recurring logo reference failed revisioned save/reload.');
    // A browser owner+AAL2 JWT is allowed direct PostgREST table DML. It
    // must NOT bypass the release RPC's finance-reference guard by PATCHing
    // active=false or deleting an active binary registration outright.
    const inUseRegistrationUrl=local.apiUrl+
      '/rest/v1/rheomiq_recurring_service_assets?asset_key=eq.'+encodeURIComponent(serviceAssetKey);
    const beforeDirectLifecycle=await upstreamJson(inUseRegistrationUrl+
      '&select=asset_key,recurring_id,active,updated_at,storage_path,mime_type',local.serviceRole);
    assert(Array.isArray(beforeDirectLifecycle)&&beforeDirectLifecycle.length===1&&
      beforeDirectLifecycle[0]?.active===true,
      'Real recurring direct-DML proof is missing its active referenced positive row.');
    const deniedDirectDeactivate=await directRequest('PATCH',
      'rheomiq_recurring_service_assets?asset_key=eq.'+encodeURIComponent(serviceAssetKey),
      {active:false});
    assert(deniedDirectDeactivate.status===409&&deniedDirectDeactivate.body?.code==='23503',
      'Direct owner AAL2 recurring asset deactivate bypassed finance reference protection.');
    const deniedDirectRepoint=await directRequest('PATCH',
      'rheomiq_recurring_service_assets?asset_key=eq.'+encodeURIComponent(serviceAssetKey),
      {recurring_id:'qa-repointed-recurring'});
    assert(deniedDirectRepoint.status===400&&deniedDirectRepoint.body?.code==='23514',
      'Direct owner AAL2 recurring asset UPDATE changed immutable registration ownership.');
    const deniedDirectDeleteResponse=await fetch(inUseRegistrationUrl,{
      method:'DELETE',headers:{
        apikey:local.publishable,authorization:'Bearer '+directToken,
        accept:'application/json',prefer:'return=representation',
      },
    });
    const deniedDirectDeleteBody=await deniedDirectDeleteResponse.json().catch(()=>null);
    assert(deniedDirectDeleteResponse.status===400&&deniedDirectDeleteBody?.code==='23514',
      'Direct owner AAL2 DELETE bypassed recurring asset two-phase release.');
    const afterDirectLifecycle=await upstreamJson(inUseRegistrationUrl+
      '&select=asset_key,recurring_id,active,updated_at,storage_path,mime_type',local.serviceRole);
    assert(JSON.stringify(afterDirectLifecycle)===JSON.stringify(beforeDirectLifecycle),
      'Denied direct recurring asset DML changed its row or timestamp.');
    assert((await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets')).length===
      initialServiceObjects.length+1,'Denied direct recurring asset DML changed Storage binary presence.');
    const assetPath=(key:string)=>'/api/account-metadata?'+new URLSearchParams({resource:'recurring-service-assets',assetKey:key});
    expect(await primary.request(assetPath(serviceAssetKey),{method:'DELETE'}),409,'RECURRING_SERVICE_ASSET_IN_USE','recurring-service-reference-protection');
    const staleServiceState=structuredClone(original.body.data.state);
    staleServiceState.recurringCustom=[...(staleServiceState.recurringCustom||[]),{...serviceRow,logoAssetKey:undefined}];
    const staleServiceWrite=await restored.request('/api/data',{
      method:'PUT',headers:{'if-match':oldRevision,'x-rheomiq-history-generation':oldGeneration},
      body:{state:staleServiceState,updatedAt:new Date().toISOString(),historyLabel:'Stale recurring service asset edit'},
    });
    assert(staleServiceWrite.status===409&&['REVISION_CONFLICT','HISTORY_CURSOR_CONFLICT'].includes(String(staleServiceWrite.body?.code||'')),'Stale recurring logo write did not fail closed.');
    const afterConflict=await restored.request('/api/data');
    expect(afterConflict,200,undefined,'recurring-service-after-conflict');
    assert(afterConflict.body?.data?.state?.recurringCustom?.some((item:any)=>item.id===serviceId&&item.logoAssetKey===serviceAssetKey),'Stale recurring logo update rewrote the durable reference.');

    // Replacement must be committed before the previous key may be released.
    const replacementKey=await uploadService('replacement.svg');
    assert(replacementKey!==serviceAssetKey,'A replacement upload reused the old asset key.');
    const replaceState=structuredClone(afterConflict.body.data.state);
    replaceState.recurringCustom=replaceState.recurringCustom.map((item:any)=>item.id===serviceId?{...item,logoAssetKey:replacementKey}:item);
    const replacementHistory=await primary.request('/api/history');
    expect(replacementHistory,200,undefined,'recurring-service-history-replace');
    const replacementSave=await primary.request('/api/data',{
      method:'PUT',headers:{'if-match':String(afterConflict.body.revision),'x-rheomiq-history-generation':String(replacementHistory.body?.generation||'')},
      body:{state:replaceState,updatedAt:new Date().toISOString(),historyLabel:'Replace recurring service asset reference'},
    });
    expect(replacementSave,200,undefined,'recurring-service-replace-save');
    const reloadedReplacement=await restored.request('/api/data');
    expect(reloadedReplacement,200,undefined,'recurring-service-replacement-reload');
    assert(reloadedReplacement.body?.data?.state?.recurringCustom?.some((item:any)=>item.id===serviceId&&item.logoAssetKey===replacementKey),'Replacement recurring logo failed revisioned save/reload.');
    expect(await primary.request(assetPath(serviceAssetKey),{method:'DELETE'}),200,undefined,'recurring-service-release-old');
    expect(await primary.request(assetPath(replacementKey),{method:'DELETE'}),409,'RECURRING_SERVICE_ASSET_IN_USE','recurring-service-replacement-protection');

    // Clearing the last reference must persist first; only then purge Storage.
    const clearedState=structuredClone(reloadedReplacement.body.data.state);
    clearedState.recurringCustom=clearedState.recurringCustom.map((item:any)=>item.id===serviceId?{...item,logoAssetKey:undefined}:item);
    const clearHistory=await primary.request('/api/history');
    expect(clearHistory,200,undefined,'recurring-service-history-remove');
    const removedSave=await primary.request('/api/data',{
      method:'PUT',headers:{'if-match':String(reloadedReplacement.body.revision),'x-rheomiq-history-generation':String(clearHistory.body?.generation||'')},
      body:{state:clearedState,updatedAt:new Date().toISOString(),historyLabel:'Remove last recurring service logo reference'},
    });
    expect(removedSave,200,undefined,'recurring-service-last-reference-remove');
    const reloadedCleared=await restored.request('/api/data');
    expect(reloadedCleared,200,undefined,'recurring-service-removed-reload');
    assert(reloadedCleared.body?.data?.state?.recurringCustom?.some((item:any)=>item.id===serviceId&&!item.logoAssetKey),'Cleared recurring logo reference was not persisted.');
    expect(await primary.request(assetPath(replacementKey),{method:'DELETE'}),200,undefined,'recurring-service-release-purge');
    const serviceAssetsAfterDelete=await primary.request('/api/account-metadata?resource=recurring-service-assets');
    expect(serviceAssetsAfterDelete,200,undefined,'recurring-service-after-purge');
    assert(!(serviceAssetsAfterDelete.body?.assets||[]).some((asset:any)=>[serviceAssetKey,replacementKey].includes(asset.assetKey)),'Released recurring logo metadata survived purge.');
    const serviceObjectsAfterDelete=await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets');
    assert(serviceObjectsAfterDelete.length===initialServiceObjects.length,'Recurring service asset Storage object survived reference-aware purge.');


    // Owner-controlled variable estimates are the same revisioned Recurring
    // model; they are never generated as booked finance expense events.
    console.log('[real-stack] stage variable-recurring-real-db-roundtrip');
    const varBefore=await primary.request('/api/data');
    expect(varBefore,200,undefined,'variable-before');
    const varHistory=await primary.request('/api/history');
    expect(varHistory,200,undefined,'variable-history-before');
    const varState=structuredClone(varBefore.body.data.state);
    const existingEventCount=(varState.events||[]).length;
    varState.recurringCustom=varState.recurringCustom.map((row:any)=>row.id===serviceId?
      {...row,amount:80,amountMode:'variable',estimateMin:60,estimateMax:100}:row);
    assert(varState.recurringCustom.some((row:any)=>row.id===serviceId&&row.amountMode==='variable'),
      'Synthetic recurring row missing before variable range save.');
    const varSave=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(varBefore.body.revision),
        'x-rheomiq-history-generation':String(varHistory.body.generation)},
      body:{state:varState,updatedAt:new Date().toISOString(),historyLabel:'Owner confirmed variable recurring estimate'},
    });
    expect(varSave,200,undefined,'variable-save');
    const varReload=await restored.request('/api/data');
    expect(varReload,200,undefined,'variable-second-session-reload');
    assert(varReload.body?.data?.state?.recurringCustom?.some((row:any)=>
      row.id===serviceId&&row.amount===80&&row.amountMode==='variable'&&
      row.estimateMin===60&&row.estimateMax===100),
      'Variable estimated recurring range did not persist through real relational storage.');
    assert((varReload.body?.data?.state?.events||[]).length===existingEventCount,
      'Variable recurring estimate posted a phantom ledger event.');
    const varStale=await restored.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(varBefore.body.revision),
        'x-rheomiq-history-generation':String(varHistory.body.generation)},
      body:{state:varState,updatedAt:new Date().toISOString(),historyLabel:'Stale estimate writer'},
    });
    assert(varStale.status===409&&['REVISION_CONFLICT','HISTORY_CURSOR_CONFLICT'].includes(String(varStale.body?.code||'')),
      'Stale variable recurring writer bypassed finance revision guard.');
    const varUndo=await historyAction('undo',varSave);
    expect(varUndo,200,undefined,'variable-undo');
    assert(varUndo.body?.data?.state?.recurringCustom?.some((row:any)=>
      row.id===serviceId&&row.amount===12&&row.amountMode===undefined),
      'Undo did not restore the prior fixed recurring amount.');
    const varRedo=await historyAction('redo',varUndo);
    expect(varRedo,200,undefined,'variable-redo');
    assert(varRedo.body?.data?.state?.recurringCustom?.some((row:any)=>
      row.id===serviceId&&row.amount===80&&row.amountMode==='variable'&&
      row.estimateMin===60&&row.estimateMax===100),
      'Redo did not restore the saved variable recurring estimate.');
    const varRestored=await historyAction('undo',varRedo);
    expect(varRestored,200,undefined,'variable-final-undo');
    assert((varRestored.body?.data?.state?.events||[]).length===existingEventCount,
      'Variable estimate undo/redo changed the posted event count.');

    // Genuine owner+AAL2 revisioned JSON-state budget verification.
    // Creates only isolated synthetic budgets. The final Undo removes both
    // budget records, while preserving pre-existing finance events/history.
    console.log('[real-stack] stage enhanced-budget-real-db-roundtrip');
    const budgetBefore=await primary.request('/api/data');
    const budgetBeforeHistory=await primary.request('/api/history');
    expect(budgetBefore,200,undefined,'enhanced-budget-before');
    expect(budgetBeforeHistory,200,undefined,'enhanced-budget-history-before');
    const budgetStamp=new Date().toISOString();
    const budgetCategory=budgetBefore.body.data.state.settings.expenseCategories[0];
    assert(typeof budgetCategory==='string'&&budgetCategory.trim().length>0,
      'Missing owner-defined synthetic budget category.');
    const knownSubcategory=(budgetBefore.body.data.state.settings.expenseCategoryTree||[])
      .find((row:any)=>row.name===budgetCategory&&row.subcategories?.length)?.subcategories[0]||
      'Synthetic QA subcategory';
    const budgetIdPrefix='qa-budget-real-stack-';
    const budgetState=structuredClone(budgetBefore.body.data.state);
    const budgetEventCount=(budgetState.events||[]).length;
    budgetState.budgets=[...(budgetState.budgets||[]),
      {id:budgetIdPrefix+'prior',month:'2027-01',scope:'subcategory',
        category:budgetCategory,subcategory:knownSubcategory,amount:50,carryover:false,
        alertThreshold:.8,createdAt:budgetStamp,updatedAt:budgetStamp},
      {id:budgetIdPrefix+'current',month:'2027-02',scope:'subcategory',
        category:budgetCategory,subcategory:knownSubcategory,amount:80,carryover:true,
        alertThreshold:.8,createdAt:budgetStamp,updatedAt:budgetStamp},
      {id:budgetIdPrefix+'other-subcategory',month:'2027-02',scope:'subcategory',
        category:budgetCategory,subcategory:'QA distinct subcategory',amount:60,carryover:false,
        alertThreshold:.8,createdAt:budgetStamp,updatedAt:budgetStamp}
    ];
    validateCompleteFinanceData({...budgetBefore.body.data,state:budgetState});
    const budgetSaved=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(budgetBefore.body.revision),
        'x-rheomiq-history-generation':String(budgetBeforeHistory.body.generation)},
      body:{state:budgetState,updatedAt:budgetStamp,
        historyLabel:'Synthetic owner reviewed budget with carryover'},
    });
    expect(budgetSaved,200,undefined,'enhanced-budget-real-save');
    const budgetReload=await restored.request('/api/data');
    expect(budgetReload,200,undefined,'enhanced-budget-real-reload');
    const budgetRows=budgetReload.body.data.state.budgets||[];
    const budgetActual=budgetRows.find((item:any)=>item.id===budgetIdPrefix+'current');
    assert(budgetActual?.scope==='subcategory'&&budgetActual.category===budgetCategory&&
      budgetActual.subcategory===knownSubcategory&&budgetActual.amount===80&&
      budgetActual.carryover===true,
      'Owner-reviewed subcategory limit and carryover did not survive real DB reload.');
    assert(budgetRows.some((item:any)=>item.id===budgetIdPrefix+'other-subcategory'&&
      item.scope==='subcategory'&&item.category===budgetCategory&&
      item.subcategory==='QA distinct subcategory'),
      'Same-month same-parent distinct subcategory budget was not persisted.');
    assert((budgetReload.body.data.state.events||[]).length===budgetEventCount,
      'Budget-only changes unexpectedly created or removed posted money.');
    const budgetForged=structuredClone(budgetReload.body.data.state);
    const forgedRow=budgetForged.budgets.find((item:any)=>item.id===budgetIdPrefix+'current');
    forgedRow.subcategoryIdentityId='qa-nonexistent-taxonomy-identity';
    const budgetInvalid=await primary.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(budgetReload.body.revision),
        'x-rheomiq-history-generation':String(budgetSaved.body.history.generation)},
      body:{state:budgetForged,updatedAt:new Date().toISOString(),
        historyLabel:'Forged budget identity must fail'},
    });
    expect(budgetInvalid,400,'INVALID_DATA','enhanced-budget-invalid-identity');
    const budgetStale=await restored.request('/api/data',{
      method:'PUT',
      headers:{'if-match':String(budgetBefore.body.revision),
        'x-rheomiq-history-generation':String(budgetBeforeHistory.body.generation)},
      body:{state:budgetState,updatedAt:new Date().toISOString(),
        historyLabel:'Stale budget overwrite must fail'},
    });
    assert(budgetStale.status===409&&
      ['REVISION_CONFLICT','HISTORY_CURSOR_CONFLICT'].includes(String(budgetStale.body?.code||'')),
      'Stale budget writer was not rejected by revision/history protection.');
    const budgetUndo=await historyAction('undo',budgetSaved);
    expect(budgetUndo,200,undefined,'enhanced-budget-real-undo');
    assert(!(budgetUndo.body.data.state.budgets||[]).some((item:any)=>
      item.id===budgetIdPrefix+'prior'||item.id===budgetIdPrefix+'current'||item.id===budgetIdPrefix+'other-subcategory'),
      'Budget Undo failed to remove both synthetic periods.');
    const budgetRedo=await historyAction('redo',budgetUndo);
    expect(budgetRedo,200,undefined,'enhanced-budget-real-redo');
    assert((budgetRedo.body.data.state.budgets||[]).some((item:any)=>
      item.id===budgetIdPrefix+'current'&&item.carryover===true),
      'Budget Redo failed to restore the subcategory carryover limit.');
    const budgetFinish=await historyAction('undo',budgetRedo);
    expect(budgetFinish,200,undefined,'enhanced-budget-real-final-undo');
    const budgetClean=await restored.request('/api/data');
    expect(budgetClean,200,undefined,'enhanced-budget-real-final-reload');
    assert(!(budgetClean.body.data.state.budgets||[]).some((item:any)=>
      item.id===budgetIdPrefix+'prior'||item.id===budgetIdPrefix+'current'||item.id===budgetIdPrefix+'other-subcategory'),
      'Synthetic budget records persisted after final Undo.');
    assert((budgetClean.body.data.state.events||[]).length===budgetEventCount,
      'Budget Do/Undo/Redo modified the canonical event ledger.');
    console.log('[real-stack] PASS subcategory budget persistence, forged taxonomy rejection, stale revision and Undo/Redo');

    console.log('[real-stack] stage provider-storage-registration-failure-cleanup');
    const missingProviderId='real-stack-missing-provider';
    const missingProviderPrefix='providers/'+missingProviderId;
    const storageBeforeFailure=await upstreamStorageList(local.apiUrl,local.serviceRole,missingProviderPrefix);
    assert(storageBeforeFailure.length===0,'Provider failure fixture prefix was not clean before upload.');
    const failureSvg=Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 16'><rect width='32' height='16' fill='#345'/></svg>",'utf8');
    const failedProviderAsset=await primary.requestBinary('/api/account-metadata?resource=financial-provider-assets&providerId='+missingProviderId+'&role=logo&variant=universal&primary=0&fileName=orphan.svg',{
      method:'PUT',
      headers:{'content-type':'image/svg+xml'},
      body:failureSvg,
    });
    expect(failedProviderAsset,400,'INVALID_PROVIDER_DATA','provider-storage-registration-failure');
    const storageAfterFailure=await upstreamStorageList(local.apiUrl,local.serviceRole,missingProviderPrefix);
    assert(storageAfterFailure.length===0,'Failed provider asset registration left an orphan Storage object.');
    const failedProviderRows=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_assets?provider_id=eq.'+missingProviderId+'&select=asset_key',local.serviceRole) as any[];
    assert(Array.isArray(failedProviderRows)&&failedProviderRows.length===0,'Failed provider asset registration left metadata residue.');
    const failedIntentPath='/api/account-metadata?'+new URLSearchParams({resource:'artwork-upload-intents',
      kind:'provider',targetId:missingProviderId,role:'logo',variant:'universal'});
    const failedIntent=await primary.request(failedIntentPath);
    expect(failedIntent,200,undefined,'failed-provider-durable-intent');
    assert(failedIntent.body?.intent?.dispatchClaimed===true&&failedIntent.body.intent.registrationRecorded===false&&
      failedIntent.body.intent.asset===null,'Definite provider failure did not retain its unresolved exact key.');
    const retiredIdentity={intentId:failedIntent.body.intent.intentId,assetKey:failedIntent.body.intent.assetKey,action:'retire'};
    const retired=await primary.request(failedIntentPath,{method:'PATCH',body:retiredIdentity});
    expect(retired,200,undefined,'failed-provider-explicit-retirement');
    assert(retired.body?.disposition==='retired'&&retired.body?.assetKey===retiredIdentity.assetKey,
      'Exact retirement did not close the never-registered claimed key.');
    const retiredReadback=await primary.request(failedIntentPath);
    expect(retiredReadback,200,undefined,'failed-provider-retired-slot-readback');
    assert(retiredReadback.body?.intent===null,'Retirement did not release the failed provider slot.');
    console.log('[real-stack] PASS claimed failed provider retirement without additional Storage deletion or registry mutation');

    // Establish the isolated recovery result before a potentially stalled UI runner.
    if(process.env.MYFINHUB_ISOLATED_RECOVERY==='1'){
      assert(process.env.CI==='true','Full recovery rehearsal may run only in isolated CI.');
      console.log('[real-stack] stage isolated-postgresql-storage-restore-before-browser');
      execFileSync(process.execPath,['scripts/isolated-full-recovery-e2e.mjs'],{
        stdio:'inherit',env:{...process.env,
          MYFINHUB_QA_RELEASED_ARTWORK_KEYS:[serviceAssetKey,replacementKey].join(',')},timeout:120_000,
      });
    }
    console.log('[real-stack] stage actual-browser-ui');
    let browserPreviousCode=lastCode;
    await runRealStackBrowserProof({
      origin:APP_ORIGIN,
      email,
      password:TEST_PASSWORD,
      nextTotp:async()=>{
        const code=await nextTotp(secret,browserPreviousCode);
        browserPreviousCode=code;
        return code;
      },
    });

    console.log('[real-stack] stage browser-finance-direct-read');
    const browserFinance=await primary.request('/api/data');
    expect(browserFinance,200,undefined,'browser-finance-direct-read');
    const browserEvents=browserFinance.body?.data?.state?.events||[];
    const expectedQuickIntents=[['Real Browser Quick Income','income',21.11],['Real Browser Quick Transfer','transfer',5.11],['Real Browser Quick Withdrawal','withdrawal',6.21],['Real Browser Quick Saving','saving_cash_offset',7.31],['Real Browser Quick Refund','refund',8.41],['Real Browser Quick Reconciliation','reconciliation',null],['Real Browser Quick Split','split',8.01]] as const;
    assert(expectedQuickIntents.every(([note,kind,amount])=>{const matches=browserEvents.filter((event:any)=>event?.note===note);return matches.length===1&&matches[0].kind===kind&&(amount===null||matches[0].amount===amount)}),'Canonical API read-back is missing a unique edited Quick Entry intent or its exact amount.');
    const attentionDismissScheduled=(browserFinance.body?.data?.state?.scheduled||[]).find((item:any)=>item?.note==='Real Browser Attention Dismiss');
    assert(attentionDismissScheduled?.id,'Canonical API read-back is missing the dismissible Attention fixture.');
    const attentionDecision=browserFinance.body?.data?.state?.attentionDecisions?.[`scheduled:${attentionDismissScheduled.id}`];
    assert(attentionDecision?.status==='dismissed'&&typeof attentionDecision?.fingerprint==='string'&&attentionDecision.fingerprint.length>0,'Canonical API read-back is missing the persisted Attention dismissal decision.');
    console.log('[real-stack] stage provider-storage-direct-read');
    const providerRows=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_providers?id=eq.real-browser-provider&select=id,logo_asset_key,wordmark_asset_key,active',local.serviceRole) as any[];
    assert(Array.isArray(providerRows)&&providerRows.length===1&&providerRows[0]?.active===true,'Real browser provider row was not persisted.');
    const providerAssets=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_assets?provider_id=eq.real-browser-provider&active=eq.true&select=asset_key,storage_bucket,storage_path,size_bytes,mime_type',local.serviceRole) as any[];
    assert(Array.isArray(providerAssets)&&providerAssets.length===1,'Real browser provider asset metadata was not persisted exactly once.');
    const providerAssetKey=String(providerAssets[0]?.asset_key||'');
    const providerIntents=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_artwork_upload_intents?target_id=eq.real-browser-provider&select=asset_key,disposition,registration_recorded',local.serviceRole) as any[];
    assert(Array.isArray(providerIntents)&&providerIntents.length===1&&providerIntents[0]?.asset_key===providerAssetKey&&
      providerIntents[0]?.disposition==='acknowledged'&&providerIntents[0]?.registration_recorded===true,
      'Actual browser provider upload did not complete its durable journal acknowledgement.');
    assert(providerRows[0]?.logo_asset_key===providerAssetKey&&providerRows[0]?.wordmark_asset_key===providerAssetKey,'Provider primary logo/wordmark do not reference the uploaded asset.');
    assert(providerAssets[0]?.storage_bucket==='financial-provider-assets'&&String(providerAssets[0]?.storage_path||'').startsWith('providers/real-browser-provider/')&&Number(providerAssets[0]?.size_bytes)>0&&providerAssets[0]?.mime_type==='image/svg+xml','Provider asset Storage metadata is invalid.');
    const providerBindings=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?provider_id=eq.real-browser-provider&select=asset_role,variant,asset_key',local.serviceRole) as any[];
    assert(Array.isArray(providerBindings)&&providerBindings.length===2&&providerBindings.every(row=>row?.variant==='universal'&&row?.asset_key===providerAssetKey)&&new Set(providerBindings.map(row=>row?.asset_role)).size===2,'Provider reusable logo/wordmark bindings were not persisted.');
    console.log('[real-stack] stage provider-binding-revoked-bearer-no-cookie-fallback');
    // The revoked bearer must take precedence over the still-valid primary
    // owner's HttpOnly cookies. A rejected native request cannot borrow cookie
    // authorization, clear that browser session, or mutate a real bound slot.
    const rejectedBinding=await primary.request(
      '/api/account-metadata?resource=financial-provider-asset-binding',{
        method:'PUT',headers:{authorization:'Bearer '+revokedDeviceBearer},
        body:{providerId:'real-browser-provider',role:'logo',variant:'universal',assetKey:null},
      });
    expect(rejectedBinding,401,'DEVICE_ACCESS_REVOKED','provider-binding-revoked-bearer');
    const afterRevokedBinding=await upstreamJson(local.apiUrl+
      '/rest/v1/rheomiq_financial_provider_asset_bindings?provider_id=eq.real-browser-provider&select=asset_role,variant,asset_key',
      local.serviceRole) as Array<{asset_role?:string;variant?:string;asset_key?:string}>;
    assert(Array.isArray(afterRevokedBinding)&&afterRevokedBinding.length===providerBindings.length&&
      providerBindings.every(row=>afterRevokedBinding.some(after=>
        after.asset_role===row.asset_role&&after.variant===row.variant&&after.asset_key===row.asset_key)),
      'Revoked bearer unexpectedly cleared a persisted provider image binding.');
    expect(await primary.request('/api/auth/session'),200,undefined,'provider-binding-valid-cookie-preserved');
    console.log('[real-stack] stage provider-direct-rpc-path-provenance');
    const providerPath=String(providerAssets[0].storage_path);
    const registerProvider=async(assetKey:string,mimeType:string,storagePath:string)=>directRequest(
      'POST','rpc/rheomiq_register_financial_provider_asset',{
        p_provider_id:'real-browser-provider',p_asset_key:assetKey,
        p_asset_role:'logo',p_variant:'universal',p_file_name:'forged-image.svg',
        p_mime_type:mimeType,p_storage_path:storagePath,
        p_size_bytes:Number(providerAssets[0].size_bytes),p_make_primary:false,
      });
    const forgedProviderKey='real-browser-provider-asset-ffffffffffff';
    const differentKey=await registerProvider(forgedProviderKey,'image/svg+xml',providerPath);
    assert(differentKey.status===400&&differentKey.body?.code==='22023',
      'Direct owner RPC registered a different provider asset key against an existing Storage object.');
    const wrongProviderMime=await registerProvider(forgedProviderKey,'image/png',providerPath);
    assert(wrongProviderMime.status===400&&wrongProviderMime.body?.code==='22023',
      'Direct owner RPC accepted the wrong provider Storage MIME extension.');
    const noncanonicalProviderKey=await registerProvider('forged-provider-key','image/svg+xml',providerPath);
    assert(noncanonicalProviderKey.status===400&&noncanonicalProviderKey.body?.code==='22023',
      'Direct owner RPC accepted a noncanonical provider asset key.');
    const modifiedProviderMime=await directRequest('PATCH',
      'rheomiq_financial_provider_assets?asset_key=eq.'+encodeURIComponent(providerAssetKey),
      {mime_type:'image/png'});
    assert(modifiedProviderMime.status===400&&modifiedProviderMime.body?.code==='23514',
      'Direct owner table update accepted mismatched provider asset MIME.');
    // A direct owner UPDATE must not disable an image and erase its Storage
    // provenance to exploit the SQL three-valued CHECK (NULL is not FALSE).
    const nulledProviderBucket=await directRequest('PATCH',
      'rheomiq_financial_provider_assets?asset_key=eq.'+encodeURIComponent(providerAssetKey),
      {active:false,storage_bucket:null});
    // Owner PostgREST can deny/omit an UPDATE via grants/RLS before the row
    // CHECK is exercised. It must not acknowledge a changed row; independently
    // exercise the immutable CHECK with the disposable local service role.
    assert(!(nulledProviderBucket.status>=200&&nulledProviderBucket.status<300&&
      Array.isArray(nulledProviderBucket.body)&&nulledProviderBucket.body.length>0),
      'Owner update acknowledged changed provider asset provenance.');
    const serviceGuardPatch=await fetch(local.apiUrl+'/rest/v1/rheomiq_financial_provider_assets?asset_key=eq.'+
      encodeURIComponent(providerAssetKey),{
      method:'PATCH',
      headers:{apikey:local.serviceRole,authorization:'Bearer '+local.serviceRole,
        accept:'application/json','content-type':'application/json',prefer:'return=representation'},
      body:JSON.stringify({active:false,storage_bucket:null}),
    });
    const serviceGuardBody=await serviceGuardPatch.json().catch(()=>null) as {code?:string}|null;
    assert(serviceGuardPatch.status===400&&serviceGuardBody?.code==='23514',
      'Direct privileged local SQL CHECK did not reject NULL provider Storage provenance (HTTP '+
      serviceGuardPatch.status+', code '+String(serviceGuardBody?.code||'missing')+').');
    const forgedProviderRows=await upstreamJson(local.apiUrl+
      '/rest/v1/rheomiq_financial_provider_assets?select=asset_key,mime_type,storage_path,storage_bucket,active&provider_id=eq.real-browser-provider',
      local.serviceRole) as Array<{asset_key?:string;mime_type?:string;storage_path?:string;storage_bucket?:string;active?:boolean}>;
    assert(Array.isArray(forgedProviderRows)&&forgedProviderRows.length===1&&
      forgedProviderRows[0]?.asset_key===providerAssetKey&&
      forgedProviderRows[0]?.mime_type==='image/svg+xml'&&
      forgedProviderRows[0]?.storage_path===providerPath&&
      forgedProviderRows[0]?.storage_bucket==='financial-provider-assets'&&
      forgedProviderRows[0]?.active===true,
      'Rejected direct provider asset mutations changed persistent metadata.');
    const providerStorage=await upstreamStorageList(local.apiUrl,local.serviceRole,'providers/real-browser-provider');
    assert(providerStorage.length===1,'Provider Storage object was not persisted exactly once.');
    // Clearing an optional presentation slot must never delete the reusable
    // binary, registry row, primary logo/wordmark or finance history.
    console.log('[real-stack] stage provider-optional-binding-clear-retention');
    const bindingPath='/api/account-metadata?resource=financial-provider-asset-binding';
    const optionalBinding={providerId:'real-browser-provider',role:'card-mark',variant:'dark'};
    const readProviderProof=async()=>{
      const [catalog,bindings,assets,intents,objects,bytes,finance,history]=await Promise.all([
        primary.request('/api/account-metadata?resource=financial-providers'),
        upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?provider_id=eq.real-browser-provider&select=asset_role,variant,asset_key&order=asset_role.asc,variant.asc',local.serviceRole),
        upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_assets?provider_id=eq.real-browser-provider&select=*&order=asset_key.asc',local.serviceRole),
        upstreamJson(local.apiUrl+'/rest/v1/rheomiq_artwork_upload_intents?target_id=eq.real-browser-provider&select=*&order=intent_id.asc',local.serviceRole),
        upstreamStorageList(local.apiUrl,local.serviceRole,'providers/real-browser-provider'),
        fetch(local.apiUrl+'/storage/v1/object/public/financial-provider-assets/'+providerPath+'?qa='+randomUUID(),{
          headers:{apikey:local.serviceRole,authorization:'Bearer '+local.serviceRole},
        }),
        primary.request('/api/data'),primary.request('/api/history'),
      ]);
      expect(catalog,200,undefined,'provider-clear-catalog');
      expect(finance,200,undefined,'provider-clear-finance');
      expect(history,200,undefined,'provider-clear-history');
      assert(bytes.status===200,'Provider clear proof could not read existing Storage bytes.');
      const content=Buffer.from(await bytes.arrayBuffer());
      assert(content.length===Number(providerAssets[0].size_bytes)&&content.length>0,
        'Provider clear proof byte count does not match the registered object.');
      const provider=catalog.body?.providers?.find((row:any)=>row.id==='real-browser-provider');
      assert(provider&&Array.isArray(provider.bindings)&&Array.isArray(provider.assets)&&
        provider.assets.length===1&&provider.assets[0].assetKey===providerAssetKey&&
        provider.logoAssetKey===providerAssetKey&&provider.wordmarkAssetKey===providerAssetKey,
        'Provider clear proof lost the original catalog identity or reusable artwork.');
      assert(Array.isArray(bindings)&&Array.isArray(assets)&&Array.isArray(intents)&&objects.length===1,
        'Provider clear proof returned an invalid or incomplete durable snapshot.');
      const {bindings:catalogBindings,...catalogWithoutBindings}=provider;
      return {catalogWithoutBindings,catalogBindings,bindings,assets,intents,objects:objects.map(row=>row.name),
        bytes:content.toString('base64'),finance:{revision:finance.body.revision,data:finance.body.data},
        history:history.body};
    };
    const beforeOptional=await readProviderProof();
    assert(beforeOptional.bindings.length===2&&beforeOptional.catalogBindings.length===2,
      'Provider optional-clear fixture must start with exactly its two existing primary assignments.');
    const assignOptional=await primary.request(bindingPath,{method:'PUT',
      body:{...optionalBinding,assetKey:providerAssetKey}});
    expect(assignOptional,200,undefined,'provider-optional-bind');
    assert(assignOptional.body?.ok===true,'Provider optional assignment lacks an exact success receipt.');
    const assignedOptional=await readProviderProof();
    const {bindings:assignedDb,catalogBindings:assignedCatalog,...assignedUnchanged}=assignedOptional;
    const {bindings:beforeDb,catalogBindings:beforeCatalog,...beforeUnchanged}=beforeOptional;
    assert(assignedDb.length===3&&assignedCatalog.length===3&&
      assignedDb.some((row:any)=>row.asset_role==='card-mark'&&row.variant==='dark'&&row.asset_key===providerAssetKey)&&
      assignedCatalog.some((row:any)=>row.role==='card-mark'&&row.variant==='dark'&&row.assetKey===providerAssetKey)&&
      beforeDb.every((row:any)=>assignedDb.some((after:any)=>JSON.stringify(after)===JSON.stringify(row)))&&
      beforeCatalog.every((row:any)=>assignedCatalog.some((after:any)=>JSON.stringify(after)===JSON.stringify(row))),
      'Provider optional assignment did not preserve both primary assignments.');
    assert(JSON.stringify(assignedUnchanged)===JSON.stringify(beforeUnchanged),
      'Adding a reusable optional binding mutated binary, registry, journal or finance/history.');
    const clearOptional=await primary.request(bindingPath,{method:'PUT',
      body:{...optionalBinding,assetKey:null}});
    expect(clearOptional,200,undefined,'provider-optional-clear');
    assert(clearOptional.body?.ok===true,'Provider optional clear lacks an exact success receipt.');
    const clearedOptional=await readProviderProof();
    assert(JSON.stringify(clearedOptional)===JSON.stringify(beforeOptional),
      'Clearing the optional binding failed to preserve exact artwork, primary slots, journal and finance/history.');
    console.log('[real-stack] PASS provider optional clear retains exact reusable Storage bytes, primary bindings and finance/history');
    const providerHealth=await upstreamJson(local.apiUrl+'/rest/v1/rpc/rheomiq_database_health',local.serviceRole,{method:'POST',body:'{}'}) as any;
    assert(providerHealth?.ok===true,'Database health is not clean after provider Storage mutation.');

    const logout=await primary.request('/api/auth/logout',{method:'POST',body:{}});
    expect(logout,200);
    assert(logout.body?.authenticated===false,'Logout response did not clear authenticated state.');
    expect(await primary.request('/api/auth/session'),401,'AUTH_REQUIRED');

    console.log('[real-stack] PASS auth/password, TOTP enrollment+challenge, session restore/logout');
    console.log('[real-stack] PASS active-device list/revoke/revoke-others/stale-session/re-auth');
    console.log('[real-stack] PASS import, mutable persistence, revision conflict, history undo/redo, backup/restore, direct DB read-back');
    console.log('[real-stack] PASS card-vault encrypted boundary remains separate from finance backup/recovery');
    console.log('[real-stack] PASS provider Storage upload/binding persistence + registration-failure cleanup');
    console.log('[real-stack] PASS generic Quick Entry intent matrix + persisted Attention decisions through actual browser and canonical API read-back');
  }finally{
    server.kill('SIGTERM');
    await Promise.race([
      new Promise<void>((resolve)=>server.once('exit',()=>resolve())),
      sleep(5000).then(()=>{if(server.exitCode===null)server.kill('SIGKILL')}),
    ]);
  }
}

main().catch((error)=>{
  console.error('[real-stack] FAIL',error instanceof Error?error.message:String(error));
  process.exitCode=1;
});
