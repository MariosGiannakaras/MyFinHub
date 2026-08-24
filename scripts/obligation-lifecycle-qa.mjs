import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-obligation-lifecycle-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for obligation lifecycle QA.');
const port=9250;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-obligation-lifecycle-qa-chrome','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Obligation lifecycle QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?page=loans`)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const navigate=async(page,width=1280,height=900,extra='')=>{await viewport(width,height);await c.send('Page.navigate',{url:`${baseUrl}?page=${page}${extra}`});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",`${page} heading`);await sleep(160)};
  const shot=async name=>{const image=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(image.data,'base64'))};
  const clickRow=async(selector,text,buttonSelector)=>{const ok=await c.call("function(selector,text,buttonSelector){const row=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').includes(text)&&item.getClientRects().length>0);const button=row?.querySelector(buttonSelector);button?.click();return Boolean(button)}",[selector,text,buttonSelector]);assert(ok,`missing ${buttonSelector} for ${text}`);await sleep(100)};
  const noOverflow=async label=>{const overflow=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(overflow<=2,`${label} horizontal overflow ${overflow}px`)};

  console.log('Obligation lifecycle QA: active loans dominate baseline');
  await navigate('loans');
  const loanBaseline=await c.call("function(){const history=document.querySelector('[data-loan-history]');const active=[...document.querySelectorAll('[data-loan-lifecycle=active]')];return {active:active.length,historyOpen:Boolean(history?.open),activePay:active.filter(row=>row.querySelector('.pay')).length,summary:(document.querySelector('.loan-toolbar')?.textContent||''),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+2}}");
  assert(loanBaseline.active>=2,'baseline active loans render');assert(!loanBaseline.historyOpen,'completed loan history is collapsed by default');assert(loanBaseline.activePay===loanBaseline.active,'every active loan has an immediate payment action');assert(loanBaseline.summary.includes('ενεργές')&&loanBaseline.summary.includes('ολοκληρωμένες'),'toolbar reports lifecycle counts');assert(!loanBaseline.overflow,'loan baseline has no overflow');
  await shot('loans-active-desktop');

  console.log('Obligation lifecycle QA: completing a loan moves it into history without payment CTA');
  await clickRow('[data-loan-lifecycle=active]','Laptop','.pay');
  await waitFor("function(){return Boolean(document.querySelector('.contextual-quick-modal'))}",'loan payment modal');
  const opened=await c.call("function(){const modal=document.querySelector('.contextual-quick-modal');const label=[...modal?.querySelectorAll('label')||[]].find(item=>(item.querySelector('span')?.textContent||'').includes('Πόσες δόσεις'));const input=label?.querySelector('input[role=combobox]');input?.click();return Boolean(input)}");assert(opened,'installment-count selector exists');
  await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=listbox]'))}",'installment options');
  const choseAll=await c.call("function(){const options=[...document.querySelectorAll('.owned-select-popover [role=option]:not(:disabled)')];const last=options.at(-1);last?.click();return Boolean(last)}");assert(choseAll,'maximum installment option is selectable');await sleep(120);
  const confirmed=await c.call("function(){const button=[...document.querySelectorAll('.contextual-quick-modal button')].find(item=>(item.textContent||'').includes('Επιβεβαίωση πληρωμής'));button?.click();return Boolean(button)}");assert(confirmed,'loan completion payment confirms');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')&&!([...document.querySelectorAll('[data-loan-lifecycle=active]')].some(row=>(row.textContent||'').includes('Laptop')))}",'completed loan leaves active list');
  const collapsedCompletion=await c.call("function(){const history=document.querySelector('[data-loan-history]');return {open:Boolean(history?.open),count:(history?.querySelector('summary strong')?.textContent||''),visibleLaptop:[...document.querySelectorAll('[data-loan-lifecycle=completed]')].some(row=>row.getClientRects().length>0&&(row.textContent||'').includes('Laptop'))}}");
  assert(!collapsedCompletion.open&&!collapsedCompletion.visibleLaptop,'completed loan is hidden in collapsed history');assert(Number(collapsedCompletion.count)>=1,'completed history count increments');
  await shot('loans-completed-collapsed-desktop');
  assert(await c.call("function(){const summary=document.querySelector('[data-loan-history] summary');summary?.click();return Boolean(summary)}"),'completed history summary is actionable');
  await waitFor("function(){return [...document.querySelectorAll('[data-loan-lifecycle=completed]')].some(row=>row.getClientRects().length>0&&(row.textContent||'').includes('Laptop'))}",'completed Laptop history row');
  const completed=await c.call("function(){const row=[...document.querySelectorAll('[data-loan-lifecycle=completed]')].find(item=>(item.textContent||'').includes('Laptop'));const progress=row?.querySelector('[role=progressbar]');return {pay:Boolean(row?.querySelector('.pay,.forgive')),edit:Boolean(row?.querySelector('.loan-list-actions button')),status:(row?.textContent||'').includes('Ολοκληρώθηκε'),progress:Number(progress?.getAttribute('aria-valuenow')),max:Number(progress?.getAttribute('aria-valuemax'))}}");
  assert(!completed.pay&&completed.edit&&completed.status,'completed loan keeps edit/history state but no payment or forgiveness CTA');assert(completed.progress===completed.max,'completed loan progress remains semantically complete');
  await shot('loans-completed-history-desktop');
  await viewport(375,812);await sleep(180);await noOverflow('completed loans mobile');const mobileLoan=await c.call("function(){const summary=document.querySelector('[data-loan-history] summary');const actions=[...document.querySelectorAll('[data-loan-lifecycle=completed] .loan-list-actions button')].filter(item=>item.getClientRects().length>0);return {summaryHeight:summary?.getBoundingClientRect().height||0,actionHeights:actions.map(item=>item.getBoundingClientRect().height)}}");assert(mobileLoan.summaryHeight>=41&&mobileLoan.actionHeights.every(height=>height>=41),'completed history remains touch accessible on mobile');await shot('loans-completed-history-mobile');

  console.log('Obligation lifecycle QA: active recurring items precede linked loans and inactive history');
  await navigate('recurring');
  const recurringBaseline=await c.call("function(){const active=document.querySelector('[data-active-recurring]');const linked=document.querySelector('.long-term-recurring');const history=document.querySelector('[data-inactive-recurring-history]');const position=node=>node?[...document.querySelectorAll('.page-stack>*')].indexOf(node):-1;return {activeRows:document.querySelectorAll('[data-recurring-status=active]').length,activePosition:position(active),linkedPosition:position(linked),historyPosition:position(history),historyOpen:Boolean(history?.open),summaryCards:document.querySelectorAll('.recurring-summary-grid>article').length,linkedRows:document.querySelectorAll('[data-linked-loan]').length}}");
  assert(recurringBaseline.activeRows>=2,'active recurring obligations render');assert(recurringBaseline.activePosition>=0&&recurringBaseline.linkedPosition>recurringBaseline.activePosition&&recurringBaseline.historyPosition>recurringBaseline.linkedPosition,'active recurring work precedes linked loans and inactive history');assert(!recurringBaseline.historyOpen,'inactive recurring history is collapsed by default');assert(recurringBaseline.summaryCards===2,'summary focuses on active total and next payment');assert(recurringBaseline.linkedRows===1,'linked long-term loan remains one canonical visible obligation');
  await shot('recurring-active-desktop');

  console.log('Obligation lifecycle QA: paused recurring items move into collapsed restorable history');
  await clickRow('.recurring-workspace-table tbody tr','Cloud','button[aria-label^="Παύση"]');
  await waitFor("function(){return !([...document.querySelectorAll('.recurring-workspace-table tbody tr')].some(row=>(row.textContent||'').includes('Cloud')))&&Number(document.querySelector('[data-inactive-recurring-history] summary strong')?.textContent||0)>=1}",'Cloud moves to inactive history');
  const inactiveCollapsed=await c.call("function(){const history=document.querySelector('[data-inactive-recurring-history]');return {open:Boolean(history?.open),visibleCloud:[...history?.querySelectorAll('[data-recurring-status]')||[]].some(row=>row.getClientRects().length>0&&(row.textContent||'').includes('Cloud'))}}");assert(!inactiveCollapsed.open&&!inactiveCollapsed.visibleCloud,'paused item is hidden in collapsed history');await shot('recurring-inactive-collapsed-desktop');
  assert(await c.call("function(){const summary=document.querySelector('[data-inactive-recurring-history] summary');summary?.click();return Boolean(summary)}"),'inactive history disclosure is actionable');
  await waitFor("function(){return [...document.querySelectorAll('[data-inactive-recurring-history] [data-recurring-status=paused]')].some(row=>row.getClientRects().length>0&&(row.textContent||'').includes('Cloud'))}",'paused Cloud history row');
  const inactiveExpanded=await c.call("function(){const row=[...document.querySelectorAll('[data-inactive-recurring-history] [data-recurring-status=paused]')].find(item=>(item.textContent||'').includes('Cloud'));return {edit:Boolean(row?.querySelector('button[aria-label^=\"Επεξεργασία\"]')),restore:Boolean(row?.querySelector('button[aria-label^=\"Ενεργοποίηση\"]')),pay:Boolean(row?.querySelector('.pay-action,.mobile-pay-action'))}}");assert(inactiveExpanded.edit&&inactiveExpanded.restore&&!inactiveExpanded.pay,'inactive recurring item remains editable/restorable without payment CTA');await shot('recurring-inactive-history-desktop');
  await viewport(375,812);await sleep(180);await noOverflow('recurring history mobile');const mobileRecurring=await c.call("function(){const summary=document.querySelector('[data-inactive-recurring-history] summary');const buttons=[...document.querySelectorAll('[data-inactive-recurring-history] .row-actions button')].filter(item=>item.getClientRects().length>0);return {summaryHeight:summary?.getBoundingClientRect().height||0,buttonHeights:buttons.map(item=>item.getBoundingClientRect().height)}}");assert(mobileRecurring.summaryHeight>=41&&mobileRecurring.buttonHeights.every(height=>height>=41),'inactive recurring history remains touch accessible on mobile');await shot('recurring-inactive-history-mobile');

  console.log('Obligation lifecycle QA: extreme recurring list remains usable');
  await navigate('recurring',375,812,'&state=extreme');await noOverflow('extreme recurring mobile');const extreme=await c.call("function(){return {active:document.querySelectorAll('.mobile-recurring-row[data-recurring-status=active]').length,historyOpen:Boolean(document.querySelector('[data-inactive-recurring-history]')?.open),summaryCards:document.querySelectorAll('.recurring-summary-grid>article').length}}");assert(extreme.active>=20&&!extreme.historyOpen&&extreme.summaryCards===2,'extreme active list preserves hierarchy with collapsed history');await shot('recurring-extreme-mobile');

  c.close();console.log('Obligation lifecycle rendered QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
