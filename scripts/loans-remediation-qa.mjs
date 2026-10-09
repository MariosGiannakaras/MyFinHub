import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Loans remediation QA.');
const port=9249;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-loans-remediation-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Loans remediation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=async(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async()=>{const url=new URL(baseUrl);url.searchParams.set('page','loans');url.searchParams.set('state','loans-long');await c.send('Page.navigate',{url:url.href});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δόσεις & Δάνεια')&&[...document.querySelectorAll('.loan-list-row h3')].some(node=>(node.textContent||'').includes('QA 120 δόσεις'))}",'long-installment Loans fixture');await sleep(100)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const state=()=>c.call(`function(){const row=[...document.querySelectorAll('.loan-list-row')].find(node=>(node.querySelector('h3')?.textContent||'').includes('QA 120 δόσεις')),progress=row?.querySelector('.installment-segments'),main=row?.querySelector('.loan-list-main'),meta=row?.querySelector('.loan-list-meta'),actions=row?.querySelector('.loan-list-actions'),history=document.querySelector('.loan-history'),note=document.querySelector('.loan-progress-note'),secondary=row?.querySelector('.loan-list-main h3+small');const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width,height:r.height}:null};const style=node=>node?getComputedStyle(node):null;return {row:rect(row),main:rect(main),progress:rect(progress),meta:rect(meta),actions:rect(actions),segments:progress?.querySelectorAll('i').length||0,paid:progress?.querySelectorAll('i.paid').length||0,visualSegments:progress?.getAttribute('data-visual-segments')||'',visualPaid:progress?.getAttribute('data-visual-paid')||'',ariaNow:progress?.getAttribute('aria-valuenow')||'',ariaMax:progress?.getAttribute('aria-valuemax')||'',historyEmpty:history?.classList.contains('is-empty')||false,historyHeight:rect(history)?.height||0,historyShadow:style(history)?.boxShadow||'',noteHeight:rect(note)?.height||0,noteBg:style(note)?.backgroundColor||'',secondaryColor:style(secondary)?.color||'',textSecondary:getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);

  console.log('Loans remediation QA: proportional long-installment progress and wide geometry');
  for(const width of [1440,1920,2560]){await viewport(width,1100);await navigate();const current=await state();assert(current.segments===60&&current.paid===30&&current.visualSegments==='60'&&current.visualPaid==='30','120-installment loan at 60 paid renders 30/60 proportional visual buckets');assert(current.ariaNow==='60'&&current.ariaMax==='120','ARIA preserves authoritative true installment totals');assert(current.main.width<=1321&&current.progress.width<=1321&&current.meta.width<=1321&&current.actions.width<=1321,'loan inner reading units stay bounded at 1320px');assert(current.overflow<=1,'Loans desktop has no horizontal overflow');assert(current.historyEmpty&&current.historyHeight<=55,'zero-history Completed disclosure stays lightweight');assert(current.noteHeight<=55,'progress explanation remains subordinate to active financial content');await shot(`loans-long-${width}`)}

  console.log('Loans remediation QA: dark secondary readability');
  await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}");
  await viewport(1440,1100);await navigate();const dark=await state();
  assert(dark.secondaryColor&&dark.secondaryColor!=='rgba(0, 0, 0, 0)','dark secondary metadata remains visibly styled');
  assert(dark.overflow<=1,'dark Loans desktop remains overflow-safe');
  await shot('loans-long-dark-1440');

  c.close();console.log(`Loans remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
