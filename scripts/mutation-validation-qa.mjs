import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-mutation-validation-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for mutation validation QA.');
const port=9351;
const profile='/tmp/myfinhub-mutation-validation-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stopBrowser(){
  if(child.exitCode!==null)return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(2000)]);
  if(child.exitCode===null){
    child.kill('SIGKILL');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1200)]);
  }
}
async function removeProfile(){
  for(let attempt=0;attempt<6;attempt+=1){
    try{rmSync(profile,{recursive:true,force:true});return}
    catch(error){
      if(error?.code!=='ENOTEMPTY'||attempt===5)throw error;
      await sleep(150*(attempt+1));
    }
  }
}
async function waitHttp(url){for(let i=0;i<120;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Mutation validation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const visible="function(node){if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}";
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<140;i+=1){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async page=>{const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('motion','reduced');await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}",`${page} page`);await sleep(100)};
  const clickText=async(selector,text)=>{const ok=await c.call(`function(selector,text){const visible=${visible};const node=[...document.querySelectorAll(selector)].find(item=>visible(item)&&(item.textContent||'').trim().includes(text));node?.click();return Boolean(node)}`,[selector,text]);assert(ok,`missing visible ${selector} containing ${text}`);await sleep(90)};
  const clickSelector=async(selector,label)=>{const ok=await c.call(`function(selector){const visible=${visible};const node=[...document.querySelectorAll(selector)].find(visible);node?.click();return Boolean(node)}`,[selector]);assert(ok,`missing ${label}`);await sleep(90)};
  const setAria=async(label,value)=>{const ok=await c.call(`function(label,value){const node=[...document.querySelectorAll('input,textarea')].find(item=>item.getAttribute('aria-label')===label);if(!node)return false;const proto=node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true}`,[label,value]);assert(ok,`missing input ${label}`);await sleep(60)};
  const assertAlert=async(root,label)=>{
    await waitFor("function(root){const scope=document.querySelector(root);const alert=scope?.querySelector('[role=alert]');return Boolean(alert&&(alert.textContent||'').trim())}",label,[root]);
    const state=await c.call("function(root){const scope=document.querySelector(root);const alert=scope?.querySelector('[role=alert]');const invalid=[...scope?.querySelectorAll('[aria-invalid=true]')||[]];return {text:(alert?.textContent||'').trim(),invalid:invalid.length,open:Boolean(scope)} }",[root]);
    assert(state.open&&state.text.length>=6,`${label}: missing actionable validation copy`);
    return state;
  };
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

  console.log('Mutation validation QA: Quick Entry');
  await navigate('dashboard');
  await clickSelector('[data-global-quick-entry="desktop"]','Quick Entry action');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal'))}",'Quick Entry modal');
  await clickText('.quick-modal button','Καταχώριση');
  await assertAlert('.quick-modal','Quick Entry invalid draft');
  await shot('validation-quick-entry');

  console.log('Mutation validation QA: Savings goal');
  await navigate('savings');
  await clickText('button','Νέος στόχος');
  await waitFor("function(){return Boolean(document.querySelector('.savings-dialog'))}",'Savings goal editor');
  await clickText('.savings-dialog button','Αποθήκευση στόχου');
  await assertAlert('.savings-dialog','Savings goal invalid draft');

  console.log('Mutation validation QA: Loan');
  await navigate('loans');
  await clickText('button','Νέο');
  await waitFor("function(){return Boolean(document.querySelector('.loan-editor-dialog'))}",'Loan editor');
  await clickText('.loan-editor-dialog button','Δημιουργία');
  await assertAlert('.loan-editor-dialog','Loan invalid draft');

  console.log('Mutation validation QA: Lending');
  await navigate('lending');
  await clickText('button','Νέο άτομο');
  await waitFor("function(){return Boolean(document.querySelector('.lending-dialog'))}",'Lending editor');
  await clickText('.lending-dialog button','Καταχώριση');
  await assertAlert('.lending-dialog','Lending invalid draft');

  console.log('Mutation validation QA: Recurring');
  await navigate('recurring');
  await clickText('button','Νέο πάγιο');
  await waitFor("function(){return Boolean(document.querySelector('#recurring-editor-title'))}",'Recurring editor');
  await clickText('.editor-dialog button','Αποθήκευση');
  await assertAlert('.editor-dialog','Recurring invalid draft');

  console.log('Mutation validation QA: Planning');
  await navigate('planning');
  await clickText('button','Νέα προγραμματισμένη');
  await waitFor("function(){return Boolean(document.querySelector('.planning-editor'))}",'Planning editor');
  await clickText('.planning-editor button','Προσθήκη στο πρόγραμμα');
  await assertAlert('.planning-editor','Planning invalid draft');

  console.log('Mutation validation QA: Cards profile');
  await navigate('cards');
  await clickSelector('.bank-add-btn','add card action');
  await waitFor("function(){return Boolean(document.querySelector('.card-create-modal'))}",'Card create editor');
  await clickText('.card-create-modal button','Προσθήκη κάρτας');
  await assertAlert('.card-create-modal','Card profile invalid draft');

  console.log('Mutation validation QA: Card secure details');
  await navigate('cards');
  await clickSelector('button[aria-label^="Ασφαλή στοιχεία"]','secure card details action');
  await waitFor("function(){return Boolean(document.querySelector('.app-card-details-dialog'))}",'Card details editor');
  await setAria('Λήξη κάρτας','13/31');
  await clickText('.app-card-details-dialog button','Αποθήκευση στοιχείων');
  await assertAlert('.app-card-details-dialog','Card secret invalid draft');

  console.log('Mutation validation QA: Credit purchase');
  await navigate('credit');
  await clickText('button','Νέα αγορά');
  await waitFor("function(){return Boolean(document.querySelector('#credit-purchase-title'))}",'Credit purchase editor');
  await clickText('.credit-dialog button','Καταχώριση αγοράς');
  await assertAlert('.credit-dialog','Credit purchase invalid draft');

  console.log('Mutation validation QA: Settings account');
  await navigate('settings');
  await clickText('.settings-tablist button','Λογαριασμοί');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'Account Settings');
  await clickText('.account-management-settings button','Νέος λογαριασμός');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-modal.is-new'))}",'Account editor');
  await clickText('.account-management-modal button','Δημιουργία λογαριασμού');
  await assertAlert('.account-management-modal','Account invalid draft');

  console.log('Mutation validation QA: Settings provider');
  await navigate('settings');
  await clickText('.settings-tablist button','Λογαριασμοί');
  await waitFor("function(){return Boolean(document.querySelector('.provider-management'))}",'Provider Settings');
  await clickText('.provider-management button','Νέος πάροχος');
  await waitFor("function(){return Boolean(document.querySelector('.provider-editor-modal'))}",'Provider editor');
  await clickText('.provider-editor-modal button','Συνέχεια στις εικόνες');
  await assertAlert('.provider-editor-modal','Provider invalid draft');

  console.log('Mutation validation QA: Settings rule');
  await navigate('settings');
  await clickText('.settings-tablist button','Κανόνες');
  await waitFor("function(){return Boolean(document.querySelector('.rules-new-button'))}",'Rules Settings');
  await clickSelector('.rules-new-button','new rule action');
  await waitFor("function(){return Boolean(document.querySelector('[data-rule-editor]'))}",'Rule editor');
  await clickText('[data-rule-editor] button','Δημιουργία κανόνα');
  await assertAlert('[data-rule-editor]','Rule invalid draft');

  console.log('Mutation validation QA: Settings category taxonomy');
  await navigate('settings');
  await clickText('.settings-tablist button','Κατηγορίες');
  await waitFor("function(){return Boolean(document.querySelector('.settings-categories-only .taxonomy-add-row'))}",'Category Settings');
  await clickText('.settings-categories-only .taxonomy-add-row button','Προσθήκη');
  await assertAlert('.settings-categories-only','Category invalid draft');

  console.log('Mutation validation QA: Settings account security');
  await navigate('settings');
  await clickText('.settings-tablist button','Χρήστης & Πρόσβαση');
  await waitFor("function(){return Boolean(document.querySelector('.account-security-settings'))}",'Account Security Settings');
  await clickText('.account-security-email-card button','Αλλαγή email');
  let securityError=await assertAlert('.account-security-settings','Invalid account email');
  assert(securityError.text.includes('email'),'invalid email message is task-local');
  await clickText('.account-security-password-card button','Αλλαγή κωδικού');
  securityError=await assertAlert('.account-security-settings','Invalid account password');
  assert(securityError.text.includes('τρέχοντα κωδικό'),'invalid password message is task-local');

  console.log('Mutation validation QA: Cards bank');
  await navigate('cards');
  await clickText('.page-heading button','Προσθήκη τράπεζας');
  await waitFor("function(){return Boolean(document.querySelector('#new-bank-title'))}",'New bank editor');
  await clickText('.picker.compact button','Προσθήκη τράπεζας');
  await assertAlert('.picker.compact','Bank invalid draft');

  console.log('Mutation validation QA: Reports budget');
  await navigate('reports');
  const budgetOpened=await c.call("function(){const details=document.querySelector('[data-budget-management]');if(!details)return false;details.open=true;details.dispatchEvent(new Event('toggle',{bubbles:false}));return true}");
  assert(budgetOpened,'budget management exists');
  await waitFor("function(){return Boolean(document.querySelector('[data-budget-management] .budget-editor-grid'))}",'Budget editor');
  await clickText('[data-budget-management] button','Αποθήκευση προϋπολογισμού');
  await assertAlert('[data-budget-management]','Budget invalid draft');

  await shot('validation-settings-mutators');

  console.log('Mutation validation rendered QA passed for finance, cards, Reports and Settings mutating forms.');
  c.close();
}finally{await stopBrowser();await removeProfile()}
