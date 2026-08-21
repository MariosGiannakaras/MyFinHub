import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for credit over-limit QA.');
const port=9233;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-credit-overlimit-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Credit over-limit QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<100;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async page=>{const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state','overlimit');await c.send('Page.navigate',{url:url.href});await waitFor("function(page){const expected=page==='credit'?'Πιστωτική Κάρτα':'Αναφορές';return (document.querySelector('#main-workspace h1')?.textContent||'').includes(expected)}",`${page} heading`,[page]);await sleep(100)};

  console.log('Credit over-limit QA: credit page');
  await navigate('credit');
  const credit=await c.call("function(){const stats=document.querySelector('.credit-card-stage-stats');const usage=[...stats?.querySelectorAll(':scope>div')||[]].find(item=>(item.querySelector(':scope>span')?.textContent||'').includes('Χρήση ορίου'));const progress=usage?.querySelector('[role=\"progressbar\"]');const fill=progress?.querySelector('i');return {text:usage?.querySelector(':scope>b')?.textContent||'',warning:usage?.querySelector('small')?.textContent||'',now:progress?.getAttribute('aria-valuenow')||'',max:progress?.getAttribute('aria-valuemax')||'',valueText:progress?.getAttribute('aria-valuetext')||'',fill:fill?.style.width||''}}") ;
  assert(credit.text==='135%','credit page exposes actual 135% utilization');
  assert(credit.warning.includes('Υπέρβαση ορίου κατά'),'credit page explains the over-limit amount');
  assert(credit.now==='100'&&credit.max==='100','visual progress value remains bounded at 100');
  assert(credit.valueText.includes('135%')&&credit.valueText.includes('υπέρβαση ορίου'),'progressbar announces actual over-limit utilization');
  assert(credit.fill==='100%','visual fill remains bounded at 100%');
  const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/credit-overlimit-desktop.png`,Buffer.from(shot.data,'base64'));

  console.log('Credit over-limit QA: reports page');
  await navigate('reports');
  const reports=await c.call("function(){const card=[...document.querySelectorAll('.report-operations-grid>article')].find(item=>(item.querySelector('span')?.textContent||'').includes('Χρήση πιστωτικών'));return {headline:card?.querySelector('b')?.textContent||'',drilldown:document.querySelector('.credit-report-drilldown')?.textContent||''}}") ;
  assert(reports.headline==='135%','reports headline exposes actual 135% utilization');
  assert(reports.drilldown.includes('Χρήση 135%'),'reports card drill-down exposes actual over-limit utilization');

  c.close();console.log('Credit over-limit QA passed.');
}finally{child.kill('SIGTERM')}
