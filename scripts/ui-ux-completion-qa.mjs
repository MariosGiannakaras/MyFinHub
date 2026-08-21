import { execFileSync, spawn } from 'node:child_process';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for completion QA.');
const port=9230;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-completion-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`UI/UX completion QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const url=params=>{const next=new URL(baseUrl);for(const [key,value] of Object.entries(params))next.searchParams.set(key,String(value));return next.href};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<100;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(params,heading)=>{await c.send('Page.navigate',{url:url(params)});await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",heading,[heading]);await sleep(100)};
  const clickAria=async label=>{const ok=await c.call("function(label){const node=[...document.querySelectorAll('button[aria-label]')].find(item=>item.getAttribute('aria-label')===label);if(!node)return false;node.click();return true}",[label]);assert(ok,`missing ${label}`)};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(ok,`missing ${text}`)};

  await viewport(1440,1000);
  console.log('Completion QA: delete, undo and redo');
  await navigate({page:'transactions'},'Συναλλαγές');
  await c.eval('window.confirm=()=>true');
  assert(await c.eval("document.body.textContent.includes('Freddo espresso')"),'fixture event exists before delete');
  await clickAria('Διαγραφή Freddo espresso');
  await waitFor("function(){return !document.body.textContent.includes('Freddo espresso')}",'transaction delete');
  assert(!(await c.eval("document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]')?.disabled")),'Undo enabled after delete');
  await clickAria('Αναίρεση τελευταίας αλλαγής');
  await waitFor("function(){return document.body.textContent.includes('Freddo espresso')}",'Undo restores transaction');
  assert(!(await c.eval("document.querySelector('button[aria-label=\"Επαναφορά τελευταίας αναιρεμένης αλλαγής\"]')?.disabled")),'Redo enabled after undo');
  await clickAria('Επαναφορά τελευταίας αναιρεμένης αλλαγής');
  await waitFor("function(){return !document.body.textContent.includes('Freddo espresso')}",'Redo reapplies delete');

  console.log('Completion QA: text, numeric, null and stable loan sorting');
  await navigate({page:'loans'},'Δόσεις & Δάνεια');
  const setSort=async label=>{
    const opened=await c.call("function(){const input=document.querySelector('.loan-sort-controls input[role=\"combobox\"]');if(!input)return false;input.click();return true}");
    assert(opened,`open loan sort ${label}`);
    await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=\"listbox\"]'))}",`loan sort options ${label}`);
    await clickText('.owned-select-popover [role="option"]',label);
    await sleep(80);
  };
  await setSort('Όνομα');await clickText('.sort-direction-control button','ASC');assert((await c.eval("document.querySelector('.loan-list-row h3')?.textContent"))==='Laptop','text ASC ordering');await clickText('.sort-direction-control button','DESC');assert((await c.eval("document.querySelector('.loan-list-row h3')?.textContent"))==='QA Long Loan','text DESC ordering');
  await setSort('Υπόλοιπο');await clickText('.sort-direction-control button','ASC');assert((await c.eval("document.querySelector('.loan-list-row h3')?.textContent"))==='Laptop','numeric ASC ordering');await clickText('.sort-direction-control button','DESC');assert((await c.eval("document.querySelector('.loan-list-row h3')?.textContent"))==='QA Long Loan','numeric DESC ordering');
  await setSort('Συνήθης ημέρα');await clickText('.sort-direction-control button','ASC');const ascIds=await c.eval("[...document.querySelectorAll('.loan-list-row')].map(row=>row.querySelector('h3')?.textContent)");await clickText('.sort-direction-control button','DESC');const descIds=await c.eval("[...document.querySelectorAll('.loan-list-row')].map(row=>row.querySelector('h3')?.textContent)");assert(ascIds.length===descIds.length&&ascIds.length>=2,'null-date sort retains all rows');assert(new Set(ascIds).size===ascIds.length&&new Set(descIds).size===descIds.length,'stable tie-break keeps unique deterministic rows');

  console.log('Completion QA: form errors are associated with dialogs and fields');
  await navigate({page:'savings'},'Αποταμίευση');await clickText('button','Μεταφορά στην άκρη');await clickText('.contextual-quick-modal .editor-actions button','Καταχώριση');await waitFor("function(){return Boolean(document.querySelector('.contextual-quick-modal .form-error'))}",'savings error');const savingAssociation=await c.eval("(()=>{const dialog=document.querySelector('.contextual-quick-modal'),error=dialog?.querySelector('.form-error'),input=dialog?.querySelector('input[data-autofocus]');return Boolean(error?.id&&dialog?.getAttribute('aria-describedby')?.split(/\\s+/).includes(error.id)&&input?.getAttribute('aria-describedby')?.split(/\\s+/).includes(error.id)&&input?.getAttribute('aria-invalid')==='true')})()");assert(savingAssociation,'savings error association');
  await navigate({page:'lending'},'Δανεικά & επιστροφές');await clickText('button','Νέα κίνηση');await clickText('.editor-actions button','Καταχώριση');await waitFor("function(){return Boolean(document.querySelector('.lending-dialog .form-error'))}",'lending error');const lendingAssociation=await c.eval("(()=>{const dialog=document.querySelector('.lending-dialog'),error=dialog?.querySelector('.form-error'),input=dialog?.querySelector('input[data-autofocus]');return Boolean(error?.id&&dialog?.getAttribute('aria-describedby')?.split(/\\s+/).includes(error.id)&&input?.getAttribute('aria-describedby')?.split(/\\s+/).includes(error.id)&&input?.getAttribute('aria-invalid')==='true')})()");assert(lendingAssociation,'lending error association');
  await navigate({page:'cards'},'Κάρτες');await clickText('button','Προσθήκη τράπεζας');await clickText('.modal-actions button','Προσθήκη τράπεζας');await waitFor("function(){return Boolean(document.querySelector('.picker .form-error'))}",'bank error');const bankAssociation=await c.eval("(()=>{const dialog=document.querySelector('.picker[role=dialog]'),error=dialog?.querySelector('.form-error'),input=dialog?.querySelector('input[data-autofocus]');return Boolean(error?.id&&dialog?.getAttribute('aria-describedby')?.split(/\\s+/).includes(error.id)&&input?.getAttribute('aria-describedby')?.split(/\\s+/).includes(error.id)&&input?.getAttribute('aria-invalid')==='true')})()");assert(bankAssociation,'bank error association');

  console.log('Completion QA: reduced motion');
  await navigate({page:'dashboard',motion:'reduced'},'Οι λογαριασμοί μου');assert((await c.eval("document.documentElement.dataset.motion"))==='reduced','reduced-motion preference applied');const motionTransform=await c.eval("getComputedStyle(document.querySelector('#main-workspace>div')).transform");assert(motionTransform==='none'||motionTransform==='matrix(1, 0, 0, 1, 0, 0)','reduced motion leaves workspace at rest');

  console.log('Completion QA: representative text contrast');
  const contrasts=await c.eval(`(()=>{const parse=value=>{const match=value.match(/rgba?\\(([^)]+)\\)/);if(!match)return null;const parts=match[1].split(/[, ]+/).filter(Boolean).map(Number);return {r:parts[0],g:parts[1],b:parts[2],a:Number.isFinite(parts[3])?parts[3]:1}};const blend=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});const bgFor=el=>{let node=el;let bg={r:255,g:255,b:255,a:1};const layers=[];while(node){const color=parse(getComputedStyle(node).backgroundColor);if(color&&color.a>0)layers.push(color);node=node.parentElement}for(const layer of layers.reverse())bg=blend(layer,bg);return bg};const lum=c=>{const f=n=>{n/=255;return n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};const ratio=selector=>{const el=document.querySelector(selector);if(!el)return null;const fg=parse(getComputedStyle(el).color),bg=bgFor(el);if(!fg)return null;const l1=lum(fg),l2=lum(bg);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};return {heading:ratio('.page-heading p'),nav:ratio('.sidebar nav button'),body:ratio('.panel small')};})()`);for(const [name,ratio] of Object.entries(contrasts))assert(ratio===null||ratio>=4.5,`${name} contrast ${ratio?.toFixed(2)} below 4.5:1`);

  c.close();console.log('UI/UX completion QA passed.');
}finally{child.kill('SIGTERM')}
