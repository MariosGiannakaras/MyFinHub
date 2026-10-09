import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-savings-remediation-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Savings remediation QA.');
const port=9294;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-savings-remediation-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(120)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Savings remediation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const url=new URL(baseUrl);url.searchParams.set('page','savings');url.searchParams.set('state','savings-historical');
  await c.send('Page.navigate',{url:url.href});
  const waitFor=async(fn,label)=>{for(let i=0;i<120;i++){if(await c.call(fn))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'Savings heading');
  const state=()=>c.call("function(){const label=[...document.querySelectorAll('.period-control>span')].find(node=>!node.classList.contains('app-tooltip'));const route=document.querySelector('.savings-route-target');const routeValues=[...route?.querySelectorAll('em')||[]].map(node=>(node.textContent||'').replace(/\\s+/g,' ').trim());const goal=[...document.querySelectorAll('.savings-goal-row.personal')].find(row=>(row.textContent||'').includes('Ταμείο ασφαλείας'));return {period:(label?.textContent||'').trim(),heading:(document.querySelector('.savings-month-card h2')?.textContent||'').trim(),routeValues,goalBalance:(goal?.querySelector(':scope > strong')?.textContent||'').replace(/\\s+/g,' ').trim(),goalProgress:(goal?.querySelector('.savings-goal-progress b')?.textContent||'').trim()}}");
  const clickPeriod=async direction=>{const label=direction==='previous'?'Προηγούμενος μήνας':'Επόμενος μήνας';const ok=await c.call("function(label){const button=[...document.querySelectorAll('.period-control button[aria-label]')].find(node=>(node.getAttribute('aria-label')||'').startsWith(label));if(!button||button.disabled)return false;button.click();return true}",[label]);assert(ok,`missing enabled ${label} control`)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};

  await sleep(450);
  const august=await state();
  assert(august.period.includes('Αύγουστος 2026')&&august.heading==='Αυτός ο μήνας','current Savings state identifies August as the current reporting month');
  assert(august.routeValues.length===2&&august.goalBalance&&august.goalProgress,'current Savings route and personal-goal snapshot are rendered');

  await clickPeriod('previous');
  await waitFor("function(){return [...document.querySelectorAll('.period-control>span')].some(node=>(node.textContent||'').includes('Ιούλιος 2026'))}",'July reporting period');
  await sleep(350);
  const july=await state();
  assert(july.heading.includes('Ιούλιος 2026'),'historical Savings heading uses the selected month label');
  assert(JSON.stringify(july.routeValues)!==JSON.stringify(august.routeValues),'historical Savings route balances change with the selected period end');
  assert(july.goalBalance!==august.goalBalance&&july.goalProgress!==august.goalProgress,'historical personal-goal balance and progress use the selected period end');
  await screenshot('savings-selected-period-july');

  await clickPeriod('next');
  await waitFor("function(){return [...document.querySelectorAll('.period-control>span')].some(node=>(node.textContent||'').includes('Αύγουστος 2026'))}",'August reporting period restored');
  await sleep(350);
  const restored=await state();
  assert(restored.heading==='Αυτός ο μήνας'&&JSON.stringify(restored.routeValues)===JSON.stringify(august.routeValues)&&restored.goalBalance===august.goalBalance&&restored.goalProgress===august.goalProgress,'Savings current-period balances and goal progress restore after historical browsing');
  await screenshot('savings-selected-period-august-restored');
  c.close();console.log('Savings remediation QA passed. Evidence: '+evidenceDir);
}finally{child.kill('SIGTERM')}
