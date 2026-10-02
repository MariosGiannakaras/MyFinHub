import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for runtime QA.');
const port=9232;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-runtime-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  on(method,listener){const list=this.listeners.get(method)||[];list.push(listener);this.listeners.set(method,list)}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const listener of this.listeners.get(message.method)||[])listener(message.params||{})}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`UI/UX runtime QA assertion failed: ${message}`)};
const PAGE_HEADINGS={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();
  await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Log.enable');await c.send('Network.enable');
  const findings=[];const recoverableAssets=[];const requests=new Map();
  const describeArg=arg=>arg.value!==undefined?String(arg.value):arg.description||arg.type||'console value';
  c.on('Runtime.exceptionThrown',params=>findings.push(`runtime exception: ${params.exceptionDetails?.exception?.description||params.exceptionDetails?.text||'unknown exception'}`));
  c.on('Runtime.consoleAPICalled',params=>{if(params.type==='error'||params.type==='assert')findings.push(`console.${params.type}: ${(params.args||[]).map(describeArg).join(' ')}`)});
  c.on('Log.entryAdded',params=>{const entry=params.entry;if(entry?.level==='error')findings.push(`browser log: ${entry.text||'error entry'}${entry.url?` @ ${entry.url}`:''}`)});
  c.on('Network.requestWillBeSent',params=>{if(params.requestId&&params.request?.url)requests.set(params.requestId,{url:params.request.url,type:params.type||''})});
  c.on('Network.loadingFailed',params=>{
    if(params.canceled||params.errorText==='net::ERR_ABORTED')return;
    const request=requests.get(params.requestId)||{url:'unknown',type:params.type||''};
    const type=params.type||request.type;
    const external=(()=>{try{return new URL(request.url).origin!==new URL(baseUrl).origin}catch{return false}})();
    if(type==='Image'&&external&&params.errorText==='net::ERR_BLOCKED_BY_ORB'){
      recoverableAssets.push(`${params.errorText}: ${request.url}`);
      return;
    }
    findings.push(`network failure: ${params.errorText||'request failed'} [${type||'unknown'}] ${request.url}${params.blockedReason?` (${params.blockedReason})`:''}`);
  });
  c.on('Network.responseReceived',params=>{const response=params.response;if(response?.status>=400)findings.push(`HTTP ${response.status}: ${response.url}`)});
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const urlFor=params=>{const url=new URL(baseUrl);for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));return url.href};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<100;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clean=async label=>{await sleep(260);assert(findings.length===0,`${label}: ${findings.join(' | ')}`);if(recoverableAssets.length){const fallback=await c.call("function(){return document.querySelectorAll('.bank-logo-fallback').length}");assert(fallback>0,`${label}: external bank-logo request failed without rendering a local fallback: ${recoverableAssets.join(' | ')}`);console.warn(`Runtime QA recovered ${recoverableAssets.length} external bank-logo image failure(s) with local fallback: ${recoverableAssets.join(' | ')}`)}recoverableAssets.length=0;requests.clear()};
  const navigate=async(params,heading)=>{findings.length=0;recoverableAssets.length=0;requests.clear();await c.send('Page.navigate',{url:urlFor(params)});if(heading)await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`heading ${heading}`,[heading]);else await waitFor("function(){return document.readyState==='complete'&&Boolean(document.body?.innerText.trim())}",'document ready');await clean(JSON.stringify(params))};

  console.log('Runtime QA: console/network checks across desktop routes');
  await viewport(1440,1000);for(const [page,heading] of Object.entries(PAGE_HEADINGS))await navigate({page},heading);
  console.log('Runtime QA: console/network checks across mobile routes');
  await viewport(375,812);for(const [page,heading] of Object.entries(PAGE_HEADINGS))await navigate({page},heading);
  console.log('Runtime QA: auth, loading, conflict and error-state surfaces');
  for(const screen of ['login','mfa','mfa-enroll'])await navigate({screen},null);

  console.log('Runtime QA: auth expiry and MFA downgrade recovery');
  await navigate({screen:'session-signal'},null);
  await waitFor("function(){return document.querySelector('[data-session-probe]')?.getAttribute('data-session-probe')==='authenticated'}",'authenticated session probe');
  await c.call("function(){globalThis.__myfinhubQaSessionMode?.('mfa');window.dispatchEvent(new Event('rheomiq:mfa-required'));return true}");
  await waitFor("function(){const title=document.querySelector('#mfa-title');const code=document.querySelector('#mfa-code');return Boolean(title&&code)&&(title.textContent||'').includes('Επαλήθευση')}",'MFA downgrade recovery');await sleep(430);
  const mfaDowngradeShot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-mfa-downgrade.png`,Buffer.from(mfaDowngradeShot.data,'base64'));
  await c.send('Page.reload');
  await waitFor("function(){return document.querySelector('[data-session-probe]')?.getAttribute('data-session-probe')==='authenticated'}",'authenticated session probe after reload');
  await c.call("function(){window.dispatchEvent(new Event('rheomiq:auth-expired'));return true}");
  await waitFor("function(){return Boolean(document.querySelector('.login-card h1'))&&(document.body.textContent||'').includes('Σύνδεση')}",'expired session recovery');
  const authExpiredShot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-auth-expired.png`,Buffer.from(authExpiredShot.data,'base64'));

  await navigate({page:'dashboard',save:'loading'},null);await waitFor("function(){return Boolean(document.querySelector('.page-skeleton[role=\"status\"]'))}",'loading PageSkeleton');const shot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-loading-state.png`,Buffer.from(shot.data,'base64'));
  await navigate({page:'dashboard',save:'conflict'},PAGE_HEADINGS.dashboard);
  assert(await c.call("function(){const notice=document.querySelector('.persistence-notice.conflict[role=alert]');const action=notice?.querySelector('button');return Boolean(notice&&(notice.textContent||'').includes('Υπάρχουν νεότερα δεδομένα')&&(notice.textContent||'').includes('Φόρτωση τελευταίας έκδοσης')&&action)}"),'conflict state is assertive and has explicit latest-version recovery');
  const conflictShot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-conflict-recovery.png`,Buffer.from(conflictShot.data,'base64'));
  await navigate({page:'dashboard',save:'error'},PAGE_HEADINGS.dashboard);
  assert(await c.call("function(){const notice=document.querySelector('.persistence-notice.error[role=alert]');const action=notice?.querySelector('button');return Boolean(notice&&(notice.textContent||'').includes('Η αποθήκευση δεν ολοκληρώθηκε')&&(notice.textContent||'').includes('δεν έχει επιβεβαιωθεί ως αποθηκευμένη')&&(notice.textContent||'').includes('Φόρτωση τελευταίας έκδοσης')&&action)}"),'save failure is assertive, avoids false success and exposes deterministic recovery');
  const errorShot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-save-error-recovery.png`,Buffer.from(errorShot.data,'base64'));

  console.log('Runtime QA: real finance persistence offline/pending recovery');
  await navigate({screen:'persistence-probe'},null);
  await waitFor("function(){return document.querySelector('[data-persistence-probe]')?.getAttribute('data-persistence-probe')==='ready'&&document.querySelector('[data-persistence-state]')?.getAttribute('data-persistence-state')==='saved'}",'persistence probe ready');
  const baselineBudget=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.getAttribute('data-persistence-budget')||'0')}");
  const cleanUnload=await c.call("function(){const event=new Event('beforeunload',{cancelable:true});const dispatched=window.dispatchEvent(event);return {defaultPrevented:event.defaultPrevented,dispatched}}");
  assert(!cleanUnload.defaultPrevented&&cleanUnload.dispatched,'clean persisted state does not block unload');

  await c.call("function(){globalThis.__myfinhubQaPersistenceMode?.('offline');document.querySelector('[data-persistence-mutate]')?.click();return true}");
  await waitFor("function(){const notice=document.querySelector('.persistence-notice.error[role=alert]');return document.querySelector('[data-persistence-state]')?.getAttribute('data-persistence-state')==='error'&&Boolean(notice)&&(notice.textContent||'').includes('Δεν ήταν δυνατή η σύνδεση με το MyFinHub')}",'offline save failure with actionable network guidance');
  const offlineCount=await c.call("function(){return globalThis.__myfinhubQaPersistencePutCount?.()||0}");
  await sleep(500);
  assert(offlineCount===1&&(await c.call("function(){return globalThis.__myfinhubQaPersistencePutCount?.()||0}"))===1,'failed save is not automatically retried');
  const failedUnload=await c.call("function(){const event=new Event('beforeunload',{cancelable:true});const dispatched=window.dispatchEvent(event);return {defaultPrevented:event.defaultPrevented,dispatched}}");
  assert(failedUnload.defaultPrevented&&!failedUnload.dispatched,'failed unconfirmed save guards hard reload/navigation');
  const offlineShot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-real-offline-save-error.png`,Buffer.from(offlineShot.data,'base64'));

  await c.call("function(){globalThis.__myfinhubQaPersistenceMode?.('success');document.querySelector('.persistence-notice.error button')?.click();return true}");
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.getAttribute('data-persistence-state')==='saved'}",'explicit persisted-state recovery');
  const recovered=await c.call("function(){return {puts:globalThis.__myfinhubQaPersistencePutCount?.()||0,budget:Number(document.querySelector('[data-persistence-budget]')?.getAttribute('data-persistence-budget')||'0')}}");
  assert(recovered.puts===1&&recovered.budget===baselineBudget,'recovery reloads server-authoritative state without replaying the failed mutation');

  await c.call("function(){globalThis.__myfinhubQaPersistenceMode?.('pending');document.querySelector('[data-persistence-mutate]')?.click();return true}");
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.getAttribute('data-persistence-state')==='saving'}",'interrupted pending save');
  const pendingUnload=await c.call("function(){const event=new Event('beforeunload',{cancelable:true});const dispatched=window.dispatchEvent(event);return {defaultPrevented:event.defaultPrevented,dispatched,puts:globalThis.__myfinhubQaPersistencePutCount?.()||0}}");
  assert(pendingUnload.defaultPrevented&&!pendingUnload.dispatched&&pendingUnload.puts===2,'in-flight save guards hard reload and remains single-shot');

  c.close();console.log('UI/UX runtime console/network QA passed.');
}finally{child.kill('SIGTERM')}
