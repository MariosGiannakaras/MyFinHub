import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';

const base=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidence=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-history-focused-qa';
mkdirSync(evidence,{recursive:true});
const browser=execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!browser)throw new Error('Chromium required for History focused QA');
const port=9377,profile=`/tmp/myfinhub-history-focused-browser-${process.pid}`;
rmSync(profile,{force:true,recursive:true});
const child=spawn(browser,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,label)=>{if(!condition)throw new Error(`History rendered QA: ${label}`)};
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{}await sleep(150)}throw Error(`Browser not ready at ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text||'History page script failed');return result.result.value}
  close(){this.ws?.close()}
}
let c;
try{
  await ready(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label)=>{for(let i=0;i<100;i++){if(await c.call(fn))return;await sleep(85)}throw Error(`History browser timeout: ${label}`)};
  const screenshot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});writeFileSync(`${evidence}/${name}.png`,Buffer.from(result.data,'base64'))};
  const open=async({width,height,theme,save='saved'})=>{
    await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
    const url=new URL(base);url.searchParams.set('state','history-cursor');url.searchParams.set('save',save);
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(){return Boolean(document.querySelector('.app-shell button[aria-label=\\\"Ιστορικό αλλαγών\\\"]'))}",'synthetic history shell');
    await c.call("async function(theme){localStorage.setItem('myfinhub.theme',theme);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(theme);return true}",[theme]);
    assert(await c.call("function(){const b=document.querySelector('button[aria-label=\\\"Ιστορικό αλλαγών\\\"]');b?.focus({preventScroll:true});b?.click();return Boolean(b&&document.activeElement===b)}"),'history opener exists');
    await waitFor("function(){return Boolean(document.querySelector('.change-history-dialog[aria-modal=true] [data-history-state=current]'))}",'lazy history modal and cursor');
    // Framer Motion mounts the dialog before its 160ms entrance completes.
    // Capture only a fully visible settled surface; otherwise screenshots can
    // look transparent and overlapped even when geometry assertions pass.
    await waitFor("function(){const d=document.querySelector('.change-history-dialog');const b=d?.closest('.command-backdrop');return Boolean(d&&b&&Number(getComputedStyle(d).opacity)>=0.99&&Number(getComputedStyle(b).opacity)>=0.99)}",'History backdrop and modal entrance settled');
    await sleep(80);
  };
  for(const {width,height,theme} of [
    {width:1440,height:900,theme:'light'},
    {width:768,height:960,theme:'dark'},
    {width:375,height:812,theme:'light'},
    {width:375,height:812,theme:'dark'},
  ]){
    await open({width,height,theme});
    const state=await c.call(`function(){const d=document.querySelector('.change-history-dialog');const r=d?.getBoundingClientRect();const opacity=Number(getComputedStyle(d).opacity);const backdropOpacity=Number(getComputedStyle(d.closest('.command-backdrop')).opacity);const actions=[...document.querySelectorAll('.change-history-dialog .history-actions button')];const states=[...d.querySelectorAll('[data-history-state]')].map(x=>x.dataset.historyState);return {width:innerWidth,right:r?.right,left:r?.left,dialogWidth:r?.width,opacity,backdropOpacity,overflows:document.documentElement.scrollWidth>innerWidth+1||d.scrollWidth>d.clientWidth+1,states,actions:actions.map(b=>({text:b.textContent,disabled:b.disabled,height:b.getBoundingClientRect().height})),status:d.querySelector('.history-status')?.textContent,currentCount:states.filter(x=>x==='current').length,focused:d.contains(document.activeElement),focusLabel:document.activeElement?.getAttribute('aria-label'),text:d.textContent}}`);
    assert(state.opacity>=0.99&&state.backdropOpacity>=0.99,`fully opaque History modal and backdrop at ${width}: ${JSON.stringify(state)}`);
    assert(!state.overflows&&state.left>=-1&&state.right<=width+1,`no horizontal clipping at ${width} ${JSON.stringify(state)}`);
    assert(state.states.join(',')==='redo,current,stored',`proven current/redo/stored hierarchy at ${width}: ${state.states}`);
    assert(state.actions.length===2&&state.actions.every(x=>!x.disabled&&x.height>=44),`44px enabled Undo/Redo at ${width}: ${JSON.stringify(state.actions)}`);
    assert(state.status?.includes('Αναίρεση: 1 βήμα')&&state.status?.includes('Επαναφορά: 1 βήμα'),`real fixture depth at ${width}: ${state.status}`);
    assert(state.focused,'keyboard focus trapped inside modal');
    assert(state.text?.includes('Παλαιότερα αποθηκευμένα σημεία')&&state.text?.includes('εγγυημένη πλήρη αναίρεση'),'truthful privacy/import boundary copy');
    await screenshot(`history-dialog-${width}-${theme}`);
    await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await waitFor("function(){return !document.querySelector('.change-history-dialog')}",'Escape dismisses history');
    await waitFor("function(){return document.activeElement?.getAttribute('aria-label')==='Ιστορικό αλλαγών'}",'opener focus restored');
  }
  for(const save of ['error','conflict']){
    await open({width:375,height:812,theme:'dark',save});
    const state=await c.call("function(){const d=document.querySelector('.change-history-dialog');return {status:d.querySelector('.history-status')?.textContent,disabled:[...d.querySelectorAll('.history-actions button')].every(b=>b.disabled)}}");
    assert(state.disabled,`Undo/Redo disabled in ${save}`);
    assert((save==='error'?state.status?.includes('δεν επιβεβαιώθηκε'):state.status?.includes('δεν συμφωνεί')),`accurate ${save} status: ${state.status}`);
    await screenshot(`history-dialog-375-dark-${save}`);
  }
  console.log('History focused rendered QA passed: cursor, long Greek labels, Light/Dark responsive geometry, button states, focus/Escape and error/conflict.');
}catch(error){console.error(error);process.exitCode=1}
finally{c?.close();child.kill('SIGTERM');rmSync(profile,{force:true,recursive:true,maxRetries:6,retryDelay:150})}
