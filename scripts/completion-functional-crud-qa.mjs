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
  const openGlobalQuickEntry=async()=>{const opened=await c.call(`function(){const visible=${visible};const button=[...document.querySelectorAll('[data-global-quick-entry]')].find(visible);button?.click();return Boolean(button)}`);assert(opened,'visible global Quick Entry trigger exists');await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'generic Quick Entry open');};
  const installCardLifecycleVault=async()=>{
    const installed=await c.call(`function(){
      if(globalThis.__myfinhubCardLifecycleOriginalFetch)return true;
      const original=globalThis.fetch.bind(globalThis);
      globalThis.__myfinhubCardLifecycleOriginalFetch=original;
      globalThis.fetch=async function(input,init){
        const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
        const url=new URL(raw,location.href);const method=String(init?.method||'GET').toUpperCase();
        if(url.pathname==='/api/card-secrets'&&method==='PUT'){
          let body={};try{body=JSON.parse(typeof init?.body==='string'?init.body:'{}')}catch{}
          const digits=String(body.pan||'').replace(/\D/g,'');
          return new Response(JSON.stringify({saved:true,last4:digits.slice(-4)||null}),{status:200,headers:{'content-type':'application/json'}});
        }
        return original(input,init);
      };
      return true;
    }`);
    assert(installed,'card lifecycle vault fixture installs');
  };
  const restoreCardLifecycleVault=async()=>{
    const restored=await c.call(`function(){const original=globalThis.__myfinhubCardLifecycleOriginalFetch;if(typeof original!=='function')return false;globalThis.fetch=original;delete globalThis.__myfinhubCardLifecycleOriginalFetch;return true}`);
    assert(restored,'card lifecycle vault fixture restores original fetch');
  };


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
  const deleteModern=await c.call("function(){const row=[...document.querySelectorAll('[data-transaction-source=event]')].find(item=>item.getClientRects().length>0&&(item.textContent||'').includes('QA Audit Modern Event'));const button=row?.querySelector('button[aria-label^=\"Διαγραφή\"]');button?.click();return Boolean(button)}");
  assert(deleteModern,'updated modern event exposes delete action');
  await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'modern event delete confirmation');
  await sleep(180);await shot('confirm-transaction-delete');
  await clickText('.app-confirm-dialog button','Διαγραφή');
  await waitFor("function(){return ![...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Audit Modern Event'))}",'modern event deleted');
  const undoModern=await c.call("function(){const button=document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');button?.click();return Boolean(button&&!button.disabled)}");
  assert(undoModern,'modern delete can be undone');
  await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Audit Modern Event'))}",'modern delete undo restores event');
  await shot('transactions-modern-event-delete-undo');
  console.log('Completion functional QA: global undo/redo keyboard shortcuts');
  await c.call("function(){document.querySelector('#main-workspace')?.focus();dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true,cancelable:true}));return true}");
  await waitFor("function(){return ![...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Audit Modern Event'))}",'Ctrl+Y redo reapplies modern delete');
  await c.call("function(){document.querySelector('#main-workspace')?.focus();dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));return true}");
  await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Audit Modern Event'))}",'Ctrl+Z undo restores modern event again');

  console.log('Completion functional QA: Generic Quick Entry intents and validation');
  await setByLabel('Αναζήτηση συναλλαγών','');
  await openGlobalQuickEntry();
  await clickText('.generic-kind-grid button','Έξοδο');
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal .form-error'))}",'generic expense validation error');
  const genericValidation=await c.call("function(){return document.querySelector('.quick-modal .form-error')?.textContent||''}");
  assert(genericValidation.length>0,'generic Quick Entry exposes inline validation');
  await setByLabel('Ποσό','11.11');
  await setByLabel('Σχόλιο','QA Generic Expense');
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.quick-modal')&&[...document.querySelectorAll('[data-transaction-kind=expense][data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Generic Expense'))}",'generic expense created');

  await openGlobalQuickEntry();
  await clickText('.generic-kind-grid button','Έσοδο');
  await setByLabel('Ποσό','22.22');
  await setByLabel('Σχόλιο','QA Generic Income');
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.quick-modal')&&[...document.querySelectorAll('[data-transaction-kind=income][data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Generic Income'))}",'generic income created');

  await openGlobalQuickEntry();
  await clickText('.generic-kind-grid button','Ανάληψη');
  await setByLabel('Ποσό','5.50');
  await setByLabel('Σχόλιο','QA Generic Withdrawal');
  const withdrawalRoute=await c.call("function(){return [...document.querySelectorAll('.quick-modal input[role=combobox]')].map(input=>input.value).filter(Boolean)}");
  assert(withdrawalRoute.length>=2&&withdrawalRoute[0]!==withdrawalRoute[1],`withdrawal resolves distinct source/cash destination: ${JSON.stringify(withdrawalRoute)}`);
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.quick-modal')&&[...document.querySelectorAll('[data-transaction-kind=withdrawal][data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Generic Withdrawal'))}",'generic withdrawal created');

  await openGlobalQuickEntry();
  await clickText('.generic-kind-grid button','Επιστροφή');
  await setByLabel('Ποσό','4.40');
  await setByLabel('Σχόλιο','QA Generic Refund');
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.quick-modal')&&[...document.querySelectorAll('[data-transaction-kind=refund][data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Generic Refund'))}",'generic refund created');

  await openGlobalQuickEntry();
  await clickText('.generic-kind-grid button','Διόρθωση');
  const reconciliationActual=await c.call("function(){const text=document.querySelector('.reconcile-preview b')?.textContent||'';const normalized=text.replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');const base=Number(normalized);return Number.isFinite(base)?(base+1).toFixed(2):'1.00'}");
  await setByLabel('Πραγματικό υπόλοιπο',reconciliationActual);
  await setByLabel('Σχόλιο','QA Generic Reconciliation');
  await clickText('.quick-modal footer button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.quick-modal')&&[...document.querySelectorAll('[data-transaction-kind=reconciliation][data-transaction-source=event]')].some(row=>(row.textContent||'').includes('QA Generic Reconciliation'))}",'generic reconciliation created');
  await shot('generic-quick-entry-intents');

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
  await sleep(180);await shot('confirm-savings-goal-delete');
  await clickText('.app-confirm-dialog button','Διαγραφή');
  await waitFor("function(){return ![...document.querySelectorAll('.savings-goal-row.personal')].some(row=>(row.textContent||'').includes('QA Audit Goal Updated'))}",'deleted savings goal');

  console.log('Completion functional QA: Savings manual transfer, target progress and report effects');
  const savingsBefore=await c.call("function(){const progress=document.querySelector('.savings-target-track');const amount=document.querySelector('.savings-month-amount')?.textContent||'';return {progress:Number(progress?.getAttribute('aria-valuenow')||0),amount}}");
  await clickText('.sidebar nav button','Αναφορές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'Reports before savings transfer');
  const reportsBeforeSaving=await c.call("function(){const cards=[...document.querySelectorAll('.report-kpi-strip .report-headline-card')];const read=label=>{const card=cards.find(node=>(node.querySelector('span')?.textContent||'').trim()===label);return (card?.textContent||'').replace(/\\s+/g,' ').trim()};return {income:read('Συνολικά έσοδα'),expense:read('Συνολικά έξοδα'),saving:read('Αποταμίευση')}}");
  assert(reportsBeforeSaving.income&&reportsBeforeSaving.expense&&reportsBeforeSaving.saving,'Reports baseline exists before savings transfer');
  await clickText('.sidebar nav button','Αποταμίευση');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'Savings after report baseline');
  const savingAction=await c.call(`function(){const visible=${visible};const button=[...document.querySelectorAll('.savings-action')].find(item=>visible(item)&&(item.textContent||'').includes('Μεταφορά στην άκρη'));button?.click();return Boolean(button)}`);
  assert(savingAction,'manual savings transfer action opens');
  await waitFor("function(){return document.querySelector('#context-quick-title')?.textContent?.includes('Μεταφορά στην αποταμίευση')}",'manual savings contextual transfer editor');
  const route=await c.call("function(){const inputs=[...document.querySelectorAll('.contextual-quick-modal input[role=combobox]')];return inputs.map(input=>input.value)}");
  assert(route.length>=2&&route[0]&&route[1]&&route[0]!==route[1],`manual savings transfer resolves distinct source/destination accounts: ${JSON.stringify(route)}`);
  await setByLabel('Ποσό','25');
  await setByLabel('Σχόλιο','QA Audit Saving');
  await clickText('.contextual-quick-modal button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')&&document.body.textContent.includes('QA Audit Saving')}",'saved manual savings transfer');
  const savingsAfter=await c.call("function(){const progress=document.querySelector('.savings-target-track');const recent=document.querySelector('.savings-recent-compact .saving-history')?.textContent||'';const amount=document.querySelector('.savings-month-amount')?.textContent||'';return {progress:Number(progress?.getAttribute('aria-valuenow')||0),recent:recent.replace(/\\s+/g,' ').trim(),amount}}");
  assert(savingsAfter.recent.includes('QA Audit Saving')&&savingsAfter.recent.includes('Μεταφορά στην αποταμίευση')&&savingsAfter.recent.includes('25'),`savings history records manual transfer source/note/amount: ${JSON.stringify(savingsAfter)}`);
  assert(savingsAfter.amount!==savingsBefore.amount&&savingsAfter.progress>=savingsBefore.progress,`savings transfer updates monthly target progress: ${JSON.stringify({before:savingsBefore,after:savingsAfter})}`);
  await shot('savings-transaction-created');
  await clickText('.sidebar nav button','Αναφορές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'Reports after savings transfer');
  const reportsAfterSaving=await c.call("function(){const cards=[...document.querySelectorAll('.report-kpi-strip .report-headline-card')];const read=label=>{const card=cards.find(node=>(node.querySelector('span')?.textContent||'').trim()===label);return (card?.textContent||'').replace(/\\s+/g,' ').trim()};return {income:read('Συνολικά έσοδα'),expense:read('Συνολικά έξοδα'),saving:read('Αποταμίευση')}}");
  assert(reportsAfterSaving.income===reportsBeforeSaving.income&&reportsAfterSaving.expense===reportsBeforeSaving.expense,'savings transfer does not alter income/expense report KPIs');
  assert(reportsAfterSaving.saving!==reportsBeforeSaving.saving,'savings transfer updates savings report KPI');

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

  console.log('Completion functional QA: self-loan create, partial return and forgiveness');
  await clickText('.page-heading button,.page-header button','ΒΟΗΘΕΙΑ');
  await waitFor("function(){return Boolean(document.querySelector('#loan-editor-title'))}",'self-loan editor');
  await setByLabel('Όνομα','QA Audit Self Loan');
  await setByLabel('Συνολικό ποσό','80');
  const selfRoute=await c.call("function(){const dialog=document.querySelector('.loan-editor-dialog');const values=[...dialog?.querySelectorAll('input[role=combobox]')||[]].map(input=>input.value);return values}");
  assert(selfRoute.length>=3&&selfRoute.every(Boolean),'self-loan resolves type, target and payment accounts');
  await clickText('.loan-editor-dialog button','Δημιουργία');
  await waitFor("function(){const row=[...document.querySelectorAll('.loan-list-row.self-loan[data-loan-lifecycle=active]')].find(node=>(node.textContent||'').includes('QA Audit Self Loan'));return Boolean(row&&(row.textContent||'').includes('ΒΟΗΘΕΙΑ · δάνειο από εμένα')&&(row.textContent||'').includes('80'))}",'created self-loan');
  await clickText('.sidebar nav button','Συναλλαγές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').trim()==='Συναλλαγές'}",'transactions after self-loan create');
  await setByLabel('Αναζήτηση συναλλαγών','QA Audit Self Loan');
  const selfCreateTransfer=await c.call(`function(){const visible=${visible};const rows=[...document.querySelectorAll('[data-transaction-kind=transfer][data-transaction-source=event]')].filter(node=>visible(node)&&(node.textContent||'').includes('ΒΟΗΘΕΙΑ: QA Audit Self Loan'));return rows.map(row=>(row.textContent||'').replace(/\\s+/g,' ').trim())}`);
  assert(selfCreateTransfer.length===1&&selfCreateTransfer[0].includes('↔'),'self-loan creation produces exactly one neutral savings-to-current transfer');
  await clickText('.sidebar nav button','Δόσεις & Δάνεια');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δόσεις & Δάνεια')}",'Loans after self-loan transfer check');
  const selfPay=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('.loan-list-row.self-loan[data-loan-lifecycle=active]')].find(node=>visible(node)&&(node.textContent||'').includes('QA Audit Self Loan'));const button=row?.querySelector('.pay');button?.click();return Boolean(button)}`);
  assert(selfPay,'self-loan exposes return action');
  await waitFor("function(){return document.querySelector('#context-quick-title')?.textContent?.includes('Επιστροφή ΒΟΗΘΕΙΑΣ')}",'self-loan return modal');
  await setByLabel('Ποσό','30');
  await clickText('.contextual-quick-modal button','Επιβεβαίωση πληρωμής');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'self-loan return close');
  await waitFor("function(){const row=[...document.querySelectorAll('.loan-list-row.self-loan[data-loan-lifecycle=active]')].find(node=>(node.textContent||'').includes('QA Audit Self Loan'));return Boolean(row&&(row.textContent||'').includes('50')&&(row.textContent||'').includes('1 επιστροφές'))}",'self-loan partial return updates outstanding');
  const forgive=await c.call("function(){const row=[...document.querySelectorAll('.loan-list-row.self-loan[data-loan-lifecycle=active]')].find(node=>(node.textContent||'').includes('QA Audit Self Loan'));const button=row?.querySelector('.forgive');button?.click();return Boolean(button)}");
  assert(forgive,'self-loan exposes forgiveness');
  await waitFor("function(){const dialog=document.querySelector('.app-confirm-dialog[role=alertdialog]');return Boolean(dialog&&(dialog.textContent||'').includes('Χάρισμα υπολοίπου')&&(dialog.textContent||'').includes('χωρίς μεταφορά χρημάτων'))}",'self-loan forgiveness confirmation');
  await sleep(180);await shot('confirm-self-loan-forgiveness');
  await clickText('.app-confirm-dialog button','Χάρισμα');
  await waitFor("function(){const history=document.querySelector('[data-loan-history]');if(!history)return false;if(!history.open)history.open=true;const row=[...history.querySelectorAll('.loan-list-row.self-loan[data-loan-lifecycle=completed]')].find(node=>(node.textContent||'').includes('QA Audit Self Loan'));return Boolean(row&&!row.querySelector('.pay,.forgive')&&(row.textContent||'').includes('Χαρίστηκαν'))}",'forgiven self-loan moves to completed history');
  await shot('loan-self-lifecycle');
  await clickText('.sidebar nav button','Συναλλαγές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').trim()==='Συναλλαγές'}",'transactions after self-loan lifecycle');
  await setByLabel('Αναζήτηση συναλλαγών','QA Audit Self Loan');
  const selfTransfers=await c.call(`function(){const visible=${visible};return [...document.querySelectorAll('[data-transaction-kind=transfer][data-transaction-source=event]')].filter(node=>visible(node)&&(node.textContent||'').includes('QA Audit Self Loan')).map(row=>(row.textContent||'').replace(/\\s+/g,' ').trim())}`);
  assert(selfTransfers.length===2&&selfTransfers.some(row=>row.includes('ΒΟΗΘΕΙΑ: QA Audit Self Loan'))&&selfTransfers.some(row=>row.includes('ΕΠΙΣΤΡΟΦΗ: QA Audit Self Loan')),'self-loan lifecycle creates only the initial and actual-return money transfers; forgiveness creates none');
  await clickText('.sidebar nav button','Δανεικά');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δανεικά')}",'Lending after self-loan lifecycle');

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
  await setByLabel('Σχόλιο','QA Audit Repayment');
  await clickText('.contextual-quick-modal button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')||Boolean(document.querySelector('#context-quick-error'))}",'lending repayment submit result');
  const repaymentState=await c.call(`function(){const modal=document.querySelector('.contextual-quick-modal');const rows=[...document.querySelectorAll('.lending-approved-table tbody tr')];const repayments=rows.filter(row=>row.querySelector('.receivable-action.repaid'));const repayButton=document.querySelector('.lending-quick-action.repayment');return {modalOpen:Boolean(modal),error:document.querySelector('#context-quick-error')?.textContent||'',repaymentRows:repayments.map(row=>(row.textContent||'').replace(/\\s+/g,' ').trim()),repayButtonDisabled:Boolean(repayButton?.disabled),selectedPerson:document.querySelector('.lending-selected-identity h2')?.textContent||''}}`);
  assert(!repaymentState.modalOpen&&!repaymentState.error,`lending repayment submits without error: ${JSON.stringify(repaymentState)}`);
  assert(repaymentState.selectedPerson==='QA Audit Person',`repayment keeps the created person selected: ${JSON.stringify(repaymentState)}`);
  assert(repaymentState.repaymentRows.length===1&&repaymentState.repaymentRows[0].includes('QA Audit Repayment')&&repaymentState.repaymentRows[0].includes('Μου δίνει'),`lending repayment records exactly one semantic repayment row: ${JSON.stringify(repaymentState)}`);
  assert(!repaymentState.repayButtonDisabled,`partial 12/42 repayment leaves a remaining receivable: ${JSON.stringify(repaymentState)}`);
  await shot('lending-repayment-completed');

  console.log('Completion functional QA: Lending full repayment, aggregation and privacy');
  await clickText('.lending-quick-action.repayment','Νέα επιστροφή');
  await waitFor("function(){return document.querySelector('#context-quick-title')?.textContent?.includes('Επιστροφή δανεικών')}",'final lending repayment editor');
  await setByLabel('Ποσό','30');
  await setByLabel('Σχόλιο','QA Audit Final Repayment');
  await clickText('.contextual-quick-modal button','Καταχώριση');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'final lending repayment close');
  const settledLending=await c.call(`function(){const rows=[...document.querySelectorAll('.lending-approved-table tbody tr')];const repayments=rows.filter(row=>row.querySelector('.receivable-action.repaid'));const selected=document.querySelector('.lending-selected-identity');const summary=document.querySelector('.lending-history-summary')?.textContent||'';const repayButton=document.querySelector('.lending-quick-action.repayment');const privacyButton=document.querySelector('.privacy-toggle');return {rows:rows.length,repayments:repayments.map(row=>(row.textContent||'').replace(/\\s+/g,' ').trim()),settled:Boolean(selected&&(selected.textContent||'').includes('Η απαίτηση έχει εξοφληθεί')),summary,repayDisabled:Boolean(repayButton?.disabled),privacyPressed:privacyButton?.getAttribute('aria-pressed')||''}} `);
  assert(settledLending.rows===3&&settledLending.repayments.length===2&&settledLending.repayments.some(row=>row.includes('QA Audit Final Repayment')),`lending history aggregates one lend and two repayments: ${JSON.stringify(settledLending)}`);
  assert(settledLending.settled&&settledLending.repayDisabled&&settledLending.privacyPressed==='false'&&settledLending.summary.includes('•'),`full repayment settles while initial privacy remains masked: ${JSON.stringify(settledLending)}`);
  const privacyReveal=await c.call("function(){const button=document.querySelector('.privacy-toggle');if(!(button instanceof HTMLButtonElement))return false;button.click();return true}");
  assert(privacyReveal,'Lending privacy control reveals settled values');
  await waitFor("function(){const button=document.querySelector('.privacy-toggle');const summary=document.querySelector('.lending-history-summary')?.textContent||'';return button?.getAttribute('aria-pressed')==='true'&&!document.querySelector('.lending-selected-identity .private-text')&&summary.includes('0,00')}",'Lending privacy reveals settled zero balance');
  const privacyHide=await c.call("function(){const button=document.querySelector('.privacy-toggle');if(!(button instanceof HTMLButtonElement))return false;button.click();return true}");
  assert(privacyHide,'Lending privacy control hides settled values again');
  await waitFor("function(){const button=document.querySelector('.privacy-toggle');const summary=document.querySelector('.lending-history-summary')?.textContent||'';return button?.getAttribute('aria-pressed')==='false'&&Boolean(document.querySelector('.lending-selected-identity .private-text'))&&summary.includes('•')}",'Lending privacy masks selected identity');
  await shot('lending-full-repayment-private');


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
  const stopRecurring=await c.call(`function(){const visible=${visible};const row=[...document.querySelectorAll('[data-recurring-status=active]')].find(item=>visible(item)&&(item.textContent||'').includes('QA Audit Recurring Updated'));const button=row?.querySelector('button[aria-label^="Διακοπή"]');button?.click();return Boolean(button)}`);
  assert(stopRecurring,'reactivated recurring item can be stopped');
  await waitFor("function(){const root=document.querySelector('[data-inactive-recurring-history]');if(!root)return false;if(!root.open)root.open=true;const row=[...root.querySelectorAll('[data-recurring-status=stopped]')].find(item=>(item.textContent||'').includes('QA Audit Recurring Updated'));return Boolean(row&&!row.querySelector('.pay-action,.mobile-pay-action'))}",'stopped recurring item retained without payment action');
  assert(!(await c.call("function(){return [...document.querySelectorAll('[data-recurring-status=active]')].some(row=>(row.textContent||'').includes('QA Audit Recurring Updated'))}")),'stopped recurring item leaves active list');
  await shot('recurring-lifecycle-updated');

  console.log('Completion functional QA: Cards create, archive, restore and permanent delete');
  await navigate('cards');
  const openCreateCard=await c.call(`function(){const visible=${visible};const button=[...document.querySelectorAll('.bank-add-btn')].find(visible);button?.click();return Boolean(button)}`);
  assert(openCreateCard,'Cards exposes an add-card action');
  await waitFor("function(){return Boolean(document.querySelector('.card-create-modal'))}",'Cards create editor');
  await setByLabel('Όνομα κάρτας','QA Audit Lifecycle Card');
  const lifecycleDesign=await c.call(`function(){const visible=${visible};const option=[...document.querySelectorAll('.card-create-modal .design-option')].find(visible);option?.click();return Boolean(option)}`);
  assert(lifecycleDesign,'new debit card exposes a selectable design');
  await clickText('.card-create-modal button','Προσθήκη κάρτας');
  await waitFor("function(){return Boolean(document.querySelector('.app-card-details-dialog'))&&document.body.textContent.includes('QA Audit Lifecycle Card')}",'new-card secure details step');
  await installCardLifecycleVault();
  await setByLabel('Αριθμός κάρτας','4242 4242 4242 4242');
  await setByLabel('Λήξη κάρτας','12/30');
  await setByLabel('CVV κάρτας','123');
  await clickText('.app-card-details-dialog button','Αποθήκευση στοιχείων');
  await waitFor("function(){return !document.querySelector('.app-card-details-dialog')&&[...document.querySelectorAll('.prototype-payment-card')].some(card=>(card.textContent||'').includes('QA Audit Lifecycle Card')&&(card.textContent||'').includes('4242'))}",'created debit card persists into active Cards stack');
  await restoreCardLifecycleVault();
  await shot('cards-lifecycle-created');

  const archiveLifecycleCard=async()=>{
    const armed=await c.call(`function(){const visible=${visible};const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>visible(node)&&(node.textContent||'').includes('QA Audit Lifecycle Card'));const button=card?.querySelector('button[aria-label="Αρχειοθέτηση κάρτας"]');button?.click();return Boolean(button)}`);
    assert(armed,'lifecycle card exposes archive action');
    await waitFor("function(){const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));return Boolean(card?.querySelector('.r-card-archive-confirm'))}",'archive confirmation slider');
    const committed=await c.call("function(){const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));const button=card?.querySelector('.r-card-archive-keyboard');button?.click();return Boolean(button)}");
    assert(committed,'keyboard archive confirmation commits lifecycle card');
    await waitFor("function(){const details=[...document.querySelectorAll('.cards-archive')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));return Boolean(details)&&![...document.querySelectorAll('.prototype-payment-card')].some(card=>(card.textContent||'').includes('QA Audit Lifecycle Card'))}",'lifecycle card moves to archive');
  };
  await archiveLifecycleCard();
  const restoredLifecycle=await c.call("function(){const details=[...document.querySelectorAll('.cards-archive')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));if(!details)return false;details.open=true;const row=[...details.querySelectorAll('.card-archive-row')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));const button=[...row?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Επαναφορά'));button?.click();return Boolean(button)}");
  assert(restoredLifecycle,'archived lifecycle card exposes restore');
  await waitFor("function(){return [...document.querySelectorAll('.prototype-payment-card')].some(card=>(card.textContent||'').includes('QA Audit Lifecycle Card')&&(card.textContent||'').includes('4242'))}",'restored lifecycle card returns with preserved metadata');
  await shot('cards-lifecycle-restored');

  await archiveLifecycleCard();
  const deleteLifecycle=await c.call("function(){const details=[...document.querySelectorAll('.cards-archive')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));if(!details)return false;details.open=true;const row=[...details.querySelectorAll('.card-archive-row')].find(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'));const button=[...row?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Οριστική διαγραφή'));button?.click();return Boolean(button)}");
  assert(deleteLifecycle,'archived lifecycle card exposes permanent delete');
  await waitFor("function(){return [...document.querySelectorAll('[role=alertdialog]')].some(dialog=>(dialog.textContent||'').includes('Οριστική διαγραφή κάρτας;'))}",'lifecycle permanent-delete confirmation');
  await sleep(180);await shot('confirm-card-permanent-delete');
  await clickText('[role=alertdialog] button','Οριστική διαγραφή');
  await waitFor("function(){return ![...document.querySelectorAll('.prototype-payment-card,.card-archive-row')].some(node=>(node.textContent||'').includes('QA Audit Lifecycle Card'))&&document.body.textContent.includes('διαγράφηκε οριστικά')}",'lifecycle card permanently removed');
  await shot('cards-lifecycle-deleted');

  console.log('Completion functional QA: Card profile edit stays separate from vault details');
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
  const creditEdit=await c.call("function(){const button=document.querySelector('#myfinhub-card-stack .stack-card.top .edit-profile-btn');if(!(button instanceof HTMLButtonElement)||!button.getAttribute('aria-label')?.startsWith('Επεξεργασία κάρτας'))return false;button.click();return true}");
  assert(creditEdit,'active Credit card exposes profile editing on the canonical card');
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
  await waitFor("function(){return [...document.querySelectorAll('[role=alertdialog]')].some(dialog=>(dialog.textContent||'').includes('Διαγραφή λογαριασμού;')&&(dialog.textContent||'').includes('QA Audit Temp Cash'))}",'account delete confirmation');
  await sleep(180);await shot('confirm-account-delete');
  await clickText('[role=alertdialog] button','Διαγραφή');
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
