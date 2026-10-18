import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-save-progress-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium required for save-progress QA');
const port=9287;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-save-progress-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<90;i++){try{const response=await fetch(url);if(response.ok)return;}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,label)=>{if(!value)throw new Error(`Save-progress QA assertion failed: ${label}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('screen','persistence-probe');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label)=>{for(let i=0;i<90;i++){if(await c.call(fn))return;await sleep(85)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async()=>{await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null}",'finance probe ready')};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const callMode=mode=>c.call("function(mode){globalThis.__myfinhubQaPersistenceMode(mode);return true}",[mode]);
  const mutate=()=>c.call("function(){const button=document.querySelector('[data-persistence-mutate]');button?.click();return Boolean(button)}");
  const release=()=>c.call("function(){return globalThis.__myfinhubQaReleaseSave?.()===true}");
  const phase=mode=>`function(){return document.querySelector('[data-save-progress="${mode}"]')!==null}`;
  const verifyTop=async()=>{const box=await c.call("function(){const node=document.querySelector('[data-save-progress]');if(!node)return null;const r=node.getBoundingClientRect();const progress=node.querySelector('[role=progressbar]');return {top:r.top,width:r.width,height:r.height,value:progress?.getAttribute('aria-valuenow'),role:progress?.getAttribute('role'),status:node.dataset.saveProgress,alert:node.getAttribute('role'),safe:getComputedStyle(node).pointerEvents==='none'}}");assert(Boolean(box&&box.top===0&&box.height>=3&&box.height<=6&&box.safe&&box.width>300&&box.role==='progressbar'),`fixed unobtrusive top line ${JSON.stringify(box)}`);return box};

  await viewport(375,812);await navigate();
  assert(await c.call("function(){return !document.querySelector('[data-save-progress]')&&!document.querySelector('.persistence-toast.saved')}",[]),'no false saved bar at initial load');
  await callMode('held');assert(await mutate(),'first synthetic finance write clicked');
  await waitFor(phase('saving'),'indeterminate pending bar');
  assert((await verifyTop()).value===null,'pending does not fabricate 100%');
  await shot('save-progress-pending-375-light');
  await sleep(620);
  assert(await c.call("function(){return document.querySelector('[data-save-progress=saving]')!==null&&(window.__myfinhubQaPersistencePutCount?.()||0)===1}"),'save remains pending without fake completion');
  assert(await release(),'release actual backend receipt');
  await waitFor(phase('success'),'receipt-confirmed success');
  assert((await verifyTop()).value==='100','100% only after committed response');
  await shot('save-progress-success-375-light');
  await waitFor("function(){return !document.querySelector('[data-save-progress]')}",'success acknowledgement clears only after receipt');

  // Rapid consecutive saves must not create a false green gap after the first receipt.
  await callMode('held');await c.call("function(){document.querySelector('[data-persistence-mutate]')?.click();document.querySelector('[data-persistence-mutate]')?.click();return true}");
  await waitFor(phase('saving'),'double queued save pending');
  await waitFor("function(){return (globalThis.__myfinhubQaPersistencePutCount?.()||0)===2}",'first queued HTTP PUT reaches held backend');
  assert(await release(),'release first of double queued save');
  await waitFor("function(){return (window.__myfinhubQaPersistencePutCount?.()||0)===3}",'second queued write begins after first');
  assert((await verifyTop()).value===null,'first receipt cannot complete while second pending');
  await shot('save-progress-consecutive-375-light');
  assert(await release(),'release second queued receipt');
  await waitFor(phase('success'),'both receipts confirmed');

  // Failure must be a persistent red line and retain a recovery action.
  await viewport(1440,900);await navigate();
  await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');return true}");
  await callMode('offline');assert(await mutate(),'offline write attempted');
  await waitFor(phase('error'),'real rejected write shows red');
  const error=await verifyTop();assert(error.alert==='alert'&&error.value===null,'failed write never becomes 100%');
  assert(await c.call("function(){return Boolean(document.querySelector('.persistence-notice.error button'))}"),'error retains recovery');
  await shot('save-progress-error-1440-dark');
  await sleep(500);
  assert(await c.call("function(){return document.querySelector('[data-save-progress=error]')!==null}"),'red error does not vanish on fake timer');

  // 409 revision conflict is also a failed save, never success.
  await navigate();await callMode('conflict');assert(await mutate(),'conflict write attempted');
  await waitFor(phase('error'),'revision conflict produces red');
  assert(await c.call("function(){return document.querySelector('[data-persistence-state=conflict]')!==null}"),'revision error is not successful');
  await shot('save-progress-conflict-1440-dark');

  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate();await callMode('held');assert(await mutate(),'reduced motion save attempted');
  await waitFor(phase('saving'),'reduced-motion pending');
  const motion=await c.call("function(){const node=document.querySelector('.save-progress-fill');return node?getComputedStyle(node).animationName:''}");
  assert(motion==='none','reduced motion disables animated fill');
  await shot('save-progress-pending-reduced-motion-1440-dark');
  assert(await release(),'reduced-motion receipt release');
  await waitFor(phase('success'),'reduced-motion backend-confirmed green');
  // Actual useFinance hook under a held old GET and subsequent successful,
  // QA-only import; the old server response must not replace newer state.
  await navigate();
  const initialBudget=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
  assert(await c.call("function(){return globalThis.__myfinhubQaHoldNextRead?.()===true}"),'schedule held old finance GET');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-reload]');b?.click();return Boolean(b)}"),'start reload before synthetic import');
  await waitFor("function(){return globalThis.__myfinhubQaHeldReadCount?.()===1}",'old GET remains held');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-import]');b?.click();return Boolean(b)}"),'synthetic import outruns held GET');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${initialBudget+13}}`,'synthetic imported finance budget applied');
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'synthetic import receipt confirmed');
  assert(await c.call("function(){return globalThis.__myfinhubQaReleaseRead?.()===true}"),'release stale GET');
  await sleep(180);
  const finalState=await c.call("function(){return {budget:Number(document.querySelector('[data-persistence-budget]')?.textContent||0),state:document.querySelector('[data-persistence-state]')?.textContent}}");
  assert(finalState.budget===initialBudget+13&&finalState.state==='saved',`old database GET cannot overwrite a newer successful import: ${JSON.stringify(finalState)}`);
  await shot('history-refresh-stale-read-after-import-1440-dark');
  c.close();
  console.log('Save-progress QA passed: pending remains active, receipt only green, persistent red failure/conflict, FIFO burst, viewport/theme/reduced-motion evidence');
}catch(error){console.error(error);process.exitCode=1}
finally{child.kill('SIGTERM')}
