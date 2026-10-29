import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { visualEvidenceContext } from './visual-evidence-store.mjs';

const context=visualEvidenceContext();
const {appVersion,timeZone,timestamp,generatedAt,sourceSha,shortSha,sourceBranch,evidenceRoot}=context;
mkdirSync(evidenceRoot,{recursive:true});
const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for visual evidence QA.');
const port=9231;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-visual-evidence-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}close(){this.ws?.close()}}
const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'};
const viewports=[{mode:'desktop',width:1440,height:1000},{mode:'mobile',width:375,height:812}];
const screenshots=[];
for(const page of Object.keys(pages)){const dir=resolve(evidenceRoot,page);mkdirSync(dir,{recursive:true});for(const name of readdirSync(dir))if(name.includes('__full-page__')&&name.endsWith('.png'))rmSync(resolve(dir,name),{force:true})}
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitForDashboardSteadyState=async()=>{const mobile=await c.call("function(){return matchMedia('(max-width:680px)').matches}");if(mobile){for(let i=0;i<120;i++){const ready=await c.call("function(){const disclosure=document.querySelector('.dashboard-mobile-disclosure');const charts=document.querySelector('.approved-chart-grid');return disclosure?.getAttribute('aria-expanded')==='false'&&charts?.classList.contains('mobile-collapsed')&&Boolean(document.querySelector('.dashboard-mobile-summary-donut'))}");if(ready)return;await sleep(100)}throw new Error('Timed out waiting for collapsed mobile Dashboard analytics')}for(let i=0;i<120;i++){const ready=await c.call("function(){const selectors=['.summary-donut .recharts-surface','.approved-bar-wrap .recharts-surface','.approved-category-donut .recharts-surface'];const visibleShape=selector=>[...document.querySelectorAll(selector)].some(node=>{try{const box=node.getBBox();return box.width>2&&box.height>2}catch{return false}});return selectors.every(selector=>Boolean(document.querySelector(selector)))&&visibleShape('.approved-bar-wrap .recharts-rectangle')&&visibleShape('.summary-donut .recharts-sector')&&visibleShape('.approved-category-donut .recharts-sector')}");if(ready)return;await sleep(100)}throw new Error('Timed out waiting for painted desktop Dashboard charts')};
  // Capture both essential states: private on fresh load, then deliberate reveal for money-bearing visual evidence.
  // Never require Recharts to render while privacy hides the underlying numeric series.
  const revealDashboardForVisualEvidence=async()=>{
    // Keep this test strict: only the three monetary KPI fields are counted here.
    // The donut's independent percentage labels are checked separately.
    // No amount text is returned to Node, so failure diagnostics stay privacy-safe.
    let last=null;
    for(let i=0;i<100;i++){
      last=await c.call("function(){const toggle=document.querySelector('.dashboard-approved-heading .privacy-toggle');const primary=[...document.querySelectorAll('.approved-account-card[data-balance-visibility=\"masked\"] .approved-balance')];const summary=[...document.querySelectorAll('.summary-income > div > b,.summary-expense > div > b,.summary-net > div:first-child > b')];const sectors=[...document.querySelectorAll('.summary-donut span b')];const charts=[...document.querySelectorAll('.summary-donut .recharts-surface,.approved-bar-wrap .recharts-surface,.approved-category-donut .recharts-surface')];const isHidden=node=>node.textContent.includes('•')&&!/\\d/.test(node.textContent);const allAccounts=[...document.querySelectorAll('.approved-account-card[data-account-id]')];return {toggle:toggle?.getAttribute('aria-pressed')||null,accounts:allAccounts.length,primary:primary.length,primaryMasked:primary.filter(isHidden).length,summary:summary.length,summaryMasked:summary.filter(isHidden).length,sectors:sectors.length,sectorsMasked:sectors.filter(isHidden).length,charts:charts.length}}");
      if(last.toggle==='false'&&last.accounts>0&&last.primary===last.accounts&&last.primaryMasked===last.primary&&last.summary===3&&last.summaryMasked===3&&last.sectors===2&&last.sectorsMasked===2&&last.charts===0)break;
      await sleep(100);
    }
    if(!last||last.toggle!=='false'||last.accounts<1||last.primary!==last.accounts||last.primaryMasked!==last.primary||last.summary!==3||last.summaryMasked!==3||last.sectors!==2||last.sectorsMasked!==2||last.charts!==0)
      throw new Error(`Dashboard default privacy assertion failed (counts and flags only): ${JSON.stringify(last)}`);
    await c.call("function(){const toggle=document.querySelector('.dashboard-approved-heading .privacy-toggle');if(!toggle)throw new Error('Dashboard privacy toggle missing');toggle.click();return true}");
    for(let i=0;i<100;i++){if(await c.call("function(){return document.querySelector('.dashboard-approved-heading .privacy-toggle')?.getAttribute('aria-pressed')==='true'}"))return;await sleep(100)}
    throw new Error('Dashboard privacy did not reveal after explicit toggle');
  };
    const assertReportCreditLayout=async()=>{
    const geometry=await c.call("function(){const grid=document.querySelector('.report-upcoming-card .report-operations-grid.report-credit-portfolio');const card=grid?.querySelector('.report-credit-portfolio-card');const copy=card?.querySelector('div');if(!grid||!card||!copy)return null;const outer=grid.getBoundingClientRect(),box=card.getBoundingClientRect(),text=copy.getBoundingClientRect();return {gridWidth:outer.width,cardWidth:box.width,copyWidth:text.width,rightOverflow:Math.max(0,box.right-outer.right,text.right-box.right),viewportOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)}}");
    if(!geometry||geometry.cardWidth<geometry.gridWidth*.9||geometry.copyWidth<geometry.cardWidth*.5||geometry.rightOverflow>2||geometry.viewportOverflow>2)
      throw new Error(`Reports credit portfolio nested grid is clipped: ${JSON.stringify(geometry)}`);
  };
  // A route title can paint before its staggered table/list rows. Wait for
  // finite content-entrance animations and (for Transactions) actual opaque
  // populated rows; do not turn a premature screenshot into a ledger-loss finding.
  const waitForVisualPaint=async(page)=>{
    await c.call("async function(){if(document.fonts?.ready)await document.fonts.ready}");
    let last=null;
    for(let attempt=0;attempt<60;attempt++){
      last=await c.call(`function(){
        const nodes=[...document.querySelectorAll('[data-content-entrance] > *,table[data-content-entrance="table"] tbody > tr')]
          .filter(node=>node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
        const pending=nodes.filter(node=>node.getAnimations().some(anim=>anim.playState==='running'
          &&Number.isFinite(anim.effect?.getComputedTiming()?.endTime))).length;
        const rows=[...document.querySelectorAll('.transactions-approved-table tbody tr')];
        const faded=rows.filter(row=>Number.parseFloat(getComputedStyle(row).opacity)<.98).length;
        return {nodes:nodes.length,pending,rows:rows.length,faded};
      }`);
      if(!last.pending&&(page!=='transactions'||!last.faded)){
        await c.call("async function(){await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)}");
        return;
      }
      await sleep(50);
    }
    throw new Error(`Visual evidence did not reach painted content state for ${page}: ${JSON.stringify(last)}`);
  };
  const navigate=async(page,heading)=>{const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('visual','1');await c.send('Page.navigate',{url:url.href});for(let i=0;i<100;i++){if(await c.call("function(text){return document.readyState==='complete'&&(document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",[heading]))break;if(i===99)throw new Error(`Timed out waiting for visual route ${page}`);await sleep(100)}await waitForVisualPaint(page);if(page==='dashboard'){await revealDashboardForVisualEvidence();await waitForDashboardSteadyState()}if(page==='reports')await assertReportCreditLayout();const visibleQaControl=await c.call("function(){const node=document.querySelector('[data-qa-crash]');if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0}");if(visibleQaControl)throw new Error(`QA-only crash control is visible in visual capture for ${page}`)};
  const assertMobileCreditHistory=async()=>{const state=await c.call(`function(){const rows=[...document.querySelectorAll('.credit-purchases-table tbody tr,.credit-payments-table tbody tr')];const details=rows.map(row=>{const cells=[...row.querySelectorAll('td')],amount=row.querySelector('td.amount'),actions=row.querySelector('td.actions');const rect=row.getBoundingClientRect(),amountRect=amount?.getBoundingClientRect(),actionsRect=actions?.getBoundingClientRect();return {cells:cells.length,rowWidth:rect.width,amountVisible:Boolean(amountRect&&amountRect.width>0&&amountRect.left>=0&&amountRect.right<=innerWidth+1),actionsVisible:!actions||Boolean(actionsRect&&actionsRect.width>0&&actionsRect.left>=0&&actionsRect.right<=innerWidth+1)}});return {rows:details.length,details,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);if(!state.rows)throw new Error('Visual QA expected populated mobile credit history rows');if(state.overflow>1||state.details.some(item=>!item.amountVisible||!item.actionsVisible))throw new Error(`Mobile credit history is clipped or unreadable: ${JSON.stringify(state)}`)};
  const fullPage=async(page,mode,width,height)=>{const metrics=await c.send('Page.getLayoutMetrics');const size=metrics.cssContentSize||metrics.contentSize;const captureWidth=Math.max(1,Math.ceil(size.width));const captureHeight=Math.max(1,Math.min(16000,Math.ceil(size.height)));const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:captureWidth,height:captureHeight,scale:1}});const fileName=`${appVersion}__${timestamp}__full-page__${mode}-${width}x${height}.png`;const surfaceDir=resolve(evidenceRoot,page);writeFileSync(resolve(surfaceDir,fileName),Buffer.from(shot.data,'base64'));screenshots.push({file:`visual-qa/${page}/${fileName}`,page,state:'LATEST',viewport:{mode,width,height},capture:{width:captureWidth,height:captureHeight}})};
  for(const item of viewports){await viewport(item.width,item.height);for(const [page,heading] of Object.entries(pages)){await navigate(page,heading);if(item.mode==='mobile'&&page==='credit')await assertMobileCreditHistory();await fullPage(page,item.mode,item.width,item.height)}}c.close();
  const manifest={schemaVersion:2,layout:'surface-first-latest-only',appVersion,captureId:`${timestamp}__${shortSha}`,generatedAt,timeZone,source:{sha:sourceSha,shortSha,branch:sourceBranch},baseUrl,screenshots};writeFileSync(resolve(evidenceRoot,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);console.log(`Full-page visual evidence QA passed: ${appVersion} (${screenshots.length} latest screenshots across ${Object.keys(pages).length} surfaces).`);
}finally{child.kill('SIGTERM')}
