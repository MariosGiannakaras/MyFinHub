import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'visual-qa/completion-functional';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for completion functional QA.');
const port=9272;
const profile='/tmp/myfinhub-completion-functional-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Completion functional QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const visible="function(node){if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}";
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<140;i+=1){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async page=>{const url=new URL(baseUrl);url.searchParams.set('page',page);await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}",`${page} page`);await sleep(100)};
  const clickText=async(selector,text)=>{const ok=await c.call(`function(selector,text){const visible=${visible};const node=[...document.querySelectorAll(selector)].find(item=>visible(item)&&(item.textContent||'').trim().includes(text));node?.click();return Boolean(node)}`,[selector,text]);assert(ok,`missing visible ${selector} containing ${text}`);await sleep(90)};
  const setByLabel=async(label,value)=>{
    const ok=await c.call(`function(label,value){const visible=${visible};const direct=[...document.querySelectorAll('input,textarea,select')].find(item=>visible(item)&&item.getAttribute('aria-label')===label);const labels=[...document.querySelectorAll('label')].filter(visible);const wrapper=labels.find(item=>(item.textContent||'').replace(/\\s+/g,' ').includes(label));const control=direct??wrapper?.querySelector('input,textarea,select')??wrapper?.parentElement?.querySelector('input,textarea,select');if(!control)return false;if(control instanceof HTMLSelectElement){control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));return true}const proto=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(control,value);else control.value=value;control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));return true}`,[label,value]);
    assert(ok,`missing control for label ${label}`);await sleep(60);
  };
  const selectOwnedByLabel=async(label,optionText)=>{
    const opened=await c.call(`function(label){const visible=${visible};const input=[...document.querySelectorAll('input[role="combobox"]')].find(item=>visible(item)&&item.getAttribute('aria-label')===label);input?.click();return Boolean(input)}`,[label]);
    assert(opened,`missing owned combobox ${label}`);
    await waitFor("function(label){return [...document.querySelectorAll('.owned-select-popover[role=dialog]')].some(node=>node.getAttribute('aria-label')===label)}",`owned selector ${label}`,[label]);
    const chosen=await c.call(`function(label,optionText){const visible=${visible};const dialog=[...document.querySelectorAll('.owned-select-popover[role=dialog]')].find(node=>node.getAttribute('aria-label')===label);const option=[...dialog?.querySelectorAll('[role=option]')||[]].find(node=>visible(node)&&(node.textContent||'').trim()===optionText);option?.click();return Boolean(option)}`,[label,optionText]);
    assert(chosen,`missing owned option ${optionText} for ${label}`);
    await waitFor("function(label,optionText){const input=[...document.querySelectorAll('input[role=combobox]')].find(item=>item.getAttribute('aria-label')===label);return Boolean(input&&input.value===optionText&&input.getAttribute('aria-expanded')==='false')}",`owned selector ${label}=${optionText}`,[label,optionText]);
  };
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

  console.log('Completion functional QA: Modern transaction edit updates in place');
  await navigate('transactions');
  await setByLabel('Αναζήτηση συναλλαγών','Freddo espresso');
  await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=\"event\"]')].some(row=>(row.textContent||'').includes('Freddo espresso'))}",'filtered modern event row');
  const editModern=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('[data-transaction-source="event"]')].find(item=>visible(item)&&(item.textContent||'').includes('Freddo espresso'));const button=row?.querySelector('button[aria-label^="Επεξεργασία"]');button?.click();return Boolean(button)}`);
  assert(editModern,'filtered modern event exposes edit action');
  await waitFor("function(){return document.querySelector('#quick-add-title')?.textContent==='Επεξεργασία κίνησης'}",'modern event editor');
  await setByLabel('Ποσό','21.75');
  await setByLabel('Σχόλιο','QA Audit Modern Event');
  await clickText('.quick-modal button','Εφαρμογή αλλαγών');
  await setByLabel('Αναζήτηση συναλλαγών','QA Audit Modern Event');
  await waitFor("function(){const rows=[...document.querySelectorAll('[data-transaction-source=\"event\"]')].filter(row=>(row.textContent||'').includes('QA Audit Modern Event'));return rows.length>=1&&rows.some(row=>(row.textContent||'').includes('21,75'))}",'updated modern event row');
  const modernCopies=await c.call(`function(){const visible=${visible};return [...document.querySelectorAll('[data-transaction-source="event"]')].filter(row=>visible(row)&&(row.textContent||'').includes('QA Audit Modern Event')).length}`);
  assert(modernCopies===1,'modern edit updates the existing event instead of creating a duplicate visible record');
  await shot('transactions-modern-event-updated');

    console.log('Completion functional QA: Savings create/edit/delete + transaction');
  await navigate('savings');
  await clickText('button','Νέος στόχος');
  await waitFor("function(){return Boolean(document.querySelector('#savings-goal-editor-title'))}",'savings goal editor');
  await setByLabel('Όνομα στόχου','QA Audit Goal');
  await setByLabel('Στόχος ποσού','1234');
  await clickText('.savings-dialog button','Αποθήκευση στόχου');
  await waitFor("function(){return [...document.querySelectorAll('.savings-goal-row.personal')].some(row=>(row.textContent||'').includes('QA Audit Goal'))}",'saved savings goal');
  await shot('savings-goal-created');
  const editGoal=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('.savings-goal-row.personal')].find(item=>visible(item)&&(item.textContent||'').includes('QA Audit Goal'));const button=[...row?.querySelectorAll('button')||[]].find(item=>(item.textContent||'').includes('Επεξεργασία'));button?.click();return Boolean(button)}`);
  assert(editGoal,'saved goal exposes edit');
  await waitFor("function(){return Boolean(document.querySelector('#savings-goal-editor-title'))}",'goal edit editor');
  await setByLabel('Όνομα στόχου','QA Audit Goal Updated');
  await clickText('.savings-dialog button','Αποθήκευση στόχου');
  await waitFor("function(){return [...document.querySelectorAll('.savings-goal-row.personal')].some(row=>(row.textContent||'').includes('QA Audit Goal Updated'))}",'updated savings goal');
  const deleteGoal=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('.savings-goal-row.personal')].find(item=>visible(item)&&(item.textContent||'').includes('QA Audit Goal Updated'));const button=[...row?.querySelectorAll('button')||[]].find(item=>(item.textContent||'').includes('Διαγραφή'));button?.click();return Boolean(button)}`);
  assert(deleteGoal,'saved goal exposes delete');
  await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=\"alertdialog\"]'))}",'goal delete confirm');
  await clickText('.app-confirm-dialog button','Διαγραφή');
  await waitFor("function(){return ![...document.querySelectorAll('.savings-goal-row.personal')].some(row=>(row.textContent||'').includes('QA Audit Goal Updated'))}",'deleted savings goal');

  const savingAction=await c.call(`function(){const visible=${visible};const button=[...document.querySelectorAll('.savings-action')].find(item=>visible(item));button?.click();return Boolean(button)}`);
  assert(savingAction,'savings action opens');
  await waitFor("function(){return Boolean(document.querySelector('#saving-editor-title'))}",'savings transaction editor');
  await setByLabel('Ποσό','25');
  await setByLabel('Σχόλιο / λόγος','QA Audit Saving');
  await clickText('.savings-dialog button','Καταχώριση αποταμίευσης');
  await waitFor("function(){return document.body.textContent.includes('QA Audit Saving')}",'saved savings transaction');
  await shot('savings-transaction-created');

  console.log('Completion functional QA: Loan create and edit');
  await navigate('loans');
  const newLoan=await c.call(`function(){const visible=${visible};const header=document.querySelector('.page-heading,.page-header');const buttons=[...(header?.querySelectorAll('button')||[])];const button=buttons.find(item=>visible(item)&&(item.textContent||'').trim()==='Νέο');button?.click();return Boolean(button)}`);
  if(!newLoan)await clickText('button','Νέο');
  await waitFor("function(){return Boolean(document.querySelector('#loan-editor-title'))}",'new loan editor');
  await setByLabel('Όνομα','QA Audit Loan');
  await setByLabel('Συνολικό ποσό','600');
  await setByLabel('Αριθμός δόσεων','6');
  await clickText('.loan-editor-dialog button','Δημιουργία');
  await waitFor("function(){return [...document.querySelectorAll('.loan-list-row')].some(row=>(row.textContent||'').includes('QA Audit Loan'))}",'saved loan');
  await shot('loan-created');
  const editLoan=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('.loan-list-row')].find(item=>visible(item)&&(item.textContent||'').includes('QA Audit Loan'));const button=[...row?.querySelectorAll('button')||[]].find(item=>(item.textContent||'').includes('Επεξεργασία'));button?.click();return Boolean(button)}`);
  assert(editLoan,'saved loan exposes edit');
  await waitFor("function(){return Boolean(document.querySelector('#loan-editor-title'))}",'loan edit editor');
  await setByLabel('Όνομα','QA Audit Loan Updated');
  await clickText('.loan-editor-dialog button','Εφαρμογή');
  await waitFor("function(){return [...document.querySelectorAll('.loan-list-row')].some(row=>(row.textContent||'').includes('QA Audit Loan Updated'))}",'updated loan');
  await shot('loan-updated');

  console.log('Completion functional QA: Lending create');
  await navigate('lending');
  await clickText('button','Νέο άτομο');
  await waitFor("function(){return Boolean(document.querySelector('#lending-dialog-title'))}",'lending editor');
  await setByLabel('Πρόσωπο','QA Audit Person');
  await setByLabel('Ποσό','42');
  await setByLabel('Σχόλιο','QA Audit Lending');
  await clickText('.lending-dialog button','Καταχώριση');
  await waitFor("function(){return document.body.textContent.includes('QA Audit Person')&&document.body.textContent.includes('QA Audit Lending')}",'saved lending movement');
  await shot('lending-created');

  console.log('Completion functional QA: Lending repayment round-trip');
  await clickText('.lending-quick-action.repayment','Νέα επιστροφή');
  await waitFor("function(){return document.querySelector('#context-quick-title')?.textContent?.includes('Επιστροφή δανεικών')}",'lending repayment contextual editor');
  await setByLabel('Ποσό','12');
  await clickText('.contextual-quick-modal button','Καταχώριση');
  await waitFor("function(){const panel=document.querySelector('.lending-selected-panel');const rows=[...document.querySelectorAll('.lending-approved-table tbody tr')];const repaymentRows=rows.filter(row=>row.querySelector('.receivable-action.repaid'));return !document.querySelector('.contextual-quick-modal')&&Boolean(panel&&(panel.textContent||'').includes('QA Audit Person')&&(panel.textContent||'').includes('30,00'))&&repaymentRows.length===1&&repaymentRows.some(row=>(row.textContent||'').includes('Μου δίνει')&&(row.textContent||'').includes('Επιστροφή δανεικών'))}",'lending repayment reduces outstanding exactly once');
  await shot('lending-repayment-completed');

  console.log('Completion functional QA: Recurring create, edit, pause and reactivate');
  await navigate('recurring');
  await clickText('button','Νέο πάγιο');
  await waitFor("function(){return Boolean(document.querySelector('#recurring-editor-title'))}",'new recurring editor');
  await setByLabel('Όνομα','QA Audit Recurring');
  await setByLabel('Προκαθορισμένο ποσό','19.90');
  await clickText('.editor-dialog button','Αποθήκευση');
  await waitFor("function(){return [...document.querySelectorAll('[data-recurring-status=active]')].some(row=>(row.textContent||'').includes('QA Audit Recurring'))}",'saved recurring item');
  const editRecurring=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('[data-recurring-status=active]')].find(item=>visible(item)&&(item.textContent||'').includes('QA Audit Recurring'));const button=row?.querySelector('button[aria-label^="Επεξεργασία"]');button?.click();return Boolean(button)}`);
  assert(editRecurring,'saved recurring item exposes edit');
  await waitFor("function(){return Boolean(document.querySelector('#recurring-editor-title'))}",'recurring edit editor');
  await setByLabel('Όνομα','QA Audit Recurring Updated');
  await clickText('.editor-dialog button','Αποθήκευση');
  await waitFor("function(){return [...document.querySelectorAll('[data-recurring-status=active]')].some(row=>(row.textContent||'').includes('QA Audit Recurring Updated'))}",'updated recurring item');
  const pauseRecurring=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('[data-recurring-status=active]')].find(item=>visible(item)&&(item.textContent||'').includes('QA Audit Recurring Updated'));const button=row?.querySelector('button[aria-label^="Παύση"]');button?.click();return Boolean(button)}`);
  assert(pauseRecurring,'recurring item can be paused');
  await waitFor("function(){const root=document.querySelector('[data-inactive-recurring-history]');if(!root)return false;if(!root.open)root.open=true;return [...root.querySelectorAll('[data-recurring-status=paused]')].some(row=>(row.textContent||'').includes('QA Audit Recurring Updated'))}",'paused recurring history');
  const reactivateRecurring=await c.call(`function(){const root=document.querySelector('[data-inactive-recurring-history]');if(root&&!root.open)root.open=true;const row=[...document.querySelectorAll('[data-recurring-status=paused]')].find(item=>(item.textContent||'').includes('QA Audit Recurring Updated'));const button=row?.querySelector('button[aria-label^="Ενεργοποίηση"]');button?.click();return Boolean(button)}`);
  assert(reactivateRecurring,'paused recurring item can be reactivated');
  await waitFor("function(){return [...document.querySelectorAll('[data-recurring-status=active]')].some(row=>(row.textContent||'').includes('QA Audit Recurring Updated'))}",'reactivated recurring item');
  await shot('recurring-lifecycle-updated');

    console.log('Completion functional QA: Card profile edit stays separate from vault details');
  await navigate('cards');
  const cardsEdit=await c.call(`function(){const visible=${visible};const button=[...document.querySelectorAll('button[aria-label^="Επεξεργασία κάρτας"]')].find(visible);button?.click();return Boolean(button)}`);
  assert(cardsEdit,'Cards exposes profile editing separately from secure details');
  await waitFor("function(){return Boolean(document.querySelector('#card-create-title'))&&document.querySelector('#card-create-title').textContent.includes('Επεξεργασία κάρτας')}",'Cards profile editor');
  await setByLabel('Όνομα κάρτας','QA Audit Card Profile');
  await selectOwnedByLabel('Δίκτυο κάρτας','Mastercard');
  const alternateDesign=await c.call(`function(){const visible=${visible};const button=[...document.querySelectorAll('.card-create-modal .design-option')].find(item=>visible(item)&&item.getAttribute('aria-checked')!=='true');button?.click();return Boolean(button)}`);
  assert(alternateDesign,'card profile exposes an alternate visual design');
  await clickText('.card-create-modal button','Αποθήκευση αλλαγών');
  await waitFor("function(){const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>(node.textContent||'').includes('QA Audit Card Profile'));return Boolean(card&&card.querySelector('[data-network=\"MASTERCARD\"]'))}",'updated Cards profile keeps explicit Mastercard network after design change');
  const secureStillSeparate=await c.call(`function(){const visible=${visible};return [...document.querySelectorAll('button[aria-label^="Ασφαλή στοιχεία"]')].some(visible)&&!document.querySelector('.app-card-details-dialog')}`);
  assert(secureStillSeparate,'Cards profile save does not open or merge the secure-details dialog');
  await shot('cards-profile-updated');

  console.log('Completion functional QA: Credit-card profile edit');
  await navigate('credit');
  await clickText('button','Επεξεργασία κάρτας');
  await waitFor("function(){return Boolean(document.querySelector('#card-create-title'))&&document.querySelector('#card-create-title').textContent.includes('Επεξεργασία κάρτας')}",'Credit profile editor');
  await setByLabel('Όνομα κάρτας','QA Audit Credit Profile');
  await clickText('.card-create-modal button','Αποθήκευση αλλαγών');
  await waitFor("function(){return document.body.textContent.includes('QA Audit Credit Profile')}",'updated Credit profile nickname');
  await shot('credit-profile-updated');

  console.log('Completion functional QA: Settings custom cash account create and delete');
  await navigate('settings');
  await clickText('.settings-tablist button','Λογαριασμοί');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'Settings account management');
  await clickText('.account-management-settings button','Νέος λογαριασμός');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-modal.is-new'))}",'new account editor');
  await clickText('.account-management-modal.is-new button','Μετρητά');
  await setByLabel('Όνομα λογαριασμού','QA Audit Temp Cash');
  await clickText('.account-management-modal.is-new button','Δημιουργία λογαριασμού');
  await waitFor("function(){return [...document.querySelectorAll('.account-management-row')].some(row=>(row.textContent||'').includes('QA Audit Temp Cash'))}",'created temporary cash account');
  const requestedDelete=await c.call(`function(){const row=[...document.querySelectorAll('.account-management-row')].find(item=>(item.textContent||'').includes('QA Audit Temp Cash'));const button=row?.querySelector('button[aria-label="Διαγραφή QA Audit Temp Cash"]');button?.click();return Boolean(button)}`);
  assert(requestedDelete,'temporary custom cash account exposes delete');
  await waitFor("function(){return [...document.querySelectorAll('[role=dialog]')].some(dialog=>(dialog.textContent||'').includes('Διαγραφή λογαριασμού;')&&(dialog.textContent||'').includes('QA Audit Temp Cash'))}",'account delete confirmation');
  await clickText('[role=dialog] button','Διαγραφή');
  await waitFor("function(){const exists=[...document.querySelectorAll('.account-management-row')].some(row=>(row.textContent||'').includes('QA Audit Temp Cash'));const message=document.querySelector('.account-management-message')?.textContent||'';return !exists&&message.includes('Ο λογαριασμός διαγράφηκε.')}",'temporary cash account deleted');
  await shot('settings-account-create-delete');

  const overflow=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");
  assert(overflow<=1,`functional flows leave document overflow ${overflow}px`);
  c.close();
  console.log('Completion functional CRUD QA passed.');
}finally{
  child.kill('SIGTERM');
  await sleep(200);
  rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
