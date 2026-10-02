import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for responsive-transition QA.');
const port=9364;
const profile='/tmp/myfinhub-responsive-transition-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i++){try{if((await fetch(url)).ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
 constructor(url){this.url=url;this.id=0;this.pending=new Map()}
 async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const msg=JSON.parse(event.data);if(!msg.id)return;const pending=this.pending.get(msg.id);if(!pending)return;this.pending.delete(msg.id);msg.error?pending.reject(new Error(msg.error.message)):pending.resolve(msg.result)}})}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
 async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}
 close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Responsive transition QA assertion failed: ${message}`)};
let c=null;
try{
 await waitHttp(`http://127.0.0.1:${port}/json/version`);
 const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
 const viewport=(width,height,mobile)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 const waitFor=async(fn,label,args=[],limit=140)=>{for(let i=0;i<limit;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
 const geometry=()=>c.call(`function(){
   const visible=node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
   const rogue=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"],[role="radio"]')].filter(visible).filter(node=>{const r=node.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}).map(node=>(node.getAttribute('aria-label')||node.textContent||node.tagName).trim().slice(0,80));
   return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,rogue,width:innerWidth,height:innerHeight};
 }`);
 const assertGeometry=async label=>{const g=await geometry();assert(g.overflow<=1,`${label}: horizontal overflow ${g.overflow}px`);assert(g.rogue.length===0,`${label}: off-viewport controls ${JSON.stringify(g.rogue)}`)};
 const navigate=async(page,width,height,mobile)=>{
   await viewport(width,height,mobile);const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('motion','reduced');
   await c.send('Page.navigate',{url:url.href});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",`${page} ready`);
 };

 for(const page of ['dashboard','transactions','settings']){
   await navigate(page,834,1112,false);await assertGeometry(`${page} tablet portrait`);
   await viewport(1112,834,false);await sleep(150);await assertGeometry(`${page} tablet landscape transition`);
   await viewport(375,812,true);await sleep(150);await assertGeometry(`${page} mobile portrait transition`);
   await viewport(812,375,true);await sleep(150);await assertGeometry(`${page} mobile landscape transition`);
 }

 await navigate('dashboard',375,812,true);
 const opened=await c.call("function(){const button=document.querySelector('[data-global-quick-entry=mobile]');button?.click();return Boolean(button)}");
 assert(opened,'mobile Quick Entry opens');
 await waitFor("function(){return Boolean(document.querySelector('.quick-modal[role=dialog]'))}",'Quick Entry dialog');
 await viewport(375,500,true);await sleep(150);
 await assertGeometry('Quick Entry keyboard-height viewport');
 const dialog=await c.call(`function(){
   const node=document.querySelector('.quick-modal[role=dialog]');if(!node)return null;
   const r=node.getBoundingClientRect(),style=getComputedStyle(node);
   const focused=document.activeElement?.getBoundingClientRect();
   return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,overflowY:style.overflowY,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,focused:focused?{top:focused.top,bottom:focused.bottom}:null};
 }`);
 assert(dialog&&dialog.left>=-1&&dialog.right<=376,`Quick Entry escapes keyboard-height viewport: ${JSON.stringify(dialog)}`);
 assert(dialog.scrollHeight>=dialog.clientHeight,'Quick Entry remains internally scrollable when keyboard reduces viewport');
 assert(dialog.focused&&dialog.focused.bottom<=500+1,'focused Quick Entry control remains visible at keyboard height');

 await viewport(375,812,true);await sleep(120);await assertGeometry('Quick Entry restored portrait viewport');
 console.log('Responsive transition/orientation/keyboard-height QA passed.');
}finally{
 try{c?.close()}catch{}
 child.kill('SIGTERM');await sleep(200);rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
