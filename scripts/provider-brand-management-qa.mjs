import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-provider-brand-management-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for provider branding QA.');
const port=9263;
const profile='/tmp/myfinhub-provider-brand-management-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Provider branding QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('visual','1');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const applyTheme=async preference=>c.call(`async function(pref){localStorage.setItem('myfinhub.theme',pref);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}`,[preference]);
  const clickAccounts=async()=>{const ok=await c.call("function(){const node=[...document.querySelectorAll('.settings-tablist button')].find(item=>(item.textContent||'').trim()==='Λογαριασμοί');if(!node)return false;node.click();return true}");assert(ok,'Accounts tab is available');await waitFor("function(){return !!document.querySelector('.provider-management')&&document.querySelectorAll('.provider-management-card').length>=8}",'provider management panel')};
  const state=async()=>c.call(`function(){const cards=[...document.querySelectorAll('.provider-management-card')];const slots=[...document.querySelectorAll('.provider-asset-slot')];const buttons=[...document.querySelectorAll('.provider-management button')].filter(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'});return {theme:document.documentElement.dataset.theme,cards:cards.length,slots:slots.length,labels:[...document.querySelectorAll('.provider-asset-copy b')].map(node=>(node.textContent||'').trim()),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,smallButtons:buttons.map(node=>{const r=node.getBoundingClientRect();return {label:(node.textContent||node.getAttribute('aria-label')||'').trim(),w:r.width,h:r.height}}).filter(item=>item.w<40||item.h<40)}}`);
  const shot=async name=>{await c.call("function(){const active=document.activeElement;if(active instanceof HTMLElement)active.blur();window.scrollTo({top:0,left:0,behavior:'auto'});return true}");await sleep(180);const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const fullShot=async name=>{await c.call("function(){window.scrollTo({top:0,left:0,behavior:'auto'});return true}");await sleep(180);const metrics=await c.send('Page.getLayoutMetrics');const width=Math.ceil(metrics.cssContentSize?.width||1440),height=Math.ceil(metrics.cssContentSize?.height||1000);const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

  for(const mode of [{name:'desktop',width:1440,height:1000,mobile:false},{name:'mobile',width:375,height:812,mobile:true}]){
    await viewport(mode.width,mode.height,mode.mobile);
    for(const theme of ['light','dark']){
      await c.send('Page.navigate',{url:url.href});
      await waitFor("function(){return document.readyState==='complete'&&!!document.querySelector('.settings-tablist')}",'Settings ready');
      assert(await applyTheme(theme)===theme,`${theme} theme resolves`);
      await clickAccounts();
      const current=await state();
      assert(current.theme===theme,`${mode.name} ${theme} theme remains active`);
      assert(current.cards>=8,`${mode.name} renders provider cards`);
      assert(current.slots===current.cards*5,`${mode.name} renders five asset slots per provider`);
      for(const expected of ['Logo','Wordmark · Light','Wordmark · Dark','Card mark · Light','Card mark · Dark'])assert(current.labels.includes(expected),`asset slot ${expected} is present`);
      assert(current.overflow<=1,`${mode.name} ${theme} has no horizontal page overflow: ${current.overflow}px`);
      assert(current.smallButtons.length===0,`${mode.name} ${theme} has no undersized provider buttons: ${JSON.stringify(current.smallButtons.slice(0,6))}`);
      await shot(`provider-management-${theme}-${mode.name}`);
    }
  }

  await viewport(1440,1000,false);
  await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.readyState==='complete'&&!!document.querySelector('.settings-tablist')}",'Settings create-provider ready');await applyTheme('light');await clickAccounts();
  const opened=await c.call("function(){const button=[...document.querySelectorAll('.provider-management button')].find(node=>(node.textContent||'').includes('Νέος πάροχος'));button?.click();return Boolean(button)}");assert(opened,'New provider action is available');
  await waitFor("function(){return !!document.querySelector('.provider-create')}",'create-provider form');
  const createState=await c.call(`function(){const root=document.querySelector('.provider-create');return {fileInputs:root?.querySelectorAll('input[type=file]').length||0,comboboxes:root?.querySelectorAll('[role=combobox]').length||0,text:(root?.textContent||'').replace(/\s+/g,' ').trim(),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);
  assert(createState.fileInputs===5,'create-provider flow exposes five optional artwork pickers');
  assert(createState.comboboxes>=1,'create-provider flow uses app-owned provider type select');
  for(const label of ['Logo','Wordmark · Light','Wordmark · Dark','Card mark · Light','Card mark · Dark'])assert(createState.text.includes(label),`create-provider artwork picker ${label} is visible`);
  assert(createState.overflow<=1,'create-provider desktop form stays viewport-contained');
  await shot('provider-create-light-desktop');

  await viewport(375,812,true);assert(await applyTheme('dark')==='dark','dark theme applies to mobile create-provider form');
  const mobileCreate=await c.call("function(){const root=document.querySelector('.provider-create');root?.scrollIntoView({block:'start'});return {visible:Boolean(root?.getClientRects().length),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(mobileCreate.visible&&mobileCreate.overflow<=1,'mobile create-provider form stays visible and viewport-contained');
  await shot('provider-create-dark-mobile');
  await fullShot('provider-management-light-desktop-full');

  console.log('Provider branding management QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
