import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const base=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const dir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-quick-finance-ambiguous';
mkdirSync(dir,{recursive:true});
const browser=process.env.MYFINHUB_QA_PRIMARY_BROWSER
  ||execFileSync('bash',['-lc','command -v chromium || command -v google-chrome || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!browser)throw new Error('Chromium required for quick finance ambiguous-receipt QA.');
const port=9387;
const profile='/tmp/myfinhub-quick-finance-ambiguous-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
let browserStartLog='';
const launchBrowser=()=>{
  const proc=spawn(browser,['--headless=new','--remote-debugging-port='+port,
    '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,
    '--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{
      stdio:['ignore','ignore','pipe'],
  });
  proc.stderr?.on('data',chunk=>{browserStartLog=(browserStartLog+String(chunk)).slice(-2400)});
  proc.on('error',error=>{browserStartLog=('spawn '+String(error)+' '+browserStartLog).slice(-2400)});
  return proc;
};
let child=launchBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stopBrowser(){
  if(child.exitCode!==null)return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1800)]);
  if(child.exitCode===null)child.kill('SIGKILL');
}
async function waitHttp(url){
  for(let i=0;i<180;i++){
    try{const r=await fetch(url);if(r.ok)return}catch{}
    if(child.exitCode!==null)break;
    await sleep(120);
  }
  throw new Error('Chrome debugging unavailable at '+url+
    ' (process exit '+String(child.exitCode)+
    '; stderr tail '+browserStartLog.replace(/\x1b\[[0-9;]*m/g,'').slice(-1200)+')');
}
class Cdp{
  constructor(ws){this.wsUrl=ws;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{
    this.ws=new WebSocket(this.wsUrl);this.ws.onopen=resolve;this.ws.onerror=reject;
    this.ws.onmessage=event=>{const msg=JSON.parse(event.data);if(!msg.id)return;
      const p=this.pending.get(msg.id);if(!p)return;this.pending.delete(msg.id);
      if(msg.error)p.reject(new Error(msg.error.message));else p.resolve(msg.result)};
  })}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{
    this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const r=await this.send('Runtime.evaluate',{expression:'globalThis'});
    const out=await this.send('Runtime.callFunctionOn',{objectId:r.result.objectId,
      functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});
    if(out.exceptionDetails)throw new Error(out.exceptionDetails.text||'Browser function error');
    return out.result.value}
  close(){this.ws?.close()}
}
const assert=(ok,msg)=>{if(!ok)throw new Error('Quick finance unknown-receipt QA: '+msg)};
try{
  try{
    await waitHttp('http://127.0.0.1:'+port+'/json/version');
  }catch(firstStartError){
    // A fresh profile + one CI Chromium bootstrap retry, never an app assertion retry.
    console.warn('Quick finance QA Chromium bootstrap retry:',String(firstStartError));
    await stopBrowser();
    rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
    browserStartLog='';
    child=launchBrowser();
    await waitHttp('http://127.0.0.1:'+port+'/json/version');
  }
  const target=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();
  await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,msg)=>{
    for(let i=0;i<150;i++){if(await c.call(fn))return;await sleep(100)}
    if(msg==='generic uncertain receipt disabled'||msg==='contextual uncertain receipt disabled'){
      const facts=await c.call("function(){const dlg=document.querySelector('.generic-quick-modal,.contextual-quick-modal');return {dialogOpen:Boolean(dlg),amount:dlg?.querySelector('[data-autofocus=true]')?.value||'',error:(dlg?.querySelector('#quick-add-error,#context-quick-error')?.textContent||'').slice(0,220),saveDisabled:[...(dlg?.querySelectorAll('footer button,.editor-actions button')||[])].find(button=>/Καταχώριση|Εφαρμογή αλλαγών|Επιβεβαίωση πληρωμής|Ολοκλήρωση/.test(button.textContent||''))?.disabled,financeAttempts:Number(document.documentElement.dataset.qaQuickEventAttempts||0),financeWrites:Number(document.documentElement.dataset.qaFinanceWrites||0),context:(dlg?.querySelector('h2')?.textContent||'').slice(0,70)}}");
      await shot('quick-finance-uncertain-diagnostic');
      throw new Error('Timed out waiting for '+msg+': '+JSON.stringify(facts));
    }
    throw new Error('Timed out waiting for '+msg);
  };
  const navigate=async(page,mode,width=1440,height=1000)=>{
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
    const u=new URL(base);u.searchParams.set('page',page);
    u.searchParams.set(mode==='rejected'?'quick-event-save-rejected':'quick-event-save-ambiguous','1');
    await c.send('Page.navigate',{url:u.href});
    await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",page+' ready');
  };
  const shot=async(name)=>{
    const res=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(dir+'/'+name+'.png',Buffer.from(res.data,'base64'));
  };
  const counts=()=>c.call("function(){return {attempts:Number(document.documentElement.dataset.qaQuickEventAttempts||0),writes:Number(document.documentElement.dataset.qaFinanceWrites||0)}}");
  const overflow=()=>c.call("function(){return Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth}");
  const openGeneric=async()=>{
    assert(await c.call("function(){const button=[...document.querySelectorAll('[data-global-quick-entry]')].find(el=>el.getBoundingClientRect().width>0);button?.click();return Boolean(button)}"),'generic launcher missing');
    await waitFor("function(){return Boolean(document.querySelector('.generic-quick-modal [data-autofocus=true]'))}",'Quick Entry form');
    const focused=await c.call("function(){const input=document.querySelector('.generic-quick-modal [data-autofocus=true]');input?.focus();return Boolean(input)}");
    assert(focused,'Quick Entry amount input missing');
    await c.send('Input.insertText',{text:'17.45'});
    await waitFor("function(){return Boolean(document.querySelector('.generic-quick-modal [data-autofocus=true]')?.value)}",'generic amount edited');
  };
  const submitGeneric=()=>c.call("function(){const btn=[...document.querySelectorAll('.generic-quick-modal footer button')].find(button=>(button.textContent||'').includes('Καταχώριση'));btn?.click();return Boolean(btn)}");
  console.log('Quick finance ambiguous QA: generic finance committed but response lost');
  await navigate('dashboard','ambiguous');
  await openGeneric();
  assert(await submitGeneric(),'generic Save missing');
  await waitFor("function(){const dlg=document.querySelector('.generic-quick-modal');return Boolean(dlg?.querySelector('#quick-add-error')?.textContent?.includes('Μην την καταχωρίσεις ξανά')&&[...dlg.querySelectorAll('footer button')].find(button=>(button.textContent||'').includes('Καταχώριση'))?.disabled)}",'generic uncertain receipt disabled');
  let count=await counts();assert(count.attempts===1&&count.writes===1,'generic commit count incorrect: '+JSON.stringify(count));
  await submitGeneric();await sleep(60);
  count=await counts();assert(count.attempts===1&&count.writes===1,'generic replay submitted duplicate event');
  await shot('quick-finance-generic-uncertain-desktop');
  assert(await overflow()<=1,'generic desktop overflow');
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await shot('quick-finance-generic-uncertain-mobile');
  assert(await overflow()<=1,'generic mobile overflow');

  console.log('Quick finance ambiguous QA: contextual recurring payment committed but response lost');
  await navigate('recurring','ambiguous');
  await waitFor("function(){return Boolean([...document.querySelectorAll('.recurring-workspace-table tbody tr')].find(row=>row.textContent.includes('Internet'))?.querySelector('.pay-action'))}",'recurring payment trigger');
  assert(await c.call("function(){const row=[...document.querySelectorAll('.recurring-workspace-table tbody tr')].find(row=>row.textContent.includes('Internet'));const button=row?.querySelector('.pay-action');button?.click();return Boolean(button)}"),'cannot open recurring payment');
  await waitFor("function(){return Boolean(document.querySelector('.contextual-quick-modal .editor-actions button:last-child'))}",'contextual payment dialog');
  assert(await c.call("function(){const btn=document.querySelector('.contextual-quick-modal .editor-actions button:last-child');btn?.click();return Boolean(btn)}"),'contextual Save missing');
  await waitFor("function(){const dlg=document.querySelector('.contextual-quick-modal');return Boolean(dlg?.querySelector('#context-quick-error')?.textContent?.includes('Μην την καταχωρίσεις ξανά')&&dlg.querySelector('.editor-actions button:last-child')?.disabled)}",'contextual uncertain receipt disabled');
  count=await counts();assert(count.attempts===1&&count.writes===1,'contextual commit count incorrect: '+JSON.stringify(count));
  await c.call("function(){document.querySelector('.contextual-quick-modal .editor-actions button:last-child')?.click();return true}");
  await sleep(60);count=await counts();
  assert(count.attempts===1&&count.writes===1,'contextual replay submitted second event');
  await shot('quick-finance-contextual-uncertain-desktop');
  assert(await overflow()<=1,'contextual desktop overflow');
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await shot('quick-finance-contextual-uncertain-mobile');
  assert(await overflow()<=1,'contextual mobile overflow');

  console.log('Quick finance ambiguous QA: known precommit conflict remains retry-eligible');
  await navigate('dashboard','rejected');
  await openGeneric();assert(await submitGeneric(),'known conflict Save missing');
  await waitFor("function(){return Boolean(document.querySelector('.generic-quick-modal #quick-add-error'))}",'known precommit rejection');
  const rejected=await c.call("function(){const dlg=document.querySelector('.generic-quick-modal');return {disabled:[...(dlg?.querySelectorAll('footer button')||[])].find(button=>(button.textContent||'').includes('Καταχώριση'))?.disabled,error:dlg?.querySelector('#quick-add-error')?.textContent||''}}");
  assert(rejected.disabled===false&&!rejected.error.includes('Μην την καταχωρίσεις ξανά'),'precommit rejection incorrectly frozen');
  count=await counts();assert(count.attempts===1&&count.writes===0,'known precommit conflict wrote finance event');
  await shot('quick-finance-precommit-conflict');
  c.close();console.log('Quick finance ambiguous receipt QA passed. Evidence: '+dir);
}finally{await stopBrowser()}
