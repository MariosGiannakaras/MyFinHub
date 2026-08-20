import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for UI/UX QA.');
const port=9229;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-ux-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
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
const assert=(value,message)=>{if(!value)throw new Error(`UI/UX browser QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<80;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const waitHeading=text=>waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`heading ${text}`,[text]);
  const clickText=async(selector,text)=>{const clicked=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(clicked,`missing clickable ${text}`)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const pressEscape=()=>c.eval("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
  const noOverflow=async label=>{const overflow=await c.eval('document.documentElement.scrollWidth-window.innerWidth');assert(overflow<=1,`${label} overflow ${overflow}px`)};

  await viewport(1440,1000);await c.send('Page.navigate',{url:baseUrl});await waitHeading('Οι λογαριασμοί μου');
  const tooltipOk=await c.eval("(()=>{const button=document.querySelector('.top-actions button[aria-label=\"Αποσύνδεση\"]');if(!button)return false;button.focus();const bubble=button.closest('.app-tooltip')?.querySelector('.app-tooltip-bubble');if(!bubble)return false;const s=getComputedStyle(bubble),r=bubble.getBoundingClientRect();return s.visibility==='visible'&&Number(s.opacity)>.9&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()");
  assert(tooltipOk,'keyboard tooltip is visible and viewport-contained');

  await clickText('.sidebar nav button','Συναλλαγές');await waitHeading('Συναλλαγές');
  await clickText('.sort-direction-control button','ASC');await sleep(100);
  assert((await c.eval("document.querySelector('.transaction-semantic-table tbody tr .transaction-title-line b')?.textContent"))==='Supermarket','ASC transaction ordering');
  assert((await c.eval("document.querySelector('.transaction-semantic-table thead th')?.getAttribute('aria-sort')"))==='ascending','ASC aria-sort state');
  await clickText('.sort-direction-control button','DESC');await sleep(100);
  assert((await c.eval("document.querySelector('.transaction-semantic-table tbody tr .transaction-title-line b')?.textContent"))==='Φαρμακείο','DESC transaction ordering');
  await screenshot('desktop-transactions-sorting');

  await clickText('.sidebar nav button','Δόσεις & Δάνεια');await waitHeading('Δόσεις & Δάνεια');
  await clickText('.sort-direction-control button','ASC');await sleep(100);
  assert((await c.eval("document.querySelector('.loan-list-row h3')?.textContent"))==='Laptop','ASC loan ordering');
  await clickText('.sort-direction-control button','DESC');await sleep(100);
  assert((await c.eval("document.querySelector('.loan-list-row h3')?.textContent"))==='QA Long Loan','DESC loan ordering');

  await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');
  const normalHeading=await c.eval("parseFloat(getComputedStyle(document.querySelector('.page-heading h1')).fontSize)");
  await clickText('.text-size-picker button','Μεγάλο');await waitFor("function(){return document.documentElement.dataset.textSize==='large'}",'large text-size state');
  const largeHeading=await c.eval("parseFloat(getComputedStyle(document.querySelector('.page-heading h1')).fontSize)");
  assert(largeHeading>normalHeading,'large text setting increases heading size');
  assert(await c.eval("document.querySelector('.text-size-picker button[aria-checked=\"true\"]')?.textContent.includes('Μεγάλο')"),'large text setting remains selected');
  await screenshot('desktop-settings-large-text');

  await clickText('.sidebar nav button','Dashboard');await waitHeading('Οι λογαριασμοί μου');
  await clickText('.command-pill','Γρήγορη κίνηση');await waitFor("function(){return Boolean(document.querySelector('.quick-modal'))}",'Quick Add modal');
  assert(await c.eval("document.body.style.position==='fixed'"),'modal locks background scroll');
  assert(await c.call("function(){const input=document.querySelector('.quick-modal .owned-date-shell .owned-input');if(!input)return false;input.click();return true}"),'date input opens');
  await waitFor("function(){return Boolean(document.querySelector('.owned-date-popover'))}",'date popover');
  await pressEscape();await sleep(120);
  assert(!(await c.eval("Boolean(document.querySelector('.owned-date-popover'))")),'Esc closes nested date popover');
  assert(await c.eval("Boolean(document.querySelector('.quick-modal'))"),'Esc leaves parent modal open');
  await pressEscape();await sleep(120);
  assert(!(await c.eval("Boolean(document.querySelector('.quick-modal'))")),'second Esc closes parent modal');
  assert(await c.eval("document.body.style.position!=='fixed'"),'closing modal restores background scroll');
  await clickText('.command-pill','Γρήγορη κίνηση');await waitFor("function(){return Boolean(document.querySelector('.modal-backdrop'))}",'Quick Add backdrop');
  await c.eval("document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))");await sleep(120);
  assert(!(await c.eval("Boolean(document.querySelector('.quick-modal'))")),'backdrop click closes modal');

  await viewport(375,812);await c.send('Page.navigate',{url:baseUrl});await waitHeading('Οι λογαριασμοί μου');await noOverflow('Dashboard 375');
  assert(await c.eval("document.documentElement.dataset.textSize==='normal'"),'QA reload returns to persisted fixture default');
  await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες');await noOverflow('Cards 375');
  assert(await c.eval("document.querySelector('.r-payment-card').getBoundingClientRect().width<=window.innerWidth-16"),'card fits 375px viewport');
  await screenshot('mobile-cards-375');
  await viewport(320,700);await c.send('Page.navigate',{url:baseUrl});await waitHeading('Οι λογαριασμοί μου');await noOverflow('Dashboard 320');
  await screenshot('mobile-dashboard-320');

  c.close();console.log(`UI/UX browser QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
