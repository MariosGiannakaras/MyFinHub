import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

type BrowserProofOptions={origin:string;email:string;password:string;nextTotp:()=>Promise<string>};

class Cdp{
  private id=0;
  private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  private listeners=new Map<string,Array<(params:any)=>void>>();
  private ws?:WebSocket;
  constructor(private readonly url:string){}
  async open(){await new Promise<void>((resolve,reject)=>{
    const ws=new WebSocket(this.url);this.ws=ws;
    ws.onopen=()=>resolve();ws.onerror=()=>reject(new Error('Browser CDP connection failed.'));
    ws.onmessage=event=>{const message=JSON.parse(String(event.data));
      if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}
      for(const listener of this.listeners.get(message.method)||[])listener(message.params);
    };
  })}
  send(method:string,params:Record<string,unknown>={}){const id=++this.id;return new Promise<any>((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws?.send(JSON.stringify({id,method,params}))})}
  on(method:string,listener:(params:any)=>void){const list=this.listeners.get(method)||[];list.push(listener);this.listeners.set(method,list)}
  async call<T=any>(fn:string,args:any[]=[]):Promise<T>{
    const root=await this.send('Runtime.evaluate',{expression:'globalThis'});
    const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Browser function call failed.');
    return result.result.value as T;
  }
  close(){this.ws?.close()}
}

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message)}
function trimDiagnostics(value:string){const text=value.trim();if(!text)return '(no Chromium diagnostics captured)';return text.length>6000?text.slice(-6000):text}
async function stopBrowser(child:ReturnType<typeof spawn>|undefined){
  if(!child||child.exitCode!==null)return;
  await new Promise<void>(resolve=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},2000);
    child.once('exit',()=>{clearTimeout(timer);resolve()});
    child.kill('SIGTERM');
  });
}
async function launchBrowser(chrome:string,baseProfile:string){
  let lastError:Error|undefined;
  for(let attempt=1;attempt<=2;attempt+=1){
    const port=9330+attempt;
    const profile=baseProfile+'-'+attempt;
    rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150});
    let diagnostics='',spawnError='';
    const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','pipe','pipe']});
    const capture=(stream:NodeJS.ReadableStream|null)=>stream?.on('data',chunk=>{diagnostics+=String(chunk);if(diagnostics.length>12000)diagnostics=diagnostics.slice(-12000)});
    capture(child.stdout);capture(child.stderr);child.on('error',error=>{spawnError=error.stack||error.message});
    try{
      for(let i=0;i<100;i+=1){
        if(spawnError)throw new Error('Chromium spawn failed: '+spawnError);
        if(child.exitCode!==null)throw new Error(`Chromium exited before CDP became ready (exit ${child.exitCode}).\n${trimDiagnostics(diagnostics)}`);
        try{const response=await fetch(`http://127.0.0.1:${port}/json/version`);if(response.ok){console.log(`[real-browser] Chromium CDP ready on attempt ${attempt} port ${port}`);return {child,port,profile}}}catch{}
        await sleep(200);
      }
      throw new Error(`Chromium did not expose CDP on port ${port} within 20s.\n${trimDiagnostics(diagnostics)}`);
    }catch(error){
      lastError=error instanceof Error?error:new Error(String(error));
      console.warn(`[real-browser] Chromium bootstrap attempt ${attempt} failed: ${lastError.message}`);
      await stopBrowser(child);rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150});
      if(attempt<2)await sleep(750);
    }
  }
  throw lastError??new Error('Chromium bootstrap failed.');
}

