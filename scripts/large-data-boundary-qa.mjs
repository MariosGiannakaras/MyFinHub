import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-large-data-boundary';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for large-data boundary QA.');
const port=9361;
const profile='/tmp/myfinhub-large-data-boundary-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i++){try{if((await fetch(url)).ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
 constructor(url){this.url=url;this.id=0;this.pending=new Map()}
 async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const msg=JSON.parse(event.data);if(!msg.id)return;const pending=this.pending.get(msg.id);if(!pending)return;this.pending.delete(msg.id);msg.error?pending.reject(new Error(msg.error.message)):pending.resolve(msg.result)}})}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
 async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}
 close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Large-data boundary QA assertion failed: ${message}`)};
let c=null;
try{
 await waitHttp(`http://127.0.0.1:${port}/json/version`);
 const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Performance.enable');
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const waitFor=async(fn,label,args=[],limit=160)=>{for(let i=0;i<limit;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
 const navigate=async page=>{
   const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state','large');url.searchParams.set('motion','reduced');
   const started=Date.now();await c.send('Page.navigate',{url:url.href});
   await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}",`${page} ready`);
   const elapsed=Date.now()-started;assert(elapsed<5000,`${page} initial large-state render took ${elapsed}ms`);return elapsed;
 };
 const footprint=async label=>{
   const metrics=await c.send('Performance.getMetrics');
   const map=Object.fromEntries(metrics.metrics.map(item=>[item.name,item.value]));
   const dom=await c.call("function(){return document.getElementsByTagName('*').length}");
   const heap=Number(map.JSHeapUsedSize||0);
   assert(dom<15000,`${label} DOM grew to ${dom} nodes`);
   assert(heap<256*1024*1024,`${label} JS heap grew to ${Math.round(heap/1024/1024)} MiB`);
   return {dom,heapMiB:Number((heap/1024/1024).toFixed(1))};
 };
 const click=async selector=>{
   const ok=await c.call("function(selector){const node=document.querySelector(selector);node?.click();return Boolean(node)}",[selector]);
   assert(ok,`missing ${selector}`);
 };
 const summary={};

 summary.transactions={renderMs:await navigate('transactions')};
 const initialRows=await c.call("function(){return document.querySelectorAll('[data-transaction-source]').length}");
 assert(initialRows<=30,`Transactions renders ${initialRows} rows before search`);
 const searchMs=await c.call(`async function(){
   const input=[...document.querySelectorAll('input[aria-label="Αναζήτηση συναλλαγών"]')].find(node=>node.getClientRects().length>0);
   if(!input)return -1;const start=performance.now();
   const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
   setter.call(input,'Large dataset unique search target');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
   for(let i=0;i<60;i++){if(document.body.textContent.includes('Large dataset unique search target'))return performance.now()-start;await new Promise(resolve=>setTimeout(resolve,16))}
   return -1;
 }`);
 assert(searchMs>=0&&searchMs<1500,`Transactions large-data search took ${searchMs}ms`);
 summary.transactions.searchMs=Math.round(searchMs);summary.transactions.footprint=await footprint('transactions');

 summary.planning={renderMs:await navigate('planning')};
 const planningInitial=await c.call("function(){return document.querySelectorAll('.scheduled-row').length}");
 assert(planningInitial<=12,`Planning renders ${planningInitial} scheduled rows initially`);
 assert(await c.call("function(){return Boolean(document.querySelector('.planning-scheduled-more'))}"),'Planning large state has progressive disclosure');
 await click('.planning-scheduled-more');await waitFor("function(){return document.querySelectorAll('.scheduled-row').length>12}",'Planning progressive disclosure');
 const planningExpanded=await c.call("function(){return document.querySelectorAll('.scheduled-row').length}");
 assert(planningExpanded<=24,`Planning first expansion rendered ${planningExpanded} rows instead of one bounded page`);
 summary.planning.initial=planningInitial;summary.planning.expanded=planningExpanded;summary.planning.footprint=await footprint('planning');

 summary.recurring={renderMs:await navigate('recurring')};
 const recurringInitial=await c.call("function(){return document.querySelectorAll('tr[data-recurring-status=active]').length}");
 assert(recurringInitial<=24,`Recurring renders ${recurringInitial} active desktop rows initially`);
 assert(await c.call("function(){return Boolean(document.querySelector('.desktop-recurring-more'))}"),'Recurring large state has progressive disclosure');
 await click('.desktop-recurring-more');await waitFor("function(){return document.querySelectorAll('tr[data-recurring-status=active]').length>24}",'Recurring progressive disclosure');
 const recurringExpanded=await c.call("function(){return document.querySelectorAll('tr[data-recurring-status=active]').length}");
 assert(recurringExpanded<=48,`Recurring first expansion rendered ${recurringExpanded} rows instead of one bounded page`);
 summary.recurring.initial=recurringInitial;summary.recurring.expanded=recurringExpanded;summary.recurring.footprint=await footprint('recurring');

 summary.reports={renderMs:await navigate('reports')};
 const reportAttention=await c.call("function(){return document.querySelectorAll('.report-budget-attention-row').length}");
 assert(reportAttention<=3,`Reports renders ${reportAttention} budget attention rows`);
 const budgetDetails=await c.call("function(){const node=document.querySelector('details[data-budget-management]');node.open=true;node.dispatchEvent(new Event('toggle'));return Boolean(node)}");
 assert(budgetDetails,'Reports budget management disclosure exists');
 await waitFor("function(){return document.querySelectorAll('.budget-setting-row').length>0}",'Reports budget rows');
 const budgetRows=await c.call("function(){return document.querySelectorAll('.budget-setting-row').length}");
 assert(budgetRows<=24,`Budget management renders ${budgetRows} rows initially`);
 assert(await c.call("function(){return Boolean(document.querySelector('.budget-settings-more'))}"),'Budget management large state has progressive disclosure');
 summary.reports.attention=reportAttention;summary.reports.budgets=budgetRows;summary.reports.footprint=await footprint('reports');

 summary.rules={renderMs:await navigate('settings')};
 await click('[aria-controls="settings-panel-rules"]');
 await waitFor("function(){return document.querySelector('[aria-controls="settings-panel-rules"]')?.getAttribute('aria-selected')==='true'}",'Settings Rules tab');
 const rules=await c.call("function(){return document.querySelectorAll('.rule-settings-list article').length}");
 assert(rules<=24,`Rules settings renders ${rules} rows initially`);
 assert(await c.call("function(){return Boolean(document.querySelector('.rule-settings-more'))}"),'Rules large state has progressive disclosure');
 summary.rules.rows=rules;summary.rules.footprint=await footprint('rules');

 await navigate('dashboard');
 await click('button[aria-label="Ιστορικό αλλαγών"]');
 await waitFor("function(){return Boolean(document.querySelector('#change-history-title'))}",'large history dialog');
 const historyRows=await c.call("function(){return document.querySelectorAll('.history-row').length}");
 assert(historyRows===100,`History must remain bounded at exactly 100 entries for the large fixture, got ${historyRows}`);
 summary.history={rows:historyRows,footprint:await footprint('history')};

 writeFileSync(`${evidenceDir}/large-data-summary.json`,JSON.stringify(summary,null,2));
 const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync(`${evidenceDir}/large-data-history.png`,Buffer.from(shot.data,'base64'));
 console.log(`Large-data boundary QA passed: ${JSON.stringify(summary)}`);
}finally{
 try{c?.close()}catch{}
 child.kill('SIGTERM');
 if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(2000)]);
 rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
