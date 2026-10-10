import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';
import { runRealStackBrowserProof } from './real-stack-browser-e2e.js';
import { realStackFinanceData } from './real-stack-fixture.js';

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
  const raw=execFileSync('npx',['--yes',`supabase@${SUPABASE_CLI_VERSION}`,'status','-o','json'],{
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
    const initial=await primary.request('/api/data');
    expect(initial,200,undefined,'data-read');
    assert(initial.body?.data?.schemaVersion===3,'Real API read did not return canonical FinanceData.');
    const initialRevision=String(initial.body?.revision||'');
    console.log('[real-stack] stage history-read');
    const history=await primary.request('/api/history');
    expect(history,200,undefined,'history-read');
    const initialGeneration=String(history.body?.generation||'');
    assert(/^\d+$/.test(initialRevision)&&/^\d+$/.test(initialGeneration),'Revision/history generation were not available.');

    const staleState=structuredClone(initial.body.data.state);
    const nextState=structuredClone(initial.body.data.state);
    nextState.settings={
      ...nextState.settings,
      accountNames:{...(nextState.settings?.accountNames||{}),'qa-cash':'Local Real Stack QA'},
    };
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

    console.log('[real-stack] stage history-redo');
    const redone=await primary.request('/api/history',{
      method:'POST',
      headers:{'if-match':String(undone.body?.revision||''),'x-rheomiq-history-generation':String(undone.body?.history?.generation||'')},
      body:{action:'redo',updatedAt:new Date().toISOString()},
    });
    expect(redone,200,undefined,'history-redo');
    assert(redone.body?.data?.state?.settings?.accountNames?.['qa-cash']==='Local Real Stack QA','Redo did not restore the saved finance state.');

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
    const serializedBackup=JSON.stringify(backupData);
    assert(!serializedBackup.includes(TEST_PAN)&&!serializedBackup.includes(TEST_EXPIRY)&&!serializedBackup.includes(TEST_CVV),'Backup unexpectedly contains card-vault plaintext.');

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

    console.log('[real-stack] stage backup-restore');
    const restoredFromBackup=await primary.request('/api/import',{
      method:'POST',
      headers:{'x-rheomiq-confirm-import':'replace'},
      body:backupData,
    });
    expect(restoredFromBackup,200,undefined,'backup-restore');
    assert(Number(restoredFromBackup.body?.revision)>Number(postBackupSave.body?.revision),'Backup restore did not advance the canonical revision.');

    const recovered=await primary.request('/api/data');
    expect(recovered,200,undefined,'backup-restore-read');
    assert(recovered.body?.data?.state?.settings?.accountNames?.['qa-cash']==='Local Real Stack QA','Backup restore did not recover the backed-up finance state.');

    const recoveredHistory=await primary.request('/api/history');
    expect(recoveredHistory,200,undefined,'backup-restore-history');
    assert(String(recoveredHistory.body?.financeRevision||'')===String(recovered.body?.revision||''),'Recovered history cursor does not match the finance revision.');
    assert(recoveredHistory.body?.points?.some((point:any)=>point.current===true&&point.label==='Εισαγωγή δεδομένων'),'Recovered history does not expose the import recovery point.');

    const auditRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_audit_log?select=action,revision&order=id.desc&limit=12`,local.serviceRole) as any[];
    const auditActions=new Set(Array.isArray(auditRows)?auditRows.map(row=>String(row?.action||'')):[]);
    assert(auditActions.has('backup')&&auditActions.has('import')&&auditActions.has('undo')&&auditActions.has('redo'),'Recovery audit trail is missing expected actions.');

    const vaultAfterRestore=await primary.request('/api/card-secrets',{method:'POST',body:{cardId:TEST_CARD_ID}});
    expect(vaultAfterRestore,200,undefined,'card-vault-after-restore');
    assert(vaultAfterRestore.body?.pan===TEST_PAN&&vaultAfterRestore.body?.expiry===TEST_EXPIRY&&vaultAfterRestore.body?.cvv===TEST_CVV,'Finance backup restore unexpectedly changed the separate card vault.');

    const health=await upstreamJson(`${local.apiUrl}/rest/v1/rpc/rheomiq_database_health`,local.serviceRole,{method:'POST',body:'{}'}) as any;
    assert(health?.ok===true&&health?.storageMode==='relational_v1','Database health is not clean after backup restore.');
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

    console.log('[real-stack] stage card-vault-delete');
    expect(await primary.request('/api/card-secrets',{method:'DELETE',body:{cardId:TEST_CARD_ID}}),200,undefined,'card-vault-delete');

    console.log('[real-stack] stage device-lifecycle');
    const secondary=new CookieClient('QA Browser B');
    let lastCode=await loginAndVerify(secondary,email,TEST_PASSWORD,secret,correct);
    const devices=await primary.request('/api/auth/devices');
    expect(devices,200);
    assert(devices.body?.count===2,'Two AAL2 device sessions were not registered.');
    const other=devices.body.devices.find((item:any)=>item.current===false);
    assert(other?.sessionId,'Secondary device session was not discoverable.');

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

    console.log('[real-stack] stage recurring-service-asset-durability');
    const serviceId='real-stack-service-brand-a';
    const serviceSvg=Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><rect width='32' height='32' fill='#345'/></svg>",'utf8');
    const initialServiceObjects=await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets');
    const uploadService=async(fileName:string)=>{
      const uploaded=await primary.requestBinary('/api/account-metadata?'+new URLSearchParams({resource:'recurring-service-assets',recurringId:serviceId,fileName}),{
        method:'PUT',headers:{'content-type':'image/svg+xml'},body:serviceSvg,
      });
      expect(uploaded,200,undefined,'recurring-service-asset-upload');
      const key=String(uploaded.body?.asset?.assetKey||'');
      assert(/^service-asset-[a-f0-9]{24}$/.test(key),'Recurring service upload returned a non-canonical asset key.');
      return key;
    };
    const serviceAssetKey=await uploadService('original.svg');
    const serviceObjectsAfterUpload=await upstreamStorageList(local.apiUrl,local.serviceRole,'services','recurring-service-assets');
    assert(serviceObjectsAfterUpload.length===initialServiceObjects.length+1,'Recurring service upload did not create exactly one Storage object.');
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
    const expectedQuickIntents=[['Real Browser Quick Income','income'],['Real Browser Quick Transfer','transfer'],['Real Browser Quick Withdrawal','withdrawal'],['Real Browser Quick Saving','saving_cash_offset'],['Real Browser Quick Refund','refund'],['Real Browser Quick Reconciliation','reconciliation'],['Real Browser Quick Split','split']];
    assert(expectedQuickIntents.every(([note,kind])=>browserEvents.some((event:any)=>event?.note===note&&event?.kind===kind)),'Canonical API read-back is missing one or more generic Quick Entry intents.');
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
    assert(providerRows[0]?.logo_asset_key===providerAssetKey&&providerRows[0]?.wordmark_asset_key===providerAssetKey,'Provider primary logo/wordmark do not reference the uploaded asset.');
    assert(providerAssets[0]?.storage_bucket==='financial-provider-assets'&&String(providerAssets[0]?.storage_path||'').startsWith('providers/real-browser-provider/')&&Number(providerAssets[0]?.size_bytes)>0&&providerAssets[0]?.mime_type==='image/svg+xml','Provider asset Storage metadata is invalid.');
    const providerBindings=await upstreamJson(local.apiUrl+'/rest/v1/rheomiq_financial_provider_asset_bindings?provider_id=eq.real-browser-provider&select=asset_role,variant,asset_key',local.serviceRole) as any[];
    assert(Array.isArray(providerBindings)&&providerBindings.length===2&&providerBindings.every(row=>row?.variant==='universal'&&row?.asset_key===providerAssetKey)&&new Set(providerBindings.map(row=>row?.asset_role)).size===2,'Provider reusable logo/wordmark bindings were not persisted.');
    const providerStorage=await upstreamStorageList(local.apiUrl,local.serviceRole,'providers/real-browser-provider');
    assert(providerStorage.length===1,'Provider Storage object was not persisted exactly once.');
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
