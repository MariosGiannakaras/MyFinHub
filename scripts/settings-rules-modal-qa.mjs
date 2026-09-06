import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-settings-rules-modal-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Settings Rules modal QA.');

const port=9264;
const profile='/tmp/myfinhub-settings-rules-modal-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const fn of this.listeners.get(message.method)||[])fn(message.params)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Settings Rules modal QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('state','settings-tabs');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];
  c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
  c.on('Network.loadingFailed',params=>{if(!params.canceled&&params.errorText!=='net::ERR_ABORTED')failedRequests.push(`${params.errorText||'network failure'} [${params.type||'unknown'}]`)});
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const screenshot=async name=>{await sleep(150);const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const clickRules=async()=>{const clicked=await c.call("function(){const button=[...document.querySelectorAll('.settings-tablist [role=tab]')].find(node=>(node.textContent||'').trim()==='Κανόνες');if(!button||button.disabled)return false;button.click();return true}");assert(clicked,'Rules tab is enabled and clickable');await waitFor("function(){const root=document.querySelector('.settings-rules-only [data-rules-workspace]');return Boolean(root&&root.getClientRects().length)}",'Rules workspace')};
  const openCreate=async()=>{const opened=await c.call("function(){const button=document.querySelector('.settings-rules-only .rules-new-button');if(!button)return false;button.focus();button.click();return true}");assert(opened,'New rule action opens the editor');await waitFor("function(){const modal=document.querySelector('[data-rule-editor][role=dialog][aria-modal=true]');return Boolean(modal&&modal.getClientRects().length)}",'Rules editor modal');await sleep(120)};
  const closeEditor=async()=>{const closed=await c.call("function(){const button=document.querySelector('[data-rule-editor] button[aria-label=\"Κλείσιμο επεξεργασίας κανόνα\"]');if(!button)return false;button.click();return true}");assert(closed,'Rules editor close action works');await waitFor("function(){return !document.querySelector('[data-rule-editor]')}",'Rules editor close')};
  const setLabelInput=async(label,value)=>{const changed=await c.call("function(label,value){const row=[...document.querySelectorAll('[data-rule-editor] label')].find(node=>(node.querySelector(':scope > span')?.textContent||'').trim().includes(label));const input=row?.querySelector('input:not([role=combobox])');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)return false;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);assert(changed,`Rules editor exposes ${label}`);await sleep(80)};
  const seedRule=async(name,description)=>{const before=await c.call("function(){return document.querySelectorAll('.rule-settings-list article').length}");await openCreate();await setLabelInput('Όνομα αυτοματισμού',name);await setLabelInput('Κείμενο περιγραφής',description);const saved=await c.call("function(){const button=[...document.querySelectorAll('[data-rule-editor] .rules-editor-actions .save-button')].find(node=>(node.textContent||'').includes('Δημιουργία κανόνα'));if(!button)return false;button.click();return true}");assert(saved,`Representative rule ${name} saves through the real modal`);await waitFor("function(){return !document.querySelector('[data-rule-editor]')}",`Representative rule ${name} editor closes`);await waitFor("function(before){return document.querySelectorAll('.rule-settings-list article').length===before+1}",`Representative rule ${name} appears`,[before])};

  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'Settings tabs');
  await viewport(1440,1000);
  await clickRules();
  await c.call("function(){window.scrollTo({top:0,left:0,behavior:'auto'});return true}");
  assert(await c.call("function(){return !document.querySelector('[data-rule-editor]')}") ,'Rules editor is closed on initial entry');
  let initialRules=await c.call("function(){return document.querySelectorAll('.rule-settings-list article').length}");
  if(initialRules<2){await seedRule('QA Supermarket','Supermarket');await seedRule('QA Utilities','ΔΕΗ');initialRules=await c.call("function(){return document.querySelectorAll('.rule-settings-list article').length}")}
  assert(initialRules>=2,'Representative Rules setup renders existing rules');
  const closedState=await c.call("function(){const root=document.querySelector('.settings-rules-only [data-rules-workspace]');return {rules:root?.querySelectorAll('.rule-settings-list article').length||0,status:Boolean(root?.querySelector('.rules-status-strip')),newAction:Boolean(root?.querySelector('.rules-new-button')),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(closedState.rules>=2,'Representative Rules setup keeps existing rules visible');
  assert(closedState.status,'Rules status context remains visible');
  assert(closedState.newAction,'Rules exposes the primary new-rule action');
  assert(closedState.overflow<=1,`Rules closed state horizontal overflow ${closedState.overflow}px`);
  await screenshot('settings-rules-corrected-desktop');

  await openCreate();
  const desktopModal=await c.call("function(){const modal=document.querySelector('[data-rule-editor]');const rect=modal?.getBoundingClientRect();const active=document.activeElement;const owned=[...(modal?.querySelectorAll('.owned-select-shell>.owned-input')||[])];return {title:modal?.querySelector('#rule-editor-title')?.textContent||'',nativeSelects:modal?.querySelectorAll('select').length||0,ownedSelects:owned.length,ownedMinHeights:owned.map(input=>parseFloat(getComputedStyle(input).minHeight)||input.getBoundingClientRect().height),ownedRadii:owned.map(input=>parseFloat(getComputedStyle(input).borderRadius)||0),bodyFixed:getComputedStyle(document.body).position==='fixed',focusedName:active instanceof HTMLInputElement&&active.closest('[data-rule-editor]')===modal&&!active.readOnly,width:rect?.width||0,height:rect?.height||0,left:rect?.left||0,top:rect?.top||0}}");
  assert(desktopModal.title.includes('Νέος κανόνας'),'Create modal has the correct identity');
  assert(desktopModal.nativeSelects===0,'Rules editor contains no browser-native select controls');
  assert(desktopModal.ownedSelects>=5,'Rules editor uses shared AppSelectInput controls');
  assert(desktopModal.ownedMinHeights.every(value=>value>=40),'Shared owned select triggers keep a usable base height');
  assert(desktopModal.ownedRadii.every(value=>value>=9),'Shared owned select triggers keep the common rounded control treatment');
  assert(desktopModal.bodyFixed,'Shared modal focus layer locks background scroll');
  assert(desktopModal.focusedName,'Shared modal focus moves into the editable form');
  assert(desktopModal.width<=920&&desktopModal.width<=1440-32,'Desktop Rules modal stays compact and viewport-contained');
  assert(desktopModal.height<=1000-32,'Desktop Rules modal height stays viewport-contained');
  assert(desktopModal.left>=0&&desktopModal.top>=0,'Desktop Rules modal remains on-screen');
  await screenshot('settings-rules-editor-desktop');

  const dropdownOpened=await c.call("function(){const input=document.querySelector('[data-rule-editor] input[aria-label=\"Κατηγορία κανόνα\"]');if(!input)return false;input.click();return true}");
  assert(dropdownOpened,'Category shared dropdown opens from the Rules modal');
  await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover[aria-label=\"Κατηγορία κανόνα\"]'))}",'Rules category dropdown');
  const dropdownState=await c.call("function(){const popover=document.querySelector('.owned-select-popover[aria-label=\"Κατηγορία κανόνα\"]');return {options:popover?.querySelectorAll('[role=option]').length||0,nativeSelects:document.querySelectorAll('select').length||0,modalCount:[...document.querySelectorAll('[aria-modal=true]')].filter(node=>node.getClientRects().length).length}}");
  assert(dropdownState.options>=2,'Category dropdown exposes real category options');
  assert(dropdownState.nativeSelects===0,'Opening a dropdown does not introduce browser-native select UI');
  assert(dropdownState.modalCount>=2,'Shared dropdown remains the topmost modal layer over the Rules editor');
  await screenshot('settings-rules-editor-category-dropdown-desktop');
  const dropdownClosed=await c.call("function(){const button=document.querySelector('.owned-select-popover[aria-label=\"Κατηγορία κανόνα\"] button[aria-label=\"Κλείσιμο επιλογών\"]');if(!button)return false;button.click();return true}");
  assert(dropdownClosed,'Category shared dropdown closes');
  await waitFor("function(){return !document.querySelector('.owned-select-popover[aria-label=\"Κατηγορία κανόνα\"]')}",'Rules category dropdown close');

  const escaped=await c.call("function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return true}");
  assert(escaped,'Escape event dispatched');
  await waitFor("function(){return !document.querySelector('[data-rule-editor]')}",'Rules editor Escape close');
  await waitFor("function(){return document.activeElement?.classList.contains('rules-new-button')}",'Rules editor focus return');

  const editOpened=await c.call("function(){const button=document.querySelector('.settings-rules-only .rule-settings-list button[aria-label^=\"Επεξεργασία αυτοματισμού\"]');if(!button)return false;button.click();return true}");
  assert(editOpened,'Existing rule edit action opens the editor');
  await waitFor("function(){return Boolean(document.querySelector('[data-rule-editor]'))}",'Existing rule editor');
  const editState=await c.call("function(){const modal=document.querySelector('[data-rule-editor]');const title=modal?.querySelector('#rule-editor-title')?.textContent||'';const name=modal?.querySelector('.rules-name-field input')?.value||'';return {title,name}}");
  assert(editState.title.includes('Επεξεργασία κανόνα'),'Edit modal has edit identity');
  assert(Boolean(editState.name),'Edit modal loads the persisted rule name');
  await screenshot('settings-rules-edit-modal-desktop');
  await closeEditor();

  await viewport(375,812);
  await openCreate();
  const mobileModal=await c.call("function(){const modal=document.querySelector('[data-rule-editor]');const rect=modal?.getBoundingClientRect();const offenders=[...(modal?.querySelectorAll('button,[role=combobox]')||[])].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.width<40||r.height<40)}).map(el=>({label:el.getAttribute('aria-label')||(el.textContent||'').trim().slice(0,40),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}));return {width:rect?.width||0,height:rect?.height||0,left:rect?.left||0,bottom:rect?.bottom||0,offenders,nativeSelects:modal?.querySelectorAll('select').length||0}}");
  assert(mobileModal.nativeSelects===0,'Mobile Rules editor keeps app-owned selects');
  assert(mobileModal.width<=375&&mobileModal.left>=-1,'Mobile Rules editor is viewport-contained');
  assert(mobileModal.height<=812*.9,'Mobile Rules editor remains a contained sheet');
  assert(mobileModal.offenders.length===0,`Mobile Rules modal touch targets below 40px: ${JSON.stringify(mobileModal.offenders.slice(0,6))}`);
  await screenshot('settings-rules-editor-mobile');
  await closeEditor();

  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);
  assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);
  c.close();
  console.log('Settings Rules modal rendered QA passed on desktop and mobile.');
}finally{
  c?.close();
  child.kill('SIGTERM');
}
