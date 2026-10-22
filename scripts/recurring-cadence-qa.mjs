import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'visual-qa/recurring-cadence';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for recurring cadence QA.');
const port=9264;
const profile='/tmp/myfinhub-recurring-cadence-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','pipe']});
let browserStderr='';
child.stderr.on('data',chunk=>{browserStderr=(browserStderr+String(chunk)).slice(-1500)});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i++){if(child.exitCode!==null)break;try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}; recurring Chromium startup failed (exit ${child.exitCode??'pending'}): ${browserStderr.slice(-900)||'No browser stderr'}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Recurring cadence QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?page=recurring`)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label)=>{for(let i=0;i<120;i++){if(await c.call(fn))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const shot=async name=>{const image=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(image.data,'base64'))};
  await viewport(1280,900);
  await waitFor("function(){return Boolean(document.querySelector('[data-active-recurring]'))}",'recurring workspace');
  const desktop=await c.call("function(){const body=document.body.textContent||'';const active=document.querySelector('[data-active-recurring]');return {monthlyEquivalent:body.includes('Μηνιαίο ισοδύναμο ενεργών'),cadence:body.includes('Κάθε μήνα'),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,active:Boolean(active)}}");
  assert(desktop.active&&desktop.monthlyEquivalent&&desktop.cadence,'desktop exposes cadence semantics');
  assert(desktop.overflow<=2,`desktop horizontal overflow ${desktop.overflow}px`);
  await shot('recurring-cadence-desktop');

  const opened=await c.call("function(){const button=[...document.querySelectorAll('button[aria-label^=\"Επεξεργασία\"]')].find(item=>item.getClientRects().length>0);button?.click();return Boolean(button)}");
  assert(opened,'recurring editor opens');
  await waitFor("function(){return Boolean(document.querySelector('[role=dialog]'))}",'recurring cadence editor');
  const editor=await c.call("function(){const dialog=document.querySelector('[role=dialog]');const labels=[...dialog.querySelectorAll('label')].map(label=>label.querySelector('span')?.textContent||'');const every=[...dialog.querySelectorAll('label')].find(label=>(label.querySelector('span')?.textContent||'')==='Κάθε')?.querySelector('input');const unit=[...dialog.querySelectorAll('label')].find(label=>(label.querySelector('span')?.textContent||'').includes('Μονάδα επανάληψης'))?.querySelector('[role=combobox],input');return {labels,everyValue:every?.value,unit:Boolean(unit)}}");
  assert(editor.labels.includes('Κάθε')&&editor.labels.includes('Μονάδα επανάληψης'),'editor exposes interval and unit controls');
  assert(editor.everyValue==='1'&&editor.unit,'legacy monthly item defaults to one-month cadence');
  await shot('recurring-cadence-editor-desktop');
  console.log('Recurring amount QA: variable estimate has explicit controls and keeps actual payments separate');
  const chooseAmountMode=await c.call("function(){const span=[...document.querySelectorAll('[role=dialog] label>span')].find(item=>item.textContent?.trim()==='Τύπος ποσού');const input=span?.parentElement?.querySelector('[role=combobox]');input?.click();return Boolean(input)}");
  assert(chooseAmountMode,'amount-mode selector uses shared editable combobox');
  await waitFor("function(){return [...document.querySelectorAll('.owned-option-list [role=option]')].some(option=>(option.textContent||'').includes('Μεταβλητό'))}",'variable amount option');
  assert(await c.call("function(){const option=[...document.querySelectorAll('.owned-option-list [role=option]')].find(item=>(item.textContent||'').includes('Μεταβλητό'));option?.click();return Boolean(option)}"),'variable mode selected');
  await waitFor("function(){return Boolean(document.querySelector('[data-variable-recurring-explainer]'))}",'estimate explanation');
  const fillAmount=async(label,value)=>{
    const ok=await c.call("function(label,value){const span=[...document.querySelectorAll('[role=dialog] label>span')].find(item=>(item.textContent||'').includes(label));const input=span?.parentElement?.querySelector('input');if(!input)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);
    assert(ok,`variable amount control ${label} exists`);
    await sleep(90);
  };
  await fillAmount('Εκτιμώμενο ποσό','80');
  await fillAmount('Κατώτερη εκτίμηση','60');
  await fillAmount('Ανώτερη εκτίμηση','100');
  const bounds=await c.call("function(){const labels=[...document.querySelectorAll('[role=dialog] label')];const value=name=>labels.find(label=>(label.querySelector('span')?.textContent||'').includes(name))?.querySelector('input')?.value;return {estimate:value('Εκτιμώμενο ποσό'),min:value('Κατώτερη εκτίμηση'),max:value('Ανώτερη εκτίμηση')}}");
  assert(bounds.estimate==='80'&&bounds.min==='60'&&bounds.max==='100','variable estimate and range are editable in exact euros');
  await shot('recurring-variable-estimate-editor-desktop');


  await viewport(375,812);await sleep(180);
  const mobile=await c.call("function(){const dialog=document.querySelector('[role=dialog]');const rect=dialog?.getBoundingClientRect();const controls=[...dialog?.querySelectorAll('button,input,[role=combobox]')||[]].filter(item=>item.getClientRects().length>0);return {left:rect?.left??-1,right:rect?.right??9999,width:rect?.width??0,viewport:innerWidth,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,smallTargets:controls.filter(item=>{const r=item.getBoundingClientRect();return r.height<40||r.width<40}).map(item=>item.getAttribute('aria-label')||item.getAttribute('role')||item.tagName)}}");
  assert(mobile.left>=-1&&mobile.right<=mobile.viewport+1&&mobile.width>0,'mobile cadence editor stays inside viewport');
  assert(mobile.overflow<=2,`mobile horizontal overflow ${mobile.overflow}px`);
  assert(mobile.smallTargets.length===0,`mobile cadence controls below touch target: ${mobile.smallTargets.join(', ')}`);
  await shot('recurring-cadence-editor-mobile');
  await shot('recurring-variable-estimate-editor-mobile');
  const saveMode=await c.call("function(){const button=[...document.querySelectorAll('[role=dialog] button')].find(item=>(item.textContent||'').trim()==='Αποθήκευση');button?.click();return Boolean(button)}");
  assert(saveMode,'variable amount editor shares one durable save action');
  await waitFor("function(){return !document.querySelector('[role=dialog]')}",'variable recurring saved receipt');
  const savedVariable=await c.call("function(){return (document.querySelector('[data-active-recurring]')?.textContent||'').includes('Εκτίμηση')}");
  assert(savedVariable,'responsive recurring list visibly labels the forecast amount as estimate');
  await shot('recurring-variable-estimate-saved-mobile');

  console.log('Recurring amount QA: failed exact save retains variable draft and original actual money');
  const failureUrl=new URL(baseUrl);
  failureUrl.searchParams.set('page','recurring');
  failureUrl.searchParams.set('recurring-save-failure','1');
  await c.send('Page.navigate',{url:failureUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('[data-active-recurring]'))}",'fresh recurring page with rejected receipt');
  const beforeFailedSave=await c.call("function(){return (document.querySelector('[data-active-recurring]')?.textContent||'').includes('Εκτίμηση')}");
  assert(!beforeFailedSave,'failed-save fixture starts from the unchanged fixed recurring baseline');
  const reopen=await c.call("function(){const node=[...document.querySelectorAll('button[aria-label^=\\\"Επεξεργασία\\\"]')].find(element=>element.getClientRects().length>0);node?.click();return Boolean(node)}");
  assert(reopen,'the recurring editor reopens after navigation');
  await waitFor("function(){return Boolean(document.querySelector('[role=dialog]'))}",'rejected-save editor');
  const selectMode=await c.call("function(){const span=[...document.querySelectorAll('[role=dialog] label>span')].find(item=>item.textContent?.trim()==='Τύπος ποσού');const input=span?.parentElement?.querySelector('[role=combobox]');input?.click();return Boolean(input)}");
  assert(selectMode,'fixed-to-variable selection exists on rejected draft');
  await waitFor("function(){return [...document.querySelectorAll('.owned-option-list [role=option]')].some(item=>(item.textContent||'').includes('Μεταβλητό'))}",'rejected draft variable option');
  assert(await c.call("function(){const item=[...document.querySelectorAll('.owned-option-list [role=option]')].find(item=>(item.textContent||'').includes('Μεταβλητό'));item?.click();return Boolean(item)}"),'rejected draft selected variable mode');
  await fillAmount('Εκτιμώμενο ποσό','80');
  await fillAmount('Κατώτερη εκτίμηση','60');
  await fillAmount('Ανώτερη εκτίμηση','100');
  const attempt=await c.call("function(){const item=[...document.querySelectorAll('[role=dialog] button')].find(item=>(item.textContent||'').trim()==='Αποθήκευση');item?.click();return Boolean(item)}");
  assert(attempt,'rejected save action was submitted');
  await waitFor("function(){return (document.querySelector('#recurring-editor-error')?.textContent||'').includes('δοκιμαστική αποθήκευση')}",'rejected durable recurring receipt');
  const held=await c.call("function(){const dialog=document.querySelector('[role=dialog]');const error=document.querySelector('#recurring-editor-error')?.textContent||'';const inputs=[...dialog?.querySelectorAll('label')||[]];const val=label=>inputs.find(x=>(x.querySelector('span')?.textContent||'').includes(label))?.querySelector('input')?.value;return {open:!!dialog,min:val('Κατώτερη εκτίμηση'),max:val('Ανώτερη εκτίμηση'),error,storedText:document.querySelector('[data-active-recurring]')?.textContent||''}}");
  assert(held.open&&held.min==='60'&&held.max==='100'&&held.error.includes('δοκιμαστική')&&!held.storedText.includes('Εκτίμηση'),'failed finance receipt retains editable variable draft without mutating the persisted recurring baseline');
  await shot('recurring-variable-rejected-save-mobile');
  c.close();console.log('Recurring cadence rendered QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
