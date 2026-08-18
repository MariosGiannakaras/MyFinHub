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
  await viewport(375,812);await c.send('Page.navigate',{url:baseUrl});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'workspace');

  console.log('Owned controls QA: Quick Entry');
  await clickText('button','Γρήγορη προσθήκη');await waitFor("function(){return Boolean(document.querySelector('.quick-modal'))}",'Quick Entry');await assertOwned('quick-modal','Quick Entry');
  await c.call("function(){const button=document.querySelector('button[aria-label=\"Κλείσιμο καταχώρισης\"]');if(!button)return false;button.click();return true}");await waitFor("function(){return !document.querySelector('.quick-modal')}",'Quick Entry close');

  const routeChecks=[['.mobile-nav button','Αποταμίευση','Αποταμίευση','Νέα','savings-dialog'],['.mobile-more-menu button','Πιστωτική','Πιστωτική Κάρτα','Νέα αγορά','credit-dialog'],['.mobile-more-menu button','Δόσεις & Δάνεια','Δόσεις & Δάνεια','Νέο','loan-editor-dialog'],['.mobile-more-menu button','Δανεικά / Οφειλές','Δανεικά & επιστροφές','Νέα κίνηση','lending-dialog'],['.mobile-more-menu button','Πάγια','Πάγια & Συνδρομές','Νέο πάγιο','editor-dialog']];
  for(const [selector,label,heading,action,dialogClass] of routeChecks){
    console.log(`Owned controls QA: ${heading}`);
    if(selector.includes('mobile-more')){const opened=await c.call("function(){return document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')?.getAttribute('aria-expanded')==='true'}");if(!opened)await c.call("function(){const button=document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]');if(!button)return false;button.click();return true}");await waitFor("function(){return Boolean(document.querySelector('.mobile-more-menu'))}",'More menu')}
    await clickText(selector,label);await waitFor("function(heading){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(heading)}",heading,[heading]);
    await clickText('button',action);await waitFor("function(dialogClass){return Boolean(document.querySelector('.'+dialogClass))}",`${heading} editor`,[dialogClass]);await assertOwned(dialogClass,heading);
    await c.call("function(dialogClass){const dialog=document.querySelector('.'+dialogClass);const close=dialog?.querySelector('.icon-button');if(!close)return false;close.click();return true}",[dialogClass]);await waitFor("function(dialogClass){return !document.querySelector('.'+dialogClass)}",`${heading} editor close`,[dialogClass]);
  }
  console.log('Owned controls QA passed.');
}finally{
  c?.close();
  child.kill('SIGTERM');
}
