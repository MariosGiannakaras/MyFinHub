import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for final UX reconciliation QA.');
const port=9242;
const profile='/tmp/myfinhub-final-ux-reconciliation-chrome';
rmSync(profile,{recursive:true,force:true});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Final UX reconciliation QA assertion failed: ${message}`)};
try{
 await waitHttp(`http://127.0.0.1:${port}/json/version`);
 const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?page=dashboard&motion=reduced`)}`,{method:'PUT'}).then(response=>response.json());
 const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
 const viewport=(width,height,mobile)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 const waitFor=async(fn,label)=>{for(let i=0;i<120;i++){if(await c.call(fn))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
 const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
 const setInput=async(selector,value)=>c.call("function(selector,value){const el=document.querySelector(selector);if(!el)return false;const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(setter)setter.call(el,value);else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return el.value===value}",[selector,value]);

 console.log('Final UX QA: dashboard semantic priority order');
 await viewport(1280,900,false);await waitFor("function(){return !!document.querySelector('[data-dashboard-section=\"primary-accounts\"]')}",'dashboard priority sections');
 let state=await c.call("function(){const primary=[...document.querySelectorAll('[data-dashboard-section=\"primary-accounts\"] [data-account-id]')].map(node=>node.getAttribute('data-account-id'));const sections=[...document.querySelectorAll('[data-dashboard-section]')].map(node=>({id:node.getAttribute('data-dashboard-section'),top:node.getBoundingClientRect().top+scrollY}));return {primary,sections,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}}");
 assert(JSON.stringify(state.primary)===JSON.stringify(['cash','piraeus-payroll','piraeus-savings']),'primary account order is cash → payroll → savings');
 const ids=state.sections.map(item=>item.id);const primaryIndex=ids.indexOf('primary-accounts');const otherIndex=ids.indexOf('other-balances');const pendingIndex=ids.indexOf('pending');const quickIndex=ids.indexOf('quick-entry');const restIndex=ids.indexOf('rest');
 assert(primaryIndex>=0&&pendingIndex>primaryIndex&&quickIndex>pendingIndex&&restIndex>quickIndex,'DOM order is primary → pending → quick → rest');
 assert(otherIndex===-1||(otherIndex>primaryIndex&&otherIndex<pendingIndex),'optional other balances stay between primary and pending');
 assert(state.sections.every((item,index,rows)=>index===0||item.top>=rows[index-1].top-1),'desktop visual order follows semantic order');assert(!state.overflow,'desktop dashboard has no horizontal overflow');

 console.log('Final UX QA: visible privacy-safe change history with undo/redo');
 await c.call("function(){document.querySelector('.primary-action')?.click();return true}");await waitFor("function(){return !!document.querySelector('[aria-labelledby=\"quick-add-title\"]')}",'Quick Add');
 assert(await setInput('[aria-labelledby="quick-add-title"] input[data-autofocus="true"]','12.34'),'amount input accepts QA value');
 assert(await setInput('[aria-labelledby="quick-add-title"] [placeholder="Σύντομη περιγραφή μόνο αν χρειάζεται"]','Final UX QA Expense'),'note input accepts QA value');
 await c.call("function(){const modal=document.querySelector('[aria-labelledby=\"quick-add-title\"]');const button=[...(modal?.querySelectorAll('button')||[])].find(item=>item.textContent?.trim()==='Καταχώριση');button?.click();return !!button}");
 await waitFor("function(){return !document.querySelector('[aria-labelledby=\"quick-add-title\"]')&&!!document.querySelector('button[aria-label=\"Ιστορικό αλλαγών\"]')}",'mutation completion');
 await waitFor("function(){const button=document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');return Boolean(button&&!button.disabled)}",'financial mutation enables undo');
 await c.call("function(){document.querySelector('button[aria-label=\"Ιστορικό αλλαγών\"]')?.click();return true}");await waitFor("function(){return !!document.querySelector('#change-history-title')}",'change history dialog');
 await waitFor("function(){return document.querySelector('[aria-labelledby=\"change-history-title\"]')?.innerText.includes('Νέα οικονομική κίνηση')}",'financial mutation history entry');
 state=await c.call("function(){const dialog=document.querySelector('[aria-labelledby=\"change-history-title\"]');return {text:dialog?.innerText||'',items:dialog?.querySelectorAll('[role=listitem]').length||0,undoDisabled:dialog?.querySelector('.history-actions button:first-child')?.disabled,redoDisabled:dialog?.querySelector('.history-actions button:last-child')?.disabled}}");
 assert(state.items>=1&&state.text.includes('Νέα οικονομική κίνηση'),'history records the financial mutation');assert(!state.text.includes('Final UX QA Expense'),'history does not duplicate sensitive/free-text transaction content');assert(state.undoDisabled===false,'history exposes enabled undo action');
 await c.call("function(){document.querySelector('.history-actions button:first-child')?.click();return true}");await waitFor("function(){return document.querySelector('[aria-labelledby=\"change-history-title\"]')?.innerText.includes('Αναίρεση τελευταίας αλλαγής')}",'undo history entry');
 state=await c.call("function(){const buttons=document.querySelectorAll('.history-actions button');return {redoDisabled:buttons[1]?.disabled,text:document.querySelector('[aria-labelledby=\"change-history-title\"]')?.innerText||''}}");assert(state.redoDisabled===false&&state.text.includes('Αναίρεση τελευταίας αλλαγής'),'undo is recorded and enables redo');
 await c.call("function(){document.querySelector('.history-actions button:last-child')?.click();return true}");await waitFor("function(){return document.querySelector('[aria-labelledby=\"change-history-title\"]')?.innerText.includes('Επαναφορά τελευταίας αναιρεμένης αλλαγής')}",'redo history entry');
 await shot('final-ux-history-desktop');
 await c.call("function(){document.querySelector('.history-actions button:first-child')?.click();return true}");await sleep(150);
 await c.call("function(){document.querySelector('button[aria-label=\"Κλείσιμο ιστορικού\"]')?.click();return true}");await waitFor("function(){return !document.querySelector('#change-history-title')}",'history close');

 console.log('Final UX QA: narrow mobile order and history containment');
 await viewport(375,812,true);await sleep(180);
 state=await c.call("function(){const sections=[...document.querySelectorAll('[data-dashboard-section]')].map(node=>{const style=getComputedStyle(node);const rect=node.getBoundingClientRect();let top=rect.top+scrollY;let bottom=rect.bottom+scrollY;let height=rect.height;if(style.display==='contents'){const childRects=[...node.children].map(child=>child.getBoundingClientRect()).filter(childRect=>childRect.width>0||childRect.height>0);if(childRects.length){top=Math.min(...childRects.map(childRect=>childRect.top))+scrollY;bottom=Math.max(...childRects.map(childRect=>childRect.bottom))+scrollY;height=bottom-top}}return {id:node.getAttribute('data-dashboard-section'),top,bottom,height,display:style.display,position:style.position,order:style.order,gridRowStart:style.gridRowStart,gridRowEnd:style.gridRowEnd,gridColumnStart:style.gridColumnStart,gridColumnEnd:style.gridColumnEnd}});const history=document.querySelector('button[aria-label=\"Ιστορικό αλλαγών\"]');const undo=document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');const redo=document.querySelector('button[aria-label=\"Επαναφορά τελευταίας αναιρεμένης αλλαγής\"]');return {sections,historyVisible:!!history&&getComputedStyle(history).display!=='none',undoDisplay:undo?getComputedStyle(undo).display:'',redoDisplay:redo?getComputedStyle(redo).display:'',overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}}");
 assert(state.sections.every((item,index,rows)=>index===0||item.top>=rows[index-1].top-1),`mobile visual order follows semantic order · ${JSON.stringify(state.sections)}`);assert(state.historyVisible,'mobile keeps History directly accessible');assert(state.undoDisplay==='none'&&state.redoDisplay==='none','mobile moves standalone undo/redo out of the crowded topbar');assert(!state.overflow,'mobile dashboard has no horizontal overflow');
 await c.call("function(){document.querySelector('button[aria-label=\"Ιστορικό αλλαγών\"]')?.click();return true}");await waitFor("function(){return !!document.querySelector('#change-history-title')}",'mobile history dialog');
 state=await c.call("function(){const dialog=document.querySelector('[aria-labelledby=\"change-history-title\"]');const rect=dialog?.getBoundingClientRect();const actions=[...document.querySelectorAll('.history-actions button')].map(node=>node.getBoundingClientRect().height);return {width:rect?.width||0,right:rect?.right||0,actions,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}}");
 assert(state.width>0&&state.right<=innerWidth+1,'mobile History dialog stays inside viewport');assert(state.actions.every(height=>height>=44),'mobile History undo/redo targets remain >=44px');assert(!state.overflow,'mobile History introduces no horizontal overflow');await shot('final-ux-history-mobile');
 c.close();console.log('Final UX reconciliation rendered QA passed.');
}finally{
 child.kill('SIGTERM');
 await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();const timer=setTimeout(resolve,1800);child.once('exit',()=>{clearTimeout(timer);resolve()})});
 try{rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100})}catch(error){console.warn(`Final UX QA cleanup warning: ${error instanceof Error?error.message:String(error)}`)}
}