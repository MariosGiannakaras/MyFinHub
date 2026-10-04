import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-session-runtime-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for session runtime QA.');
const port=9258;const profile='/tmp/myfinhub-session-runtime-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(120)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const expression=`(${fn})(...${JSON.stringify(args)})`;const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Session runtime QA assertion failed: ${message}`)};
let c;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('screen','session-signal');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(r=>r.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

  await waitFor("function(){return document.querySelector('[data-session-probe=\"authenticated\"]')?.textContent?.includes('Authenticated QA shell')}",'authenticated session shell');
  await shot('session-authenticated');

  const mfaSignal=await c.call("function(){globalThis.__myfinhubQaSessionMode?.('mfa');dispatchEvent(new Event('rheomiq:mfa-required'));return true}");
  assert(mfaSignal,'MFA downgrade signal dispatched');
  await waitFor("function(){return (document.querySelector('#mfa-title')?.textContent||'').includes('Επαλήθευση')&&!document.querySelector('[data-session-probe=\"authenticated\"]')}",'MFA challenge after downgrade');await sleep(430);
  const mfaState=await c.call("function(){const input=document.querySelector('#mfa-code');return {heading:document.querySelector('#mfa-title')?.textContent||'',focused:document.activeElement===input,locked:(document.querySelector('.login-footnote')?.textContent||'').includes('παραμένουν κλειδωμένα')}}");
  assert(mfaState.heading.includes('Επαλήθευση'),'MFA challenge is explicit');
  assert(mfaState.focused,'MFA code receives focus after downgrade');
  assert(mfaState.locked,'finance data remains explicitly locked during MFA recovery');
  await shot('session-mfa-downgrade');

  await c.call("function(){dispatchEvent(new Event('rheomiq:auth-expired'));return true}");
  await waitFor("function(){return (document.querySelector('#login-title')?.textContent||'').includes('Σύνδεση')&&!document.querySelector('#mfa-title')&&!document.querySelector('[data-session-probe=\"authenticated\"]')}",'login after hard auth expiry');await sleep(430);
  const loginState=await c.call("function(){return {heading:document.querySelector('#login-title')?.textContent||'',password:document.querySelector('#login-password')?.getAttribute('type')||'',financeShell:Boolean(document.querySelector('#main-workspace'))}}");
  assert(loginState.heading.includes('Σύνδεση'),'hard expiry returns to login');
  assert(loginState.password==='password','login password remains masked');
  assert(!loginState.financeShell,'hard expiry never leaves finance workspace mounted');
  await shot('session-hard-expiry');

  console.log('Session runtime QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
