import { execFileSync, spawn } from 'node:child_process';

const baseUrl=process.env.MYFINHUB_PERF_URL||'http://127.0.0.1:4173/qa.html';
const configured=process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chromium is required for scale interaction audit.');
const port=9271;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-scale-audit-chrome','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Scale interaction audit failed: ${message}`)};
let c;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[],limit=120)=>{for(let i=0;i<limit;i++){if(await c.call(fn,args))return;await sleep(50)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(page)=>{const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state','large');url.searchParams.set('motion','reduced');await c.send('Page.navigate',{url:url.href});await waitFor("function(page){return document.querySelector('.app-shell')?.getAttribute('data-page')===page}",page,[page])};

  console.log('Scale audit: 1,500+ transaction pagination and search remain bounded');
  await navigate('transactions');
  const initial=await c.call(`function(){return {
    total:document.querySelector('.transactions-ledger-footer span')?.textContent||'',
    visible:document.querySelectorAll('.transactions-approved-table tbody .transaction-row').length,
    nodes:document.getElementsByTagName('*').length,
    first:document.querySelector('.transactions-approved-table tbody .transaction-row')?.textContent||''
  }}`);
  assert(initial.total.includes('1500')||/1[45-9]\d\d/.test(initial.total),`large transaction total missing: ${initial.total}`);
  assert(initial.visible<=50,`transaction page rendered ${initial.visible} desktop rows instead of bounded pagination`);
  assert(initial.nodes<12000,`transactions DOM is unexpectedly large: ${initial.nodes} nodes`);

  const searchMs=await c.call(`async function(){
    const input=document.querySelector('input[aria-label="Αναζήτηση συναλλαγών"]');
    if(!input)return -1;
    const start=performance.now();
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'Large dataset unique search target');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    for(let i=0;i<80;i++){if(document.body.textContent.includes('Large dataset unique search target'))return performance.now()-start;await new Promise(r=>setTimeout(r,10))}
    return 99999;
  }`);
  assert(searchMs>=0&&searchMs<2000,`large transaction search took ${Math.round(searchMs)}ms`);

  console.log('Scale audit: 120 budgets and report analytics stay bounded');
  await navigate('reports');
  const reports=await c.call("function(){return {nodes:document.getElementsByTagName('*').length,budgets:(document.querySelector('[data-budget-overview]')?.textContent||''),charts:document.querySelectorAll('.report-chart-frame').length}}");
  assert(reports.nodes<15000,`reports DOM is unexpectedly large: ${reports.nodes} nodes`);
  assert(reports.charts>=2,'report charts did not render under large finance state');
  assert(reports.budgets.includes('Προϋπολογισμοί'),'large budget report overview is missing');

  console.log('Scale audit: 120 scheduled/recurring rows and 100 history entries remain usable');
  await navigate('planning');
  const planning=await c.call("function(){return {nodes:document.getElementsByTagName('*').length,text:document.querySelector('#main-workspace')?.textContent||''}}");
  assert(planning.nodes<15000,`planning DOM is unexpectedly large: ${planning.nodes} nodes`);
  assert(planning.text.includes('Large scheduled 120')||planning.text.includes('Large scheduled'),'large scheduled data is not represented in Planning');

  const historyOpenMs=await c.call(`async function(){
    const button=document.querySelector('button[aria-label="Ιστορικό αλλαγών"]');if(!button)return -1;
    const start=performance.now();button.click();
    for(let i=0;i<100;i++){if(document.querySelectorAll('.history-row').length===100)return performance.now()-start;await new Promise(r=>setTimeout(r,10))}
    return 99999;
  }`);
  const history=await c.call("function(){return {rows:document.querySelectorAll('.history-row').length,nodes:document.getElementsByTagName('*').length,meta:document.querySelector('.command-result-meta')?.textContent||''}}");
  assert(history.rows===100,`history rendered ${history.rows} rows instead of the bounded 100`);
  assert(history.meta.includes('100 πρόσφατες εγγραφές'),'history retention count is not communicated');
  assert(history.nodes<15000,`history DOM is unexpectedly large: ${history.nodes} nodes`);
  assert(historyOpenMs>=0&&historyOpenMs<2000,`opening 100-entry history took ${Math.round(historyOpenMs)}ms`);

  console.log(`Scale interaction audit passed: search ${Math.round(searchMs)}ms · history open ${Math.round(historyOpenMs)}ms.`);
}finally{c?.close();child.kill('SIGTERM')}
