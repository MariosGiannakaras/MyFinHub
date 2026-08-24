import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-credit-statements-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for credit statements QA.');
const port=9258;
const profile='/tmp/myfinhub-credit-statements-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Credit statements QA assertion failed: ${message}`)};
const shot=async(c,name)=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','credit');url.searchParams.set('motion','reduced');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πιστωτική Κάρτα')&&Boolean(document.querySelector('[data-credit-statements]'))}",'credit statement page');

  const hierarchy=await c.call("function(){const statements=document.querySelector('[data-credit-statements]');const purchases=document.querySelector('.credit-purchases-table');const primary=document.querySelector('[data-primary-credit-statement]');return {statementBeforePurchases:Boolean(statements&&purchases&&(statements.compareDocumentPosition(purchases)&Node.DOCUMENT_POSITION_FOLLOWING)),primary:primary?.textContent||'',pay:primary?.querySelector('button.save-button')?.textContent||'',overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(hierarchy.statementBeforePurchases,'statements are presented before raw purchase history');
  assert(hierarchy.primary.includes('20/08/2026')&&hierarchy.primary.includes('90,00'),'primary statement exposes due date and remaining balance');
  assert(hierarchy.pay.includes('Πληρωμή'),'primary unpaid statement exposes payment CTA');
  assert(hierarchy.overflow<=1,`desktop horizontal overflow ${hierarchy.overflow}px`);
  await shot(c,'credit-statements-active-desktop');

  await c.call("function(){document.querySelector('[data-primary-credit-statement] button.save-button')?.click();return true}");
  await waitFor("function(){return Boolean(document.querySelector('[data-credit-statement-payment-preview]'))}",'statement payment preview');
  const preview=await c.call("function(){const box=document.querySelector('[data-credit-statement-payment-preview]');return {text:box?.textContent||'',effect:document.querySelector('.payment-effect-summary')?.textContent||''}}");
  assert(preview.text.includes('90,00')&&preview.text.includes('Ακουστικά'),'payment preview shows remaining balance and included purchase');
  assert(preview.effect.includes('δήλωση')&&preview.effect.includes('μία πραγματική κίνηση'),'payment confirmation preserves one-real-event semantics');
  await shot(c,'credit-statement-payment-desktop');
  await c.call("function(){document.querySelector('.contextual-quick-modal button[aria-label*=\"Κλείσιμο\"]')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'payment modal close');

  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return Boolean(document.querySelector('[data-primary-credit-statement]'))}",'mobile statement page');
  const mobile=await c.call("function(){const overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;const controls=[...document.querySelectorAll('[data-credit-statements] button,[data-credit-statements] summary')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});return {overflow,minTouch:controls.length?Math.min(...controls.map(el=>el.getBoundingClientRect().height)):99}}");
  assert(mobile.overflow<=1,`mobile horizontal overflow ${mobile.overflow}px`);
  assert(mobile.minTouch>=41,`mobile statement touch target ${mobile.minTouch}px`);
  await shot(c,'credit-statements-active-mobile');

  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return Boolean(document.querySelector('.page-heading'))}",'credit page reset');
  await c.call("function(){const button=[...document.querySelectorAll('.page-heading button')].find(item=>(item.textContent||'').includes('Αρχείο καρτών'));button?.click();return Boolean(button)}");
  await waitFor("function(){return Boolean(document.querySelector('.card-archive-manager'))}",'archive manager');
  const archive=await c.call("function(){const row=[...document.querySelectorAll('.card-archive-row')].find(item=>(item.textContent||'').includes('QA Settled'));return {text:row?.textContent||'',deleteEnabled:Boolean(row?.querySelector('button.danger:not([disabled])'))}}");
  assert(archive.text.includes('Statements 1'),'archive manager preserves statement count');
  assert(archive.deleteEnabled,'settled archived card remains eligible for hard delete');
  await c.call("function(){const row=[...document.querySelectorAll('.card-archive-row')].find(item=>(item.textContent||'').includes('QA Settled'));row?.querySelector('button.danger:not([disabled])')?.click();return true}");
  await waitFor("function(){return [...document.querySelectorAll('[role=dialog] button')].some(item=>(item.textContent||'').includes('Ολική διαγραφή'))}",'hard-delete confirmation');
  await c.call("function(){const buttons=[...document.querySelectorAll('[role=dialog] button')];const confirm=buttons.find(item=>(item.textContent||'').includes('Ολική διαγραφή'));confirm?.click();return Boolean(confirm)}");
  await waitFor("function(){return Boolean(document.querySelector('[data-deleted-statement-history]'))}",'deleted statement history');
  await c.call("function(){document.querySelector('.card-archive-manager .close-picker')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.card-archive-manager')}",'archive manager close after deletion');
  const deleted=await c.call("function(){const section=document.querySelector('.deleted-credit-history');return {text:section?.textContent||'',leaks:/QA Settled|2222|ΠΕΙΡΑΙΩΣ/.test(section?.textContent||''),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(deleted.text.includes('Διαγραμμένη κάρτα')&&deleted.text.includes('δήλωση'),'deleted-card statement history stays readable with neutral identity');
  assert(!deleted.leaks,'deleted statement history does not retain nickname, last4 or bank identity');
  assert(deleted.overflow<=1,`deleted history desktop overflow ${deleted.overflow}px`);
  await shot(c,'credit-deleted-statement-history-desktop');

  c.close();console.log('Credit statement lifecycle rendered QA passed.');
}finally{child.kill('SIGTERM')}
