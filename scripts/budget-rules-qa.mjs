import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Budget/Rules QA.');
const port=9242;
const profile='/tmp/myfinhub-budget-rules-qa-chrome';
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
const assert=(value,message)=>{if(!value)throw new Error(`Budget/Rules QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];
  c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
  c.on('Network.loadingFailed',params=>{if(!params.canceled&&params.errorText!=='net::ERR_ABORTED')failedRequests.push(`${params.errorText||'network failure'} [${params.type||'unknown'}]`)});
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const urlFor=(page,state='budget-rules')=>{const url=new URL(baseUrl);url.searchParams.set('page',page);if(state)url.searchParams.set('state',state);return url.href};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(page,state='budget-rules',width=1440,height=1000)=>{await viewport(width,height);await c.send('Page.navigate',{url:urlFor(page,state)});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",`${page} heading`);await sleep(140)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text)&&item.getClientRects().length>0);node?.click();return Boolean(node)}",[selector,text]);assert(ok,`missing clickable ${text}`);await sleep(100)};
  const clickAria=async label=>{const ok=await c.call("function(label){const node=document.querySelector(`button[aria-label=\"${CSS.escape(label)}\"]`);node?.click();return Boolean(node)}",[label]);assert(ok,`missing aria control ${label}`);await sleep(100)};
  const setLabelInput=async(label,value)=>{const ok=await c.call(`function(label,value){const row=[...document.querySelectorAll('label')].find(node=>(node.querySelector(':scope > span')?.textContent||'').trim().includes(label));const input=row?.querySelector('input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}`,[label,value]);assert(ok,`missing input ${label}`);await sleep(80)};
  const ownedValue=label=>c.call("function(label){const row=[...document.querySelectorAll('label')].find(node=>(node.querySelector(':scope > span')?.textContent||'').trim().includes(label));return row?.querySelector('input[role=\"combobox\"]')?.value||''}",[label]);
  const noOverflow=async label=>{const value=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(value<=1,`${label} horizontal overflow ${value}px`)};
  const touchTargets=async label=>{const offenders=await c.call("function(){return [...document.querySelectorAll('#main-workspace button,#main-workspace summary,.mobile-nav button,.topbar button')].filter(el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden'||el.disabled)return false;return r.width<40||r.height<40}).map(el=>({name:el.getAttribute('aria-label')||(el.textContent||'').trim().slice(0,45),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}))}");assert(offenders.length===0,`${label} touch targets below 40px: ${JSON.stringify(offenders.slice(0,8))}`)};

  console.log('Budget/Rules QA: Dashboard and Reports budget integration');
  await navigate('dashboard');
  assert(await c.call("function(){return document.querySelector('[data-budget-panel]')?.textContent.includes('Σταθερά έξοδα')&&document.querySelector('[data-budget-panel]')?.textContent.includes('Υπέρβαση')}"),'dashboard shows exceeded category budget');
  await clickText('[data-budget-panel] button','Αναλυτική εικόνα budgets');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'reports navigation');
  assert(await c.call("function(){const panel=document.querySelector('[data-budget-panel]');return Boolean(panel&&panel.querySelector('[role=progressbar]')&&panel.textContent.includes('Σταθερά έξοδα'))}"),'reports detailed budget progress');

  console.log('Budget/Rules QA: Advanced Automations is secondary and human-facing');
  await navigate('settings');
  assert(await c.call("function(){const details=document.querySelector('[data-advanced-automations]');return Boolean(details&&!details.open)}"),'advanced automations is collapsed by default');
  const hiddenText=await c.call("function(){return document.querySelector('[data-advanced-automations]')?.textContent||''}");
  assert(!hiddenText.includes('First match wins')&&!hiddenText.includes('Προτεραιότητα'),'low-level rule-engine terminology is absent');
  await clickText('[data-advanced-automations] summary','Προχωρημένα · Αυτοματισμοί');
  await waitFor("function(){return Boolean(document.querySelector('[data-advanced-automations]')?.open)}",'advanced automations open');
  const builderLabels=await c.call("function(){const details=document.querySelector('[data-advanced-automations]');const text=details?.textContent||'';return text.includes('Όταν η περιγραφή')&&text.includes('Τότε βάλε κατηγορία')&&text.includes('Πότε να λειτουργεί')}" );
  assert(builderLabels,'human condition-action builder labels');
  assert((await ownedValue('Πότε να λειτουργεί'))==='Όταν την καταχωρίζω εγώ','human source-scope selection');
  await screenshot('advanced-automations-desktop');

  console.log('Budget/Rules QA: read-only preview, creation and deterministic direct reordering');
  await setLabelInput('Όνομα αυτοματισμού','QA Market first');
  await setLabelInput('Κείμενο περιγραφής','QA Market');
  await waitFor("function(){const text=document.querySelector('.rule-preview')?.textContent||'';return text.includes('1 υπάρχουσες')&&text.includes('QA Market Match')}",'rule preview with matching example');
  assert((await c.call("function(){return document.querySelector('.rule-preview')?.textContent||''}")).includes('Δεν αλλάζει καμία από αυτές'),'preview explicitly does not mutate history');
  await clickText('.rule-settings-panel .save-button','Προσθήκη αυτοματισμού');
  await waitFor("function(){return (document.querySelector('.rule-settings-list')?.textContent||'').includes('1. QA Market first')}",'first automation creation');
  await setLabelInput('Όνομα αυτοματισμού','QA Market second');
  await setLabelInput('Κείμενο περιγραφής','QA Market');
  await clickText('.rule-settings-panel .save-button','Προσθήκη αυτοματισμού');
  await waitFor("function(){const rows=[...document.querySelectorAll('.rule-settings-list article')];return rows.length===2&&(rows[0].textContent||'').includes('1. QA Market first')&&(rows[1].textContent||'').includes('2. QA Market second')}",'second automation ordered after first');
  await clickAria('Μετακίνηση αυτοματισμού QA Market first προς τα κάτω');
  await waitFor("function(){const rows=[...document.querySelectorAll('.rule-settings-list article')];return (rows[0]?.textContent||'').includes('1. QA Market second')&&(rows[1]?.textContent||'').includes('2. QA Market first')}",'automation direct reorder');
  assert(await c.call("function(){return Boolean(document.querySelector('button[aria-label=\"Μετακίνηση αυτοματισμού QA Market second προς τα πάνω\"]')?.disabled)}"),'top move-up control is disabled at boundary');
  await screenshot('advanced-automations-ordered-desktop');

  console.log('Budget/Rules QA: pause, edit and deletion remain explicit');
  await clickText('.rule-settings-list .secondary','Παύση');
  assert(await c.call("function(){return Boolean(document.querySelector('.rule-settings-list article.disabled'))}"),'automation pause state');
  await clickAria('Επεξεργασία αυτοματισμού QA Market second');
  await waitFor("function(){return [...document.querySelectorAll('.rule-settings-panel button')].some(button=>(button.textContent||'').includes('Ενημέρωση αυτοματισμού'))}",'automation edit mode');
  await clickText('.rule-settings-panel .secondary','Ακύρωση επεξεργασίας');
  await clickAria('Διαγραφή αυτοματισμού QA Market first');
  await waitFor("function(){return !(document.querySelector('.rule-settings-list')?.textContent||'').includes('QA Market first')}",'automation deletion');

  console.log('Budget/Rules QA: budgets still edit independently of Advanced Automations');
  await setLabelInput('Όριο €','75');
  await clickText('.budget-settings-panel button','Αποθήκευση budget');
  await waitFor("function(){return (document.querySelector('.budget-settings-list')?.textContent||'').includes('75')}",'budget update');
  assert(!(await c.call("function(){return document.querySelector('.top-actions button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]')?.disabled??true}")),'budget update participates in undo');
  await clickAria('Αναίρεση τελευταίας αλλαγής');

  console.log('Budget/Rules QA: mobile Advanced Automations accessibility and containment');
  await navigate('settings','budget-rules',375,812);
  await noOverflow('budget/rules mobile settings');await touchTargets('budget/rules mobile settings');
  await clickText('[data-advanced-automations] summary','Προχωρημένα · Αυτοματισμοί');
  await noOverflow('advanced automations mobile open');await touchTargets('advanced automations mobile open');
  assert(await c.call("function(){const grid=document.querySelector('.rule-editor-grid');return Boolean(grid&&grid.getBoundingClientRect().width<=innerWidth)}"),'automation builder contained on mobile');
  await screenshot('advanced-automations-mobile');
  await navigate('reports','empty',320,700);
  assert(await c.call("function(){return (document.querySelector('[data-budget-panel]')?.textContent||'').includes('Δεν υπάρχουν budgets')}"),'reports no-budget state');
  await noOverflow('budget/rules narrow reports');
  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);
  assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);
  c.close();
  console.log('Budget and Advanced Automations rendered QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
