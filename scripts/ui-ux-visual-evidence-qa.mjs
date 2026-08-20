import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for visual evidence QA.');
const port=9231;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-visual-evidence-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',reports:'Αναφορές',settings:'Ρυθμίσεις'};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const navigate=async(page,heading)=>{const url=new URL(baseUrl);url.searchParams.set('page',page);await c.send('Page.navigate',{url:url.href});for(let i=0;i<100;i++){if(await c.call("function(text){return document.readyState==='complete'&&(document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",[heading]))break;if(i===99)throw new Error(`Timed out waiting for visual route ${page}`);await sleep(100)}await sleep(120)};
  const fullPage=async name=>{const metrics=await c.send('Page.getLayoutMetrics');const size=metrics.cssContentSize||metrics.contentSize;const width=Math.max(1,Math.ceil(size.width));const height=Math.max(1,Math.min(16000,Math.ceil(size.height)));const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  for(const [mode,width,height] of [['desktop',1440,1000],['mobile',375,812]]){
    await viewport(width,height);
    for(const [page,heading] of Object.entries(pages)){await navigate(page,heading);await fullPage(`full-${mode}-${page}`)}
  }
  c.close();console.log('Full-page visual evidence QA passed.');
}finally{child.kill('SIGTERM')}
