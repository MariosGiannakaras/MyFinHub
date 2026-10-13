import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Cards remediation QA.');
const port=9250;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-cards-remediation-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Cards remediation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=async(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(state='')=>{const url=new URL(baseUrl);url.searchParams.set('page','cards');if(state)url.searchParams.set('state',state);await c.send('Page.navigate',{url:url.href});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Κάρτες')&&Boolean(document.querySelector('.cards-prototype-workspace'))}",'Cards page');await sleep(100)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const state=()=>c.call(`function(){const workspace=document.querySelector('.cards-workspace'),grid=document.querySelector('.cards-grid'),columns=[...document.querySelectorAll('.cards-bank-column')],hint=document.querySelector('.cards-workspace-scroll-hint'),recent=document.querySelector('.cards-surrounding-recent-list'),card=document.querySelector('.prototype-payment-card'),reveal=card?.querySelector('.card-icon-reveal'),management=card?.querySelector('.card-icon-management'),label=card?.querySelector('.card-field-label'),bankMeta=document.querySelector('.bank-column-title small'),kpi=[...document.querySelectorAll('.cards-surrounding-kpi')].find(node=>(node.textContent||'').includes('Τράπεζες με κάρτα')),root=getComputedStyle(document.documentElement);const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width,height:r.height}:null};const style=node=>node?getComputedStyle(node):null;return {columns:columns.length,columnWidths:columns.map(node=>rect(node)?.width||0),workspaceClient:workspace?.clientWidth||0,workspaceScroll:workspace?.scrollWidth||0,scrollLeft:workspace?.scrollLeft||0,hintVisible:Boolean(hint&&rect(hint)?.height),gridWidth:rect(grid)?.width||0,recentWidth:rect(recent)?.width||0,labelSize:parseFloat(style(label)?.fontSize||'0'),revealBg:style(reveal)?.backgroundColor||'',managementBg:style(management)?.backgroundColor||'',managementOpacity:parseFloat(style(management)?.opacity||'1'),bankMetaColor:style(bankMeta)?.color||'',textSecondary:root.getPropertyValue('--text-secondary').trim(),kpiText:kpi?.textContent||'',addCard:[...document.querySelectorAll('.page-heading button')].some(node=>(node.textContent||'').includes('Προσθήκη κάρτας')),addBank:[...document.querySelectorAll('.page-heading button')].some(node=>(node.textContent||'').includes('Προσθήκη τράπεζας')),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);

  console.log('Cards remediation QA: standard one-card domain state');
  await viewport(1440,1000);await navigate('');
  let current=await state();
  assert(current.columns===1,'provider registry does not create empty card-bank columns for the one-card fixture');
  assert(current.kpiText.includes('1'),'Cards-domain bank KPI counts the represented bank');
  assert(current.addCard&&current.addBank,'both add-card and custom-bank management remain reachable');
  assert(current.labelSize>=10&&current.revealBg!==current.managementBg&&current.managementOpacity<1,'card microcopy and utility hierarchy remain readable/subordinate');
  assert(current.recentWidth<=1121&&current.overflow<=1,'recent activity stays within controlled measure without page overflow');
  await shot('cards-remediation-one-card-1440');

  console.log('Cards remediation QA: intentional multi-bank horizontal navigation');
  await navigate('cards-rich');current=await state();
  assert(current.columns===5,'rich fixture renders five represented bank columns without registry-only empties');
  assert(current.workspaceScroll>current.workspaceClient&&current.hintVisible,'1440 multi-bank workspace exposes intentional horizontal navigation');
  assert(current.columnWidths.every(width=>width>=300&&width<=361),'bank columns retain bounded desktop widths');
  assert(current.overflow<=1,'horizontal bank navigation stays inside the workspace rather than widening the document');
  await c.call("function(){const workspace=document.querySelector('.cards-workspace');if(workspace)workspace.scrollLeft=workspace.scrollWidth;return workspace?.scrollLeft||0}");
  await sleep(60);current=await state();assert(current.scrollLeft>0,'workspace can scroll to later represented banks');
  await shot('cards-remediation-rich-1440-scrolled');

  console.log('Cards remediation QA: wide desktop scan distance');
  for(const width of [1920,2560]){await viewport(width,1100);await navigate('cards-rich');current=await state();assert(current.recentWidth<=1121&&current.columnWidths.every(value=>value<=391)&&current.overflow<=1,`${width}px Cards keeps recent data and columns bounded`);await shot(`cards-remediation-rich-${width}`)}

  console.log('Cards remediation QA: dark secondary contrast');
  await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}");
  await viewport(1440,1000);await navigate('cards-rich');current=await state();
  assert(current.bankMetaColor&&current.managementOpacity<1&&current.overflow<=1,'dark bank metadata and subordinate card utilities remain visible and contained');
  await shot('cards-remediation-rich-dark-1440');

  c.close();console.log(`Cards remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
