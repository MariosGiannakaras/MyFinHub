import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-settings-rules-modal-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Settings Rules modal QA.');
const port=9264;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-settings-rules-modal-qa-chrome','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw new Error(`Settings Rules modal QA assertion failed: ${message}`)};
async function waitHttp(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const fn of this.listeners.get(message.method)||[])fn(message.params)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
let c;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('state','settings-tabs');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];
  c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
  c.on('Network.loadingFailed',params=>{if(!params.canceled&&params.errorText!=='net::ERR_ABORTED')failedRequests.push(params.errorText||'network failure')});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const screenshot=async name=>{await sleep(120);const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const clickRules=async()=>{assert(await c.call("function(){const button=[...document.querySelectorAll('.settings-tablist [role=tab]')].find(node=>(node.textContent||'').trim()==='Κανόνες');if(!button)return false;button.click();return true}"),'Rules tab opens');await waitFor("function(){return Boolean(document.querySelector('.settings-rules-only [data-rules-workspace]'))}",'Rules workspace')};
  const openCreate=async()=>{assert(await c.call("function(){const button=document.querySelector('.rules-new-button');if(!button)return false;button.focus();button.click();return true}"),'New rule action opens');await waitFor("function(){return Boolean(document.querySelector('[data-rule-editor]'))}",'Rules editor')};
  const closeEditor=async()=>{assert(await c.call("function(){const button=document.querySelector('[data-rule-editor] button[aria-label=\"Κλείσιμο επεξεργασίας κανόνα\"]');if(!button)return false;button.click();return true}"),'Rules editor closes');await waitFor("function(){return !document.querySelector('[data-rule-editor]')}",'Rules editor close')};
  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'Settings tabs');
  await viewport(1440,1000);await clickRules();
  assert(!await c.call("function(){return Boolean(document.querySelector('[data-rule-editor]'))}"),'Rules editor starts closed');
  const closed=await c.call("function(){const root=document.querySelector('[data-rules-workspace]');return {newAction:Boolean(root?.querySelector('.rules-new-button')),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}} ");
  assert(closed.newAction,'Rules new action exists');assert(closed.overflow<=1,`Rules closed overflow ${closed.overflow}px`);await screenshot('settings-rules-corrected-desktop');

  await openCreate();
  const modal=await c.call("function(){const root=document.querySelector('[data-rule-editor]');const rect=root?.getBoundingClientRect();const owned=[...(root?.querySelectorAll('.owned-select-shell>.owned-input')||[])];return {title:root?.querySelector('#rule-editor-title')?.textContent||'',native:root?.querySelectorAll('select').length||0,owned:owned.length,hierarchical:Boolean(root?.querySelector('input[aria-label=\"Κατηγορία ή υποκατηγορία κανόνα\"]')),heights:owned.map(input=>input.getBoundingClientRect().height),radii:owned.map(input=>parseFloat(getComputedStyle(input).borderRadius)||0),bodyFixed:getComputedStyle(document.body).position==='fixed',width:rect?.width||0,height:rect?.height||0,left:rect?.left||0,top:rect?.top||0}} ");
  assert(modal.title.includes('Νέος κανόνας'),'Create modal identity');assert(modal.native===0,'No native selects');assert(modal.owned>=4,'Shared app-owned selectors');assert(modal.hierarchical,'Shared hierarchical category selector');assert(modal.heights.every(value=>value>=40),'Shared selector heights');assert(modal.radii.every(value=>value>=9),'Shared selector radii');assert(modal.bodyFixed,'Background scroll lock');assert(modal.width<=920&&modal.height<=968&&modal.left>=0&&modal.top>=0,'Desktop modal containment');await screenshot('settings-rules-editor-desktop');

  const categoryLabel='Κατηγορία ή υποκατηγορία κανόνα';
  assert(await c.call("function(label){const input=document.querySelector(`[data-rule-editor] input[aria-label=\"${label}\"]`);if(!input)return false;input.click();return true}",[categoryLabel]),'Hierarchical category dropdown opens');
  await waitFor("function(label){return Boolean(document.querySelector(`.owned-select-popover[aria-label=\"${label}\"]`))}",'category dropdown',[categoryLabel]);
  const taxonomy=await c.call("function(label){const pop=document.querySelector(`.owned-select-popover[aria-label=\"${label}\"]`);return {options:pop?.querySelectorAll('[role=option]').length||0,categories:pop?.querySelectorAll('[data-option-level=category]').length||0,subcategories:pop?.querySelectorAll('[data-option-level=subcategory]').length||0,native:document.querySelectorAll('select').length||0,modals:[...document.querySelectorAll('[aria-modal=true]')].filter(node=>node.getClientRects().length).length}}":[categoryLabel]);
  assert(taxonomy.options>=2,'Taxonomy options exist');assert(taxonomy.categories>=1,'Category hierarchy rows exist');assert(taxonomy.subcategories>=1,'Subcategory hierarchy rows exist');assert(taxonomy.native===0,'Dropdown stays app-owned');assert(taxonomy.modals>=2,'Dropdown is nested modal layer');await screenshot('settings-rules-editor-category-dropdown-desktop');
  assert(await c.call("function(label){const button=document.querySelector(`.owned-select-popover[aria-label=\"${label}\"] button[aria-label=\"Κλείσιμο επιλογών\"]`);if(!button)return false;button.click();return true}",[categoryLabel]),'Category dropdown closes');
  await waitFor("function(label){return !document.querySelector(`.owned-select-popover[aria-label=\"${label}\"]`)}",'category dropdown close',[categoryLabel]);
  await c.call("function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return true}");await waitFor("function(){return !document.querySelector('[data-rule-editor]')}",'Escape closes Rules editor');await waitFor("function(){return document.activeElement?.classList.contains('rules-new-button')}",'focus return');

  await viewport(375,812);await openCreate();
  const mobile=await c.call("function(){const root=document.querySelector('[data-rule-editor]');const rect=root?.getBoundingClientRect();const offenders=[...(root?.querySelectorAll('button,[role=combobox]')||[])].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.width<40||r.height<40)});return {native:root?.querySelectorAll('select').length||0,width:rect?.width||0,height:rect?.height||0,left:rect?.left||0,offenders:offenders.length}} ");
  assert(mobile.native===0,'Mobile stays app-owned');assert(mobile.width<=375&&mobile.left>=-1&&mobile.height<=812*.9,'Mobile sheet containment');assert(mobile.offenders===0,'Mobile touch targets');await screenshot('settings-rules-editor-mobile');await closeEditor();
  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);assert(failedRequests.length===0,`network failures: ${failedRequests.join(' | ')}`);
  c.close();console.log('Settings Rules modal rendered QA passed on desktop and mobile.');
}finally{c?.close();child.kill('SIGTERM')}
