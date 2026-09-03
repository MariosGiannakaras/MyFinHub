import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-settings-tabs-qa';mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();if(!chrome)throw new Error('Chrome/Chromium is required for Settings tabs QA.');
const port=9254;const profile='/tmp/myfinhub-settings-tabs-qa-chrome';const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const fn of this.listeners.get(message.method)||[])fn(message.params)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Settings tabs QA assertion failed: ${message}`)};
const tabs=[
  {id:'general',label:'Γενικά',selector:'.settings-general-grid'},
  {id:'profile',label:'Λογαριασμός',selector:'.settings-profile-card'},
  {id:'accounts',label:'Λογαριασμοί',selector:'.settings-accounts-tab'},
  {id:'budgets',label:'Προϋπολογισμοί & Στόχοι',selector:'.settings-budgets-only .budget-settings-panel'},
  {id:'categories',label:'Κατηγορίες',selector:'.settings-categories-only .category-icons-workspace'},
  {id:'icons',label:'Εικονίδια',selector:'.settings-icons-only .category-icons-workspace'},
  {id:'rules',label:'Κανόνες',selector:'.settings-rules-only .rule-settings-panel'},
  {id:'data',label:'Δεδομένα',selector:'.settings-data-tab'},
];
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('state','settings-tabs');const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));c.on('Network.loadingFailed',params=>{if(!params.canceled&&params.errorText!=='net::ERR_ABORTED')failedRequests.push(`${params.errorText||'network failure'} [${params.type||'unknown'}]`)});
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clickTab=async tab=>{const ok=await c.call("function(label){const node=[...document.querySelectorAll('.settings-tablist button')].find(item=>(item.textContent||'').trim()===label);if(!node||node.disabled)return false;node.click();node.scrollIntoView({block:'nearest',inline:'center'});return true}",[tab.label]);assert(ok,`tab ${tab.label} is enabled and clickable`);await waitFor("function(id,selector){const selected=[...document.querySelectorAll('.settings-tablist [role=tab]')].filter(node=>node.getAttribute('aria-selected')==='true');const panel=document.querySelector('.settings-tab-panel');const target=document.querySelector(selector);return selected.length===1&&selected[0].getAttribute('aria-controls')===`settings-panel-${id}`&&panel?.id===`settings-panel-${id}`&&Boolean(target&&target.getClientRects().length)}",`${tab.label} selected panel`,[tab.id,tab.selector]);await c.call("function(){document.querySelector('.settings-tab-panel')?.scrollIntoView({block:'start'});window.scrollBy(0,-132);return true}");await sleep(100)};
  const noPageOverflow=async label=>{const overflow=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(overflow<=1,`${label} horizontal page overflow ${overflow}px`)};
  const screenshot=async(name)=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const visibleTouchTargets=async label=>{const offenders=await c.call("function(){return [...document.querySelectorAll('#main-workspace button,#main-workspace summary,#main-workspace [role=combobox]')].filter(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);if(!r.width||!r.height||style.visibility==='hidden'||style.display==='none'||el.disabled)return false;return r.width<40||r.height<40}).map(el=>({name:el.getAttribute('aria-label')||(el.textContent||'').trim().slice(0,50),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}))}");assert(offenders.length===0,`${label} touch targets below 40px: ${JSON.stringify(offenders.slice(0,8))}`)};

  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'Settings tabs');
  const architecture=await c.call("function(){const tabs=[...document.querySelectorAll('.settings-tablist [role=tab]')];return {count:tabs.length,disabled:tabs.filter(tab=>tab.disabled).length,labels:tabs.map(tab=>(tab.textContent||'').trim())}}");assert(architecture.count===tabs.length,`expected ${tabs.length} tabs, got ${architecture.count}`);assert(architecture.disabled===0,'all Settings tabs are enabled');assert(JSON.stringify(architecture.labels)===JSON.stringify(tabs.map(tab=>tab.label)),'Settings tab order changed');

  for(const mode of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:375,height:812}]){
    await viewport(mode.width,mode.height);
    for(const tab of tabs){
      await clickTab(tab);await noPageOverflow(`${mode.name} ${tab.label}`);
      if(tab.id==='profile'){
        const profile=await c.call("function(){const card=document.querySelector('.settings-profile-card');return {text:card?.textContent||'',buttons:card?.querySelectorAll('button').length||0}}");assert(profile.text.includes('Δεν υποστηρίζεται από αυτή τη σελίδα'),'Profile states unsupported mutations truthfully');assert(profile.buttons===0,'Profile does not invent account mutation controls');
      }
      if(tab.id==='budgets')assert(await c.call("function(){return !document.querySelector('.settings-budgets-only .rule-settings-panel')}") ,'Budgets does not render Rules UI');
      if(tab.id==='categories')assert(await c.call("function(){return ![...document.querySelectorAll('.settings-categories-only .taxonomy-icon-disclosure')].some(node=>node.getClientRects().length)}") ,'Categories keeps icon pickers out of the visible taxonomy workspace');
      if(tab.id==='icons'){
        const iconState=await c.call("function(){const root=document.querySelector('.settings-icons-only');return {picker:[...(root?.querySelectorAll('.taxonomy-icon-disclosure')||[])].some(node=>node.getClientRects().length>0),management:[...(root?.querySelectorAll('.taxonomy-add-row,.taxonomy-row-actions')||[])].some(node=>node.getClientRects().length>0)}}");assert(iconState.picker,'Icons exposes real icon preference controls');assert(!iconState.management,'Icons does not duplicate taxonomy mutation controls');
      }
      if(tab.id==='rules'){
        const ruleState=await c.call("function(){const details=document.querySelector('.settings-rules-only .rule-settings-panel');return {open:Boolean(details?.open),budget:Boolean(document.querySelector('.settings-rules-only .budget-settings-panel')),builder:Boolean(document.querySelector('.settings-rules-only .rule-editor-grid'))}}");assert(ruleState.open,'Rules details is semantically open');assert(!ruleState.budget,'Rules does not render budget editor');assert(ruleState.builder,'Rules renders the existing automation builder');
      }
      if(mode.name==='mobile')await visibleTouchTargets(`${mode.name} ${tab.label}`);
      await screenshot(`settings-${tab.id}-${mode.name}`);
    }
  }
  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);c.close();console.log('All Settings tabs rendered QA passed on desktop and mobile.');
}finally{c?.close();child.kill('SIGTERM')}
