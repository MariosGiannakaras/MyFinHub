import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for runtime QA.');
const port=9232;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-runtime-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  on(method,listener){const list=this.listeners.get(method)||[];list.push(listener);this.listeners.set(method,list)}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const listener of this.listeners.get(message.method)||[])listener(message.params||{})}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`UI/UX runtime QA assertion failed: ${message}`)};
const PAGE_HEADINGS={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',reports:'Αναφορές',settings:'Ρυθμίσεις'};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();
  await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Log.enable');await c.send('Network.enable');
  const findings=[];
  const describeArg=arg=>arg.value!==undefined?String(arg.value):arg.description||arg.type||'console value';
  c.on('Runtime.exceptionThrown',params=>findings.push(`runtime exception: ${params.exceptionDetails?.exception?.description||params.exceptionDetails?.text||'unknown exception'}`));
  c.on('Runtime.consoleAPICalled',params=>{if(params.type==='error'||params.type==='assert')findings.push(`console.${params.type}: ${(params.args||[]).map(describeArg).join(' ')}`)});
  c.on('Log.entryAdded',params=>{const entry=params.entry;if(entry?.level==='error')findings.push(`browser log: ${entry.text||'error entry'}${entry.url?` @ ${entry.url}`:''}`)});
  c.on('Network.loadingFailed',params=>{const text=params.errorText||'request failed';if(!params.canceled&&text!=='net::ERR_ABORTED')findings.push(`network failure: ${text} ${params.blockedReason||''}`.trim())});
  c.on('Network.responseReceived',params=>{const response=params.response;if(response?.status>=400)findings.push(`HTTP ${response.status}: ${response.url}`)});
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const urlFor=params=>{const url=new URL(baseUrl);for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));return url.href};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<100;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clean=async label=>{await sleep(220);assert(findings.length===0,`${label}: ${findings.join(' | ')}`)};
  const navigate=async(params,heading)=>{findings.length=0;await c.send('Page.navigate',{url:urlFor(params)});if(heading)await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`heading ${heading}`,[heading]);else await waitFor("function(){return document.readyState==='complete'&&Boolean(document.body?.innerText.trim())}",'document ready');await clean(JSON.stringify(params))};

  console.log('Runtime QA: console/network checks across desktop routes');
  await viewport(1440,1000);for(const [page,heading] of Object.entries(PAGE_HEADINGS))await navigate({page},heading);
  console.log('Runtime QA: console/network checks across mobile routes');
  await viewport(375,812);for(const [page,heading] of Object.entries(PAGE_HEADINGS))await navigate({page},heading);
  console.log('Runtime QA: auth, loading, conflict and error-state surfaces');
  for(const screen of ['login','mfa','mfa-enroll'])await navigate({screen},null);
  await navigate({page:'dashboard',save:'loading'},PAGE_HEADINGS.dashboard);const shot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/runtime-loading-state.png`,Buffer.from(shot.data,'base64'));
  await navigate({page:'dashboard',save:'conflict'},PAGE_HEADINGS.dashboard);
  await navigate({page:'dashboard',save:'error'},PAGE_HEADINGS.dashboard);

  c.close();console.log('UI/UX runtime console/network QA passed.');
}finally{child.kill('SIGTERM')}
