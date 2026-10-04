import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';
import { realStackFinanceData } from './real-stack-fixture.js';

const SUPABASE_CLI_VERSION='2.119.0';
const APP_ORIGIN='http://127.0.0.1:4317';
const TEST_EMAIL_DOMAIN='example.com';
const TEST_PASSWORD='Local-Only-Real-Stack-9f7!';

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
  const server=spawn(tsxBin,['server/index.ts'],{
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

    console.log('[real-stack] stage backup');
    const backup=await primary.request('/api/backup',{method:'POST',body:{}});
    expect(backup,200,undefined,'backup');
    assert(/^supabase:\/\/rheomiq_backups\/\d+$/.test(String(backup.body?.path||'')),'Backup did not persist through the real RPC boundary.');

    const stateRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_app_state?id=eq.primary&select=revision,finance_storage_mode,updated_at`,local.serviceRole) as any[];
    assert(Array.isArray(stateRows)&&stateRows.length===1,'Direct database read-back did not find the canonical state row.');
    assert(String(stateRows[0]?.revision)===String(persisted.body?.revision),'API revision and persisted database revision disagree.');
    assert(stateRows[0]?.finance_storage_mode==='relational_v1','Relational finance storage mode is not active.');

    const backupRows=await upstreamJson(`${local.apiUrl}/rest/v1/rheomiq_backups?select=id,reason,revision&order=id.desc&limit=1`,local.serviceRole) as any[];
    assert(Array.isArray(backupRows)&&backupRows.length===1,'Direct database read-back did not find the real backup row.');

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

    const logout=await primary.request('/api/auth/logout',{method:'POST',body:{}});
    expect(logout,200);
    assert(logout.body?.authenticated===false,'Logout response did not clear authenticated state.');
    expect(await primary.request('/api/auth/session'),401,'AUTH_REQUIRED');

    console.log('[real-stack] PASS auth/password, TOTP enrollment+challenge, session restore/logout');
    console.log('[real-stack] PASS active-device list/revoke/revoke-others/stale-session/re-auth');
    console.log('[real-stack] PASS import, mutable persistence, revision conflict, backup, direct DB read-back');
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
