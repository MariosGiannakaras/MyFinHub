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
  const state=()=>c.call(`function(){const stage=document.querySelector('#myfinhub-card-stack .stack-stage'),cards=[...document.querySelectorAll('#myfinhub-card-stack .stack-card')],top=stage?.querySelector('.stack-card.top'),dots=document.querySelector('#myfinhub-card-stack .dots'),active=dots?.querySelector('.dot.active'),hint=document.querySelector('#myfinhub-card-stack .stack-drag-hint'),stack=document.querySelector('#myfinhub-card-stack'),stats=document.querySelector('.credit-card-stage-stats'),toolbar=top?.querySelector('.card-toolbar');const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};const dotsRect=rect(dots),activeRect=rect(active);return {mode:stack?.className||'',count:cards.length,topId:top?.getAttribute('data-card-id')||'',tops:cards.slice(0,4).map(node=>rect(node)?.top||0),dots:document.querySelectorAll('#myfinhub-card-stack .dot').length,dotsScroll:dots?.scrollLeft||0,dotsClient:dots?.clientWidth||0,dotsWidth:dots?.scrollWidth||0,activeVisible:Boolean(activeRect&&dotsRect&&activeRect.left>=dotsRect.left-1&&activeRect.right<=dotsRect.right+1),hintVisible:Boolean(hint&&getComputedStyle(hint).display!=='none'&&hint.getBoundingClientRect().height>0),cursor:stage?getComputedStyle(stage).cursor:'',touchAction:stage?getComputedStyle(stage).touchAction:'',hostNav:document.querySelectorAll('.credit-card-view-controls,.credit-card-horizontal-nav').length,editProfile:toolbar?.querySelectorAll('.edit-profile-btn').length||0,editDetails:toolbar?.querySelectorAll('.edit-details-btn').length||0,stats:stats?.textContent||'',stagePanelBottom:rect(document.querySelector('.credit-card-stage'))?.bottom??0,ratesPanelTop:rect(document.querySelector('[data-credit-rates]'))?.top??0,purchasesPanelTop:rect(document.querySelector('[data-credit-purchases]'))?.top??0,repaymentsPanelTop:rect(document.querySelector('[data-credit-repayments]'))?.top??0,pageScrollY:window.scrollY,topCenterVisible:Boolean(top&&rect(top)&&(rect(top).top+rect(top).height/2)>=0&&(rect(top).top+rect(top).height/2)<=innerHeight),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);
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

  const hoverCredit=async()=>{
    const rect=await c.call("function(){const r=document.querySelector('#myfinhub-card-stack .stack-card.top [data-tilt]')?.getBoundingClientRect();return r?{x:r.left,y:r.top,w:r.width,h:r.height}:null}");
    assert(rect&&rect.w>100&&rect.h>100,'credit card pointer tilt has visible geometry');
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+rect.w*.24,y:rect.y+rect.h*.3});
    await sleep(240);
    return c.call("function(){return document.querySelector('#myfinhub-card-stack .stack-card.top [data-tilt]')?.style.transform||''}");
  };
  const creditTilt=await hoverCredit();
  assert(/rotateY\(-?\d+(?:\.\d+)?deg\)/.test(creditTilt)&&!creditTilt.includes('rotateY(0deg)'),`credit card follows real mouse hover: ${creditTilt}`);
  await shot('credit-stack-mouse-tilt');
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
  await sleep(240);
  const creditRest=await c.call("function(){return document.querySelector('#myfinhub-card-stack .stack-card.top [data-tilt]')?.style.transform||''}");
  assert(creditRest==='perspective(1000px) rotateY(0deg) rotateX(0deg)',`credit card returns to rest on pointer exit: ${creditRest}`);
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('credit-stack');
  const reducedTilt=await hoverCredit();
  assert(!reducedTilt||reducedTilt==='perspective(1000px) rotateY(0deg) rotateX(0deg)',`credit OS reduced motion suppresses tilt: ${reducedTilt}`);
  await c.send('Emulation.setEmulatedMedia',{features:[]});
  await navigate('credit-stack');
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

  console.log('Credit stack remediation QA: twelve consecutive commits across two complete six-card cycles');
  // Owner-reported regression: repeated real drags previously made the stack disappear.
  // Check the *settled DOM* after each transition, not only a source-only count.
  // Wait for the previous animation, then pin the page viewport before
  // exercising repeated physical gestures; only dots may scroll horizontally.
  await sleep(300);
  const cycleOrigin=down.topId;
  const pageScrollOrigin=(await state()).pageScrollY;
  const seenIds=new Set([cycleOrigin]);
  for(let cycle=0;cycle<12;cycle++){
    const previous=await state();
    assert(previous.stagePanelBottom>0&&previous.purchasesPanelTop>=previous.stagePanelBottom-2&&previous.repaymentsPanelTop>=previous.purchasesPanelTop&&previous.ratesPanelTop>=previous.stagePanelBottom-2,
      `credit finance panels must remain BELOW the active stack for every selected card, even with empty purchases/repayments: ${JSON.stringify(previous)}`);
    assert(previous.topCenterVisible&&Math.abs(previous.pageScrollY-pageScrollOrigin)<=2,
      `credit stack remains in the viewport without document-scroll drift before drag ${cycle+1}/12: ${JSON.stringify(previous)}`);
    const startOfCycle=await pointer(-92,65);
    const dragging=await c.call("function(){const stage=document.querySelector('#myfinhub-card-stack .stack-stage');return Boolean(stage?.classList.contains('dragging'))}");
    if(!dragging)await shot('credit-stack-cycle-'+(cycle+1)+'-no-pointer-capture');
    assert(dragging,`real pointerdown must engage the active physical card at step ${cycle+1}/12: ${JSON.stringify(previous)}`);
    await release(startOfCycle,-92);
    await sleep(600); // restack completes at 470ms; allow selected-card reconciliation
    const actual=await state();
    if(actual.topId===previous.topId)await shot('credit-stack-cycle-'+(cycle+1)+'-no-restack');
    assert(actual.topId!==previous.topId,`each physical gesture rotates to a different card at step ${cycle+1}/12: ${JSON.stringify({previous,actual})}`);
    seenIds.add(actual.topId);
    assert(actual.stagePanelBottom>0&&actual.purchasesPanelTop>=actual.stagePanelBottom-2&&actual.repaymentsPanelTop>=actual.purchasesPanelTop&&actual.ratesPanelTop>=actual.stagePanelBottom-2,
      `Credit layout stable after physical card switch ${cycle+1}/12, including empty states: ${JSON.stringify(actual)}`);
    assert(actual.topCenterVisible&&Math.abs(actual.pageScrollY-pageScrollOrigin)<=2&&
      actual.count===6&&actual.dots===6&&actual.activeVisible&&actual.overflow<=1&&
      actual.editProfile===1&&actual.editDetails===1&&!actual.mode.includes('dragging'),
      `all physical cards and actions survive repeated restack ${cycle+1}/12: ${JSON.stringify(actual)}`);
    if((cycle+1)%6===0){
      if(actual.topId!==cycleOrigin)await shot('credit-stack-cycle-'+(cycle+1)+'-unexpected-order');
      assert(actual.topId===cycleOrigin,
        `six consecutive commits return to the original physical card at ${cycle+1}: ${JSON.stringify({origin:cycleOrigin,actual})}`);
    }
    console.log(`Credit stack physical drag ${cycle+1}/12: ${previous.topId} → ${actual.topId}`);
  }
  assert(seenIds.size===6,'two full physical cycles visit every card and preserve all six unique fronts');
  await shot('credit-stack-two-full-cycles');

  console.log('Credit stack remediation QA: single-card mode');
  await navigate('');
  const single=await state();
  assert(single.mode.includes('single-card-mode')&&single.count===1&&single.dots===0&&!single.hintVisible,'single active card renders without deck pagination/discovery affordance');
  assert(single.cursor==='default'&&single.touchAction==='pan-y','single active card disables deck drag affordance while preserving page scrolling');
  const singleId=single.topId;const singleStart=await pointer(-100,60);await release(singleStart,-100);await sleep(120);const singleAfter=await state();
  assert(singleAfter.topId===singleId&&!singleAfter.mode.includes('dragging'),'single active card does not enter restack choreography');
  await shot('credit-single-card');

  console.log('Credit stack remediation QA: Greek nickname glyph clearance');
  for(const [width,height,mobile,fixture] of [[320,812,true,'credit-greek-nickname-payzy'],[375,812,true,'credit-greek-nickname-payzy'],[1440,1000,false,'credit-greek-nickname-payzy'],[2560,1440,false,'credit-greek-nickname-payzy'],[1440,1000,false,'credit-greek-nickname']]){
    await viewport(width,height,mobile);await navigate(fixture,'reduced');
    const glyph=await c.call(`function(){const node=document.querySelector('#myfinhub-card-stack .stack-card.top .card-nickname');if(!node)return null;const style=getComputedStyle(node),text=node.textContent||'',probe=document.createElement('div');probe.style.cssText='position:fixed;left:-10000px;top:0;white-space:nowrap;padding:0;border:0;margin:0;';Object.assign(probe.style,{fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing});probe.textContent=text;const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';probe.append(marker);document.body.append(probe);try{const box=probe.getBoundingClientRect(),baseline=marker.getBoundingClientRect().top-box.top,context=document.createElement('canvas').getContext('2d');context.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;const metrics=context.measureText(text);return {text,font:style.fontFamily,size:style.fontSize,line:style.lineHeight,topClearance:baseline-metrics.actualBoundingBoxAscent,bottomClearance:box.height-baseline-metrics.actualBoundingBoxDescent,fullWidth:node.scrollWidth<=node.clientWidth+1}}finally{probe.remove()}}`);
    await shot('credit-greek-nickname-'+fixture+'-'+width);
    assert(glyph?.text==='Ύψος ΐΰ'&&glyph.fullWidth&&glyph.topClearance>=0&&glyph.bottomClearance>=0,'Greek nickname glyph ink fits the computed real font line box at '+width+'px: '+JSON.stringify(glyph));
  }
  await viewport(1440,1000,false);
  console.log('Credit stack remediation QA: direct accessible selection');
  await navigate('credit-stack');
  const choice=await c.call("function(){const dots=[...document.querySelectorAll('#myfinhub-card-stack .dots button')],target=dots.at(-1);if(!target)return null;const rect=target.getBoundingClientRect();target.focus();target.click();return {id:target.dataset.dotId,width:rect.width,height:rect.height}}");
  assert(choice?.id&&choice.width>=24&&choice.height>=24,'card indicators expose at least 24px real button targets');
  await waitFor("function(id){const top=document.querySelector('#myfinhub-card-stack .stack-card.top'),selected=document.querySelector('#myfinhub-card-stack .dot[aria-current=true]');return top?.dataset.cardId===id&&selected?.dataset.dotId===id&&selected===document.activeElement&&selected.tabIndex===0}",'clicked indicator selects its card and retains focus',[choice.id]);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});
  await waitFor("function(){const top=document.querySelector('#myfinhub-card-stack .stack-card.top'),selected=document.querySelector('#myfinhub-card-stack .dot[aria-current=true]');return top?.dataset.cardId==='qa-card'&&selected===document.activeElement&&document.querySelectorAll('#myfinhub-card-stack .dot[tabindex=\"0\"]').length===1}",'indicator Home selects the first card with one Tab stop');
  await shot('credit-stack-indicator-focus');
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


  console.log('Sensitive credit-stack clipboard single-flight: one status for same-turn double click');
  await viewport(1440,1000,false);await navigate('credit-stack');
  const stackFixture=await c.call("function(){const original=globalThis.fetch,descriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard'),legacy=document.execCommand;const probe=globalThis.__qaCreditSensitiveCopy={requests:0,copies:0,mode:'deny',release:null};globalThis.fetch=(input,init)=>{const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url,uri=new URL(raw,location.href);if(uri.pathname==='/api/card-secrets'&&String(init?.method||'GET').toUpperCase()==='POST'){probe.requests++;return Promise.resolve(new Response(JSON.stringify({pan:'4444333322221111',expiry:'11/30',cvv:'123'}),{status:200,headers:{'content-type':'application/json'}}))}return original(input,init)};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>{probe.copies++;if(probe.mode==='deny')return Promise.reject(new Error('synthetic clipboard denial'));return new Promise(resolve=>{probe.release=resolve})}}});document.execCommand=()=>false;globalThis.__qaCreditSensitiveCopyRestore=()=>{globalThis.fetch=original;if(descriptor)Object.defineProperty(navigator,'clipboard',descriptor);else delete navigator.clipboard;document.execCommand=legacy;delete globalThis.__qaCreditSensitiveCopy;delete globalThis.__qaCreditSensitiveCopyRestore};return true}");
  assert(stackFixture,'credit stack runs isolated Card Vault and clipboard fixture');
  assert(await c.call("function(){const b=document.querySelector('#myfinhub-card-stack .stack-card.top .copy-btn[data-field=pan]');b?.click();return Boolean(b)}"),'real top physical card copy selected');
  await waitFor("function(){return document.querySelector('#myfinhub-card-stack .sr-status[role=alert]')?.textContent?.includes('Δεν ήταν δυνατή η αντιγραφή')}",'denied credit stack copy remains explicit alert');
  assert(await c.call("function(){return globalThis.__qaCreditSensitiveCopy?.copies===1&&globalThis.__qaCreditSensitiveCopy?.requests===1}"),'first credit copy used one Card Vault read and one clipboard attempt');
  await shot('credit-stack-sensitive-copy-denied-desktop');
  assert(await c.call("function(){globalThis.__qaCreditSensitiveCopy.mode='pending';return true}"),'arm held credit clipboard');
  assert(await c.call("function(){const b=document.querySelector('#myfinhub-card-stack .stack-card.top .copy-btn[data-field=pan]');b?.click();b?.click();return Boolean(b)}"),'two credit copy clicks in same event turn');
  await waitFor("function(){return globalThis.__qaCreditSensitiveCopy?.copies===2}",'exactly one new clipboard attempt for double click');
  assert(await c.call("function(){const n=document.querySelector('#myfinhub-card-stack .sr-status');return n?.textContent===''&&n?.getAttribute('role')==='status'}"),'old credit denial cleared while pending, no false green');
  assert(await c.call("function(){globalThis.__qaCreditSensitiveCopy.release?.();return true}"),'confirm pending credit clipboard outcome');
  await waitFor("function(){return document.querySelector('#myfinhub-card-stack .sr-status[role=status]')?.textContent==='Αντιγράφηκε'}",'credit copy status only after acknowledged clipboard');
  assert(await c.call("function(){return globalThis.__qaCreditSensitiveCopy?.copies===2&&globalThis.__qaCreditSensitiveCopy?.requests===1}"),'credit sensitive copy never repeats vault read or clipboard for duplicate click');
  await viewport(375,812,true);
  assert(await c.call("function(){const n=document.querySelector('#myfinhub-card-stack .sr-status');return Boolean(n&&n.getAttribute('role')==='status'&&n.textContent==='Αντιγράφηκε'&&document.documentElement.scrollWidth<=innerWidth+1)}"),'mobile credit screen-reader-only status is accessible without document overflow');
  await shot('credit-stack-sensitive-copy-singleflight-mobile');
  assert(await c.call("function(){globalThis.__qaCreditSensitiveCopyRestore?.();return true}"),'credit stack clipboard fixture restored');


  console.log('Sensitive credit-stack stale-card pending-vault copy is cancelled before clipboard after restack');
  await viewport(1440,1000,false);await navigate('credit-stack');
  const staleCardFixture=await c.call("function(){const original=globalThis.fetch,descriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard'),probe=globalThis.__qaCreditStaleCopy={reads:0,writes:0,release:null};globalThis.fetch=(input,init)=>{const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url,uri=new URL(raw,location.href);if(uri.pathname==='/api/card-secrets'&&String(init?.method||'GET').toUpperCase()==='POST'){probe.reads++;return new Promise(resolve=>{probe.release=()=>resolve(new Response(JSON.stringify({pan:'4444333322221111',expiry:'11/30',cvv:'123'}),{status:200,headers:{'content-type':'application/json'}}))})}return original(input,init)};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>{probe.writes++;return Promise.resolve()}}});globalThis.__qaCreditStaleCopyRestore=()=>{globalThis.fetch=original;if(descriptor)Object.defineProperty(navigator,'clipboard',descriptor);else delete navigator.clipboard;delete globalThis.__qaCreditStaleCopy;delete globalThis.__qaCreditStaleCopyRestore};return true}");
  assert(staleCardFixture,'isolated delayed Card Vault read and counted clipboard writes installed');
  assert(await c.call("function(){const b=document.querySelector('#myfinhub-card-stack .stack-card.top .copy-btn[data-field=pan]');b?.click();return Boolean(b)}"),'original top-card copy requested');
  await waitFor("function(){return globalThis.__qaCreditStaleCopy?.reads===1&&typeof globalThis.__qaCreditStaleCopy.release==='function'}",'confidential original-card read deliberately held pending');
  const originalCopyCard=(await state()).topId;
  await pressArrow('ArrowDown');
  await waitFor("function(original){const top=document.querySelector('#myfinhub-card-stack .stack-card.top');return Boolean(top&&top.getAttribute('data-card-id')!==original)}",'top card changes while original-card vault read is pending',[originalCopyCard]);
  await sleep(550);
  assert(await c.call("function(){globalThis.__qaCreditStaleCopy.release?.();return true}"),'release stale card vault response after selected card switches');
  await sleep(240);
  const staleCopyOutcome=await c.call("function(){const p=globalThis.__qaCreditStaleCopy,n=document.querySelector('#myfinhub-card-stack .sr-status');return {reads:p?.reads,writes:p?.writes,role:n?.getAttribute('role'),status:n?.textContent||'',top:document.querySelector('#myfinhub-card-stack .stack-card.top')?.getAttribute('data-card-id')}}");
  assert(staleCopyOutcome.reads===1&&staleCopyOutcome.writes===0&&staleCopyOutcome.top!==originalCopyCard&&!staleCopyOutcome.status,'the old card never reaches clipboard or announces success/error after restack: '+JSON.stringify(staleCopyOutcome));
  await shot('credit-stack-stale-card-copy-cancelled-desktop');
  assert(await c.call("function(){globalThis.__qaCreditStaleCopyRestore?.();return true}"),'stale card copy fixture removed');


  console.log('Sensitive credit-stack stale pending-vault reveal must remain masked after restack');
  await viewport(1440,1000,false);await navigate('credit-stack');
  assert(await c.call("function(){const original=globalThis.fetch,probe=globalThis.__qaCreditStaleReveal={reads:0,release:null};globalThis.fetch=(input,init)=>{const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url,uri=new URL(raw,location.href);if(uri.pathname==='/api/card-secrets'&&String(init?.method||'GET').toUpperCase()==='POST'){probe.reads++;return new Promise(resolve=>{probe.release=()=>resolve(new Response(JSON.stringify({pan:'4444333322221111',expiry:'11/30',cvv:'123'}),{status:200,headers:{'content-type':'application/json'}}))})}return original(input,init)};globalThis.__qaCreditStaleRevealRestore=()=>{globalThis.fetch=original;delete globalThis.__qaCreditStaleReveal;delete globalThis.__qaCreditStaleRevealRestore};return true}"),'install isolated delayed Credit Card Vault reveal response');
  const originalRevealCard=(await state()).topId;
  assert(await c.call("function(){const b=document.querySelector('#myfinhub-card-stack .stack-card.top .reveal-btn');b?.click();return Boolean(b)}"),'top credit card starts pending vault reveal');
  await waitFor("function(){return globalThis.__qaCreditStaleReveal?.reads===1&&typeof globalThis.__qaCreditStaleReveal?.release==='function'}",'top-card vault reveal deliberately pending');
  await pressArrow('ArrowDown');
  await waitFor("function(original){return document.querySelector('#myfinhub-card-stack .stack-card.top')?.getAttribute('data-card-id')!==original}",'credit stack changes active card while reveal is pending',[originalRevealCard]);
  await sleep(550);
  assert(await c.call("function(){globalThis.__qaCreditStaleReveal?.release?.();return true}"),'old card vault read returns only after restack');
  await sleep(200);
  const revealWhileInactive=await c.call("function(original){const card=[...document.querySelectorAll('#myfinhub-card-stack .stack-card')].find(node=>node.getAttribute('data-card-id')===original);return {active:document.querySelector('#myfinhub-card-stack .stack-card.top')?.getAttribute('data-card-id'),revealed:card?.querySelector('.payment-card')?.dataset.revealed,numberMasked:Boolean(card?.querySelector('.card-number.masked')),status:document.querySelector('#myfinhub-card-stack .sr-status')?.textContent||''}}",[originalRevealCard]);
  assert(revealWhileInactive.active!==originalRevealCard&&revealWhileInactive.revealed==='false'&&revealWhileInactive.numberMasked&&!revealWhileInactive.status,'obsolete reveal does not unmask old inactive card or announce vault error');
  for(let cycle=0;cycle<5;cycle++){await pressArrow('ArrowDown');await sleep(530)}
  await waitFor("function(original){return document.querySelector('#myfinhub-card-stack .stack-card.top')?.getAttribute('data-card-id')===original}",'original card returns to front without any new reveal',[originalRevealCard]);
  const staleRevealMasked=await c.call("function(){const card=document.querySelector('#myfinhub-card-stack .stack-card.top .payment-card');return Boolean(card&&card.dataset.revealed==='false'&&card.querySelector('.card-number.masked')&&card.querySelector('.reveal-btn[aria-pressed=false]')&&!document.querySelector('#myfinhub-card-stack .sr-status')?.textContent)}");
  assert(staleRevealMasked,'staleRevealMasked: original card stays masked after full rotation; old vault read never latches visible');
  await shot('credit-stack-stale-vault-reveal-cancelled-desktop');
  assert(await c.call("function(){globalThis.__qaCreditStaleRevealRestore?.();return true}"),'restore isolated credit vault reveal mock');

  console.log('Rejected credit archive receipt preserves active identity');
  await navigate('credit-stack','reduced');
  const rejectedId=(await state()).topId;
  await c.call("function(){history.replaceState(null,'',location.pathname+'?page=credit&state=credit-stack&motion=reduced&card-profile-save-failure=1');return true}");
  assert(await c.call("function(){const button=document.querySelector('.stack-card.top .delete-btn');button?.click();return Boolean(button)}"),'arm credit archive failure');
  await waitFor("function(){return Boolean(document.querySelector('.stack-card.top .delete-slider'))}",'credit archive slider');
  await c.call("function(){const slider=document.querySelector('.stack-card.top .delete-slider');for(const key of ['End','Enter'])slider.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));return true}");
  await waitFor("function(){return document.querySelector('#myfinhub-card-stack .sr-status[role=alert]')?.textContent.includes('Δεν επιβεβαιώθηκε')}",'credit archive rejected');
  assert((await state()).topId===rejectedId&&(await state()).count===6,'rejected archive does not remove or reorder the credit deck');
  await shot('credit-stack-archive-rejected-receipt');

  c.close();console.log(`Credit stack remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
