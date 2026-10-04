import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-desktop-host-visual-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for desktop host visual QA.');
const port=9276;
const profile='/tmp/myfinhub-desktop-host-visual-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new','--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(120)}throw new Error('Timed out waiting for '+url)}
async function stopBrowser(process){
  if(!process||process.exitCode!==null)return;
  await new Promise(resolve=>{
    let settled=false;
    const finish=()=>{if(settled)return;settled=true;clearTimeout(forceTimer);clearTimeout(giveUpTimer);resolve()};
    const forceTimer=setTimeout(()=>{if(process.exitCode===null){try{process.kill('SIGKILL')}catch{}}},2000);
    const giveUpTimer=setTimeout(finish,3500);
    process.once('exit',finish);
    try{process.kill('SIGTERM')}catch{finish()}
  });
}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error('Desktop host visual QA assertion failed: '+message)};
let c=null;
try{
  await waitHttp('http://127.0.0.1:'+port+'/json/version');
  const target=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent('about:blank'),{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<160;i+=1){if(await c.call(fn,args))return;await sleep(40)}throw new Error('Timed out waiting for '+label)};
  const navigate=async url=>{await c.send('Page.navigate',{url});await waitFor("function(url){return location.href===url&&document.readyState==='complete'}",'navigation '+url,[url]);await sleep(100)};
  const shot=async name=>{const image=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(evidenceDir+'/'+name+'.png',Buffer.from(image.data,'base64'))};
  const noHorizontalOverflow=async label=>{const overflow=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth}");assert(overflow<=1,label+' horizontal overflow '+overflow+'px')};
  const setInput=async(selector,value)=>{const ok=await c.call("function(selector,value){const input=document.querySelector(selector);if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[selector,value]);assert(ok,'missing input '+selector)};

  console.log('Desktop host QA: App Lock locked/error/rate-limit states');
  await viewport(1440,930);
  const lockUrl=new URL(baseUrl);lockUrl.searchParams.set('screen','desktop-lock');
  await navigate(lockUrl.href);
  await waitFor("function(){return document.querySelector('.desktop-app-lock-screen')?.getAttribute('data-phase')==='locked'&&document.activeElement?.getAttribute('aria-label')==='4ψήφιο PIN εφαρμογής'}",'desktop lock focused state');
  assert(await c.call("function(){const card=document.querySelector('.desktop-app-lock-card');const r=card?.getBoundingClientRect();return Boolean(r&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight)}"),'lock card is contained at native main-window size');
  await shot('desktop-app-lock-locked-1440x930');
  await setInput('.desktop-app-lock-input','0000');
  await waitFor("function(){return (document.querySelector('.desktop-app-lock-feedback')?.textContent||'').includes('Το PIN δεν είναι σωστό')}","wrong PIN feedback");
  await shot('desktop-app-lock-invalid-pin-1440x930');
  await setInput('.desktop-app-lock-input','0000');
  await waitFor("function(){return (document.querySelector('.desktop-app-lock-feedback')?.textContent||'').includes('Νέα προσπάθεια σε')}","rate-limited PIN feedback");
  await viewport(1100,760);await sleep(120);await noHorizontalOverflow('desktop lock 1100x760');
  await shot('desktop-app-lock-rate-limited-1100x760');

  console.log('Desktop host QA: Update Panel available/downloading/ready/error states');
  const updateUrl=status=>{const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('state','settings-tabs');url.searchParams.set('desktop-update',status);url.searchParams.set('visual','1');return url.href};
  await viewport(1440,930);
  await navigate(updateUrl('available'));
  await waitFor("function(){const panel=document.querySelector('.desktop-update-panel');return panel&&(panel.textContent||'').includes('Νέα έκδοση 1.4.0')&&(panel.textContent||'').includes('Λήψη ενημέρωσης')}","available update panel");
  await shot('desktop-update-available-1440x930');
  await viewport(1100,760);
  await navigate(updateUrl('downloading'));
  await waitFor("function(){const bar=document.querySelector('.desktop-update-progress[role=progressbar]');return bar?.getAttribute('aria-valuenow')==='42'}","downloading update progress");
  assert(await c.call("function(){const panel=document.querySelector('.desktop-update-panel');const button=panel?.querySelector('button');return Boolean(button?.disabled&&(panel?.textContent||'').includes('Λήψη 42%'))}"),'downloading update exposes disabled busy action');
  await noHorizontalOverflow('desktop update downloading 1100x760');
  await shot('desktop-update-downloading-1100x760');
  await navigate(updateUrl('ready'));
  await waitFor("function(){const panel=document.querySelector('.desktop-update-panel');return panel&&(panel.textContent||'').includes('Έτοιμη 1.4.0')&&(panel.textContent||'').includes('Εγκατάσταση & επανεκκίνηση')}","ready update panel");
  await shot('desktop-update-ready-1100x760');
  await viewport(1440,930);
  await navigate(updateUrl('error'));
  await waitFor("function(){const message=document.querySelector('.desktop-update-message.error');return Boolean(message&&(message.textContent||'').includes('Η ενημέρωση δεν ολοκληρώθηκε'))}","update error panel");
  await shot('desktop-update-error-1440x930');
  await navigate(updateUrl('up-to-date'));
  await waitFor("function(){const panel=document.querySelector('.desktop-update-panel');return panel&&(panel.textContent||'').includes('Ενημερωμένη')&&(panel.textContent||'').includes('Η εφαρμογή είναι ενημερωμένη.')}","up-to-date update panel");
  await shot('desktop-update-up-to-date-1440x930');

  console.log('Desktop host QA: real startup recovery diagnostics surface');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'myFinHubDesktop',{configurable:true,value:Object.freeze({getRecoveryState:async()=>({progress:62,step:'backend-startup',message:'Ο τοπικός πυρήνας δεν απάντησε εγκαίρως.',error:{code:'BACKEND_STARTUP_TIMEOUT',stage:'backend-startup',message:'Η τοπική υπηρεσία δεν ξεκίνησε εγκαίρως.',detail:'Η υπηρεσία σταμάτησε πριν από το ασφαλές readiness marker. Δεν εκτίθενται credentials.'}}),onStartupProgress:()=>()=>{},retryStartup:async()=>({ok:false,error:{code:'BACKEND_STARTUP_TIMEOUT',stage:'backend-startup',message:'Η νέα προσπάθεια δεν ολοκληρώθηκε.',detail:'Ασφαλές diagnostic detail.'}}),copyStartupDiagnostics:async()=>({ok:true})})});"});
  const recoveryUrl=new URL('/desktop/setup.html',baseUrl).href;
  await viewport(760,840);await navigate(recoveryUrl);
  await waitFor("function(){return !document.querySelector('#diagnostic-panel')?.hidden&&document.querySelector('#diagnostic-code')?.textContent==='BACKEND_STARTUP_TIMEOUT'}","recovery diagnostics");
  const recovery=await c.call("function(){const shell=document.querySelector('.shell')?.getBoundingClientRect();const body=document.body.innerText||'';return {progress:document.querySelector('.progress-shell')?.getAttribute('aria-valuenow'),shell:shell?{left:shell.left,right:shell.right,width:shell.width}:null,body}}");
  assert(recovery.progress==='62','recovery progress reflects host state');
  assert(recovery.shell&&recovery.shell.left>=0&&recovery.shell.right<=760,'recovery shell fits native 760px setup width');
  assert(!/sb_secret_|sb_publishable_|Bearer\\s+[A-Za-z0-9._-]+|CARD_VAULT_KEY/i.test(recovery.body),'recovery evidence contains no secret-shaped diagnostics');
  await shot('desktop-startup-recovery-error-760x840');
  await c.call("function(){document.querySelector('#copy-diagnostics')?.click();return true}");
  await waitFor("function(){return (document.querySelector('#status')?.textContent||'').includes('αντιγράφηκαν στο πρόχειρο')}","recovery copy success");
  await shot('desktop-startup-recovery-copy-success-760x840');
  await viewport(620,650);await sleep(120);await noHorizontalOverflow('desktop recovery 620x650');
  assert(await c.call("function(){const shell=document.querySelector('.shell')?.getBoundingClientRect();return Boolean(shell&&shell.left>=0&&shell.right<=innerWidth)}"),'recovery shell fits minimum window width');
  await shot('desktop-startup-recovery-min-620x650');

  console.log('Desktop host visual QA passed: App Lock, updater and startup recovery states.');
}finally{
  try{c?.close()}catch{}
  await stopBrowser(child);
  await sleep(250);
  try{rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150})}catch{}
}
