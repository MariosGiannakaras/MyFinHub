import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-large-data-boundaries-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for large-data boundaries QA.');
const port=9341;
const profile='/tmp/myfinhub-large-data-boundaries-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stopBrowser(process){if(!process||process.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{process.kill('SIGKILL');resolve()},2000);process.once('exit',()=>{clearTimeout(timer);resolve()});process.kill('SIGTERM')})}
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Large-data QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Performance.enable');
  const waitFor=async(fn,label,args=[],limit=140)=>{for(let i=0;i<limit;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
  const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  const urlFor=page=>{const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state','large');url.searchParams.set('motion','reduced');return url.href};
  const navigate=async(page,heading,width=1280,height=900,mobile=false)=>{await viewport(width,height,mobile);const started=Date.now();await c.send('Page.navigate',{url:urlFor(page)});await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`${page} heading`,[heading]);await sleep(120);return Date.now()-started};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const noOverflow=async label=>{const overflow=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(overflow<=1,`${label} horizontal overflow ${overflow}px`)};
  const heapMb=async()=>{const metrics=(await c.send('Performance.getMetrics')).metrics||[];const used=metrics.find(item=>item.name==='JSHeapUsedSize')?.value||0;return used/1024/1024};
  const domSize=()=>c.call("function(){return document.getElementsByTagName('*').length}");

  const results={};

  results.reportsLoadMs=await navigate('reports','Αναφορές');
  await waitFor("function(){return Boolean(document.querySelector('.reports-dashboard .report-kpi-strip'))}",'large reports dashboard');
  const reports=await c.call("function(){return {charts:document.querySelectorAll('.recharts-wrapper').length,dom:document.getElementsByTagName('*').length,budgetAttention:document.querySelectorAll('.report-budget-attention-row').length,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(reports.charts>0&&reports.charts<=6,`large reports chart count is bounded (${reports.charts})`);
  assert(reports.dom<9000,`large reports DOM remains bounded (${reports.dom})`);
  assert(reports.overflow<=1,'large reports has no horizontal overflow');
  assert(await c.call("function(){const details=document.querySelector('details[data-budget-management],#report-budgets');if(!details)return false;details.open=true;details.dispatchEvent(new Event('toggle',{bubbles:false}));return true}"),'budget management disclosure exists');
  await waitFor("function(){return document.querySelectorAll('.budget-setting-row').length>0}",'large budget rows');
  const initialBudgets=await c.call("function(){return {count:document.querySelectorAll('.budget-setting-row').length,more:Boolean(document.querySelector('.budget-settings-more'))}}");
  assert(initialBudgets.count>0&&initialBudgets.count<=24,`budget DOM is initially bounded (${initialBudgets.count})`);
  assert(initialBudgets.more,'large budgets expose progressive disclosure');
  const firstBudgetDeleteLabel=await c.call("function(){return document.querySelector('.budget-setting-row button[aria-label^=\"Διαγραφή προϋπολογισμού\"]')?.getAttribute('aria-label')||''}");
  assert(firstBudgetDeleteLabel,'large budget delete action exists');
  const deleteLatencyStart=Date.now();
  assert(await c.call("function(label){const button=[...document.querySelectorAll('.budget-setting-row button[aria-label^=\"Διαγραφή προϋπολογισμού\"]')].find(node=>node.getAttribute('aria-label')===label);if(!button)return false;button.click();return true}",[firstBudgetDeleteLabel]),'large budget delete action is actionable');
  await waitFor("function(label){return ![...document.querySelectorAll('.budget-setting-row button[aria-label^=\"Διαγραφή προϋπολογισμού\"]')].some(node=>node.getAttribute('aria-label')===label)}",'large budget mutation',[firstBudgetDeleteLabel]);
  results.budgetDeleteLatencyMs=Date.now()-deleteLatencyStart;
  assert(results.budgetDeleteLatencyMs<1500,`large budget mutation latency ${results.budgetDeleteLatencyMs}ms`);
  results.reportsHeapMb=await heapMb();
  assert(results.reportsHeapMb<256,`large reports heap ${results.reportsHeapMb.toFixed(1)} MiB`);
  await screenshot('large-reports-desktop');

  results.recurringLoadMs=await navigate('recurring','Πάγια & Συνδρομές');
  const recurring=await c.call("function(){return {rows:document.querySelectorAll('.recurring-workspace-table tbody tr[data-recurring-status=active]').length,more:Boolean(document.querySelector('.desktop-recurring-more')),dom:document.getElementsByTagName('*').length}}");
  assert(recurring.rows>0&&recurring.rows<=24,`desktop recurring DOM is bounded (${recurring.rows})`);
  assert(recurring.more,'large recurring exposes desktop progressive disclosure');
  assert(recurring.dom<7000,`large recurring DOM remains bounded (${recurring.dom})`);
  await noOverflow('large recurring desktop');
  await screenshot('large-recurring-desktop');

  results.recurringMobileLoadMs=await navigate('recurring','Πάγια & Συνδρομές',375,812,true);
  const recurringMobile=await c.call("function(){return {rows:document.querySelectorAll('.mobile-recurring-row').length,more:Boolean(document.querySelector('.mobile-recurring-more')),dom:document.getElementsByTagName('*').length}}");
  assert(recurringMobile.rows>0&&recurringMobile.rows<=12,`mobile recurring DOM is bounded (${recurringMobile.rows})`);
  assert(recurringMobile.more,'large recurring exposes mobile progressive disclosure');
  assert(recurringMobile.dom<7000,`large recurring mobile DOM remains bounded (${recurringMobile.dom})`);
  await noOverflow('large recurring mobile');
  await screenshot('large-recurring-mobile');

  results.planningLoadMs=await navigate('planning','Προγραμματισμός & πρόβλεψη ρευστότητας');
  const planning=await c.call("function(){return {rows:document.querySelectorAll('.scheduled-row').length,more:Boolean(document.querySelector('.planning-scheduled-more')),legacyCharts:document.querySelectorAll('.forecast-chart .recharts-wrapper').length,approvedForecast:Boolean(document.querySelector('[data-planning-approved-desktop] .planning-approved-forecast')),approvedKpis:document.querySelectorAll('[data-planning-approved-desktop] .planning-forecast-kpi').length,history:document.querySelectorAll('.scheduled-history-list>div').length,dom:document.getElementsByTagName('*').length}}");
  assert(planning.rows>0&&planning.rows<=12,`planning scheduled DOM is bounded (${planning.rows})`);
  assert(planning.more,'large planning exposes scheduled progressive disclosure');
  assert(planning.approvedForecast&&planning.approvedKpis===3,`approved planning forecast remains bounded and visible (${JSON.stringify(planning)})`);
  assert(planning.legacyCharts<=1,`legacy planning chart DOM stays bounded when present (${planning.legacyCharts})`);
  assert(planning.history<=8,`scheduled audit history is bounded (${planning.history})`);
  assert(planning.dom<7000,`large planning DOM remains bounded (${planning.dom})`);
  await noOverflow('large planning desktop');
  await screenshot('large-planning-desktop');

  results.dashboardLoadMs=await navigate('dashboard','Οι λογαριασμοί μου');
  assert(await c.call("function(){const button=document.querySelector('.top-actions button[aria-label=\"Ιστορικό αλλαγών\"]');button?.click();return Boolean(button)}"),'change history action exists');
  await waitFor("function(){return Boolean(document.querySelector('#change-history-title'))}",'large change history dialog');
  const history=await c.call("function(){return {rows:document.querySelectorAll('.history-row').length,meta:(document.querySelector('.command-result-meta')?.textContent||''),dom:document.getElementsByTagName('*').length,dialogFocused:Boolean(document.querySelector('#change-history-title')?.closest('[role=dialog]')===document.activeElement)}}");
  assert(history.rows===100,`durable history is capped at 100 rows (${history.rows})`);
  assert(history.meta.includes('100')&&history.meta.includes('10 ημέρες'),'history retention contract is visible');
  assert(history.dom<7000,`history dialog DOM remains bounded (${history.dom})`);
  results.historyHeapMb=await heapMb();
  assert(results.historyHeapMb<256,`large history heap ${results.historyHeapMb.toFixed(1)} MiB`);
  await screenshot('large-history-dialog-desktop');

  results.settingsLoadMs=await navigate('settings','Ρυθμίσεις');
  assert(await c.call("function(){const button=[...document.querySelectorAll('.settings-tablist button')].find(node=>(node.textContent||'').includes('Κανόνες'));button?.click();return Boolean(button)}"),'Settings rules tab exists');
  await waitFor("function(){return document.querySelectorAll('.rule-settings-list>article').length>0}",'large transaction rules');
  const rules=await c.call("function(){return {rows:document.querySelectorAll('.rule-settings-list>article').length,more:Boolean(document.querySelector('.rule-settings-more')),dom:document.getElementsByTagName('*').length}}");
  assert(rules.rows>0&&rules.rows<=24,`rules DOM is initially bounded (${rules.rows})`);
  assert(rules.more,'large rules expose progressive disclosure');
  assert(rules.dom<7000,`large rules DOM remains bounded (${rules.dom})`);
  await noOverflow('large settings rules desktop');
  await screenshot('large-rules-desktop');

  results.maxLoadMs=Math.max(results.reportsLoadMs,results.recurringLoadMs,results.recurringMobileLoadMs,results.planningLoadMs,results.dashboardLoadMs,results.settingsLoadMs);
  assert(results.maxLoadMs<5000,`large-state route readiness stays under 5s (${results.maxLoadMs}ms)`);
  writeFileSync(`${evidenceDir}/large-data-metrics.json`,JSON.stringify(results,null,2));
  console.log(`Large-data boundaries QA passed: max route readiness ${results.maxLoadMs}ms, budget mutation ${results.budgetDeleteLatencyMs}ms, reports heap ${results.reportsHeapMb.toFixed(1)} MiB, history heap ${results.historyHeapMb.toFixed(1)} MiB.`);
}finally{
  try{c?.close()}catch{}
  await stopBrowser(child);
}
