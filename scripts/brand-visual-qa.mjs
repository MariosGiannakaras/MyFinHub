import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for brand visual QA.');
const port=9235;
const profile='/tmp/myfinhub-brand-visual-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Brand visual QA assertion failed: ${message}`)};
try{
 await waitHttp(`http://127.0.0.1:${port}/json/version`);const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?screen=login`)}`,{method:'PUT'}).then(response=>response.json());const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
 const viewport=(width,height,mobile)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 const waitFor=async(fn,label)=>{for(let i=0;i<100;i++){if(await c.call(fn))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
 const navigate=async url=>{await c.send('Page.navigate',{url});await waitFor("function(){return document.readyState==='complete'&&!!document.body?.innerText.trim()}",'page ready');await sleep(120)};
 const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

 console.log('Brand visual QA: login light/dark contract');await viewport(430,812,true);await navigate(`${baseUrl}?screen=login`);await waitFor("function(){return !!document.querySelector('.login-brand .brand-mark')}",'login brand');
 let state=await c.call("function(){const light=document.querySelector('.login-brand .brand-mark-image-light');const dark=document.querySelector('.login-brand .brand-mark-image-dark');return {marks:document.querySelectorAll('.login-brand .brand-mark-image').length,lightWidth:light?.naturalWidth||0,darkWidth:dark?.naturalWidth||0,lightOpacity:getComputedStyle(light).opacity,darkOpacity:getComputedStyle(dark).opacity,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2}}");
 assert(state.marks===2,'login renders both theme assets');assert(state.lightWidth===192&&state.darkWidth===192,'both login assets load at native 192 width');assert(state.lightOpacity==='1'&&state.darkOpacity==='0','light asset is active by default');assert(!state.overflow,'login brand has no horizontal overflow');await shot('brand-login-light');
 await c.call("function(){document.documentElement.dataset.theme='dark';return true}");await sleep(80);state=await c.call("function(){const light=document.querySelector('.login-brand .brand-mark-image-light');const dark=document.querySelector('.login-brand .brand-mark-image-dark');return {lightOpacity:getComputedStyle(light).opacity,darkOpacity:getComputedStyle(dark).opacity}}");assert(state.lightOpacity==='0'&&state.darkOpacity==='1','explicit dark theme switches only the brand asset');await shot('brand-login-dark-contract');
 await c.call("function(){delete document.documentElement.dataset.theme;return true}");

 console.log('Brand visual QA: desktop shell');await viewport(1440,1000,false);await navigate(baseUrl);await waitFor("function(){return !!document.querySelector('.sidebar .brand-mark-lockup')}",'desktop shell brand');state=await c.call("function(){const mark=document.querySelector('.sidebar .brand-mark-lockup');const image=mark?.querySelector('.brand-mark-image-light');return {visible:!!mark,natural:image?.naturalWidth||0,overflow:mark?mark.scrollWidth>mark.clientWidth+2:false}}");assert(state.visible&&state.natural===192,'desktop shell uses new native brand source');assert(!state.overflow,'desktop shell lockup remains contained');await shot('brand-shell-desktop');

 console.log('Brand visual QA: mobile shell');await viewport(375,812,true);await navigate(baseUrl);await waitFor("function(){return !!document.querySelector('.mobile-brand .brand-mark-lockup')}",'mobile shell brand');state=await c.call("function(){const mark=document.querySelector('.mobile-brand .brand-mark-lockup');const rect=mark?.getBoundingClientRect();return {visible:!!mark,width:rect?.width||0,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2}}");assert(state.visible&&state.width>0&&state.width<=170,'mobile lockup fits its header allocation');assert(!state.overflow,'mobile shell has no horizontal overflow');await shot('brand-shell-mobile');
 c.close();console.log('Brand visual QA passed.');
}finally{child.kill('SIGTERM')}
