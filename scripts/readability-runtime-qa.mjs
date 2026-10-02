import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-readability-runtime-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for readability runtime QA.');
const port=9351;
const profile='/tmp/myfinhub-readability-runtime-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<160;i++){try{const r=await fetch(url);if(r.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const r=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Runtime call failed');return r.result.value}
  close(){this.ws?.close()}
}
const assert=(v,m)=>{if(!v)throw new Error(`Readability runtime QA assertion failed: ${m}`)};
let c;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<140;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
  const shot=async name=>{const image=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(image.data,'base64'))};
  const inspect=async label=>{
    const state=await c.call(`function(){
      const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
      const controls=[...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=tab],[role=radio]')].filter(visible);
      const rogue=controls.filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}).length;
      return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,rogue,textSize:document.documentElement.dataset.textSize,motion:document.documentElement.dataset.motion,theme:document.documentElement.dataset.theme,h1:(document.querySelector('h1')?.textContent||'').trim()};
    }`);
    assert(state.overflow<=1,`${label}: horizontal overflow ${state.overflow}`);
    assert(state.rogue===0,`${label}: off-viewport interactive controls ${state.rogue}`);
    assert(state.textSize==='large',`${label}: large text preference missing`);
    assert(state.motion==='reduced',`${label}: reduced motion preference missing`);
    return state;
  };
  const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',reports:'Αναφορές',settings:'Ρυθμίσεις'};
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-color-scheme',value:'dark'}]});
  await c.send('Emulation.setDeviceMetricsOverride',{width:720,height:500,deviceScaleFactor:2,mobile:false});
  for(const [page,heading] of Object.entries(pages)){
    const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('text','large');url.searchParams.set('motion','reduced');
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`${page} heading`,[heading]);
    await c.call(`async function(){localStorage.setItem('myfinhub.theme','system');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('system');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true}`);
    const state=await inspect(`200pct/${page}`);
    assert(state.theme==='dark',`${page}: System theme did not resolve emulated OS dark`);
    await shot(`readability-200pct-${page}-dark`);
  }

  // Keep the current page mounted while the OS preference changes: no reload/navigation.
  const before=await c.call("function(){return {href:location.href,heading:document.querySelector('#main-workspace h1')?.textContent||''}}");
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-color-scheme',value:'light'}]});
  await waitFor("function(){return document.documentElement.dataset.theme==='light'}",'System light theme live update');
  const after=await inspect('system-theme-live-change');
  assert(after.theme==='light','System theme follows OS light without reload');
  const identity=await c.call("function(){return {href:location.href,heading:document.querySelector('#main-workspace h1')?.textContent||''}}");
  assert(identity.href===before.href&&identity.heading===before.heading,'System theme update does not navigate or reload the route');
  await shot('readability-200pct-system-light-live');

  console.log('Readability runtime QA passed: 200%-equivalent reflow, large text, reduced motion and live System theme changes.');
}finally{try{c?.close()}catch{}child.kill('SIGTERM');await sleep(200);rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
