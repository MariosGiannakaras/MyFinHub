import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-bounded-history-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for bounded-history QA.');
const port=9274;
const profile='/tmp/myfinhub-bounded-history-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Runtime call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Bounded-history QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<140;i+=1){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(page,state,width,height)=>{await viewport(width,height);const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state',state);await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}",`${page} ${state}`);await sleep(220)};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const visible=node=>Boolean(node&&node.getClientRects().length);const node=[...document.querySelectorAll(selector)].find(item=>visible(item)&&(item.textContent||'').includes(text));node?.click();return Boolean(node)}",[selector,text]);assert(ok,`missing visible ${text}`);await sleep(120)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};

  console.log('Bounded history QA: Transactions desktop/mobile page slice');
  await navigate('transactions','extreme',1440,1000);
  let transactions=await c.call("function(){const desktop=[...document.querySelectorAll('.transactions-approved-table tbody tr')].filter(node=>node.getClientRects().length);const semantic=document.querySelectorAll('.transaction-semantic-table tbody tr');const mobilePager=document.querySelector('.mobile-transaction-pagination');return {desktop:desktop.length,semantic:semantic.length,mobilePagerDisplay:mobilePager?getComputedStyle(mobilePager).display:'missing'}}");
  assert(transactions.desktop===14,`desktop Transactions must render exactly 14 current-page rows: ${JSON.stringify(transactions)}`);
  assert(transactions.semantic===14,`hidden semantic Transactions table must use the same bounded 14-row slice: ${JSON.stringify(transactions)}`);
  assert(transactions.mobilePagerDisplay==='none',`mobile paginator leaked into desktop: ${JSON.stringify(transactions)}`);

  await navigate('transactions','extreme',375,812);
  transactions=await c.call("function(){const rows=document.querySelectorAll('.mobile-transaction-list .mobile-transaction-row').length;const pager=document.querySelector('.mobile-transaction-pagination');return {rows,pagerVisible:Boolean(pager&&pager.getClientRects().length),text:pager?.textContent||''}}");
  assert(transactions.rows===14&&transactions.pagerVisible,`mobile Transactions must render one 14-row page with paginator: ${JSON.stringify(transactions)}`);
  const nextClicked=await c.call("function(){const button=document.querySelector('.mobile-transaction-pagination button[aria-label=\"Επόμενη σελίδα συναλλαγών\"]');if(!button||button.disabled)return false;button.click();return true}");
  assert(nextClicked,'mobile Transactions next-page action is enabled');
  await waitFor("function(){return (document.querySelector('.mobile-transaction-pagination')?.textContent||'').includes('15–28')}",'Transactions second page');
  assert((await c.call("function(){return document.querySelectorAll('.mobile-transaction-list .mobile-transaction-row').length}"))===14,'Transactions second page remains bounded to 14 rows');
  await shot('transactions-mobile-page-2');

  console.log('Bounded history QA: Lending initial 20 + explicit expansion');
  await navigate('lending','large-history',375,812);
  let lendingCount=await c.call("function(){return document.querySelectorAll('.mobile-lending-history-row').length}");
  assert(lendingCount===20,`mobile Lending must render 20 rows initially, got ${lendingCount}`);
  assert(await c.call("function(){return Boolean([...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&(node.textContent||'').includes('Προβολή περισσότερων')))}"),'Lending exposes explicit expansion control');
  await clickText('button','Προβολή περισσότερων');
  await waitFor("function(){return document.querySelectorAll('.mobile-lending-history-row').length===40}",'Lending 40-row expanded window');
  lendingCount=await c.call("function(){return document.querySelectorAll('.mobile-lending-history-row').length}");
  assert(lendingCount===40,'Lending expands by exactly 20 rows');
  await shot('lending-mobile-history-expanded');

  console.log('Bounded history QA: Credit purchases/payments initial 25 + explicit expansion');
  await navigate('credit','large-history',375,812);
  let credit=await c.call("function(){return {purchases:document.querySelectorAll('.credit-purchases-table tbody tr').length,payments:document.querySelectorAll('.credit-payments-table tbody tr').length}}");
  assert(credit.purchases===25&&credit.payments===25,`Credit histories must render 25 rows initially: ${JSON.stringify(credit)}`);
  await clickText('button','Προβολή περισσότερων αγορών');
  await waitFor("function(){return document.querySelectorAll('.credit-purchases-table tbody tr').length>25}",'expanded credit purchases');
  await clickText('button','Προβολή περισσότερων αποπληρωμών');
  await waitFor("function(){return document.querySelectorAll('.credit-payments-table tbody tr').length>25}",'expanded credit payments');
  credit=await c.call("function(){return {purchases:document.querySelectorAll('.credit-purchases-table tbody tr').length,payments:document.querySelectorAll('.credit-payments-table tbody tr').length,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(credit.purchases>25&&credit.purchases<=50&&credit.payments>25&&credit.payments<=50,`Credit expansion windows invalid: ${JSON.stringify(credit)}`);
  assert(credit.overflow<=1,`Credit large-history mobile overflow ${credit.overflow}px`);
  await shot('credit-mobile-histories-expanded');

  c.close();
  console.log('Bounded history rendered QA passed.');
}finally{
  child.kill('SIGTERM');
  await sleep(200);
  rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
