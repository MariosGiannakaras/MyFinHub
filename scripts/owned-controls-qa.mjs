import { spawn, execFileSync } from 'node:child_process';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for owned-controls QA.');
const port=9224;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/rheomiq-owned-controls-qa','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<60;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(250)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Owned controls QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<70;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clickText=async(selector,text)=>assert(await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').includes(text));if(!node)return false;node.click();return true}",[selector,text]),`missing ${text}`);
  const assertOwned=async(dialogClass,label)=>assert(await c.call("function(dialogClass){const dialog=document.querySelector('.'+dialogClass);if(!dialog)return false;const shells=[...dialog.querySelectorAll('.owned-input-shell')];return dialog.querySelectorAll('select,input[type=\"date\"]').length===0&&shells.length>0&&shells.every(shell=>{const input=shell.querySelector('input');return input&&parseFloat(getComputedStyle(input).fontSize)>=15.9&&((shell.classList.contains('owned-select-shell')&&input.getAttribute('role')==='combobox'&&input.getAttribute('aria-haspopup')==='listbox')||(shell.classList.contains('owned-date-shell')&&input.getAttribute('aria-haspopup')==='dialog'))})}",[dialogClass]),`${label} uses rendered app-owned controls`);
  const assertNoNativeSelects=async(label)=>assert(await c.call("function(){return document.querySelectorAll('.workspace select').length===0}"),`${label} has no native select controls`);
  const exerciseNestedSelect=async(dialogClass,label)=>{
    const listboxId=await c.call("function(dialogClass){const dialog=document.querySelector('.'+dialogClass);const trigger=dialog?.querySelector('.owned-select-shell input[role=\"combobox\"]');if(!trigger)return '';trigger.focus();trigger.click();return trigger.getAttribute('aria-controls')||''}",[dialogClass]);
    if(!listboxId)return;
    await waitFor("function(id){const listbox=document.getElementById(id);const popover=listbox?.closest('.owned-select-popover');return Boolean(popover&&popover.contains(document.activeElement)&&!(document.activeElement instanceof HTMLButtonElement&&document.activeElement.disabled))}",`${label} nested select focus`,[listboxId]);
    assert(await c.call("function(id){const listbox=document.getElementById(id);const trigger=[...document.querySelectorAll('.owned-select-shell input[role=\"combobox\"]')].find(input=>input.getAttribute('aria-controls')===id);return Boolean(listbox&&listbox.getAttribute('role')==='listbox'&&trigger&&trigger.getAttribute('aria-expanded')==='true')}",[listboxId]),`${label} combobox controls the rendered listbox`);
    assert(await c.call("function(){const button=document.querySelector('.owned-select-popover button[aria-label=\"Κλείσιμο επιλογών\"]');if(!button)return false;button.click();return true}"),`${label} nested select close button`);
    await waitFor("function(id){return !document.getElementById(id)}",`${label} nested select close`,[listboxId]);
    await waitFor("function(id){const trigger=[...document.querySelectorAll('.owned-select-shell input[role=\"combobox\"]')].find(input=>input.getAttribute('aria-controls')===id);return Boolean(trigger&&document.activeElement===trigger&&trigger.getAttribute('aria-expanded')==='false')}",`${label} nested select focus restore`,[listboxId]);
  };
  const exerciseLendingSuggestions=async()=>{
    assert(await c.call("function(){const dialog=document.querySelector('.lending-dialog');return Boolean(dialog&&!dialog.querySelector('datalist'))}"),'Lending has no native datalist at runtime');
    const firstPerson=await c.call("function(){return document.querySelector('.known-people-suggestions [role=\"option\"]')?.textContent?.trim()||''}");
    assert(firstPerson,'Lending renders known-person suggestions');
    const prefix=firstPerson.slice(0,1);
    assert(await c.call("function(value){const input=document.querySelector('.lending-person-field input');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));return true}",[prefix]),'Lending person input accepts typed filter');
    await waitFor("function(){const input=document.querySelector('.lending-person-field input');const list=document.getElementById('known-people-options');return Boolean(input&&list&&input.getAttribute('aria-autocomplete')==='list'&&input.getAttribute('aria-controls')===list.id&&list.getAttribute('role')==='listbox'&&list.querySelector('[role=\"option\"]'))}",'Lending owned suggestion list after typing');
  };
  const openMore=async()=>{const opened=await c.call("function(){return document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')?.getAttribute('aria-expanded')==='true'}");if(!opened)await c.call("function(){const button=document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]');if(!button)return false;button.click();return true}");await waitFor("function(){return Boolean(document.querySelector('.mobile-more-menu'))}",'More menu')};
  await viewport(375,812);await c.send('Page.navigate',{url:baseUrl});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'workspace');

  console.log('Owned controls QA: Quick Entry');
  await clickText('button','Γρήγορη προσθήκη');await waitFor("function(){return Boolean(document.querySelector('.quick-modal'))}",'Quick Entry');await assertOwned('quick-modal','Quick Entry');await exerciseNestedSelect('quick-modal','Quick Entry');
  await c.call("function(){const button=document.querySelector('button[aria-label=\"Κλείσιμο καταχώρισης\"]');if(!button)return false;button.click();return true}");await waitFor("function(){return !document.querySelector('.quick-modal')}",'Quick Entry close');

  const routeChecks=[['.mobile-nav button','Αποταμίευση','Αποταμίευση','Νέα','savings-dialog'],['.mobile-more-menu button','Πιστωτική','Πιστωτική Κάρτα','Νέα αγορά','credit-dialog'],['.mobile-more-menu button','Δόσεις & Δάνεια','Δόσεις & Δάνεια','Νέο','loan-editor-dialog'],['.mobile-more-menu button','Δανεικά / Οφειλές','Δανεικά & επιστροφές','Νέα κίνηση','lending-dialog'],['.mobile-more-menu button','Πάγια','Πάγια & Συνδρομές','Νέο πάγιο','editor-dialog']];
  for(const [selector,label,heading,action,dialogClass] of routeChecks){
    console.log(`Owned controls QA: ${heading}`);
    if(selector.includes('mobile-more'))await openMore();
    await clickText(selector,label);await waitFor("function(heading){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(heading)}",heading,[heading]);
    await assertNoNativeSelects(heading);
    await clickText('button',action);await waitFor("function(dialogClass){return Boolean(document.querySelector('.'+dialogClass))}",`${heading} editor`,[dialogClass]);await assertOwned(dialogClass,heading);await exerciseNestedSelect(dialogClass,heading);
    if(heading==='Δανεικά & επιστροφές')await exerciseLendingSuggestions();
    await c.call("function(dialogClass){const dialog=document.querySelector('.'+dialogClass);const close=dialog?.querySelector('.icon-button');if(!close)return false;close.click();return true}",[dialogClass]);await waitFor("function(dialogClass){return !document.querySelector('.'+dialogClass)}",`${heading} editor close`,[dialogClass]);
  }

  console.log('Owned controls QA: Cards creation');
  await clickText('.mobile-nav button','Κάρτες');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')}",'Cards heading');await assertNoNativeSelects('Cards');
  assert(await c.call("function(){const button=[...document.querySelectorAll('.bank-add-btn')].find(item=>!item.disabled);if(!button)return false;button.click();return true}"),'open card creation');
  await waitFor("function(){return Boolean(document.querySelector('.card-create-modal'))}",'card creation dialog');await assertOwned('card-create-modal','Card creation');await exerciseNestedSelect('card-create-modal','Card creation');
  assert(await c.call("function(){const button=document.querySelector('.card-create-modal .close-picker');if(!button)return false;button.click();return true}"),'close card creation');await waitFor("function(){return !document.querySelector('.card-create-modal')}",'card creation close');

  console.log('Owned controls QA: Transactions and Settings page filters');
  await clickText('.mobile-nav button','Συναλλαγές');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Συναλλαγές')}",'Transactions heading');await assertNoNativeSelects('Transactions');assert(await c.call("function(){return document.querySelectorAll('.mobile-transaction-filters .owned-select-shell').length>=2}"),'Transactions mobile filters use owned selects');
  await openMore();await clickText('.mobile-more-menu button','Ρυθμίσεις');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'Settings heading');await assertNoNativeSelects('Settings');assert(await c.call("function(){return document.querySelectorAll('.settings-form .owned-select-shell').length>=3}"),'Settings defaults use owned selects');

  console.log('Owned controls QA passed.');
}finally{
  c?.close();
  child.kill('SIGTERM');
}
