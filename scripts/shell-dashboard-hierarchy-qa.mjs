import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for shell/Dashboard hierarchy QA.');
const port=9248;
const profile='/tmp/myfinhub-shell-dashboard-hierarchy-chrome';
rmSync(profile,{recursive:true,force:true});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
async function removeProfile(){for(let attempt=0;attempt<6;attempt++){try{rmSync(profile,{recursive:true,force:true});return}catch(error){if(error?.code!=='ENOTEMPTY'||attempt===5)throw error;await sleep(150*(attempt+1))}}}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Shell/Dashboard hierarchy QA assertion failed: ${message}`)};
const dashboardState=`(()=>{const visible=node=>{if(!node)return false;const rect=node.getBoundingClientRect();const style=getComputedStyle(node);return rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden'};const globals=[...document.querySelectorAll('[data-global-quick-entry]')].filter(visible);const shortcutOverlaps=[...document.querySelectorAll('[data-prefilled-quick-entry]')].filter(button=>{const label=button.querySelector('b')?.getBoundingClientRect();const amount=button.querySelector('strong')?.getBoundingClientRect();if(!label||!amount)return true;return label.left<amount.right&&label.right>amount.left&&label.top<amount.bottom&&label.bottom>amount.top}).length;return {globals:globals.map(node=>node.getAttribute('data-global-quick-entry')),headingGeneric:!!document.querySelector('.page-heading .save-button'),quickGeneric:!!document.querySelector('[data-dashboard-section="quick-entry"]>.wide-action'),prefilled:document.querySelectorAll('[data-prefilled-quick-entry]').length,accounts:document.querySelectorAll('[data-account-quick-entry]').length,quickTitle:document.querySelector('[data-dashboard-section="quick-entry"] .panel-head span')?.textContent||'',shortcutOverlaps,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}})()`;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const RealDate=Date;const fixed=RealDate.parse('2026-08-24T03:00:00+03:00');class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}Object.setPrototypeOf(FixedDate,RealDate);globalThis.Date=FixedDate})()`});
  const viewport=(width,height,mobile)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  const urlFor=params=>{const url=new URL(baseUrl);for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));return url.href};
  const waitFor=async(fn,label)=>{for(let i=0;i<120;i++){if(await c.call(fn))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigateDashboard=async params=>{await c.send('Page.navigate',{url:urlFor(params)});await waitFor("function(){return document.querySelector('#main-workspace h1')?.textContent==='Οι λογαριασμοί μου'}",'Dashboard heading');await sleep(100)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

  console.log('Shell/Dashboard hierarchy QA: desktop action/status/period contract');
  await viewport(1280,900,false);await navigateDashboard({page:'dashboard',motion:'reduced'});
  let state=await c.eval(dashboardState);
  assert(JSON.stringify(state.globals)===JSON.stringify(['desktop']),'desktop exposes exactly one visible global Quick Entry');
  assert(!state.headingGeneric&&!state.quickGeneric,'Dashboard removes duplicate generic CTA routes');
  assert(state.prefilled>0&&state.accounts>=3&&state.quickTitle==='Συχνές κινήσεις','structured frequent/account shortcuts remain available');
  assert(state.shortcutOverlaps===0,'desktop frequent shortcut labels and amounts do not overlap');
  assert(state.overflow<=1,'desktop Dashboard has no horizontal overflow');
  const shellState=await c.eval(`(()=>{const saved=document.querySelector('.file-panel[data-save-state="saved"]');const next=document.querySelector('.period-control button[aria-label^="Επόμενος μήνας"]');const pending=document.querySelector('[data-dashboard-section="pending"]');return {savedQuiet:saved?.classList.contains('is-quiet')||false,savedSmallDisplay:saved?getComputedStyle(saved.querySelector('small')).display:'',savedLive:saved?.getAttribute('aria-live'),nextDisabled:next?.disabled||false,periodText:document.querySelector('.period-control>span')?.textContent||'',pendingColumns:pending?getComputedStyle(pending).gridTemplateColumns.split(/\s+/).filter(Boolean).length:0}})()`);
  assert(shellState.savedQuiet&&shellState.savedSmallDisplay==='none'&&shellState.savedLive===null,'healthy saved chrome is quiet and non-announcing');
  assert(shellState.nextDisabled&&shellState.periodText.trim().length>0,'current reporting month disables future navigation');
  assert(shellState.pendingColumns===3,'desktop pending obligations use a compact three-column hierarchy');
  await shot('shell-dashboard-hierarchy-desktop');

  assert(await c.call("function(){const previous=document.querySelector('.period-control button[aria-label=\"Προηγούμενος μήνας\"]');previous?.click();return !!previous}"),'previous reporting month control exists');
  await waitFor("function(){const next=document.querySelector('.period-control button[aria-label^=\"Επόμενος μήνας\"]');return Boolean(next&&!next.disabled)}",'historical reporting month can advance');
  state=await c.eval(`(()=>{const next=document.querySelector('.period-control button[aria-label^="Επόμενος μήνας"]');return {disabled:next?.disabled||false,label:next?.getAttribute('aria-label')||''}})()`);
  assert(!state.disabled&&state.label==='Επόμενος μήνας','historical month can advance back toward current month');
  assert(await c.call("function(){const next=document.querySelector('.period-control button[aria-label^=\"Επόμενος μήνας\"]');next?.click();return !!next}"),'next reporting month control exists');
  await waitFor("function(){const next=document.querySelector('.period-control button[aria-label^=\"Επόμενος μήνας\"]');return Boolean(next?.disabled)}",'return to current reporting month');

  console.log('Shell/Dashboard hierarchy QA: persistence escalation');
  await navigateDashboard({page:'dashboard',save:'saving'});state=await c.eval(`(()=>{const panel=document.querySelector('.file-panel[data-save-state="saving"]');return {active:panel?.classList.contains('is-active')||false,live:panel?.getAttribute('aria-live'),toast:document.querySelector('.persistence-toast.saving')?.textContent||''}})()`);assert(state.active&&state.live==='polite'&&state.toast.includes('Αποθήκευση'),'saving remains explicit and accessible');
  await navigateDashboard({page:'dashboard',save:'error'});state=await c.eval(`(()=>({active:document.querySelector('.file-panel[data-save-state="error"]')?.classList.contains('is-active')||false,alert:document.querySelector('.persistence-notice.error[role="alert"]')?.textContent||''}))()`);assert(state.active&&state.alert.includes('Η αποθήκευση δεν ολοκληρώθηκε'),'save error remains explicit and actionable');
  await navigateDashboard({page:'dashboard',save:'conflict'});state=await c.eval(`(()=>({active:document.querySelector('.file-panel[data-save-state="conflict"]')?.classList.contains('is-active')||false,alert:document.querySelector('.persistence-notice.conflict[role="alert"]')?.textContent||''}))()`);assert(state.active&&state.alert.includes('Υπάρχουν νεότερα δεδομένα'),'save conflict remains explicit and actionable');

  console.log('Shell/Dashboard hierarchy QA: Planning remains the future-date domain');
  await c.send('Page.navigate',{url:urlFor({page:'planning',motion:'reduced'})});await waitFor("function(){return document.querySelector('#main-workspace h1')?.textContent==='Προγραμματισμός & πρόβλεψη ρευστότητας'}",'Planning heading');assert(!(await c.eval("Boolean(document.querySelector('.period-control'))")),'Planning does not inherit reporting period navigation');

  console.log('Shell/Dashboard hierarchy QA: mobile single-entry contract');
  await viewport(375,812,true);await navigateDashboard({page:'dashboard',motion:'reduced'});
  state=await c.eval(dashboardState);
  assert(JSON.stringify(state.globals)===JSON.stringify(['mobile']),'mobile exposes exactly one visible global Quick Entry');
  assert(!state.headingGeneric&&!state.quickGeneric&&state.prefilled>0&&state.accounts>=3,'mobile keeps structured shortcuts without duplicate generic actions');
  assert(state.shortcutOverlaps===0,'mobile frequent shortcut labels and amounts do not overlap');
  assert(state.overflow<=1,'mobile Dashboard has no horizontal overflow');
  await shot('shell-dashboard-hierarchy-mobile');

  c.close();console.log(`Shell/Dashboard hierarchy QA passed. Evidence: ${evidenceDir}`);
}finally{
  child.kill('SIGTERM');
  if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1200)]);
  if(child.exitCode===null)child.kill('SIGKILL');
  await removeProfile();
}
