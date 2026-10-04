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

export async function runRealStackBrowserProof({origin,email,password,nextTotp}:BrowserProofOptions){
  const chrome=execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
  assert(chrome,'Chromium is required for the real-stack browser proof.');
  const evidenceDir='/tmp/myfinhub-real-stack-browser';
  const profile='/tmp/myfinhub-real-stack-browser-profile';
  mkdirSync(evidenceDir,{recursive:true});rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  const port=9331;
  const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','about:blank'],{stdio:'ignore'});
  let c:Cdp|undefined;
  try{
    for(let i=0;i<120;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`)).ok)break}catch{}if(i===119)throw new Error('Timed out waiting for Chromium.');await sleep(100)}
    const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin+'/#/transactions')}`,{method:'PUT'}).then(response=>response.json()) as any;
    c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const runtimeErrors:string[]=[];const apiFailures:string[]=[];
    c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
    c.on('Network.responseReceived',params=>{
      const url=String(params.response?.url||'');const status=Number(params.response?.status||0);
      if(!url.startsWith(origin+'/api/')||status<400)return;
      const pathname=new URL(url).pathname;if(status===401&&pathname==='/api/auth/session')return;
      apiFailures.push(`${status} ${pathname}`);
    });
    const waitFor=async(fn:string,label:string,args:any[]=[])=>{for(let i=0;i<160;i++){if(await c!.call(fn,args))return;await sleep(100)}throw new Error('Timed out waiting for '+label)};
    const setSelector=async(selector:string,value:string)=>{const ok=await c!.call<boolean>("function(selector,value){const input=document.querySelector(selector);if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement))return false;const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[selector,value]);assert(ok,'Missing input '+selector)};
    const setByLabel=async(label:string,value:string)=>{const ok=await c!.call<boolean>("function(label,value){const visible=node=>{if(!(node instanceof HTMLElement))return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0};const direct=[...document.querySelectorAll('input,textarea,select')].find(node=>visible(node)&&node.getAttribute('aria-label')===label);const wrapper=[...document.querySelectorAll('label')].find(node=>visible(node)&&(node.textContent||'').replace(/\\s+/g,' ').includes(label));const control=direct??wrapper?.querySelector('input,textarea,select')??wrapper?.parentElement?.querySelector('input,textarea,select');if(control instanceof HTMLSelectElement){control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));return true}if(!(control instanceof HTMLInputElement||control instanceof HTMLTextAreaElement))return false;const proto=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(control,value);control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));return true}",[label,value]);assert(ok,'Missing field '+label)};
    const clickText=async(selector:string,text:string)=>{const ok=await c!.call<boolean>("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>item.getClientRects().length>0&&(item.textContent||'').trim().includes(text));if(!(node instanceof HTMLElement))return false;node.click();return true}",[selector,text]);assert(ok,'Missing control '+text)};
    const search=async(value:string)=>setByLabel('Αναζήτηση συναλλαγών',value);
    const waitApiEvent=async(note:string,present:boolean)=>waitFor("async function(note,present){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const exists=(payload.data?.state?.events||[]).some(item=>item.note===note);return present?exists:!exists}",'persisted event '+note,[note,present]);
    const waitLegacy=async(text:string,deleted:boolean)=>waitFor("async function(text,deleted){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const overrides=JSON.stringify(payload.data?.state?.overrides||{});const tombstones=JSON.stringify(payload.data?.state?.deleted||[]);return overrides.includes(text)&&(deleted?tombstones.includes('qa-seed-income'):!tombstones.includes('qa-seed-income'))}",'persisted legacy state',[text,deleted]);
    const waitCreditState=async(paid:boolean)=>waitFor("async function(paid){const response=await fetch('/api/data',{cache:'no-store'});if(!response.ok)return false;const payload=await response.json();const events=payload.data?.state?.events||[];const purchase=events.find(item=>item.kind==='card_purchase'&&item.cardId==='qa-credit-card'&&item.note==='Real Browser Credit Purchase');if(!purchase?.statementId)return false;const payment=events.find(item=>item.kind==='card_payment'&&item.cardId==='qa-credit-card'&&item.statementId===purchase.statementId);return paid?Boolean(payment):!payment}",paid?'persisted credit payment':'persisted credit purchase',[paid]);
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

    assert(runtimeErrors.length===0,'Browser runtime errors: '+runtimeErrors.join(' | '));
    assert(apiFailures.length===0,'Unexpected browser API failures: '+apiFailures.join(' | '));
    console.log('[real-browser] PASS actual browser auth + modern/legacy/credit mutation persistence across hard reload');
  }finally{c?.close();if(child.exitCode===null)child.kill('SIGTERM');await sleep(300);rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
}
