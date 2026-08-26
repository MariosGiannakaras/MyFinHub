import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for ledger foundations QA.');
const port=9239;
const profile='/tmp/myfinhub-ledger-foundations-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Ledger foundations QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?page=reports`)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<100;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(ok,`could not click ${text}`);await sleep(120)};
  const setLabelInput=async(label,value)=>{const ok=await c.call("function(label,value){const row=[...document.querySelectorAll('label')].find(item=>[...item.children].some(child=>child.tagName==='SPAN'&&(child.textContent||'').trim().startsWith(label)));const input=row?.querySelector('input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);assert(ok,`could not set ${label}`);await sleep(80)};
  const setAriaInput=async(label,value)=>{const ok=await c.call("function(label,value){const input=document.querySelector(`input[aria-label=\"${label}\"]`);if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);assert(ok,`could not set ${label}`);await sleep(80)};
  const navigate=async(label,heading)=>{await clickText('.sidebar nav button',label);await waitFor("function(heading){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(heading)}",heading,[heading])};
  const splitState=selector=>c.call("function(selector){const row=document.querySelector(selector);const toggle=row?.querySelector('.transaction-split-toggle');return {exists:!!row,toggle:!!toggle,expanded:toggle?.getAttribute('aria-expanded')==='true',parts:row?.querySelectorAll('.transaction-split-part').length||0,text:row?.textContent||'',amount:row?.querySelector('.amount')?.textContent||row?.querySelector('.mobile-transaction-main>strong')?.textContent||''}}",[selector]);
  const expandSplit=async selector=>{assert(await c.call("function(selector){const toggle=document.querySelector(selector)?.querySelector('.transaction-split-toggle');if(!toggle)return false;if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();return true}",[selector]),'split disclosure toggle exists');await waitFor("function(selector){const row=document.querySelector(selector);return row?.querySelector('.transaction-split-toggle')?.getAttribute('aria-expanded')==='true'&&row.querySelectorAll('.transaction-split-part').length>=2}",'split disclosure expands',[selector])};

  await waitFor("function(){return !!document.querySelector('.report-kpis-v2')}",'Reports baseline');
  const reportsBefore=await c.call("function(){return document.querySelector('.report-kpis-v2')?.textContent||''}");

  console.log('Ledger QA: create first-class transfer');
  await navigate('Dashboard','Οι λογαριασμοί μου');
  await clickText('button.primary-action','Γρήγορη προσθήκη');
  await waitFor("function(){return !!document.querySelector('.quick-modal')}",'Quick Add');
  await clickText('.generic-kind-grid button','Μεταφορά');
  await setLabelInput('Ποσό','42.50');
  const transferSelects=await c.call("function(){return [...document.querySelectorAll('.quick-modal [role=combobox]')].map(input=>input.value)}");
  assert(transferSelects.length>=2,'transfer exposes source and destination selectors');
  assert(transferSelects[0]&&transferSelects[1]&&transferSelects[0]!==transferSelects[1],'transfer defaults resolve to two current different accounts');
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.quick-modal')}",'transfer modal close');
  await navigate('Συναλλαγές','Συναλλαγές');
  const transferRow=await c.call("function(){const row=document.querySelector('[data-transaction-kind=transfer]');return row?{text:row.textContent||'',accounts:row.children[3]?.textContent||'',amount:row.querySelector('.amount')?.textContent||''}:null}");
  assert(transferRow,'transfer row is rendered');assert(transferRow.accounts.includes('→'),'transfer row shows account direction');assert(transferRow.amount.includes('↔'),'transfer amount is visually neutral');

  console.log('Ledger QA: edit, undo and redo transfer atomically');
  await c.call("function(){document.querySelector('[data-transaction-kind=transfer] button[aria-label^=\"Επεξεργασία\"]')?.click()}");
  await waitFor("function(){return [...document.querySelectorAll('.quick-modal footer button')].some(button=>(button.textContent||'').includes('Εφαρμογή αλλαγών'))}",'transfer edit mode');
  await setLabelInput('Ποσό','55.25');await clickText('.quick-modal footer button','Εφαρμογή αλλαγών');await waitFor("function(){return !document.querySelector('.quick-modal')}",'transfer edit close');
  let transferText=await c.call("function(){return document.querySelector('[data-transaction-kind=transfer]')?.textContent||''}");assert(transferText.includes('55,25'),'edited transfer amount is visible');
  await c.call("function(){document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]')?.click()}");await sleep(180);transferText=await c.call("function(){return document.querySelector('[data-transaction-kind=transfer]')?.textContent||''}");assert(transferText.includes('42,50'),'undo restores the whole previous transfer');
  await c.call("function(){document.querySelector('button[aria-label=\"Επαναφορά τελευταίας αναιρεμένης αλλαγής\"]')?.click()}");await sleep(180);transferText=await c.call("function(){return document.querySelector('[data-transaction-kind=transfer]')?.textContent||''}");assert(transferText.includes('55,25'),'redo restores the whole edited transfer');

  console.log('Ledger QA: Reports remain neutral after internal transfer');
  await navigate('Αναφορές','οικονομική εικόνα');
  const reportsAfter=await c.call("function(){return document.querySelector('.report-kpis-v2')?.textContent||''}");assert(reportsAfter===reportsBefore,'transfer does not alter income/expense KPI text');

  console.log('Ledger QA: create split transaction from authoritative parts');
  await navigate('Συναλλαγές','Συναλλαγές');await clickText('button.primary-action','Γρήγορη προσθήκη');await waitFor("function(){return !!document.querySelector('.quick-modal')}",'Quick Add split');await clickText('.generic-kind-grid button','Σύνθετη αγορά');
  const splitParentFields=await c.call("function(){const modal=document.querySelector('.quick-modal');const labels=[...modal.querySelectorAll('.form-grid label>span')].map(node=>(node.textContent||'').trim());return {hasAmount:labels.some(label=>label==='Ποσό'),hasCategory:labels.some(label=>label==='Κατηγορία'),focused:document.activeElement?.getAttribute('aria-label')||''}}");assert(!splitParentFields.hasAmount&&!splitParentFields.hasCategory,'split exposes no independent parent amount or category');assert(splitParentFields.focused==='Ποσό μέρους 1','split focuses the first authoritative part amount');
  await setAriaInput('Περιγραφή μέρους 1','Σούπερ μάρκετ');await setAriaInput('Ποσό μέρους 1','70');await setAriaInput('Περιγραφή μέρους 2','Σπίτι');await setAriaInput('Ποσό μέρους 2','30');
  const allocationText=await c.call("function(){return document.querySelector('.split-head [aria-live=polite]')?.textContent||''}");assert(allocationText.includes('Σύνολο')&&allocationText.includes('100,00'),'split editor derives exact total from parts before save');
  await clickText('.quick-modal footer button','Καταχώριση');await waitFor("function(){return !document.querySelector('.quick-modal')}",'split modal close');
  let split=await splitState('[data-transaction-kind=split]');assert(split.exists&&split.toggle,'split parent row and disclosure exist');assert(!split.expanded&&split.parts===0,'split details are compact by default');assert(split.amount.includes('100,00')&&split.amount.includes('−'),'split row shows one derived expense amount');
  await expandSplit('[data-transaction-kind=split]');split=await splitState('[data-transaction-kind=split]');assert(split.parts===2&&split.text.includes('Σούπερ μάρκετ')&&split.text.includes('Σπίτι'),'expanded split shows both authoritative portions');

  console.log('Ledger QA: split edit derives a new total and rejects non-positive parts');
  await c.call("function(){document.querySelector('[data-transaction-kind=split] button[aria-label^=\"Επεξεργασία\"]')?.click()}");
  await waitFor("function(){return [...document.querySelectorAll('.quick-modal footer button')].some(button=>(button.textContent||'').includes('Εφαρμογή αλλαγών'))}",'split edit mode');
  await setAriaInput('Ποσό μέρους 2','0');await clickText('.quick-modal footer button','Εφαρμογή αλλαγών');const splitError=await c.call("function(){return document.querySelector('.quick-modal .form-error')?.textContent||''}");assert(splitError.includes('θετικό'),'zero split part is rejected with direct feedback');
  await setAriaInput('Ποσό μέρους 2','20');const editedTotal=await c.call("function(){return document.querySelector('.split-head [aria-live=polite]')?.textContent||''}");assert(editedTotal.includes('90,00'),'split edit derives the new parent total live');await clickText('.quick-modal footer button','Εφαρμογή αλλαγών');await waitFor("function(){return !document.querySelector('.quick-modal')}",'split corrected close');split=await splitState('[data-transaction-kind=split]');assert(split.amount.includes('90,00')&&!split.expanded&&split.parts===0,'saved split amount follows edited parts and returns compact');await expandSplit('[data-transaction-kind=split]');split=await splitState('[data-transaction-kind=split]');assert(split.parts===2,'edited split keeps both authoritative portions');

  console.log('Ledger QA: delete and undo split atomically');
  await c.call("function(){document.querySelector('[data-transaction-kind=split] button[aria-label^=\"Διαγραφή\"]')?.click()}");
  await waitFor("function(){return Boolean(document.querySelector('[role=alertdialog]'))}",'split delete confirmation');
  const confirmed=await c.call("function(){const dialog=document.querySelector('[role=alertdialog]');const button=[...(dialog?.querySelectorAll('button')||[])].find(node=>(node.textContent||'').trim()==='Διαγραφή');button?.click();return Boolean(button)}");assert(confirmed,'split delete uses app-owned confirmation');
  await waitFor("function(){return !document.querySelector('[data-transaction-kind=split]')}",'split parent delete');let splitExists=await c.call("function(){return !!document.querySelector('[data-transaction-kind=split]')}");assert(!splitExists,'split parent is deleted in one confirmed action');await c.call("function(){document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]')?.click()}");await sleep(180);splitExists=await c.call("function(){return !!document.querySelector('[data-transaction-kind=split]')}");assert(splitExists,'undo restores the entire split parent and portions');

  const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/ledger-foundations-transactions.png`,Buffer.from(shot.data,'base64'));
  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});await sleep(180);let mobile=await splitState('[data-mobile-transaction-kind=split]');const mobileBase=await c.call("function(){return {transfer:!!document.querySelector('[data-mobile-transaction-kind=transfer]'),split:!!document.querySelector('[data-mobile-transaction-kind=split]'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2}}");assert(mobileBase.transfer&&mobileBase.split&&mobile.toggle&&!mobile.expanded,'mobile transaction list preserves transfer and compact split disclosure');assert(!mobileBase.overflow,'ledger transaction mobile view has no horizontal overflow');await expandSplit('[data-mobile-transaction-kind=split]');mobile=await splitState('[data-mobile-transaction-kind=split]');assert(mobile.parts===2,'mobile disclosure exposes both split portions on demand');const mobileShot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/ledger-foundations-mobile.png`,Buffer.from(mobileShot.data,'base64'));
  c.close();console.log('Ledger foundations rendered QA passed.');
}finally{child.kill('SIGTERM');rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100})}