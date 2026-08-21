import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for refresh-route QA.');
const port=9234;const profile='/tmp/myfinhub-refresh-route-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<60;i++){try{const response=await fetch(url);if(response.ok)return response}catch{}await sleep(250)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Refresh-route QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);const targetUrl=`${baseUrl}?page=reports`;const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`,{method:'PUT'}).then(response=>response.json());c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<80;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'Reports before refresh');
  const before=await c.call("function(){return {href:location.href,search:location.search,heading:document.querySelector('#main-workspace h1')?.textContent||''}}");
  assert(await c.call("function(){const button=document.querySelector('button[aria-label=\"Ανανέωση δεδομένων\"]');if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.click();return true}"),'refresh button is functional');
  await waitFor("function(){return Boolean(document.querySelector('.page-skeleton[role=\"status\"][aria-label=\"Ανανέωση δεδομένων\"]'))}",'in-place PageSkeleton');
  const during=await c.call("function(){return {search:location.search,hasShell:Boolean(document.querySelector('.app-shell')),hasSkeleton:Boolean(document.querySelector('.page-skeleton')),refreshDisabled:Boolean(document.querySelector('button[aria-label=\"Ανανέωση δεδομένων\"]')?.disabled)}}");
  assert(during.search===before.search,'manual refresh preserves the current route/query');assert(during.hasShell&&during.hasSkeleton,'refresh replaces only workspace content with a skeleton');assert(during.refreshDisabled,'refresh action is disabled while reload is active');
  mkdirSync('/tmp/myfinhub-ui-ux-qa',{recursive:true});const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('/tmp/myfinhub-ui-ux-qa/refresh-in-place-reports.png',Buffer.from(shot.data,'base64'));
  await waitFor("function(){return !document.querySelector('.page-skeleton')&&(document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'Reports restored after refresh');
  const after=await c.call("function(){return {search:location.search,heading:document.querySelector('#main-workspace h1')?.textContent||''}}");assert(after.search===before.search,'route remains unchanged after refresh completes');assert(after.heading.includes('Αναφορές'),'same Reports page is restored after refresh');
  console.log('In-place refresh route QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
