import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl='http://127.0.0.1:5173/qa.html?screen=404&visual=1';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-not-found-accessibility-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for 404 accessibility QA.');
const port=9268;
const profile='/tmp/myfinhub-not-found-accessibility-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stopBrowser(process){if(!process||process.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{process.kill('SIGKILL');resolve()},2000);process.once('exit',()=>{clearTimeout(timer);resolve()});process.kill('SIGTERM')})}
async function waitHttp(url){for(let i=0;i<100;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`404 accessibility QA assertion failed: ${message}`)};
let c;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const applyTheme=async preference=>c.call("async function(pref){localStorage.setItem('myfinhub.theme',pref);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const root=getComputedStyle(document.documentElement);return {theme:document.documentElement.dataset.theme,pref:document.documentElement.dataset.themePreference,stored:localStorage.getItem('myfinhub.theme'),canvas:root.getPropertyValue('--canvas').trim(),ink:root.getPropertyValue('--ink').trim(),colorScheme:root.colorScheme}}",[preference]);
  for(let i=0;i<120;i+=1){if(await c.call("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#not-found-title'))}"))break;await sleep(100)}
  assert(await c.call("function(){return document.activeElement?.id==='not-found-title'}"),'route title receives programmatic focus');
  assert(await c.call("function(){const title=document.querySelector('#not-found-title');const s=getComputedStyle(title);return title===document.activeElement&&(s.outlineStyle==='none'||parseFloat(s.outlineWidth)===0)&&s.boxShadow==='none'}"),'programmatic title focus stays visually neutral');
  assert(await c.call("function(){const n=document.querySelector('.not-found-route-node.is-missing');return n&&getComputedStyle(n).animationName==='none'}"),'reduced-motion disables the missing-route pulse');

  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await sleep(100);
  assert(await c.call("function(){const a=document.activeElement;return a?.tagName==='BUTTON'&&(a.textContent||'').includes('Dashboard')&&getComputedStyle(a).boxShadow!=='none'}"),'keyboard Tab reaches Dashboard with visible focus');
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await sleep(100);
  assert(await c.call("function(){const a=document.activeElement;return a?.tagName==='BUTTON'&&(a.textContent||'').includes('Πίσω')}"),'keyboard Tab reaches Back action');

  await c.send('Emulation.setDeviceMetricsOverride',{width:720,height:500,deviceScaleFactor:1,mobile:false});
  await sleep(150);
  assert(await c.call("function(){const d=document.documentElement;return d.scrollWidth<=d.clientWidth+1}"),'200%-equivalent reflow does not create horizontal overflow');
  const lightTheme=await applyTheme('light');
  assert(lightTheme.theme==='light'&&lightTheme.pref==='light'&&lightTheme.stored==='light'&&lightTheme.colorScheme==='light','light 404 applies semantic theme tokens');
  const light=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});writeFileSync(`${evidenceDir}/not-found-light-200pct.png`,Buffer.from(light.data,'base64'));

  const darkTheme=await applyTheme('dark');
  assert(darkTheme.theme==='dark'&&darkTheme.pref==='dark'&&darkTheme.stored==='dark'&&darkTheme.colorScheme==='dark'&&darkTheme.canvas!==lightTheme.canvas&&darkTheme.ink!==lightTheme.ink,'dark 404 applies distinct semantic theme tokens');
  assert(await c.call("function(){const d=document.documentElement;return d.scrollWidth<=d.clientWidth+1&&document.querySelector('.not-found-safety')&&document.querySelectorAll('.not-found-actions button').length===2}"),'dark 200%-equivalent 404 remains contained and complete');
  const dark=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});writeFileSync(`${evidenceDir}/not-found-dark-200pct.png`,Buffer.from(dark.data,'base64'));

  console.log('404 accessibility QA passed: focus order, visible keyboard focus, reduced motion and 200%-equivalent responsive reflow.');
}finally{try{c?.close()}catch{}await stopBrowser(child);await sleep(250);rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