export async function runRealStackBrowserProof({origin,email,password,nextTotp}:BrowserProofOptions){
  const chrome=execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
  assert(chrome,'Chromium is required for the real-stack browser proof.');
  const evidenceDir='/tmp/myfinhub-real-stack-browser';
  const baseProfile='/tmp/myfinhub-real-stack-browser-profile';
  mkdirSync(evidenceDir,{recursive:true});
  let c:Cdp|undefined;
  let child:ReturnType<typeof spawn>|undefined;
  let profile='';
  try{
    const launched=await launchBrowser(chrome,baseProfile);
    child=launched.child;profile=launched.profile;const port=launched.port;
    const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin+'/#/transactions')}`,{method:'PUT'}).then(response=>response.json()) as any;
    c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const runtimeErrors:string[]=[];const apiFailures:string[]=[];const apiResponses:string[]=[];
    let expectedInvalidImport=false;
    c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
    c.on('Network.responseReceived',params=>{
      const url=String(params.response?.url||'');const status=Number(params.response?.status||0);
      if(!url.startsWith(origin+'/api/'))return;
      const pathname=new URL(url).pathname;apiResponses.push(`${status} ${pathname}`);
      if(status<400)return;
      if(status===401&&pathname==='/api/auth/session')return;
      if(status===400&&pathname==='/api/import'&&expectedInvalidImport)return;
      apiFailures.push(`${status} ${pathname}`);
    });
    const waitFor=async(fn:string,label:string,args:any[]=[])=>{for(let i=0;i<160;i++){if(await c!.call(fn,args))return;await sleep(100)}throw new Error('Timed out waiting for '+label)};
    const setSelector=async(selector:string,value:string)=>{const ok=await c!.call<boolean>("function(selector,value){const input=document.querySelector(selector);if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement))return false;const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[selector,value]);assert(ok,'Missing input '+selector)};
    const setByLabel=async(label:string,value:string)=>{const ok=await c!.call<boolean>("function(label,value){const visible=node=>{if(!(node instanceof HTMLElement))return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0};const direct=[...document.querySelectorAll('input,textarea,select')].find(node=>visible(node)&&node.getAttribute('aria-label')===label);const wrapper=[...document.querySelectorAll('label')].find(node=>visible(node)&&(node.textContent||'').replace(/\\s+/g,' ').includes(label));const control=direct??wrapper?.querySelector('input,textarea,select')??wrapper?.parentElement?.querySelector('input,textarea,select');if(control instanceof HTMLSelectElement){control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));return true}if(!(control instanceof HTMLInputElement||control instanceof HTMLTextAreaElement))return false;const proto=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(control,value);control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);assert(ok,'Missing field '+label)};
    const clickText=async(selector:string,text:string)=>{const ok=await c!.call<boolean>("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>item.getClientRects().length>0&&(item.textContent||'').trim().includes(text));if(!(node instanceof HTMLElement))return false;node.click();return true}",[selector,text]);assert(ok,'Missing control '+text)};
    const selectOwnedOption=async(label:string,optionText:string)=>{const opened=await c!.call<boolean>("function(label){const row=[...document.querySelectorAll('label')].find(node=>node.getClientRects().length>0&&(node.querySelector(':scope > span')?.textContent||'').trim().includes(label));const input=row?.querySelector('input[role=combobox]');if(!(input instanceof HTMLInputElement))return false;input.click();return true}",[label]);assert(opened,'Missing owned selector '+label);await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=listbox]'))}",label+' options');const selected=await c!.call<boolean>("function(optionText){const option=[...document.querySelectorAll('.owned-select-popover [role=option]')].find(node=>(node.textContent||'').trim()===optionText&&node.getClientRects().length>0);if(!(option instanceof HTMLElement))return false;option.click();return true}",[optionText]);assert(selected,'Missing owned option '+optionText)};
    const clickAria=async(label:string)=>{const ok=await c!.call<boolean>("function(label){const node=[...document.querySelectorAll('button[aria-label]')].find(item=>item.getClientRects().length>0&&item.getAttribute('aria-label')===label);if(!(node instanceof HTMLElement))return false;node.click();return true}",[label]);assert(ok,'Missing aria control '+label)};
    const waitCardState=async(nickname:string,active:boolean,present=true)=>waitFor("async function(nickname,active,present){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const card=(payload.data?.state?.cards||[]).find(item=>item.nickname===nickname);return present?Boolean(card&&Boolean(card.active)===active):!card}",present?'persisted card '+nickname:'deleted card '+nickname,[nickname,active,present]);
    const waitExpenseCategory=async(name:string,subcategory:string|null=null,present=true)=>waitFor("async function(name,subcategory,present){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const tree=payload.data?.state?.settings?.expenseCategoryTree||[];const category=tree.find(item=>item.name===name);if(!present)return !category;if(!category)return false;return subcategory?Array.isArray(category.subcategories)&&category.subcategories.includes(subcategory):true}",present?'persisted category '+name:'retired category '+name,[name,subcategory,present]);
    const waitIconChoice=async(choice:string)=>waitFor("async function(choice){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return Object.values(payload.data?.state?.settings?.categoryIcons||{}).includes(choice)}",'persisted icon '+choice,[choice]);
    const search=async(value:string)=>setByLabel('Αναζήτηση συναλλαγών',value);
    const waitApiEvent=async(note:string,present:boolean)=>waitFor("async function(note,present){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const exists=(payload.data?.state?.events||[]).some(item=>item.note===note);return present?exists:!exists}",'persisted event '+note,[note,present]);
    const waitLegacy=async(text:string,deleted:boolean)=>waitFor("async function(text,deleted){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const overrides=JSON.stringify(payload.data?.state?.overrides||{});const tombstones=JSON.stringify(payload.data?.state?.deleted||[]);return overrides.includes(text)&&(deleted?tombstones.includes('qa-seed-income'):!tombstones.includes('qa-seed-income'))}",'persisted legacy state',[text,deleted]);
    const waitCreditState=async(paid:boolean)=>waitFor("async function(paid){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const events=payload.data?.state?.events||[];const purchase=events.find(item=>item.kind==='card_purchase'&&item.cardId==='qa-credit-card'&&item.note==='Real Browser Credit Purchase');if(!purchase?.statementId)return false;const payment=events.find(item=>item.kind==='card_payment'&&item.cardId==='qa-credit-card'&&item.statementId===purchase.statementId);return paid?Boolean(payment):!payment}",paid?'persisted credit payment':'persisted credit purchase',[paid]);
    const installDownloadObserver=async()=>assert(await c!.call<boolean>("function(){globalThis.__myfinhubQaDownloads=[];const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLAnchorElement&&node.download)globalThis.__myfinhubQaDownloads.push(node.download)});observer.observe(document.body,{childList:true,subtree:true});globalThis.__myfinhubQaDownloadObserver=observer;return true}"),'Download observer could not be installed.');
    const importFile=async(mode:'invalid'|'valid')=>{const ok=await c!.call<boolean>("async function(mode){const input=document.querySelector('.settings-data-import-card input[type=file]');if(!(input instanceof HTMLInputElement))return false;let data;if(mode==='invalid'){data={app:'RheomIQ',schemaVersion:3}}else{const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();data=structuredClone(payload.data);data.updatedAt=new Date().toISOString();data.state.settings={...data.state.settings,accountNames:{...(data.state.settings?.accountNames||{}),'qa-cash':'Imported QA Cash'}}}const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(data)],mode+'.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[mode]);assert(ok,'Data import file could not be attached.')};
    const currentRevision=()=>c!.call<string>("async function(){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return '';const payload=await response.json();return String(payload.revision||'')}");
    const waitStateText=async(value:string,present=true)=>waitFor("async function(value,present){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const exists=JSON.stringify(payload.data?.state||{}).includes(value);return present?exists:!exists}",present?'persisted state '+value:'removed state '+value,[value,present]);
    const waitRecurringStatus=async(name:string,status:string)=>waitFor("async function(name,status){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return (payload.data?.state?.recurringCustom||[]).some(item=>item.name===name&&(item.status|| (item.active?'active':'stopped'))===status)}",'recurring '+name+' '+status,[name,status]);
    const waitScheduledStatus=async(note:string,status:string)=>waitFor("async function(note,status){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return (payload.data?.state?.scheduled||[]).some(item=>item.note===note&&item.status===status)}",'scheduled '+note+' '+status,[note,status]);
    const waitBudgetAmount=async(amount:number)=>waitFor("async function(amount){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return (payload.data?.state?.budgets||[]).some(item=>item.scope==='overall'&&Number(item.amount)===amount)}",'overall budget '+amount,[amount]);
    const waitRule=async(name:string)=>waitFor("async function(name){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return (payload.data?.state?.transactionRules||[]).some(item=>item.name===name&&item.enabled!==false)}",'rule '+name,[name]);
    const waitApiEventCategory=async(note:string,category:string)=>waitFor("async function(note,category){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return (payload.data?.state?.events||[]).some(item=>item.note===note&&item.category===category)}",'categorized event '+note,[note,category]);
    const shot=async(name:string)=>{const result=await c!.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

    console.log('[real-browser] stage login');
    await waitFor("function(){return Boolean(document.querySelector('#login-title'))}",'login screen');
    await setSelector('#login-email',email);await setSelector('#login-password',password);await clickText('.login-submit','Σύνδεση');
    await waitFor("function(){return document.querySelector('#mfa-title')?.textContent==='Επαλήθευση'}",'MFA challenge');
    await setSelector('#mfa-code',await nextTotp());await clickText('.login-submit','Επαλήθευση');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Συναλλαγ')}",'transactions workspace');

    console.log('[real-browser] stage modern-create-reload');
    const opened=await c.call<boolean>("function(){const button=[...document.querySelectorAll('[data-global-quick-entry]')].find(node=>node.getClientRects().length>0);if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(opened,'Global Quick Entry is not visible.');
    await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'Quick Entry');
    await clickText('.generic-kind-grid button','Έξοδο');await setByLabel('Ποσό','12.34');await setByLabel('Σχόλιο','Real Browser Expense');await clickText('.quick-modal footer button','Καταχώριση');
    await waitFor("function(){return !document.querySelector('.quick-modal')}",'Quick Entry close');await waitApiEvent('Real Browser Expense',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after create');await search('Real Browser Expense');
    await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('Real Browser Expense'))}",'persisted modern row');

    console.log('[real-browser] stage modern-edit-delete-undo');
    const editModern=await c.call<boolean>("function(){const row=[...document.querySelectorAll('[data-transaction-source=event]')].find(item=>(item.textContent||'').includes('Real Browser Expense'));const button=row?.querySelector('button[aria-label^=\"Επεξεργασία\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(editModern,'Modern edit action is missing.');
    await waitFor("function(){return document.querySelector('#quick-add-title')?.textContent==='Επεξεργασία κίνησης'}",'modern editor');await setByLabel('Ποσό','13.45');await setByLabel('Σχόλιο','Real Browser Expense Edited');await clickText('.quick-modal button','Εφαρμογή αλλαγών');await waitApiEvent('Real Browser Expense Edited',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after edit');await search('Real Browser Expense Edited');
    await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('Real Browser Expense Edited')&&(row.textContent||'').includes('13,45'))}",'edited modern row');
    const deleteModern=await c.call<boolean>("function(){const row=[...document.querySelectorAll('[data-transaction-source=event]')].find(item=>(item.textContent||'').includes('Real Browser Expense Edited'));const button=row?.querySelector('button[aria-label^=\"Διαγραφή\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(deleteModern,'Modern delete action is missing.');
    await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'modern delete confirm');await clickText('.app-confirm-dialog button','Διαγραφή');await waitApiEvent('Real Browser Expense Edited',false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after delete');
    const undoModern=await c.call<boolean>("function(){const button=document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.click();return true}");assert(undoModern,'Durable modern undo is unavailable after reload.');await waitApiEvent('Real Browser Expense Edited',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after undo');await search('Real Browser Expense Edited');await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('Real Browser Expense Edited'))}",'modern undo persisted');await shot('modern-transaction-persisted');

    console.log('[real-browser] stage legacy-edit-delete-undo');
    await search('Synthetic real-stack seed income');await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=legacy]')].some(row=>(row.textContent||'').includes('Synthetic real-stack seed income'))}",'legacy seed row');
    const editLegacy=await c.call<boolean>("function(){const row=[...document.querySelectorAll('[data-transaction-source=legacy]')].find(item=>(item.textContent||'').includes('Synthetic real-stack seed income'));const button=row?.querySelector('button[aria-label^=\"Επεξεργασία\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(editLegacy,'Legacy edit action is missing.');
    await waitFor("function(){return Boolean(document.querySelector('.legacy-transaction-editor[role=dialog]'))}",'legacy editor');await setByLabel('Ποσό ιστορικής κίνησης','101.25');await setByLabel('Περιγραφή ιστορικής κίνησης','Synthetic real-stack seed income override');await clickText('.legacy-transaction-editor button','Αποθήκευση override');await waitLegacy('Synthetic real-stack seed income override',false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after legacy edit');await search('Synthetic real-stack seed income override');await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=legacy][data-legacy-override=true]')].some(row=>(row.textContent||'').includes('Synthetic real-stack seed income override'))}",'legacy override after reload');
    const deleteLegacy=await c.call<boolean>("function(){const row=[...document.querySelectorAll('[data-transaction-source=legacy]')].find(item=>(item.textContent||'').includes('Synthetic real-stack seed income override'));const button=row?.querySelector('button[aria-label^=\"Διαγραφή\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(deleteLegacy,'Legacy delete action is missing.');
    await waitFor("function(){return Boolean(document.querySelector('[role=alertdialog]'))}",'legacy delete confirm');await clickText('[role=alertdialog] button','Διαγραφή');await waitLegacy('Synthetic real-stack seed income override',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after legacy delete');
    const undoLegacy=await c.call<boolean>("function(){const button=document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.click();return true}");assert(undoLegacy,'Durable legacy undo is unavailable after reload.');await waitLegacy('Synthetic real-stack seed income override',false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after legacy undo');await search('Synthetic real-stack seed income override');await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=legacy][data-legacy-override=true]')].some(row=>(row.textContent||'').includes('Synthetic real-stack seed income override'))}",'legacy undo persisted');await shot('legacy-transaction-persisted');

    console.log('[real-browser] stage credit-purchase-payment-reload');
    await clickText('.sidebar nav button','Πιστωτική');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πιστωτική Κάρτα')}",'credit workspace');
    await clickText('.page-heading .heading-actions button','Νέα αγορά');
    await waitFor("function(){return Boolean(document.querySelector('[aria-labelledby=\"credit-purchase-title\"]'))}",'credit purchase dialog');
    await setByLabel('Ποσό','25.50');await setByLabel('Περιγραφή','Real Browser Credit Purchase');await clickText('.credit-dialog button','Καταχώριση αγοράς');
    await waitFor("function(){return !document.querySelector('[aria-labelledby=\"credit-purchase-title\"]')}",'credit purchase close');await waitCreditState(false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πιστωτική Κάρτα')}",'credit reload after purchase');
    await waitFor("function(){const row=[...document.querySelectorAll('.credit-purchases-table tbody tr')].find(item=>(item.textContent||'').includes('Real Browser Credit Purchase'));const statement=document.querySelector('[data-primary-credit-statement]');return Boolean(row&&(row.textContent||'').includes('25,50')&&statement&&(statement.textContent||'').includes('25,50'))}",'credit purchase + statement after reload');
    await shot('credit-purchase-persisted');

    await clickText('.page-heading .heading-actions button','Αποπληρωμή');
    await waitFor("function(){return (document.querySelector('#context-quick-title')?.textContent||'').includes('Πληρωμή δήλωσης πιστωτικής')}",'credit statement payment');
    await clickText('.contextual-quick-modal button','Επιβεβαίωση πληρωμής');await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'credit payment close');await waitCreditState(true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πιστωτική Κάρτα')}",'credit reload after payment');
    await waitFor("function(){const statement=document.querySelector('[data-primary-credit-statement]');const payment=document.querySelector('.credit-payments-table tbody tr');const used=[...document.querySelectorAll('.credit-card-stage-stats>div')].find(item=>(item.querySelector(':scope>span')?.textContent||'').includes('Χρησιμοποιημένο'));return Boolean(statement&&(statement.textContent||'').includes('Εξοφλημένη')&&payment&&(payment.textContent||'').includes('25,50')&&(used?.textContent||'').includes('0,00'))}",'paid credit state after reload');
    await shot('credit-payment-persisted');

    console.log('[real-browser] stage savings-goal-transfer-reload');
    await clickText('.sidebar nav button','Αποταμίευση');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'savings workspace');
    await clickText('.savings-goals button','Νέος στόχος');
    await waitFor("function(){return Boolean(document.querySelector('#savings-goal-editor-title'))}",'savings goal editor');
    await setByLabel('Όνομα στόχου','Real Browser Savings Goal');await setByLabel('Στόχος ποσού','250');await clickText('.savings-dialog button','Αποθήκευση στόχου');
    await waitStateText('Real Browser Savings Goal');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'savings reload after goal');
    await waitFor("function(){return document.body.textContent.includes('Real Browser Savings Goal')}",'savings goal after reload');
    await clickText('.savings-action','Μεταφορά στην άκρη');
    await waitFor("function(){return (document.querySelector('#context-quick-title')?.textContent||'').includes('Μεταφορά στην αποταμίευση')}",'savings transfer modal');
    await setByLabel('Ποσό','20');await setByLabel('Σχόλιο','Real Browser Savings Transfer');await clickText('.contextual-quick-modal button','Καταχώριση');
    await waitStateText('Real Browser Savings Transfer');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αποταμίευση')}",'savings reload after transfer');
    await waitFor("function(){return document.body.textContent.includes('Real Browser Savings Transfer')}",'savings transfer after reload');
    await shot('savings-domain-persisted');

    console.log('[real-browser] stage loan-create-reload');
    await clickText('.sidebar nav button','Δόσεις & Δάνεια');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δόσεις & Δάνεια')}",'loans workspace');
    await clickText('.page-heading button','Νέο');
    await waitFor("function(){return Boolean(document.querySelector('#loan-editor-title'))}",'loan create editor');
    await setByLabel('Όνομα','Real Browser Loan');await setByLabel('Συνολικό ποσό','120');await setByLabel('Αριθμός δόσεων','3');await clickText('.loan-editor-dialog button','Δημιουργία');
    await waitStateText('Real Browser Loan');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δόσεις & Δάνεια')}",'loan reload');
    await waitFor("function(){return [...document.querySelectorAll('.loan-list-row[data-loan-lifecycle=active]')].some(row=>(row.textContent||'').includes('Real Browser Loan'))}",'loan after reload');
    await shot('loan-domain-persisted');

    console.log('[real-browser] stage lending-repayment-reload');
    await clickText('.sidebar nav button','Δανεικά / Οφειλές');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δανεικά / Οφειλές')}",'lending workspace');
    await clickText('.lending-selected-toolbar button','Νέο άτομο');
    await waitFor("function(){return Boolean(document.querySelector('#lending-dialog-title'))}",'lending create editor');
    await setByLabel('Πρόσωπο','Real Browser Person');await setByLabel('Ποσό','42');await setByLabel('Σχόλιο','Real Browser Lending');await clickText('.lending-dialog button','Καταχώριση');
    await waitStateText('Real Browser Lending');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δανεικά / Οφειλές')}",'lending reload after create');
    await waitStateText('Real Browser Lending');
    await clickText('.lending-quick-action.repayment','Νέα επιστροφή');
    await waitFor("function(){return (document.querySelector('#context-quick-title')?.textContent||'').includes('Επιστροφή δανεικών')}",'lending repayment modal');
    await setByLabel('Ποσό','12');await setByLabel('Σχόλιο','Real Browser Repayment');await clickText('.contextual-quick-modal button','Καταχώριση');
    await waitStateText('Real Browser Repayment');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δανεικά / Οφειλές')}",'lending reload after repayment');
    await waitStateText('Real Browser Repayment');
    const revealLending=await c.call<boolean>("function(){const button=document.querySelector('.privacy-toggle');if(!(button instanceof HTMLButtonElement))return false;if(button.getAttribute('aria-pressed')!=='true')button.click();return true}");assert(revealLending,'Lending privacy control is unavailable.');
    await waitFor("function(){return document.body.textContent.includes('Real Browser Person')}",'lending person after reload');
    await shot('lending-domain-persisted');

    console.log('[real-browser] stage recurring-create-pause-reload');
    await clickText('.sidebar nav button','Πάγια');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πάγια')}",'recurring workspace');
    await clickText('.page-heading button','Νέο πάγιο');
    await waitFor("function(){return Boolean(document.querySelector('#recurring-editor-title'))}",'recurring create editor');
    await setByLabel('Όνομα','Real Browser Recurring');await setByLabel('Προκαθορισμένο ποσό','19.90');await clickText('.editor-dialog button','Αποθήκευση');
    await waitRecurringStatus('Real Browser Recurring','active');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πάγια')}",'recurring reload after create');
    await waitFor("function(){return [...document.querySelectorAll('[data-recurring-status=active]')].some(row=>(row.textContent||'').includes('Real Browser Recurring'))}",'recurring after reload');
    const pauseRecurring=await c.call<boolean>("function(){const row=[...document.querySelectorAll('[data-recurring-status=active]')].find(item=>(item.textContent||'').includes('Real Browser Recurring'));const button=row?.querySelector('button[aria-label^=\"Παύση\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(pauseRecurring,'Recurring pause action is unavailable.');
    await waitRecurringStatus('Real Browser Recurring','paused');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πάγια')}",'recurring reload after pause');
    const openInactive=await c.call<boolean>("function(){const root=document.querySelector('[data-inactive-recurring-history]');if(!(root instanceof HTMLDetailsElement))return false;root.open=true;return true}");assert(openInactive,'Inactive recurring history is unavailable.');
    await waitFor("function(){return [...document.querySelectorAll('[data-recurring-status=paused]')].some(row=>(row.textContent||'').includes('Real Browser Recurring'))}",'paused recurring after reload');
    await shot('recurring-domain-persisted');

    console.log('[real-browser] stage planning-create-complete-reload');
    await clickText('.sidebar nav button','Προγραμματισμός');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Προγραμματισμός')}",'planning workspace');
    await clickText('#main-workspace button','Νέα προγραμματισμένη');
    await waitFor("function(){return Boolean(document.querySelector('.planning-editor[role=dialog]'))}",'planning editor');
    await setByLabel('Ποσό','33.30');await setByLabel('Περιγραφή','Real Browser Scheduled');await clickText('.planning-editor button','Προσθήκη στο πρόγραμμα');
    await waitScheduledStatus('Real Browser Scheduled','pending');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Προγραμματισμός')}",'planning reload after create');
    await waitFor("function(){return [...document.querySelectorAll('.scheduled-row')].some(row=>(row.textContent||'').includes('Real Browser Scheduled'))}",'scheduled row after reload');
    const completeScheduled=await c.call<boolean>("function(){const row=[...document.querySelectorAll('.scheduled-row')].find(item=>(item.textContent||'').includes('Real Browser Scheduled'));const button=[...row?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Ολοκλήρωση'));if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(completeScheduled,'Scheduled completion action is unavailable.');
    await waitFor("function(){return Boolean(document.querySelector('.completion-dialog'))}",'scheduled completion dialog');
    await setByLabel('Πραγματικό ποσό','30');await clickText('.completion-dialog button','Καταχώριση πραγματικής κίνησης');
    await waitScheduledStatus('Real Browser Scheduled','completed');await waitApiEvent('Real Browser Scheduled',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Προγραμματισμός')}",'planning reload after completion');
    await waitFor("function(){return [...document.querySelectorAll('.scheduled-history-list>div')].some(row=>(row.textContent||'').includes('Real Browser Scheduled')&&(row.textContent||'').includes('Ολοκληρώθηκε'))}",'completed schedule after reload');
    await shot('planning-domain-persisted');

    console.log('[real-browser] stage budget-create-reload');
    await clickText('.sidebar nav button','Αναφορές');
    await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'reports workspace for budget');
    await waitFor("function(){return Boolean(document.querySelector('[data-budget-management]'))}",'budget management');
    await selectOwnedOption('Τύπος ορίου','Συνολικό όριο');await setByLabel('Όριο €','777');await setByLabel('Προειδοποίηση %','80');await clickText('[data-budget-management] button','Αποθήκευση προϋπολογισμού');
    await waitBudgetAmount(777);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'reports reload after budget');
    await waitFor("function(){return [...document.querySelectorAll('.budget-setting-row')].some(row=>(row.textContent||'').includes('Συνολικό όριο')&&(row.textContent||'').includes('777'))}",'budget after reload');
    await shot('budget-domain-persisted');

    console.log('[real-browser] stage rule-create-apply-reload');
    await clickText('.sidebar nav button','Ρυθμίσεις');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings workspace for rules');
    await clickText('.settings-tablist button','Κανόνες');await waitFor("function(){return Boolean(document.querySelector('[data-rules-workspace]'))}",'rules workspace');
    await clickText('[data-rules-workspace] button','Νέος κανόνας');await waitFor("function(){return Boolean(document.querySelector('[data-rule-editor]'))}",'rule editor');
    await setByLabel('Όνομα αυτοματισμού','Real Browser Rule');await setByLabel('Κείμενο περιγραφής','Real Browser Rule Match');await selectOwnedOption('Κατηγορία / υποκατηγορία','Rule Applied');await clickText('[data-rule-editor] button','Δημιουργία κανόνα');
    await waitRule('Real Browser Rule');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings reload after rule');
    await clickText('.settings-tablist button','Κανόνες');await waitFor("function(){return [...document.querySelectorAll('.rule-settings-list article')].some(row=>(row.textContent||'').includes('Real Browser Rule'))}",'rule after reload');
    await clickText('.sidebar nav button','Συναλλαγές');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Συναλλαγές')}",'transactions for rule application');
    const openRuleQuick=await c.call<boolean>("function(){const button=document.querySelector('[data-global-quick-entry]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(openRuleQuick,'Global Quick Entry is unavailable for rule application.');
    await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'rule Quick Entry');
    await setByLabel('Ποσό','7.77');await setByLabel('Σχόλιο','Real Browser Rule Match');await clickText('.quick-modal button','Καταχώριση');
    await waitApiEventCategory('Real Browser Rule Match','Rule Applied');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Συναλλαγές')}",'transactions reload after rule match');await search('Real Browser Rule Match');
    await waitFor("function(){return [...document.querySelectorAll('[data-transaction-source=event]')].some(row=>(row.textContent||'').includes('Real Browser Rule Match')&&(row.textContent||'').includes('Rule Applied'))}",'rule-applied transaction after reload');
    await shot('rule-domain-persisted');

    console.log('[real-browser] stage cards-lifecycle-reload');
    await clickText('.sidebar nav button','Κάρτες');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')}",'cards workspace');
    const openCreateCard=await c.call<boolean>("function(){const button=[...document.querySelectorAll('.bank-add-btn')].find(node=>node.getClientRects().length>0);if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(openCreateCard,'Cards add action is unavailable.');
    await waitFor("function(){return Boolean(document.querySelector('.card-create-modal'))}",'card create editor');
    await setByLabel('Όνομα κάρτας','Real Browser Lifecycle Card');
    const selectDesign=await c.call<boolean>("function(){const option=[...document.querySelectorAll('.card-create-modal .design-option')].find(node=>node.getClientRects().length>0);if(!(option instanceof HTMLElement))return false;option.click();return true}");assert(selectDesign,'Card design option is unavailable.');
    await clickText('.card-create-modal button','Προσθήκη κάρτας');
    await waitFor("function(){return Boolean(document.querySelector('.app-card-details-dialog'))&&document.body.textContent.includes('Real Browser Lifecycle Card')}",'new card secure-details step');
    await setByLabel('Αριθμός κάρτας','4242 4242 4242 4242');await setByLabel('Λήξη κάρτας','12/30');await setByLabel('CVV κάρτας','123');await clickText('.app-card-details-dialog button','Αποθήκευση στοιχείων');
    await waitCardState('Real Browser Lifecycle Card',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')}",'cards reload after create');
    await waitFor("function(){return [...document.querySelectorAll('.prototype-payment-card')].some(card=>(card.textContent||'').includes('Real Browser Lifecycle Card')&&(card.textContent||'').includes('4242'))}",'created card after reload');
    const archiveCard=async()=>{const requested=await c!.call<boolean>("function(){const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>node.getClientRects().length>0&&(node.textContent||'').includes('Real Browser Lifecycle Card'));const button=card?.querySelector('button[aria-label=\"Αρχειοθέτηση κάρτας\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(requested,'Lifecycle card archive action is unavailable.');await waitFor("function(){const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'));return Boolean(card?.querySelector('.r-card-archive-confirm'))}",'card archive confirmation');const committed=await c!.call<boolean>("function(){const card=[...document.querySelectorAll('.prototype-payment-card')].find(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'));const button=card?.querySelector('.r-card-archive-keyboard');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(committed,'Card archive keyboard confirmation is unavailable.');await waitCardState('Real Browser Lifecycle Card',false)};
    await archiveCard();
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')}",'cards reload after archive');
    const restoreCard=await c.call<boolean>("function(){const details=[...document.querySelectorAll('.cards-archive')].find(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'));if(!(details instanceof HTMLDetailsElement))return false;details.open=true;const row=[...details.querySelectorAll('.card-archive-row')].find(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'));const button=[...row?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Επαναφορά'));if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(restoreCard,'Archived card restore action is unavailable.');
    await waitCardState('Real Browser Lifecycle Card',true);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')}",'cards reload after restore');
    await waitFor("function(){return [...document.querySelectorAll('.prototype-payment-card')].some(card=>(card.textContent||'').includes('Real Browser Lifecycle Card')&&(card.textContent||'').includes('4242'))}",'restored card after reload');
    await shot('cards-lifecycle-persisted');
    await archiveCard();
    const deleteCard=await c.call<boolean>("function(){const details=[...document.querySelectorAll('.cards-archive')].find(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'));if(!(details instanceof HTMLDetailsElement))return false;details.open=true;const row=[...details.querySelectorAll('.card-archive-row')].find(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'));const button=[...row?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Οριστική διαγραφή'));if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(deleteCard,'Archived card permanent-delete action is unavailable.');
    await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'card permanent-delete confirmation');await clickText('.app-confirm-dialog button','Οριστική διαγραφή');await waitCardState('Real Browser Lifecycle Card',false,false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')}",'cards reload after permanent delete');
    await waitFor("function(){return ![...document.querySelectorAll('.prototype-payment-card,.card-archive-row')].some(node=>(node.textContent||'').includes('Real Browser Lifecycle Card'))}",'deleted card absent after reload');

    console.log('[real-browser] stage taxonomy-icons-reload');
    await clickText('.sidebar nav button','Ρυθμίσεις');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings workspace for taxonomy');
    await clickText('.settings-tablist button','Κατηγορίες');await waitFor("function(){return Boolean(document.querySelector('.category-icons-workspace'))}",'taxonomy workspace');
    await setSelector('.taxonomy-add-row input','Real Browser Taxonomy');await clickText('.taxonomy-add-row .save-button','Προσθήκη');await waitExpenseCategory('Real Browser Taxonomy');
    await setSelector('.taxonomy-add-row input','Real Browser Target');await clickText('.taxonomy-add-row .save-button','Προσθήκη');await waitExpenseCategory('Real Browser Target');
    const sourceCategoryId=await c.call<string>("function(){const card=[...document.querySelectorAll('.category-taxonomy-card')].find(node=>(node.querySelector('.category-taxonomy-title b')?.textContent||'').trim()==='Real Browser Taxonomy');return card?.getAttribute('data-category-id')||''}");assert(sourceCategoryId,'Created taxonomy category has no stable id.');
    const addSubcategory=await c.call<boolean>("function(id){const card=[...document.querySelectorAll('.category-taxonomy-card')].find(node=>node.getAttribute('data-category-id')===id);const input=card?.querySelector('.taxonomy-add-subcategory input');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,'Real Browser Sub');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));const button=[...card.querySelectorAll('.taxonomy-add-subcategory button')].find(node=>(node.textContent||'').includes('Προσθήκη'));if(!(button instanceof HTMLElement))return false;button.click();return true}",[sourceCategoryId]);assert(addSubcategory,'Taxonomy subcategory add action is unavailable.');
    await waitExpenseCategory('Real Browser Taxonomy','Real Browser Sub');
    await clickAria('Μεταφορά Real Browser Sub σε άλλη κατηγορία');await waitFor("function(){return Boolean(document.querySelector('.taxonomy-move-editor [role=combobox]'))}",'subcategory move editor');
    const openMove=await c.call<boolean>("function(){const input=document.querySelector('.taxonomy-move-editor [role=combobox]');if(!(input instanceof HTMLInputElement))return false;input.click();return true}");assert(openMove,'Taxonomy move target selector is unavailable.');
    await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=listbox]'))}",'taxonomy move options');await clickText('.owned-select-popover [role=option]','Real Browser Target');await clickText('.taxonomy-move-editor .save-button','Μεταφορά');
    await waitExpenseCategory('Real Browser Target','Real Browser Sub');
    await clickAria('Απόσυρση κατηγορίας Real Browser Taxonomy');await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'taxonomy retirement confirmation');await clickText('.app-confirm-dialog button','Απόσυρση');await waitExpenseCategory('Real Browser Taxonomy',null,false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings reload after taxonomy');
    await clickText('.settings-tablist button','Κατηγορίες');await waitFor("function(){return Boolean(document.querySelector('.category-icons-workspace'))}",'taxonomy workspace after reload');
    await waitFor("function(){const target=[...document.querySelectorAll('.category-taxonomy-card')].find(node=>(node.querySelector('.category-taxonomy-title b')?.textContent||'').trim()==='Real Browser Target');return Boolean(target)&&[...target.querySelectorAll('.taxonomy-subcategory-main b')].some(node=>(node.textContent||'').trim()==='Real Browser Sub')&&![...document.querySelectorAll('.category-taxonomy-title b')].some(node=>(node.textContent||'').trim()==='Real Browser Taxonomy')}",'taxonomy persisted after reload');
    await shot('taxonomy-domain-persisted');

    await clickText('.settings-tablist button','Εικονίδια');await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only .category-icon-assignment-workspace'))}",'icons workspace');
    await clickText('.settings-icons-only .category-icon-pack-switcher-global button','Phosphor');await waitFor("function(){const button=[...document.querySelectorAll('.settings-icons-only .category-icon-pack-switcher-global button')].find(item=>(item.querySelector('b')?.textContent||'').trim()==='Phosphor');return button?.getAttribute('aria-pressed')==='true'}",'Phosphor icon family');
    const openIconTarget=await c.call<boolean>("function(){const rows=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-category .category-icon-unified-main')];const row=rows.find(item=>(item.querySelector('.category-icon-unified-copy b')?.textContent||'').trim()==='Real Browser Target');if(!(row instanceof HTMLElement))return false;row.click();return true}");assert(openIconTarget,'Created category is unavailable in icon workspace.');
    await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-picker'))}",'category icon picker');
    const iconChoice=await c.call<string>("function(){const buttons=[...document.querySelectorAll('.settings-icons-only [data-icon-selection-panel] .category-icon-options .category-icon-option')];const button=buttons[1]||buttons[0];const key=button?.querySelector('[data-category-icon]')?.getAttribute('data-category-icon')||'';if(!(button instanceof HTMLElement)||!key)return '';button.click();return key}");assert(iconChoice.startsWith('phosphor:'),'Expected a Phosphor category icon choice.');
    await waitIconChoice(iconChoice);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings reload after icon preference');
    await clickText('.settings-tablist button','Εικονίδια');await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only .category-icon-assignment-workspace'))}",'icons workspace after reload');
    await waitFor("function(choice){const rows=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-category .category-icon-unified-main')];const row=rows.find(item=>(item.querySelector('.category-icon-unified-copy b')?.textContent||'').trim()==='Real Browser Target');return row?.querySelector('[data-category-icon]')?.getAttribute('data-category-icon')===choice}",'icon preference after reload',[iconChoice]);
    await shot('icon-preference-persisted');

    console.log('[real-browser] stage provider-storage-create-bind-reload');
    await clickText('.sidebar nav button','Ρυθμίσεις');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings workspace for provider');
    await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return Boolean(document.querySelector('.provider-management'))}",'provider management');
    await clickText('.provider-management button','Νέος πάροχος');await waitFor("function(){return Boolean(document.querySelector('.provider-editor-modal'))}",'new provider editor');
    await setByLabel('Όνομα','Real Browser Provider');await setByLabel('Σύντομο όνομα','RB Provider');
    await waitFor("function(){const input=document.querySelector('.provider-id-field input');return input instanceof HTMLInputElement&&input.value==='real-browser-provider'}",'provider slug');
    await clickText('.provider-editor-footer button','Συνέχεια στις εικόνες');await waitFor("function(){return Boolean(document.querySelector('.provider-branding-panel'))}",'provider branding');
    const chooseProviderSlot=async(label:string)=>{const opened=await c!.call<boolean>("function(label){const card=[...document.querySelectorAll('.provider-slot-card')].find(node=>node.getClientRects().length>0&&(node.textContent||'').includes(label));const button=card?.querySelector('.provider-slot-select');if(!(button instanceof HTMLElement))return false;button.click();return true}",[label]);assert(opened,'Provider slot is unavailable: '+label);await waitFor("function(){return Boolean(document.querySelector('.provider-asset-picker[aria-modal=true]'))}",'provider asset picker '+label)};
    await chooseProviderSlot('Βασικό λογότυπο');await clickText('.provider-asset-picker button','Ανέβασμα νέας');
    const providerAssetAttached=await c.call<boolean>("function(){const input=document.querySelector('.provider-management > input[type=file]');if(!(input instanceof HTMLInputElement))return false;const svg='<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 120 60\\'><rect width=\\'120\\' height=\\'60\\' rx=\\'10\\' fill=\\'#234\\'/><path d=\\'M20 40h80V20H20z\\' fill=\\'#fff\\'/></svg>';const transfer=new DataTransfer();transfer.items.add(new File([svg],'real-browser-provider.svg',{type:'image/svg+xml'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true}");assert(providerAssetAttached,'Provider asset file could not be attached.');
    await waitFor("function(){return [...document.querySelectorAll('.provider-slot-card')].some(card=>(card.textContent||'').includes('Βασικό λογότυπο')&&(card.textContent||'').includes('real-browser-provider.svg'))}",'provider logo pending assignment');
    await chooseProviderSlot('Βασικό λεκτικό σήμα');await clickText('.provider-picker-asset','real-browser-provider.svg');
    await waitFor("function(){return [...document.querySelectorAll('.provider-slot-card')].filter(card=>(card.textContent||'').includes('real-browser-provider.svg')).length>=2&&document.body.textContent.includes('χρησιμοποιείται σε 2 θέσεις')}",'provider asset reuse');
    await clickText('.provider-editor-footer button','Δημιουργία παρόχου');
    await waitFor("function(){return !document.querySelector('.provider-editor-modal')&&(document.querySelector('.provider-management-message')?.textContent||'').includes('Real Browser Provider')}",'provider save success');
    await waitFor("async function(){const response=await fetch('/api/account-metadata?resource=financial-providers',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const provider=(payload.providers||[]).find(item=>item.id==='real-browser-provider');if(!provider||provider.assets?.length!==1)return false;const logo=provider.bindings?.find(item=>item.role==='logo'&&item.variant==='universal');const wordmark=provider.bindings?.find(item=>item.role==='wordmark'&&item.variant==='universal');const asset=provider.assets[0];return Boolean(logo&&wordmark&&logo.assetKey===asset.assetKey&&wordmark.assetKey===asset.assetKey&&String(asset.url||'').includes('/storage/v1/object/public/financial-provider-assets/providers/real-browser-provider/'))}",'provider API + Storage binding');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings reload after provider');
    await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return [...document.querySelectorAll('.provider-list-row')].some(row=>(row.textContent||'').includes('Real Browser Provider')&&(row.textContent||'').includes('1 εικόνα')&&(row.textContent||'').includes('2 χρήσεις'))}",'provider after hard reload');
    const reopenProvider=await c.call<boolean>("function(){const row=[...document.querySelectorAll('.provider-list-row')].find(node=>(node.textContent||'').includes('Real Browser Provider'));const button=row?.querySelector('.provider-edit-action');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(reopenProvider,'Persisted provider edit action is unavailable.');
    await waitFor("function(){return Boolean(document.querySelector('.provider-editor-modal'))}",'persisted provider editor');await clickText('.provider-editor-tabs button','Εικόνες');
    await waitFor("function(){const cards=[...document.querySelectorAll('.provider-slot-card')];const logo=cards.find(card=>(card.textContent||'').includes('Βασικό λογότυπο'));const wordmark=cards.find(card=>(card.textContent||'').includes('Βασικό λεκτικό σήμα'));const image=document.querySelector('.provider-library-item img');return Boolean(logo&&wordmark&&(logo.textContent||'').includes('real-browser-provider.svg')&&(wordmark.textContent||'').includes('real-browser-provider.svg')&&document.querySelectorAll('.provider-library-item').length===1&&image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0)}",'provider persisted branding editor');
    await shot('provider-storage-persisted');await clickAria('Κλείσιμο');

    console.log('[real-browser] stage account-create-delete-reload');
    await clickText('.sidebar nav button','Ρυθμίσεις');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings workspace for accounts');
    await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'account management');
    await clickText('.account-management-settings button','Νέος λογαριασμός');
    await waitFor("function(){return Boolean(document.querySelector('.account-management-modal.is-new'))}",'new account editor');
    await clickText('.account-management-modal.is-new button','Μετρητά');await setByLabel('Όνομα λογαριασμού','Real Browser Temp Cash');await clickText('.account-management-modal.is-new button','Δημιουργία λογαριασμού');
    await waitStateText('Real Browser Temp Cash');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings reload after account create');
    await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return [...document.querySelectorAll('.account-management-row')].some(row=>(row.textContent||'').includes('Real Browser Temp Cash'))}",'account after reload');
    await shot('account-domain-created');
    const deleteAccount=await c.call<boolean>("function(){const row=[...document.querySelectorAll('.account-management-row')].find(item=>(item.textContent||'').includes('Real Browser Temp Cash'));const button=row?.querySelector('button[aria-label=\"Διαγραφή Real Browser Temp Cash\"]');if(!(button instanceof HTMLElement))return false;button.click();return true}");assert(deleteAccount,'Temporary account delete action is unavailable.');
    await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'account delete confirmation');await clickText('.app-confirm-dialog button','Διαγραφή');await waitStateText('Real Browser Temp Cash',false);
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings reload after account delete');
    await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return ![...document.querySelectorAll('.account-management-row')].some(row=>(row.textContent||'').includes('Real Browser Temp Cash'))}",'account deletion after reload');

    console.log('[real-browser] stage data-management-backup-import');
    await clickText('.sidebar nav button','Ρυθμίσεις');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'settings workspace');
    await clickText('.settings-tablist button','Δεδομένα');await waitFor("function(){return Boolean(document.querySelector('.settings-data-tab'))}",'settings data tab');
    await installDownloadObserver();
    await clickText('.settings-data-action-button','Backup & λήψη');
    await waitFor("function(){return (document.querySelector('.logic-note[role=status]')?.textContent||'').includes('αντίγραφο ασφαλείας δημιουργήθηκε')}",'backup success feedback');
    await waitFor("function(){return (globalThis.__myfinhubQaDownloads||[]).some(name=>/^MyFinHub-backup-.*\\.json$/.test(name))}",'JSON export download');
    assert(apiResponses.includes('200 /api/backup'),'Backup action did not reach the real API successfully.');

    const beforeInvalid=await currentRevision();assert(beforeInvalid,'Could not read the pre-validation revision.');
    expectedInvalidImport=true;await importFile('invalid');
    await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'invalid import confirmation');
    const priorMessage=await c.call<string>("function(){return document.querySelector('.logic-note[role=status]')?.textContent||''}");
    await clickText('.app-confirm-dialog button','Εισαγωγή');
    await waitFor("function(previous){const text=document.querySelector('.logic-note[role=status]')?.textContent||'';return Boolean(text&&text!==previous)}",'invalid import rejection',[priorMessage]);
    const afterInvalid=await currentRevision();expectedInvalidImport=false;
    assert(afterInvalid===beforeInvalid,'Rejected import changed the canonical revision.');
    assert(apiResponses.includes('400 /api/import'),'Invalid import did not exercise the real validation rejection.');

    await importFile('valid');
    await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'valid import confirmation');
    await clickText('.app-confirm-dialog button','Εισαγωγή');
    await waitFor("function(){return (document.querySelector('.logic-note[role=status]')?.textContent||'').includes('Η εισαγωγή ολοκληρώθηκε')}",'valid import success');
    await waitFor("async function(){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();return payload.data?.state?.settings?.accountNames?.['qa-cash']==='Imported QA Cash'}",'persisted valid import');
    await c.send('Page.reload',{ignoreCache:true});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",'reload after valid import');
    await clickText('.sidebar nav button','Dashboard');await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('λογαριασμοί')}",'dashboard after import');
    await waitFor("function(){return document.body.textContent.includes('Imported QA Cash')}",'imported account name after reload');
    const historyButton=await c.call<boolean>("function(){const button=document.querySelector('button[aria-label=\"Ιστορικό αλλαγών\"]');if(!(button instanceof HTMLButtonElement))return false;button.click();return true}");assert(historyButton,'Change History action is missing.');
    await waitFor("function(){const dialog=document.querySelector('[aria-labelledby=\"change-history-title\"]');return Boolean(dialog&&(dialog.textContent||'').includes('Εισαγωγή δεδομένων')&&(dialog.textContent||'').includes('δεν εντάσσεται αυτόματα στο Undo/Redo'))}",'import history point');
    await shot('data-management-import-history-persisted');

    assert(runtimeErrors.length===0,'Browser runtime errors: '+runtimeErrors.join(' | '));
    assert(apiFailures.length===0,'Unexpected browser API failures: '+apiFailures.join(' | '));
    console.log('[real-browser] PASS actual browser auth + modern/legacy/credit/savings/loans/lending/recurring/planning/budgets/rules/cards/taxonomy/icons/providers/accounts/data-management persistence across hard reload');
  }finally{c?.close();await stopBrowser(child);await sleep(300);if(profile)rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150})}
}
