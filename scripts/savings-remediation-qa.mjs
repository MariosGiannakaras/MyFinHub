import { execFileSync } from 'node:child_process';
import {launchQaBrowser} from './qa-browser-cdp-startup.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-savings-remediation-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Savings remediation QA.');
let browserSession;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Savings remediation QA assertion failed: ${message}`)};
try{
  browserSession=await launchQaBrowser({binary:chrome,firstPort:9294,profileBase:'/tmp/myfinhub-savings-remediation-qa-chrome'});
  const {port}=browserSession;
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const url=new URL(baseUrl);url.searchParams.set('page','savings');url.searchParams.set('state','savings-historical');
  await c.send('Page.navigate',{url:url.href});
  const waitFor=async(fn,label)=>{for(let i=0;i<120;i++){if(await c.call(fn))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'Savings heading');
  const state=()=>c.call("function(){const label=[...document.querySelectorAll('.period-control>span')].find(node=>!node.classList.contains('app-tooltip'));const route=document.querySelector('.savings-route-target');const routeValues=[...route?.querySelectorAll('em')||[]].map(node=>(node.textContent||'').replace(/\\s+/g,' ').trim());const goal=[...document.querySelectorAll('.savings-goal-row.personal')].find(row=>(row.textContent||'').includes('Ταμείο ασφαλείας'));return {period:(label?.textContent||'').trim(),heading:(document.querySelector('.savings-month-card h2')?.textContent||'').trim(),routeValues,goalBalance:(goal?.querySelector(':scope > strong')?.textContent||'').replace(/\\s+/g,' ').trim(),goalProgress:(goal?.querySelector('.savings-goal-progress b')?.textContent||'').trim()}}");
  // The selected reporting-month label updates synchronously; route balances
  // and goals can settle in a later render. Wait for the *actual finance values*
  // instead of guessing a fixed 350ms paint delay under concurrent QA load.
  const waitForSavingsSnapshot=async(predicate,label)=>{
    let last;
    for(let attempt=0;attempt<120;attempt++){
      last=await state();
      if(predicate(last))return last;
      await sleep(100);
    }
    throw new Error(`Savings QA values did not settle: ${label} (last=${JSON.stringify(last)})`);
  };
  const clickPeriod=async direction=>{const label=direction==='previous'?'Προηγούμενος μήνας':'Επόμενος μήνας';const ok=await c.call("function(label){const button=[...document.querySelectorAll('.period-control button[aria-label]')].find(node=>(node.getAttribute('aria-label')||'').startsWith(label));if(!button||button.disabled)return false;button.click();return true}",[label]);assert(ok,`missing enabled ${label} control`)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};

  await sleep(450);
  const august=await state();
  assert(august.period.includes('Αύγουστος 2026')&&august.heading==='Αυτός ο μήνας','current Savings state identifies August as the current reporting month');
  assert(august.routeValues.length===2&&august.goalBalance&&august.goalProgress,'current Savings route and personal-goal snapshot are rendered');

  console.log('Savings remediation QA: advisory goal forecast does not post money');
  const realBefore=await state();
  const openedProjection=await c.call("function(){const button=[...document.querySelectorAll('.savings-desktop-target .savings-goal-row.personal button')].find(node=>(node.textContent||'').includes('Προβολή στόχου'));button?.click();return Boolean(button)}");
  assert(openedProjection,'actual personal savings goal offers optional projection');
  await waitFor("function(){return Boolean(document.querySelector('.savings-desktop-target [data-savings-goal-projection]'))}",'desktop goal advisory panel');
  const advisory=await c.call("function(){const el=document.querySelector('.savings-desktop-target [data-savings-goal-projection]');return el?.textContent||''}");
  assert(advisory.includes('Κοινό πραγματικό υπόλοιπο')&&advisory.includes('Καμία μεταφορά')&&advisory.includes('γνωστές κινήσεις'),'goal projection distinguishes shared real balance, hypothetical funding and bounded assumptions');
  // The projection row starts below the desktop fold. Capture the actual
  // advisory metrics/scenarios rather than only the surrounding Savings hero.
  const framedDesktop=await c.call("function(){const node=document.querySelector('.savings-desktop-target [data-savings-goal-projection]');if(!node)return false;node.scrollIntoView({block:'center',behavior:'instant'});const box=node.getBoundingClientRect();return box.width>240&&box.height>150}");
  assert(framedDesktop,'desktop projection is present and can be brought into the viewport');
  await sleep(150);
  await screenshot('savings-goal-projection-desktop');
  const enteredScenario=await c.call("function(){const input=document.querySelector('.savings-desktop-target [data-savings-goal-projection] input[aria-label=\"Υποθετική μηνιαία αποταμίευση\"]');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,'50');input.dispatchEvent(new Event('input',{bubbles:true}));return true}");
  assert(enteredScenario,'what-if monthly contribution uses shared finance money input');
  await sleep(70);
  const stillReal=await state();
  assert(JSON.stringify(realBefore)===JSON.stringify(stillReal),'editable hypothetical contribution does not post finance events or change realized account balances');
  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:false});
  const framedMobile=await c.call("function(){const node=document.querySelector('.savings-mobile-legacy [data-savings-goal-projection]');if(!node)return false;node.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy(0,-100);return node.getBoundingClientRect().width>0}");
  assert(framedMobile,'mobile goal advisory header can be framed below the fixed toolbar');
  await sleep(170);
  const mobileProjection=await c.call("function(){const node=document.querySelector('.savings-mobile-legacy [data-savings-goal-projection]');const r=node?.getBoundingClientRect();return {exists:Boolean(node),width:r?.width||0,left:r?.left??-1,right:r?.right??9999,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,panels:node?.querySelectorAll('.savings-projection-scenario').length??0}}");
  await screenshot('savings-goal-projection-mobile');
  const scenarioFramed=await c.call("function(){const node=document.querySelector('.savings-mobile-legacy [data-savings-goal-projection] .savings-projection-scenarios');if(!node||node.querySelectorAll('.savings-projection-scenario').length<2)return false;node.scrollIntoView({block:'center',behavior:'instant'});const box=node.getBoundingClientRect();return box.width>0&&box.height>40&&box.top<innerHeight-70&&box.bottom>65}");
  assert(scenarioFramed,'mobile hypothetical scenarios visible in viewport before evidence capture');
  await sleep(120);
  await screenshot('savings-goal-projection-mobile-scenarios');
  assert(mobileProjection.exists&&mobileProjection.overflow<=1&&mobileProjection.left>=-1&&mobileProjection.right<=376,'goal projection mobile has no clipping or horizontal overflow');
  await c.call("function(){[...document.querySelectorAll('.savings-mobile-legacy [data-savings-goal-projection] button')].find(el=>(el.textContent||'').includes('Κλείσιμο'))?.click();return true}");
  await waitFor("function(){return !document.querySelector('[data-savings-goal-projection]')}",'projection closes without a ledger mutation');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  assert(JSON.stringify(realBefore)===JSON.stringify(await state()),'closed goal projection has no realized-money side effects');

  console.log('Savings remediation QA: future-dated saving does not affect current realized progress');
  const baselineUrl=new URL(baseUrl);baselineUrl.searchParams.set('page','savings');baselineUrl.searchParams.set('state','budget-rules');
  await c.send('Page.navigate',{url:baselineUrl.href});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'budget-matched baseline Savings');
  await sleep(350);
  const activeSavings=await c.call("function(){return (document.querySelector('.savings-hero')?.textContent||'').replace(/\\s+/g,' ').trim()}");
  const futureUrl=new URL(baseUrl);futureUrl.searchParams.set('page','savings');futureUrl.searchParams.set('state','future-reporting');
  await c.send('Page.navigate',{url:futureUrl.href});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'future activity Savings');
  await sleep(430);
  const futureSavings=await c.call("function(){return (document.querySelector('.savings-hero')?.textContent||'').replace(/\\s+/g,' ').trim()}");
  assert(futureSavings===activeSavings,'future-dated savings transfer does not change current-month realized Savings hero');
  await screenshot('savings-future-dated-activity-ignored');
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'return to baseline Savings');
  await sleep(350);

  await clickPeriod('previous');
  await waitFor("function(){return [...document.querySelectorAll('.period-control>span')].some(node=>(node.textContent||'').includes('Ιούλιος 2026'))}",'July reporting period');
  const july=await waitForSavingsSnapshot(snapshot=>
    snapshot.heading.includes('Ιούλιος 2026')
    &&JSON.stringify(snapshot.routeValues)!==JSON.stringify(august.routeValues)
    &&snapshot.goalBalance!==august.goalBalance
    &&snapshot.goalProgress!==august.goalProgress,
    'historical July balances and goal progress');
  assert(july.heading.includes('Ιούλιος 2026'),'historical Savings heading uses the selected month label');
  assert(JSON.stringify(july.routeValues)!==JSON.stringify(august.routeValues),'historical Savings route balances change with the selected period end');
  assert(july.goalBalance!==august.goalBalance&&july.goalProgress!==august.goalProgress,'historical personal-goal balance and progress use the selected period end');
  await screenshot('savings-selected-period-july');

  await clickPeriod('next');
  await waitFor("function(){return [...document.querySelectorAll('.period-control>span')].some(node=>(node.textContent||'').includes('Αύγουστος 2026'))}",'August reporting period restored');
  const restored=await waitForSavingsSnapshot(snapshot=>
    snapshot.heading==='Αυτός ο μήνας'
    &&JSON.stringify(snapshot.routeValues)===JSON.stringify(august.routeValues)
    &&snapshot.goalBalance===august.goalBalance
    &&snapshot.goalProgress===august.goalProgress,
    'August balances and goal progress restored after historical browsing');
  assert(restored.heading==='Αυτός ο μήνας'&&JSON.stringify(restored.routeValues)===JSON.stringify(august.routeValues)&&restored.goalBalance===august.goalBalance&&restored.goalProgress===august.goalProgress,'Savings current-period balances and goal progress restore after historical browsing');
  await screenshot('savings-selected-period-august-restored');
  // A single page width and an actual chart label gutter at the desktop
  // breakpoint, ordinary desktop and large monitors.
  for(const width of [1100,1440,2560]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await waitFor("function(){const page=document.querySelector('.savings-page'),body=page?.querySelector('.savings-desktop-target'),header=page?.querySelector('.page-heading'),actions=page?.querySelector('.savings-action-section');if(!body||!header||!actions)return false;const p=page.getBoundingClientRect(),r=[body,header,actions].map(n=>n.getBoundingClientRect());const svg=body.querySelector('.savings-trend-chart'),labels=[...svg?.querySelectorAll('g>text')||[]],lines=[...svg?.querySelectorAll('g>line')||[]];return r.every(b=>b.width>0&&Math.abs(b.left-p.left)<=1&&Math.abs(b.right-p.right)<=1)&&document.documentElement.scrollWidth<=innerWidth+1&&labels.length>0&&labels.length===lines.length&&new Set(labels.map(n=>n.textContent)).size===labels.length&&labels.every((n,i)=>n.getBBox().x+n.getBBox().width<=Number(lines[i].getAttribute('x1'))-2)}",'aligned Savings width and distinct nonoverlapping axis labels '+width);
    await screenshot('savings-aligned-axis-'+width);
  }
  for(const width of [320,375,768]){
    await c.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:false});
    await waitFor("function(){const page=document.querySelector('.savings-page'),body=page?.querySelector('.savings-mobile-legacy'),header=page?.querySelector('.page-heading'),actions=page?.querySelector('.savings-action-section');if(!body||!header||!actions)return false;const p=page.getBoundingClientRect();return [body,header,actions].every(node=>{const b=node.getBoundingClientRect();return b.width>0&&Math.abs(b.left-p.left)<=1&&Math.abs(b.right-p.right)<=1})&&document.documentElement.scrollWidth<=innerWidth+1}",'aligned mobile Savings width '+width);
    await c.call("function(){window.scrollTo({top:0,behavior:'instant'});return true}");
    if(width<=390)await waitFor("function(){const actions=[...document.querySelectorAll('.savings-action-section .savings-action')];return actions.length===3&&actions.every(button=>{const cta=button.querySelector('strong'),text=[...cta.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()),icon=cta.querySelector('svg');if(!text||!icon)return false;const range=document.createRange();range.selectNodeContents(text);const rects=[...range.getClientRects()],b=button.getBoundingClientRect(),c=cta.getBoundingClientRect(),s=icon.getBoundingClientRect();return rects.length===1&&rects[0].width>0&&rects[0].left>=c.left-1&&rects[0].right<=s.left+1&&s.right<=c.right+1&&c.left>=b.left-1&&c.right<=b.right+1&&c.bottom<=b.bottom+1&&s.width>0})}",'narrow Savings action text and arrow share one readable row '+width);
    await screenshot('savings-aligned-mobile-'+width);
  }
  // A malformed goal amount must not create any goal or affect actual balances.
  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:false});
  const beforeGoal=await state();
  const goalCount=await c.call("function(){return document.querySelectorAll('.savings-mobile-legacy .savings-goal-row.personal').length}");
  assert(await c.call("function(){const button=[...document.querySelectorAll('.savings-mobile-legacy .savings-goals button')].find(n=>(n.textContent||'').includes('Νέος στόχος'));button?.click();return Boolean(button)}"),'mobile goal opener');
  await waitFor("function(){return Boolean(document.querySelector('#savings-goal-editor-title'))}",'mobile goal editor');
  const setGoalField=async(label,value)=>assert(await c.call("function(label,value){const row=[...document.querySelectorAll('.savings-dialog label')].find(n=>(n.textContent||'').includes(label));const input=row?.querySelector('input');if(!(input instanceof HTMLInputElement))return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));return true}",[label,value]),'goal input '+label);
  const saveGoal=()=>c.call("function(){const button=[...document.querySelectorAll('.savings-dialog button')].find(n=>(n.textContent||'').includes('Αποθήκευση στόχου'));button?.click();return Boolean(button)}");
  await setGoalField('Όνομα στόχου','Synthetic cent precision goal');
  for(const invalid of ['1e3','0x10','1.234','0']){
    await setGoalField('Στόχος ποσού',invalid);
    assert(await saveGoal(),'goal save control');
    await waitFor("function(){return (document.querySelector('#savings-goal-editor-error')?.textContent||'').includes('έγκυρο θετικό ποσό')}",'reject malformed goal '+invalid);
    assert(await c.call("function(){return Boolean(document.querySelector('#savings-goal-editor-title'))}"),'invalid goal stays open');
    assert((await c.call("function(){return document.querySelectorAll('.savings-mobile-legacy .savings-goal-row.personal').length}"))===goalCount,'invalid goal creates no row');
  }
  await waitFor("function(){const dialog=document.querySelector('.savings-dialog[aria-labelledby=savings-goal-editor-title]');if(!dialog||!dialog.getClientRects().length)return false;for(let node=dialog;node;node=node.parentElement){if(Number(getComputedStyle(node).opacity)<.995||node.getAnimations().some(animation=>animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime)))return false}return !dialog.getAnimations({subtree:true}).some(animation=>animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime))}",'invalid Savings goal editor visually settled');
  await c.call("async function(){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true}");
  const readGoalDialogPaint=()=>c.call("function(){const node=document.querySelector('.savings-dialog[aria-labelledby=savings-goal-editor-title]');if(!node)return null;const style=getComputedStyle(node),header=node.querySelector('.panel-head'),footer=node.querySelector('.editor-actions'),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');if(!context||!header||!footer)return null;const rgba=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return Array.from(context.getImageData(0,0,1,1).data)};const token=style.getPropertyValue('--surface-elevated').trim(),base=style.getPropertyValue('--surface').trim(),expected=rgba(token||base||'#fff');const pixels=rgba(style.backgroundColor),headerPixels=rgba(getComputedStyle(header).backgroundColor);return {theme:document.documentElement.dataset.theme||null,token,base,background:style.backgroundColor,image:style.backgroundImage,alpha:pixels[3],headerAlpha:headerPixels[3],matches:JSON.stringify(pixels)===JSON.stringify(expected)&&JSON.stringify(headerPixels)===JSON.stringify(expected),footerImage:getComputedStyle(footer).backgroundImage,opacity:Number(style.opacity),ancestors:[...function*(){for(let p=node;p;p=p.parentElement)yield {className:typeof p.className==='string'?p.className:'',opacity:getComputedStyle(p).opacity,filter:getComputedStyle(p).filter,backdropFilter:getComputedStyle(p).backdropFilter}}()]}}");
  const goalDialogPaint=await readGoalDialogPaint();
  console.log('Savings goal editor settled paint:',JSON.stringify(goalDialogPaint));
  assert(goalDialogPaint?.alpha===255&&goalDialogPaint.opacity>=.995&&goalDialogPaint.headerAlpha===255&&goalDialogPaint.matches&&goalDialogPaint.footerImage!=='none','invalid Savings goal editor has an opaque dialog surface');
  await screenshot('savings-goal-invalid-cent-mobile');
  // Exercise actual theme owner too, without changing the default fixture for unrelated routes.
  for(const theme of ['dark','light']){
    assert(await c.call("async function(pref){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}",[theme])===theme,'Savings editor applies actual '+theme+' theme');
    // A theme attribute and two frames do not settle CSS color transitions.
    await waitFor("function(){const dialog=document.querySelector('.savings-dialog[aria-labelledby=savings-goal-editor-title]');if(!dialog||!dialog.getClientRects().length)return false;for(let node=dialog;node;node=node.parentElement){if(Number(getComputedStyle(node).opacity)<.995||node.getAnimations().some(animation=>(animation.pending||animation.playState==='running')&&Number.isFinite(animation.effect?.getComputedTiming().endTime)))return false}return !dialog.getAnimations({subtree:true}).some(animation=>(animation.pending||animation.playState==='running')&&Number.isFinite(animation.effect?.getComputedTiming().endTime))}",'Savings goal editor settled theme '+theme);
    await c.call("async function(){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true}");
    const paint=await readGoalDialogPaint();
    assert(paint?.theme===theme&&paint.token&&paint.alpha===255&&paint.headerAlpha===255&&paint.matches&&paint.footerImage!=='none'&&paint.opacity>=.995,'Savings editor solid theme surface '+theme+': '+JSON.stringify(paint));
    await screenshot('savings-goal-invalid-cent-mobile-'+theme);
  }
  await setGoalField('Στόχος ποσού','12,34');assert(await saveGoal(),'corrected goal save control');
  await waitFor("function(){const rows=[...document.querySelectorAll('.savings-mobile-legacy .savings-goal-row.personal')];return !document.querySelector('#savings-goal-editor-title')&&rows.some(n=>(n.textContent||'').includes('Synthetic cent precision goal')&&(n.textContent||'').includes('12,34'))}",'corrected cent-exact goal saved');
  assert(JSON.stringify(await state())===JSON.stringify(beforeGoal),'goal metadata does not move actual savings money');
  await waitFor("function(){const row=[...document.querySelectorAll('.savings-mobile-legacy .savings-goal-row.personal')].find(n=>(n.textContent||'').includes('Synthetic cent precision goal'));if(!row)return false;row.scrollIntoView({block:'center',behavior:'instant'});for(let node=row;node;node=node.parentElement){if(Number(getComputedStyle(node).opacity)<.995||node.getAnimations().some(animation=>animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime)))return false}const rect=row.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight+1}",'saved cent-exact Savings goal visible and settled');
  await screenshot('savings-goal-cent-exact-mobile');
  c.close();console.log('Savings remediation QA passed. Evidence: '+evidenceDir);
}finally{await browserSession?.stop()}
