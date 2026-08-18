import { spawn, execFileSync } from 'node:child_process';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for redesign QA.');
const port=9223;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/rheomiq-redesign-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<60;i++){try{const response=await fetch(url);if(response.ok)return response}catch{}await sleep(250)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const objectId=root.result.objectId;if(!objectId)throw new Error('Unable to resolve browser global object.');const result=await this.send('Runtime.callFunctionOn',{objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Mobile redesign QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const navigate=async(url=baseUrl)=>{await c.send('Page.navigate',{url});for(let i=0;i<80;i++){if(await c.eval("document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))"))return;await sleep(100)}throw new Error(`Page not ready: ${url}`)};
  const waitFor=async(functionDeclaration,label,args=[])=>{for(let i=0;i<70;i++){if(await c.call(functionDeclaration,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const waitHeading=text=>waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`heading ${text}`,[text]);
  const clickText=async(selector,text)=>{const clicked=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(clicked,`missing clickable ${text}`)};
  const openMore=async()=>{const open=await c.eval("document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')?.getAttribute('aria-expanded')==='true'");if(!open)await clickText('.mobile-nav button','Περισσότερα');await waitFor("function(){return Boolean(document.querySelector('[aria-labelledby=\"mobile-more-title\"]'))}",'More sheet')};
  const morePage=async(label,heading)=>{await openMore();await clickText('.mobile-more-menu button',label);await waitHeading(heading)};
  const noOverflow=async label=>{const overflow=await c.eval('document.documentElement.scrollWidth-window.innerWidth');assert(overflow<=1,`${label} page overflow ${overflow}px`)};
  const fullWidthStack=async(containerSelector,childSelector,min=1)=>c.call("function(containerSelector,childSelector,min){const container=document.querySelector(containerSelector);if(!container)return false;const cr=container.getBoundingClientRect();const nodes=[...document.querySelectorAll(childSelector)].filter(node=>node.getBoundingClientRect().width>0);if(nodes.length<min)return false;const wide=nodes.every(node=>node.getBoundingClientRect().width>=cr.width*.86);if(nodes.length<2)return wide;return wide&&Math.abs(nodes[1].getBoundingClientRect().top-nodes[0].getBoundingClientRect().top)>8}",[containerSelector,childSelector,min]);

  await viewport(1440,1000);await navigate();await waitHeading('Οι λογαριασμοί μου');
  assert(await c.eval("getComputedStyle(document.querySelector('.sidebar')).display!=='none'"),'desktop sidebar remains visible');assert(await c.eval("getComputedStyle(document.querySelector('.mobile-nav')).display==='none'"),'mobile dock hidden on desktop');
  await clickText('.sidebar nav button','Κάρτες');await waitHeading('Κάρτες');assert(await c.eval("getComputedStyle(document.querySelector('.banks-scroll')).display!=='none'"),'desktop Cards workspace remains active');
  await clickText('.sidebar nav button','Πιστωτική');await waitHeading('Πιστωτική Κάρτα');assert(await c.eval("getComputedStyle(document.querySelector('.credit-summary-grid')).display==='grid'"),'desktop credit summary remains grid');
  await clickText('.sidebar nav button','Δόσεις & Δάνεια');await waitHeading('Δόσεις & Δάνεια');assert(await c.eval("document.querySelectorAll('.loan-list-row').length>=2"),'desktop loan list remains operational');
  await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');assert(await c.eval("getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden=\"true\"]')).display!=='none'"),'desktop report chart remains visible');
  await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');assert(await c.eval("!document.querySelector('.settings-draft-actions')"),'settings no longer expose Apply/Cancel actions');assert(await c.eval("!document.body.textContent.includes('Εφαρμογή ρυθμίσεων')"),'settings have no explicit save action');
  assert(await c.call("function(){const input=document.querySelector('.account-name-grid input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'QA AUTOSAVE');input.dispatchEvent(new Event('input',{bubbles:true}));return true}"),'settings autosave input can be edited');await sleep(100);await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');assert(await c.eval("document.querySelector('.account-name-grid input')?.value==='QA AUTOSAVE'"),'settings edit persisted without Apply');

  await viewport(375,812);await navigate();await waitHeading('Οι λογαριασμοί μου');await noOverflow('Dashboard 375');
  assert(await c.eval("getComputedStyle(document.querySelector('.sidebar')).display==='none'"),'phone sidebar hidden');assert(await c.eval("getComputedStyle(document.querySelector('.mobile-nav')).display==='grid'"),'phone dock active');assert(await c.eval("getComputedStyle(document.querySelector('.command-pill')).position==='fixed'"),'Quick Entry is floating phone action');assert(await fullWidthStack('.primary-balance-grid','.primary-balance-grid>.primary-balance-card',2),'primary balances stack');

  await clickText('.mobile-nav button','Συναλλαγές');await waitHeading('Συναλλαγές');await noOverflow('Transactions 375');assert(await c.eval("getComputedStyle(document.querySelector('.mobile-transaction-list')).display!=='none'&&getComputedStyle(document.querySelector('.desktop-finance-table')).display==='none'"),'mobile transactions feed active');
  await clickText('.mobile-nav button','Αποταμίευση');await waitHeading('Αποταμίευση');await noOverflow('Savings 375');assert(await fullWidthStack('.savings-action-grid','.savings-action-grid>.savings-action',2),'Savings actions stack');
  await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες');await noOverflow('Cards 375');assert(await c.eval("['auto','scroll'].includes(getComputedStyle(document.querySelector('.banks-scroll')).overflowX)"),'Cards banks stay in contained horizontal rail');assert(await c.eval("document.querySelector('.payment-card').getBoundingClientRect().width<=window.innerWidth-24"),'payment card fits phone viewport');

  await morePage('Πιστωτική','Πιστωτική Κάρτα');await noOverflow('Credit 375');assert(await fullWidthStack('.credit-summary-grid','.credit-summary-grid>article',2),'credit summary stacks on phone');assert(await c.eval("parseFloat(getComputedStyle(document.querySelector('.credit-hero')).borderRadius)>=16"),'credit status keeps mobile surface');
  await morePage('Δόσεις & Δάνεια','Δόσεις & Δάνεια');await noOverflow('Loans 375');assert(await c.eval("getComputedStyle(document.querySelector('.loan-toolbar')).flexDirection==='column'"),'loan toolbar stacks on phone');assert(await c.eval("document.querySelector('.loan-list-actions button').getBoundingClientRect().height>=36"),'loan actions remain usable');
  await morePage('Δανεικά / Οφειλές','Δανεικά & επιστροφές');await noOverflow('Lending 375');assert(await fullWidthStack('.receivable-person-grid','.receivable-person-grid>article',1),'Lending people remain one-column');
  await morePage('Πάγια','Πάγια & Συνδρομές');await noOverflow('Recurring 375');assert(await c.eval("document.querySelectorAll('.recurring-summary-grid>article').length===3"),'Recurring compact pulse');assert(await c.eval("getComputedStyle(document.querySelector('.mobile-recurring-list')).display!=='none'"),'Recurring phone cards active');assert(await c.eval("Boolean(document.querySelector('.long-term-recurring'))"),'long-term obligations remain visible on phone');
  await morePage('Αναφορές','Αναφορές');await noOverflow('Reports 375');assert(await c.eval("getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden=\"true\"]')).display==='none'"),'phone reports list-first');
  await morePage('Ρυθμίσεις','Ρυθμίσεις');await noOverflow('Settings 375');assert(await fullWidthStack('.settings-grid','.settings-grid>article',2),'Settings one-column groups');assert(await c.eval("!document.querySelector('.settings-draft-actions')"),'phone settings have no sticky Apply/Cancel bar');

  for(const width of [320,430]){await viewport(width,812);await navigate();await waitHeading('Οι λογαριασμοί μου');await noOverflow(`Dashboard ${width}`);assert(await c.eval("getComputedStyle(document.querySelector('.mobile-nav')).display==='grid'"),`mobile dock active ${width}`);await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες');await noOverflow(`Cards ${width}`)}
  await viewport(667,375);await navigate();await waitHeading('Οι λογαριασμοί μου');await noOverflow('landscape Dashboard');await openMore();assert(await c.eval("document.querySelector('.mobile-more-menu').getBoundingClientRect().height<window.innerHeight"),'More sheet constrained in landscape');

  c.close();console.log('Mobile redesign fidelity QA passed.');
}finally{child.kill('SIGTERM')}
