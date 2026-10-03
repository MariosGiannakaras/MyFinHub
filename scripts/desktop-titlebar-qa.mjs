import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-desktop-titlebar-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for desktop title-bar rendered QA.');
const port=9253;
const profile='/tmp/myfinhub-desktop-titlebar-qa-chrome';
rmSync(profile,{recursive:true,force:true});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(120)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Desktop title-bar QA assertion failed: ${message}`)};
const qaUrl=()=>{const url=new URL(baseUrl);url.searchParams.set('page','dashboard');url.searchParams.set('visual','1');url.searchParams.set('desktop-titlebar','1');return url.href};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(qaUrl())}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label)=>{for(let i=0;i<120;i++){if(await c.call(fn))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const shot=async name=>{await sleep(180);const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const applyTheme=preference=>c.call(`async function(pref){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}`,[preference]);
  const state=()=>c.call(`function(){
    const topbar=document.querySelector('.topbar'),actions=document.querySelector('.top-actions');
    if(!topbar||!actions)return null;
    const rect=topbar.getBoundingClientRect(),actionsRect=actions.getBoundingClientRect(),style=getComputedStyle(topbar);
    let cssText='';
    for(const sheet of document.styleSheets){try{for(const rule of sheet.cssRules||[])cssText+=rule.cssText+'\\n'}catch{}}
    return {
      desktop:document.documentElement.dataset.myfinhubDesktop||'',
      theme:document.documentElement.dataset.theme||'',
      layoutWidth:document.documentElement.clientWidth,
      scrollbarGutter:Math.max(0,innerWidth-document.documentElement.clientWidth),
      top:Math.round(rect.top),rightGap:Math.round(document.documentElement.clientWidth-rect.right),height:Math.round(rect.height),
      paddingRight:Math.round(parseFloat(style.paddingRight)||0),
      actionReserve:Math.round(document.documentElement.clientWidth-actionsRect.right),
      dragRule:/app-region:\\s*drag/.test(cssText),
      noDragRule:/app-region:\\s*no-drag/.test(cssText),
      background:style.backgroundColor||style.backgroundImage||'',
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth
    };
  }`);

  await viewport(1440,1000);
  await waitFor("function(){return document.documentElement.dataset.myfinhubDesktop==='true'&&Boolean(document.querySelector('.topbar .top-actions button'))}",'desktop titlebar shell');
  assert((await applyTheme('light'))==='light','light theme applies');
  let current=await state();
  assert(current?.desktop==='true','desktop marker is active');
  assert(current.top<=1&&current.rightGap<=1,`1440 topbar reaches native top/right edges: ${JSON.stringify(current)}`);
  assert(current.height>=75&&current.height<=77,`1440 titlebar preserves content baseline with 14px shell gutter: ${JSON.stringify(current)}`);
  assert(current.paddingRight>=160&&current.actionReserve>=145,`1440 native caption controls retain reserved interaction area: ${JSON.stringify(current)}`);
  assert(current.dragRule&&current.noDragRule,'desktop stylesheet declares drag and no-drag regions');
  assert(current.overflow<=1,`1440 titlebar introduces no horizontal overflow: ${JSON.stringify(current)}`);
  await shot('desktop-titlebar-light-1440');

  assert((await applyTheme('dark'))==='dark','dark theme applies');
  current=await state();
  assert(current.theme==='dark'&&current.background&&current.background!=='rgba(0, 0, 0, 0)','dark titlebar keeps a visible semantic surface');
  assert(current.top<=1&&current.rightGap<=1&&current.actionReserve>=145,'dark titlebar keeps caption-control clearance');
  await shot('desktop-titlebar-dark-1440');

  await viewport(960,800);
  await sleep(180);
  current=await state();
  assert(current.top<=1&&current.rightGap<=1,`960 topbar reaches native top/right edges: ${JSON.stringify(current)}`);
  assert(current.height>=69&&current.height<=71,`960 titlebar uses compact 8px shell gutter: ${JSON.stringify(current)}`);
  assert(current.paddingRight>=155&&current.actionReserve>=138,`960 caption controls remain clear of app actions: ${JSON.stringify(current)}`);
  assert(current.overflow<=1,`960 titlebar introduces no horizontal overflow: ${JSON.stringify(current)}`);
  await shot('desktop-titlebar-dark-960');

  c.close();
  console.log('Desktop title-bar rendered QA passed for light/dark 1440px and compact 960px layouts.');
}finally{
  child.kill('SIGTERM');
  await sleep(180);
  rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
