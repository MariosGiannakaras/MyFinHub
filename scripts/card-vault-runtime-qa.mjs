import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-card-vault-runtime-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for card-vault runtime QA.');
const port=9362;
const profile='/tmp/myfinhub-card-vault-runtime-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(120)}throw new Error(`Timed out waiting for ${url}`)}
async function stopBrowser(process){
  if(!process||process.exitCode!==null)return;
  await new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(forceTimer);clearTimeout(giveUpTimer);resolve()};
    const forceTimer=setTimeout(()=>{if(process.exitCode===null){try{process.kill('SIGKILL')}catch{}}},2000);
    const giveUpTimer=setTimeout(finish,3500);
    process.once('exit',finish);
    if(process.exitCode!==null){finish();return}
    try{process.kill('SIGTERM')}catch{finish()}
  });
}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Card-vault runtime QA assertion failed: ${message}`)};
function vaultFixture(initialSecret){
  const original=globalThis.fetch.bind(globalThis);
  const state={secret:initialSecret,calls:[]};
  globalThis.__myfinhubQaCardVault=state;
  globalThis.fetch=async function(input,init){
    const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    const url=new URL(raw,location.href);const method=String(init?.method||'GET').toUpperCase();
    if(url.pathname!=='/api/card-secrets')return original(input,init);
    let body={};try{body=JSON.parse(typeof init?.body==='string'?init.body:'{}')}catch{}
    state.calls.push({method,cardId:body.cardId||null});
    if(method==='POST'){
      if(!state.secret)return new Response(JSON.stringify({code:'CARD_SECRET_NOT_FOUND',error:'missing'}),{status:404,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify(state.secret),{status:200,headers:{'content-type':'application/json'}});
    }
    if(method==='PUT'){
      state.secret={pan:body.pan||undefined,expiry:body.expiry||undefined,cvv:body.cvv||undefined};
      const digits=String(body.pan||'').replace(/\D/g,'');
      return new Response(JSON.stringify({saved:true,last4:digits.slice(-4)||null}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(method==='DELETE'){
      state.secret=null;
      return new Response(JSON.stringify({deleted:true}),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({code:'METHOD_NOT_ALLOWED'}),{status:405,headers:{'content-type':'application/json'}});
  };
  return true;
}

let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<150;i+=1){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const setInput=async(label,value)=>{const ok=await c.call("function(label,value){const input=[...document.querySelectorAll('input')].find(node=>node.getAttribute('aria-label')===label);if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);assert(ok,`missing input ${label}`);await sleep(60)};
  const clickAria=async label=>{const ok=await c.call("function(label){const button=[...document.querySelectorAll('button')].find(node=>node.getAttribute('aria-label')===label&&node.getClientRects().length>0);button?.click();return Boolean(button)}",[label]);assert(ok,`missing button ${label}`);await sleep(80)};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const button=[...document.querySelectorAll(selector)].find(node=>node.getClientRects().length>0&&(node.textContent||'').includes(text));button?.click();return Boolean(button)}",[selector,text]);assert(ok,`missing ${selector} containing ${text}`);await sleep(80)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};

  const url=new URL(baseUrl);url.searchParams.set('page','cards');url.searchParams.set('card-vault','ready');
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').trim()==='Κάρτες'}",'Cards page');
  assert(await c.call(vaultFixture.toString(),[null]),'initial synthetic server vault installed');

  console.log('Card Vault runtime QA: invalid input stays local and does not write');
  await clickAria('Ασφαλή στοιχεία QA Debit');
  await waitFor("function(){return Boolean(document.querySelector('.app-card-details-dialog'))&&!document.querySelector('.app-card-details-dialog input:disabled')}",'secure details dialog ready');
  await setInput('Αριθμός κάρτας','4242 4242 4242 4242');
  await setInput('Λήξη κάρτας','13/30');
  await setInput('CVV κάρτας','12');
  await clickText('.app-card-details-dialog button','Αποθήκευση στοιχείων');
  await waitFor("function(){return Boolean(document.querySelector('.app-card-details-dialog [role=alert]'))}",'invalid card secret alert');
  assert(!(await c.call("function(){return globalThis.__myfinhubQaCardVault.calls.some(call=>call.method==='PUT')}")),'invalid secret must not reach PUT');

  console.log('Card Vault runtime QA: save and reveal through server boundary');
  await setInput('Λήξη κάρτας','12/30');
  await setInput('CVV κάρτας','123');
  await clickText('.app-card-details-dialog button','Αποθήκευση στοιχείων');
  await waitFor("function(){return !document.querySelector('.app-card-details-dialog')}",'secure details save closes');
  await clickAria('Ασφαλή στοιχεία QA Debit');
  await waitFor("function(){const pan=document.querySelector('input[aria-label=\"Αριθμός κάρτας\"]'),exp=document.querySelector('input[aria-label=\"Λήξη κάρτας\"]'),cvv=document.querySelector('input[aria-label=\"CVV κάρτας\"]');return pan?.value==='4242 4242 4242 4242'&&exp?.value==='12/30'&&cvv?.value==='123'}",'saved server secret reveal');
  await screenshot('card-vault-revealed-before-reload');
  await clickAria('Κλείσιμο στοιχείων κάρτας');

  const saved=await c.call("function(){return globalThis.__myfinhubQaCardVault.secret}");
  assert(saved?.pan==='4242424242424242'&&saved?.expiry==='12/30'&&saved?.cvv==='123','synthetic server retained normalized secret before reload');
  const preload=`(${vaultFixture.toString()})(${JSON.stringify(saved)})`;
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:preload});

  console.log('Card Vault runtime QA: hard reload re-reveals server secret');
  await c.send('Page.reload',{ignoreCache:true});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').trim()==='Κάρτες'}",'Cards after hard reload');
  await clickAria('Ασφαλή στοιχεία QA Debit');
  await waitFor("function(){const pan=document.querySelector('input[aria-label=\"Αριθμός κάρτας\"]'),exp=document.querySelector('input[aria-label=\"Λήξη κάρτας\"]'),cvv=document.querySelector('input[aria-label=\"CVV κάρτας\"]');return pan?.value==='4242 4242 4242 4242'&&exp?.value==='12/30'&&cvv?.value==='123'}",'server secret after hard reload');
  await setInput('Λήξη κάρτας','11/31');
  await setInput('CVV κάρτας','987');
  await clickText('.app-card-details-dialog button','Αποθήκευση στοιχείων');
  await waitFor("function(){return !document.querySelector('.app-card-details-dialog')}",'updated secure details close');
  await clickAria('Ασφαλή στοιχεία QA Debit');
  await waitFor("function(){return document.querySelector('input[aria-label=\"Λήξη κάρτας\"]')?.value==='11/31'&&document.querySelector('input[aria-label=\"CVV κάρτας\"]')?.value==='987'}",'updated secret reveal');
  await clickAria('Κλείσιμο στοιχείων κάρτας');

  console.log('Card Vault runtime QA: explicit delete clears subsequent reveal');
  const deleted=await c.call("async function(){const module=await import('/src/lib/cardVaultClient.ts');await module.deleteCardSecret('qa-debit-card');return globalThis.__myfinhubQaCardVault.calls.at(-1)}");
  assert(deleted?.method==='DELETE'&&deleted?.cardId==='qa-debit-card','explicit DELETE reaches server-vault boundary');
  await clickAria('Ασφαλή στοιχεία QA Debit');
  await waitFor("function(){const pan=document.querySelector('input[aria-label=\"Αριθμός κάρτας\"]'),exp=document.querySelector('input[aria-label=\"Λήξη κάρτας\"]'),cvv=document.querySelector('input[aria-label=\"CVV κάρτας\"]');return pan&&!pan.disabled&&pan.value===''&&exp?.value===''&&cvv?.value===''}",'deleted secret returns empty secure editor');
  const calls=await c.call("function(){return globalThis.__myfinhubQaCardVault.calls}");
  assert(calls.some(call=>call.method==='PUT')&&calls.some(call=>call.method==='POST')&&calls.some(call=>call.method==='DELETE'),'runtime exercised PUT, POST and DELETE vault methods');
  await screenshot('card-vault-empty-after-delete');
  console.log('Card Vault runtime QA passed: invalid input, save/reveal/update, hard reload and explicit delete.');
}finally{
  try{c?.close()}catch{}
  await stopBrowser(child);
  await sleep(250);
  try{rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150})}
  catch(error){console.warn(`Card Vault runtime QA profile cleanup deferred: ${error instanceof Error?error.message:String(error)}`)}
}
