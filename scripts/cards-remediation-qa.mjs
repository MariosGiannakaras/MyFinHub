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
  const state=()=>c.call(`function(){const workspace=document.querySelector('.cards-workspace'),grid=document.querySelector('.cards-grid'),columns=[...document.querySelectorAll('.cards-bank-column')],hint=document.querySelector('.cards-workspace-scroll-hint'),recent=document.querySelector('.cards-surrounding-recent-list'),card=document.querySelector('.prototype-payment-card'),reveal=card?.querySelector('.card-icon-reveal'),management=card?.querySelector('.card-icon-management'),controls=[...(card?.querySelectorAll('.card-toolbar .card-icon-btn')||[])],label=card?.querySelector('.card-field-label'),bankMeta=document.querySelector('.bank-column-title small'),kpi=[...document.querySelectorAll('.cards-surrounding-kpi')].find(node=>(node.textContent||'').includes('Τράπεζες με κάρτα')),root=getComputedStyle(document.documentElement);const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width,height:r.height}:null};const style=node=>node?getComputedStyle(node):null;return {columns:columns.length,columnWidths:columns.map(node=>rect(node)?.width||0),workspaceClient:workspace?.clientWidth||0,workspaceScroll:workspace?.scrollWidth||0,scrollLeft:workspace?.scrollLeft||0,hintVisible:Boolean(hint&&rect(hint)?.height),gridWidth:rect(grid)?.width||0,recentWidth:rect(recent)?.width||0,labelSize:parseFloat(style(label)?.fontSize||'0'),revealBg:style(reveal)?.backgroundColor||'',managementBg:style(management)?.backgroundColor||'',managementOpacity:parseFloat(style(management)?.opacity||'1'),toolbarIcons:controls.map(node=>({label:node.getAttribute('aria-label')||'',bg:style(node)?.backgroundColor||'',shadow:style(node)?.boxShadow||'',opacity:parseFloat(style(node)?.opacity||'0'),stroke:parseFloat(style(node.querySelector('svg'))?.strokeWidth||'0'),pseudo:getComputedStyle(node,'::before').content,pseudoDisplay:getComputedStyle(node,'::before').display,cssWidth:parseFloat(style(node)?.width||'0'),width:rect(node)?.width||0})),bankMetaColor:style(bankMeta)?.color||'',textSecondary:root.getPropertyValue('--text-secondary').trim(),kpiText:kpi?.textContent||'',addCard:[...document.querySelectorAll('.page-heading button')].some(node=>(node.textContent||'').includes('Προσθήκη κάρτας')),addBank:[...document.querySelectorAll('.page-heading button')].some(node=>(node.textContent||'').includes('Προσθήκη τράπεζας')),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);

  console.log('Cards remediation QA: standard one-card domain state');
  await viewport(1440,1000);await navigate('');
  let current=await state();
  assert(current.columns===1,'provider registry does not create empty card-bank columns for the one-card fixture');
  assert(current.kpiText.includes('1'),'Cards-domain bank KPI counts the represented bank');
  assert(current.addCard&&current.addBank,'both add-card and custom-bank management remain reachable');
  assert(current.labelSize>=10,'card VALID THRU and CVV microcopy stays readable');
  assert(current.toolbarIcons.length===3&&current.toolbarIcons.some(icon=>icon.label.includes('Εμφάνιση στοιχείων'))&&current.toolbarIcons.some(icon=>icon.label.includes('Επεξεργασία κάρτας'))&&current.toolbarIcons.some(icon=>icon.label.includes('Αρχειοθέτηση κάρτας'))&&current.toolbarIcons.every(icon=>icon.bg==='rgba(0, 0, 0, 0)'&&icon.shadow==='none'&&icon.opacity>=.9&&icon.stroke>=2.3&&icon.width>=30&&icon.width<=41),'card icon controls retain the owner-approved uniform unboxed visual hierarchy');
  assert(current.recentWidth<=1121&&current.overflow<=1,'recent activity stays within controlled measure without page overflow');
  await shot('cards-remediation-one-card-1440');

  // The shared canonical mobile host adds a decorative ::before box to some
  // controls. Debit/prepaid Eye/Pencil/Archive explicitly use plain glyphs.
  console.log('Cards remediation QA: unboxed toolbar at true mobile widths');
  for(const width of [320,375,412]){
    await viewport(width,812);await navigate('');current=await state();
    assert(current.toolbarIcons.length===3&&current.toolbarIcons.every(icon=>icon.bg==='rgba(0, 0, 0, 0)'&&icon.shadow==='none'&&icon.pseudoDisplay==='none'&&icon.opacity>=.9&&icon.stroke>=2.3&&Math.abs(icon.cssWidth-40)<=.1&&icon.width>=40&&icon.width<=44),`${width}px toolbar has three plain bold icons, no mobile pseudo-box, with 40px touch targets: ${JSON.stringify(current.toolbarIcons)}`);
    await shot(`cards-remediation-mobile-unboxed-${width}`);
  }

  console.log('Cards remediation QA: intentional multi-bank horizontal navigation');
  await viewport(1440,1000);
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
  assert(current.bankMetaColor&&current.toolbarIcons.length===3&&current.toolbarIcons.every(icon=>icon.bg==='rgba(0, 0, 0, 0)'&&icon.shadow==='none'&&icon.opacity>=.9&&icon.stroke>=2.3)&&current.overflow<=1,'dark bank metadata and plain high-contrast card utilities remain visible and contained');
  await shot('cards-remediation-rich-dark-1440');


  console.log('Cards remediation QA: debit/prepaid archive exits with nine visible slices before state transition');
  const archiveCard=async(reduce=false,evidenceName='')=>{
    const armed=await c.call("function(){const card=document.querySelector('.prototype-payment-card:not(.r-card-archive-ghost)');const button=card?.querySelector('button[aria-label=\"Αρχειοθέτηση κάρτας\"]');button?.click();return Boolean(button)}");
    assert(armed,'debit card archive affordance remains accessible');
    await waitFor("function(){return Boolean(document.querySelector('.prototype-payment-card:not(.r-card-archive-ghost) .r-card-archive-keyboard'))}",'archive slider exists');
    const state=await c.call("function(){const button=document.querySelector('.prototype-payment-card:not(.r-card-archive-ghost) .r-card-archive-keyboard');button?.click();const layer=document.querySelector('.r-card-archive-shred');return {clicked:Boolean(button),slices:layer?.querySelectorAll('.r-card-archive-slice').length||0,active:Boolean(document.querySelector('.prototype-payment-card:not(.r-card-archive-ghost)'))}}");
    assert(state.clicked,'archive thumb commits from keyboard');
    assert(reduce?state.slices===0:state.slices===9&&state.active,reduce?'reduced-motion archive does not start animated slices':'nine animated slices are visible while card is still active');
    if(!reduce)await shot('cards-archive-shred-'+evidenceName);
    await waitFor("function(){return !document.querySelector('.r-card-archive-shred')&&Boolean(document.querySelector('.cards-archive .card-archive-row'))}",'archive only commits after animation');
  };
  for(const [width,theme] of [[375,'light'],[1440,'dark']]){
    await viewport(width,width===375?812:1000);
    await navigate('');
    await c.call("async function(theme){localStorage.setItem('myfinhub.theme',theme);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(theme)}",[theme]);
    await archiveCard(false,`${width}-${theme}`);
    await shot(`cards-archive-completed-${width}-${theme}`);
  }
  console.log('Cards remediation QA: fast pointer drag uses latest progress rather than stale React state');
  await viewport(375,812);await navigate('');
  const armedForPointer=await c.call("function(){const card=document.querySelector('.prototype-payment-card:not(.r-card-archive-ghost)');const button=card?.querySelector('button[aria-label=\"Αρχειοθέτηση κάρτας\"]');button?.click();return Boolean(button)}");
  assert(armedForPointer,'pointer archive can be armed');
  await waitFor("function(){return Boolean(document.querySelector('.prototype-payment-card .r-card-archive-keyboard'))}",'pointer slider mounted');
  const coords=await c.call("function(){const thumb=document.querySelector('.prototype-payment-card .r-card-archive-keyboard');const slider=thumb?.closest('.delete-slider');if(!thumb||!slider)return null;const a=thumb.getBoundingClientRect(),b=slider.getBoundingClientRect();return {startX:a.left+a.width/2,endX:b.right-12,y:a.top+a.height/2}}");
  assert(coords&&coords.endX>coords.startX,'pointer slider has valid visible travel');
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:coords.startX,y:coords.y,buttons:0});
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:coords.startX,y:coords.y,button:'left',clickCount:1,buttons:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:coords.endX,y:coords.y,buttons:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:coords.endX,y:coords.y,button:'left',clickCount:1,buttons:0});
  const pointerOutcome=await c.call("function(){const layer=document.querySelector('.r-card-archive-shred');return {slices:layer?.querySelectorAll('.r-card-archive-slice').length||0,active:Boolean(document.querySelector('.prototype-payment-card:not(.r-card-archive-ghost)'))}}");
  assert(pointerOutcome.slices===9&&pointerOutcome.active,'fast pointerup commits archive while nine slices animate');
  await shot('cards-archive-shred-fast-pointer-375');
  await waitFor("function(){return !document.querySelector('.r-card-archive-shred')&&Boolean(document.querySelector('.cards-archive .card-archive-row'))}",'pointer archive settles only after exit motion');

  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await viewport(375,812);await navigate('');await archiveCard(true);
  await c.send('Emulation.setEmulatedMedia',{features:[]});

  c.close();console.log(`Cards remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
