import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Credit stack remediation QA.');
const port=9247;
const profile='/tmp/myfinhub-credit-stack-remediation-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Credit stack remediation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=async(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(state='',motion='system')=>{const url=new URL(baseUrl);url.searchParams.set('page','credit');if(state)url.searchParams.set('state',state);if(motion==='reduced')url.searchParams.set('motion','reduced');await c.send('Page.navigate',{url:url.href});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πιστωτική Κάρτα')&&Boolean(document.querySelector('#myfinhub-card-stack .stack-card.top'))}",'Credit page');await sleep(120)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const state=()=>c.call(`function(){const stage=document.querySelector('#myfinhub-card-stack .stack-stage'),cards=[...document.querySelectorAll('#myfinhub-card-stack .stack-card')],top=stage?.querySelector('.stack-card.top'),dots=document.querySelector('#myfinhub-card-stack .dots'),active=dots?.querySelector('.dot.active'),hint=document.querySelector('#myfinhub-card-stack .stack-drag-hint'),stack=document.querySelector('#myfinhub-card-stack'),stats=document.querySelector('.credit-card-stage-stats'),toolbar=top?.querySelector('.card-toolbar');const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};const dotsRect=rect(dots),activeRect=rect(active);return {mode:stack?.className||'',count:cards.length,topId:top?.getAttribute('data-card-id')||'',tops:cards.slice(0,4).map(node=>rect(node)?.top||0),dots:document.querySelectorAll('#myfinhub-card-stack .dot').length,dotsScroll:dots?.scrollLeft||0,dotsClient:dots?.clientWidth||0,dotsWidth:dots?.scrollWidth||0,activeVisible:Boolean(activeRect&&dotsRect&&activeRect.left>=dotsRect.left-1&&activeRect.right<=dotsRect.right+1),hintVisible:Boolean(hint&&getComputedStyle(hint).display!=='none'&&hint.getBoundingClientRect().height>0),cursor:stage?getComputedStyle(stage).cursor:'',touchAction:stage?getComputedStyle(stage).touchAction:'',hostNav:document.querySelectorAll('.credit-card-view-controls,.credit-card-horizontal-nav').length,editProfile:toolbar?.querySelectorAll('.edit-profile-btn').length||0,editDetails:toolbar?.querySelectorAll('.edit-details-btn').length||0,stats:stats?.textContent||'',overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);
  const pointer=async(deltaY,holdMs=80)=>{const rect=await c.call("function(){const r=document.querySelector('#myfinhub-card-stack .stack-card.top')?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null}");assert(rect,'top card geometry exists');await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x,y:rect.y});await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x,y:rect.y+deltaY,button:'left',buttons:1});await sleep(holdMs);return rect};
  const release=async(rect,deltaY)=>c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x,y:rect.y+deltaY,button:'left',clickCount:1});
  const pressArrow=async key=>{await c.call("function(){const stage=document.querySelector('#myfinhub-card-stack .stack-stage');stage?.focus();return document.activeElement===stage}");await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key})};

  await viewport(1440,1000,false);
  console.log('Credit stack remediation QA: multi-card pre-drag and mid-drag follower motion');
  await navigate('credit-stack');
  let before=await state();
  assert(before.count===6&&before.topId==='qa-card','deterministic six-card fixture renders canonical stack with base card on top');
  assert(before.dots===6&&before.hintVisible&&before.hostNav===0,'multi-card deck exposes subordinate dots/drag hint without host navigation');
  assert(before.editProfile===1&&before.editDetails===1,'only the active top card exposes profile and secure-details editing');
  assert(before.overflow<=1,'multi-card Credit desktop has no document overflow');
  await shot('credit-stack-pre-drag');
  const start=await pointer(-92,90);
  const mid=await state();
  assert(mid.topId===before.topId&&mid.tops[0]<before.tops[0]-35,'front card follows vertical drag before release');
  assert(mid.tops[1]<before.tops[1]-4,'second stack layer advances toward the front during drag');
  await shot('credit-stack-mid-drag');
  await release(start,-92);
  await sleep(180);
  await shot('credit-stack-restack');
  await sleep(360);
  let settled=await state();
  assert(settled.topId==='qa-credit-stack-2','committed upward drag rotates the canonical deck after restack');
  assert(settled.stats.includes('1.500'),'host finance summary switches coherently to the settled active card');
  assert(settled.activeVisible,'active pagination marker remains visible after restack');
  await shot('credit-stack-settled');

  console.log('Credit stack remediation QA: downward commit and cancelled drag');
  const downStart=await pointer(92,80);await release(downStart,92);await sleep(540);let down=await state();
  assert(down.topId==='qa-credit-stack-3'&&down.stats.includes('1.600'),'committed downward drag cycles to the next stable card and host state');
  const cancelTop=down.topId;const cancelStart=await pointer(28,60);await release(cancelStart,28);await sleep(120);down=await state();
  assert(down.topId===cancelTop,'sub-threshold drag returns to the original selected card');

  console.log('Credit stack remediation QA: single-card mode');
  await navigate('');
  const single=await state();
  assert(single.mode.includes('single-card-mode')&&single.count===1&&single.dots===0&&!single.hintVisible,'single active card renders without deck pagination/discovery affordance');
  assert(single.cursor==='default'&&single.touchAction==='pan-y','single active card disables deck drag affordance while preserving page scrolling');
  const singleId=single.topId;const singleStart=await pointer(-100,60);await release(singleStart,-100);await sleep(120);const singleAfter=await state();
  assert(singleAfter.topId===singleId&&!singleAfter.mode.includes('dragging'),'single active card does not enter restack choreography');
  await shot('credit-single-card');

  console.log('Credit stack remediation QA: long pagination containment');
  await navigate('credit-stack-long');
  let long=await state();
  assert(long.count===24&&long.dots===24&&long.dotsWidth>long.dotsClient&&long.activeVisible&&long.overflow<=1,'long deterministic card set uses contained scrollable pagination without page overflow');
  for(let i=0;i<16;i++){await pressArrow('ArrowDown');await sleep(500)}
  long=await state();
  assert(long.dotsScroll>0&&long.activeVisible&&long.overflow<=1,'active dot remains visible after cycling deep into a long deck');
  await shot('credit-stack-long-pagination');

  console.log('Credit stack remediation QA: reduced motion');
  await navigate('credit-stack','reduced');
  const reducedBefore=await state();await pressArrow('ArrowDown');await sleep(520);const reducedAfter=await state();
  assert(reducedAfter.topId!==reducedBefore.topId,'reduced-motion mode preserves functional card selection');

  c.close();console.log(`Credit stack remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
