import { spawn, execFileSync } from 'node:child_process';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for owned-controls QA.');
const port=9224;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/rheomiq-owned-controls-qa','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=(promise,label,ms=6000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Timed out: ${label}`)),ms))]);
async function waitHttp(url){for(let i=0;i<60;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(250)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await timeout(new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);clearTimeout(pending.timer);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}}),'CDP websocket open')}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Timed out waiting for CDP ${method}`))},6000);this.pending.set(id,{resolve,reject,timer});try{this.ws.send(JSON.stringify({id,method,params}))}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error)}})}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('CDP connection closed'))}this.pending.clear();this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Owned controls QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await timeout(fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json()),'create Chrome target');
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<70;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clickText=async(selector,text)=>assert(await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').includes(text));if(!node)return false;node.click();return true}",[selector,text]),`missing ${text}`);
  await viewport(375,812);await c.send('Page.navigate',{url:baseUrl});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'workspace');
  console.log('Owned controls QA: Quick Entry');
  await clickText('button','Γρήγορη προσθήκη');await waitFor("function(){return Boolean(document.querySelector('.quick-modal'))}",'Quick Entry');
  assert(await c.eval("document.querySelectorAll('.quick-modal select,.quick-modal input[type=\"date\"]').length===0"),'Quick Entry has no native select/date controls');
  assert(await c.call("function(){const input=document.querySelector('.quick-modal .owned-select-shell input');if(!input)return false;input.click();return true}"),'Quick Entry owned select opens');
  await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=\"listbox\"]'))}",'owned listbox');
  assert(await c.eval("document.querySelector('.owned-select-popover').contains(document.activeElement)"),'listbox traps focus');
  assert(await c.eval("(()=>{const r=document.querySelector('.owned-select-popover').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()"),'listbox stays within viewport');
  await c.eval("document.querySelector('.owned-select-popover [role=\"option\"]')?.click()");
  assert(await c.call("function(){const input=document.querySelector('.quick-modal .owned-date-shell input');if(!input)return false;input.click();return true}"),'Quick Entry owned date opens');
  await waitFor("function(){return Boolean(document.querySelector('.owned-calendar-grid[role=\"grid\"]'))}",'owned calendar');
  assert(await c.eval("document.querySelector('.owned-date-popover').contains(document.activeElement)"),'calendar traps focus');
  assert(await c.eval("document.querySelectorAll('.owned-calendar-grid [role=\"gridcell\"]').length===42"),'calendar renders six-week grid');
  assert(await c.eval("parseFloat(getComputedStyle(document.querySelector('.owned-date-shell input')).fontSize)>=15.9"),'owned date input uses mobile-safe font size');
  await c.eval("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}))");await waitFor("function(){return !document.querySelector('.owned-date-popover')}",'calendar Escape close');
  await c.eval("document.querySelector('button[aria-label=\"Κλείσιμο καταχώρισης\"]')?.click()");await waitFor("function(){return !document.querySelector('.quick-modal')}",'Quick Entry close');

  const routeChecks=[['.mobile-nav button','Αποταμίευση','Αποταμίευση','Νέα','savings-dialog'],['.mobile-more-menu button','Πιστωτική','Πιστωτική Κάρτα','Νέα αγορά','credit-dialog'],['.mobile-more-menu button','Δόσεις & Δάνεια','Δόσεις & Δάνεια','Νέο','loan-editor-dialog'],['.mobile-more-menu button','Δανεικά / Οφειλές','Δανεικά & επιστροφές','Νέα κίνηση','lending-dialog'],['.mobile-more-menu button','Πάγια','Πάγια & Συνδρομές','Νέο πάγιο','editor-dialog']];
  for(const [selector,label,heading,action,dialogClass] of routeChecks){
    console.log(`Owned controls QA: ${heading}`);
    if(selector.includes('mobile-more')){const opened=await c.eval("document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')?.getAttribute('aria-expanded')==='true'");if(!opened)await c.eval("document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')?.click()");await waitFor("function(){return Boolean(document.querySelector('.mobile-more-menu'))}",'More menu')}
    await clickText(selector,label);await waitFor("function(heading){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(heading)}",heading,[heading]);
    await clickText('button',action);await waitFor("function(dialogClass){return Boolean(document.querySelector('.'+dialogClass))}",`${heading} editor`,[dialogClass]);
    assert(await c.call("function(dialogClass){const dialog=document.querySelector('.'+dialogClass);return Boolean(dialog)&&dialog.querySelectorAll('select,input[type=\"date\"]').length===0&&dialog.querySelectorAll('.owned-input-shell').length>0}",[dialogClass]),`${heading} editor uses only app-owned date/select popovers`);
    await c.call("function(dialogClass){const dialog=document.querySelector('.'+dialogClass);const close=dialog?.querySelector('.icon-button');if(!close)return false;close.click();return true}",[dialogClass]);
    await waitFor("function(dialogClass){return !document.querySelector('.'+dialogClass)}",`${heading} editor close`,[dialogClass]);
  }
  console.log('Owned controls QA passed.');
}finally{
  c?.close();
  child.kill('SIGTERM');
}
