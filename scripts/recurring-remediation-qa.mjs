import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Recurring remediation QA.');
const port=9251;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-recurring-remediation-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Recurring remediation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=async(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async()=>{const url=new URL(baseUrl);url.searchParams.set('page','recurring');url.searchParams.set('state','recurring-rich');await c.send('Page.navigate',{url:url.href});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πάγια')&&document.querySelectorAll('[data-recurring-status=\"active\"]').length>=9}",'Recurring rich fixture');await sleep(100)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const state=()=>c.call(`function(){const summaries=[...document.querySelectorAll('.recurring-summary-card')],summaryGrid=document.querySelector('.recurring-summary-grid'),workspace=document.querySelector('.recurring-active-workspace'),loanGroup=document.querySelector('.long-term-recurring'),inactive=document.querySelector('.inactive-recurring'),table=document.querySelector('.recurring-workspace-table'),pay=document.querySelector('.recurring-actions .pay-action'),manage=document.querySelector('.recurring-actions .icon-button'),helper=document.querySelector('.recurring-workspace-table td small');const rect=node=>{const r=node?.getBoundingClientRect();return r?{width:r.width,height:r.height,left:r.left,right:r.right}:null};const style=node=>node?getComputedStyle(node):null;const values=summaries.map(card=>card.querySelector('div>b'));return {summaryGrid:rect(summaryGrid),workspace:rect(workspace),loanGroup:rect(loanGroup),inactive:rect(inactive),table:rect(table),valueSizes:values.map(node=>parseFloat(style(node)?.fontSize||'0')),animatedSize:parseFloat(style(summaries[0]?.querySelector('.animated-amount'))?.fontSize||'0'),payImage:style(pay)?.backgroundImage||'',payBg:style(pay)?.backgroundColor||'',payColor:style(pay)?.color||'',payShadow:style(pay)?.boxShadow||'',payBorder:style(pay)?.borderTopColor||'',manageImage:style(manage)?.backgroundImage||'',manageBg:style(manage)?.backgroundColor||'',manageColor:style(manage)?.color||'',manageShadow:style(manage)?.boxShadow||'',manageBorder:style(manage)?.borderTopColor||'',helperSize:parseFloat(style(helper)?.fontSize||'0'),inactiveEmpty:inactive?.classList.contains('is-empty')||false,activeRows:document.querySelectorAll('[data-recurring-status=\"active\"]').length,cadenceOccurrences:[...document.querySelectorAll('.recurring-workspace-table tbody>tr[data-recurring-status=\"active\"]')].slice(0,3).map(row=>(row.textContent?.match(/Κάθε|μήνα|χρόνο/gi)||[]).length),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);

  console.log('Recurring remediation QA: rich wide desktop');
  for(const width of [1440,1920,2560]){await viewport(width,1100);await navigate();const current=await state();assert(current.activeRows>=9,'rich recurring fixture renders active obligations');assert(current.summaryGrid.width<=1501&&current.workspace.width<=1501&&(!current.loanGroup||current.loanGroup.width<=1501)&&current.overflow<=1,`${width}px recurring composition remains bounded and overflow-safe`);assert(current.valueSizes.length===2&&Math.abs(current.valueSizes[0]-current.valueSizes[1])<.6&&Math.abs(current.animatedSize-current.valueSizes[0])<.6,'monthly AnimatedAmount and next-date summary use equivalent metric typography');const transparent=value=>['rgba(0, 0, 0, 0)','transparent'].includes(value);const payEmphasized=(current.payImage&&current.payImage!=='none')||current.payShadow!=='none'||current.payBg!==current.manageBg||current.payBorder!==current.manageBorder;const manageQuiet=transparent(current.manageBg)&&(!current.manageImage||current.manageImage==='none')&&current.manageShadow==='none';assert(payEmphasized&&manageQuiet,'Payment remains visually stronger than lifecycle management actions');assert(current.helperSize>=10,'dense recurring helper metadata stays readable');assert(current.inactiveEmpty&&current.inactive.height<=55,'zero inactive history remains discoverable but lightweight');await shot(`recurring-remediation-${width}`)}

  console.log('Recurring remediation QA: dark hierarchy');
  await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}");
  await viewport(1440,1100);await navigate();const dark=await state();
  assert(dark.helperSize>=10&&dark.payBg!==dark.manageBg&&dark.overflow<=1,'dark recurring hierarchy/readability remains intact');
  await shot('recurring-remediation-dark-1440');

  c.close();console.log(`Recurring remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
