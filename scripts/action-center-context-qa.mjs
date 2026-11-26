import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Action Center QA.');
const port=9241;
const profile='/tmp/myfinhub-action-center-context-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Browser startup on cold shared runners is not an application assertion.
 // Bound CDP readiness independently of UI, then keep all UI timeouts strict.
async function waitHttp(url){
  for(let i=0;i<240;i++){
    if(child.exitCode!==null||child.signalCode!==null)throw new Error('Chromium exited before the debugging endpoint became ready');
    try{const response=await fetch(url);if(response.ok)return}catch{}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for Chromium debugging endpoint: ${url}`);
}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const fn of this.listeners.get(message.method)||[])fn(message.params)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Action Center QA assertion failed: ${message}`)};

try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];const recoverableAssets=[];const requests=new Map();
  c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
  c.on('Network.requestWillBeSent',params=>{if(params.requestId&&params.request?.url)requests.set(params.requestId,{url:params.request.url,type:params.type||''})});
  c.on('Network.loadingFailed',params=>{
    if(params.canceled||params.errorText==='net::ERR_ABORTED')return;
    const request=requests.get(params.requestId)||{url:'unknown',type:params.type||''};
    const type=params.type||request.type;
    const external=(()=>{try{return new URL(request.url).origin!==new URL(baseUrl).origin}catch{return false}})();
    if(type==='Image'&&external&&params.errorText==='net::ERR_BLOCKED_BY_ORB'){
      recoverableAssets.push(`${params.errorText}: ${request.url}`);
      return;
    }
    failedRequests.push(`${params.errorText||'network failure'} [${type||'unknown'}] ${request.url}`);
  });
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const urlFor=(page='attention',state='',text='normal')=>{const url=new URL(baseUrl);url.searchParams.set('page',page);if(state)url.searchParams.set('state',state);if(text!=='normal')url.searchParams.set('text',text);return url.href};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(page='attention',state='',width=1440,height=1000,text='normal')=>{await viewport(width,height);await c.send('Page.navigate',{url:urlFor(page,state,text)});await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}",`${page} heading`);await sleep(160)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const noOverflow=async label=>{const value=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(value<=1,`${label} horizontal overflow ${value}px`)};
  const noUnnamed=async label=>{const offenders=await c.call("function(){return [...document.querySelectorAll('#main-workspace button,#main-workspace summary,.contextual-quick-modal button')].filter(el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden')return false;return !(el.getAttribute('aria-label')||el.getAttribute('title')||(el.textContent||'').trim())}).map(el=>el.outerHTML.slice(0,150))}");assert(offenders.length===0,`${label} unnamed controls: ${offenders.join(' | ')}`)};
  const assertActionLabelContained=async (label,maxLines=2)=>{
    const failures=await c.call("function(maxLines){return [...document.querySelectorAll('.attention-approved-desktop .attention-approved-actions>.save-button')].filter(button=>button.getClientRects().length>0).flatMap(button=>{const box=button.getBoundingClientRect(),host=button.closest('.attention-approved-actions')?.getBoundingClientRect();const range=document.createRange();const rects=[...button.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).flatMap(node=>{range.selectNodeContents(node);return [...range.getClientRects()]});const lineCount=new Set(rects.filter(rect=>rect.width>.5).map(rect=>Math.round(rect.top))).size;const spills=rects.filter(rect=>rect.width>.5&&(rect.left<box.left-1||rect.right>box.right+1||rect.top<box.top-1||rect.bottom>box.bottom+1));if(lineCount>maxLines||spills.length||button.scrollWidth>button.clientWidth+1||host&&(box.left<host.left-1||box.right>host.right+1))return [{label:(button.textContent||'').trim(),lineCount,maxLines,box:{left:box.left,right:box.right,width:box.width},rects:spills.map(rect=>({left:rect.left,right:rect.right}))}];return []})}",[maxLines]);
    assert(failures.length===0,`${label} long action labels must stay inside button boundaries and readable line count: ${JSON.stringify(failures)}`);
  };
  const touchTargets=async label=>{const offenders=await c.call("function(){return [...document.querySelectorAll('#main-workspace button,#main-workspace summary,.mobile-nav button,.topbar button,.contextual-quick-modal button')].filter(el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden'||el.disabled)return false;return r.width<40||r.height<40}).map(el=>({name:el.getAttribute('aria-label')||(el.textContent||'').trim().slice(0,45),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}))}");assert(offenders.length===0,`${label} touch targets below 40px: ${JSON.stringify(offenders.slice(0,8))}`)};
  const clickText=async(selector,text)=>{const clicked=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(clicked,`missing clickable ${text}`)};
  const clickAttention=async(id)=>{const clicked=await c.call("function(id){const row=document.querySelector(`[data-attention-id=\"${CSS.escape(id)}\"]`);const button=row?.querySelector('.attention-actions .save-button');button?.click();return Boolean(button)}",[id]);assert(clicked,`missing attention action ${id}`)};
  const assertDialogSemantics=async title=>{assert(await c.call("function(title){const modal=document.querySelector('.contextual-quick-modal');if(!modal)return false;const labelled=modal.getAttribute('aria-labelledby');return modal.getAttribute('role')==='dialog'&&modal.getAttribute('aria-modal')==='true'&&Boolean(labelled)&&((document.getElementById(labelled)?.textContent||'').includes(title))}",[title]),`${title} dialog semantics`)};
  const waitModal=async title=>{await waitFor("function(title){const modal=document.querySelector('.contextual-quick-modal');return Boolean(modal&&(modal.querySelector('h2')?.textContent||'').includes(title))}",`${title} contextual modal`,[title]);assert(await c.call("function(){return document.querySelector('.contextual-quick-modal input[data-autofocus=true]')===document.activeElement}"),`${title} autofocus`);await assertDialogSemantics(title)};
  const closeModal=async()=>{
    const closed=await c.call("function(){const button=document.querySelector('.contextual-quick-modal header button');button?.click();return Boolean(button)}");
    assert(closed,'context modal close control');
    await waitFor("function(){return !document.querySelector('.contextual-quick-modal')||Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'context close or discard prompt');
    const confirmed=await c.call("function(){const dialog=document.querySelector('.app-confirm-dialog[role=alertdialog]');const button=[...dialog?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Απόρριψη'));button?.click();return Boolean(button)}");
    if(confirmed)await waitFor("function(){return !document.querySelector('.app-confirm-dialog[role=alertdialog]')}",'confirmed contextual discard');
    await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'context modal close');
  };
  const closeGenericModal=async()=>{
    const closed=await c.call("function(){const button=document.querySelector('.quick-modal:not(.contextual-quick-modal) button[aria-label=\"Κλείσιμο καταχώρισης\"]');button?.click();return Boolean(button)}");
    assert(closed,'generic account context closes');
    await waitFor("function(){return !document.querySelector('.generic-quick-modal')||Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'generic close or unsaved discard prompt');
    const discarded=await c.call("function(){const dialog=document.querySelector('.app-confirm-dialog[role=alertdialog]');const button=[...dialog?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Απόρριψη'));button?.click();return Boolean(button)}");
    if(discarded)await waitFor("function(){return !document.querySelector('.app-confirm-dialog[role=alertdialog]')}",'generic discarded draft confirmation closed');
    await waitFor("function(){return !document.querySelector('.quick-modal')}",'generic account context close');
  };
  const pressEscape=async()=>{for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27})};
  const approvedAttentionState=()=>c.call("function(){const groups=[...document.querySelectorAll('.attention-approved-desktop>.attention-approved-group')].filter(group=>!group.classList.contains('legacy-confirmation-panel')).slice(0,4).map(group=>{const title=group.querySelector('h2')?.textContent||'',match=title.match(/\\((\\d+)\\)/),count=Number(match?.[1]||0),link=group.querySelector('.attention-approved-group-link'),head=group.querySelector('.attention-approved-table-head');return {count,hasLink:Boolean(link),expanded:link?.getAttribute('aria-expanded')??null,hasTableHead:Boolean(head),emptyClass:group.classList.contains('is-empty'),height:group.getBoundingClientRect().height}});const rows=[...document.querySelectorAll('.attention-approved-desktop .attention-approved-row')],row=rows[0],primary=row?.querySelector('.attention-approved-actions>.save-button'),secondary=row?.querySelector('.attention-approved-icon-action'),reason=row?.querySelector('.attention-approved-copy>p'),context=row?.querySelector('.attention-approved-context'),dateSmall=row?.querySelector('.attention-approved-date>small'),table=document.querySelector('.attention-approved-table-head'),tableRect=table?.getBoundingClientRect(),style=node=>node?getComputedStyle(node):null,total=groups.reduce((sum,g)=>sum+g.count,0),danger=groups[0]?.count||0,clear=document.querySelector('.attention-approved-all-clear');return {groups,total,danger,allClearText:clear?.textContent||'',tableWidth:tableRect?.width||0,primaryBg:style(primary)?.backgroundColor||'',primaryImage:style(primary)?.backgroundImage||'',primaryShadow:style(primary)?.boxShadow||'',primaryBorder:style(primary)?.borderTopColor||'',secondaryBg:style(secondary)?.backgroundColor||'',secondaryImage:style(secondary)?.backgroundImage||'',secondaryShadow:style(secondary)?.boxShadow||'',secondaryBorder:style(secondary)?.borderTopColor||'',reasonSize:parseFloat(style(reason)?.fontSize||'0'),contextSize:parseFloat(style(context)?.fontSize||'0'),dateSize:parseFloat(style(dateSmall)?.fontSize||'0')}}");

  console.log('Action Center QA: desktop hierarchy, privacy and deterministic queue');
  await navigate('attention');
  assert(await c.call("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Έλεγχος')}") ,'attention heading');
  assert((await c.call("function(){return document.querySelectorAll('.attention-summary-grid>article').length}"))===3,'three severity summary cards');
  assert((await c.call("function(){return document.querySelectorAll('.attention-row').length}"))>0,'attention queue has actionable items');
  assert(await c.call("function(){return Boolean(document.querySelector('[data-legacy-confirmation-panel]'))}"),'legacy confirmation is integrated into Έλεγχος');
  assert(await c.call("function(){const toggle=document.querySelector('.attention-page .privacy-toggle');return toggle?.getAttribute('aria-pressed')==='false'}") ,'privacy starts hidden');
  await clickText('.attention-page .privacy-toggle','Εμφάνιση ποσών');
  assert(await c.call("function(){return document.querySelector('.attention-page .privacy-toggle')?.getAttribute('aria-pressed')==='true'}"),'privacy toggle exposes values only on request');
  const approved=await approvedAttentionState();assert(approved.groups.length===4,'desktop keeps exactly the four approved priority groups');assert(approved.groups.every(group=>group.count>4?group.hasLink:!group.hasLink),'Προβολή όλων exists only when a group actually truncates rows');assert(approved.groups.every(group=>group.count===0?group.emptyClass&&!group.hasTableHead:true),'zero-count groups stay discoverable without a table header shell');assert(approved.allClearText.includes('Όλα υπό έλεγχο!')===(approved.total===0),'true all-clear language appears only with zero active actionable items');const primaryEmphasized=(approved.primaryImage&&approved.primaryImage!=='none')||approved.primaryShadow!=='none'||approved.primaryBg!==approved.secondaryBg||approved.primaryBorder!==approved.secondaryBorder;const secondaryQuiet=['rgba(0, 0, 0, 0)','transparent'].includes(approved.secondaryBg)&&(!approved.secondaryImage||approved.secondaryImage==='none')&&approved.secondaryShadow==='none';assert(primaryEmphasized&&secondaryQuiet,'row domain action remains primary while snooze/dismiss controls are visually quiet');assert(approved.reasonSize>=9&&approved.contextSize>=9&&approved.dateSize>=9,`desktop dense Attention text remains readable: ${JSON.stringify(approved)}`);
  await assertActionLabelContained('attention desktop 1440');
  await noOverflow('attention desktop');await noUnnamed('attention desktop');await screenshot('action-center-desktop');
  for(const [width,height,label] of [[1100,900,'1100'],[1920,1080,'1920'],[2560,1440,'2560']]){await navigate('attention','',width,height);const wide=await approvedAttentionState();assert(wide.tableWidth<=1481,`${label}px Attention table measure is bounded: ${JSON.stringify(wide)}`);await assertActionLabelContained(`attention responsive desktop ${label}`,width===1100?3:2);await noOverflow(`attention wide ${label}`);await screenshot(`action-center-wide-${label}`)}

  console.log('Action Center QA: focused legacy split-review editor');
  await navigate('attention','split-review');
  await clickText('.legacy-confirmation-toggle','Προβολή');
  await waitFor("function(){return [...document.querySelectorAll('.legacy-confirmation-row button')].some(node=>(node.textContent||'').includes('Άνοιγμα διαχωρισμού'))}",'split-required legacy review action');
  await clickText('.legacy-confirmation-row button','Άνοιγμα διαχωρισμού');
  await waitFor("function(){return Boolean(document.querySelector('.split-review-summary'))&&document.querySelectorAll('.review-part').length>=2}",'legacy split review editor');
  const splitReviewGeometry=await c.call("function(){const summary=document.querySelector('.split-review-summary'),dialog=summary?.closest('.editor-dialog'),parts=[...document.querySelectorAll('.review-part')];if(!summary||!dialog||parts.length<2)return null;const r=dialog.getBoundingClientRect(),sr=summary.getBoundingClientRect();return {parts:parts.length,dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},summary:{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom},overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,partWidths:parts.map(part=>part.getBoundingClientRect().width)}}");
  assert(splitReviewGeometry&&splitReviewGeometry.parts>=2&&splitReviewGeometry.dialog.left>=0&&splitReviewGeometry.dialog.right<=1440&&splitReviewGeometry.dialog.top>=0&&splitReviewGeometry.dialog.bottom<=1000&&splitReviewGeometry.summary.left>=splitReviewGeometry.dialog.left&&splitReviewGeometry.summary.right<=splitReviewGeometry.dialog.right&&splitReviewGeometry.overflow<=1&&splitReviewGeometry.partWidths.every(width=>width>120),'legacy split-review dialog geometry');
  await noUnnamed('legacy split-review editor');await screenshot('action-center-split-review-editor');
  const splitClosed=await c.call("function(){const button=document.querySelector('button[aria-label=\"Κλείσιμο επεξεργασίας διαχωρισμού\"]');button?.click();return Boolean(button)}");assert(splitClosed,'legacy split-review close control');
  await waitFor("function(){return !document.querySelector('.split-review-summary')}",'legacy split-review close');

  console.log('Action Center QA: legacy review keep semantics never mutate reports implicitly');
  await clickText('.sidebar nav button','Αναφορές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'Reports before review decision');
  const reportBeforeKeep=await c.call("function(){return (document.querySelector('.report-kpi-strip')?.textContent||'').replace(/\\s+/g,' ').trim()}");
  assert(reportBeforeKeep.length>0,'report KPI baseline exists before review decision');
  await clickText('.sidebar nav button','Έλεγχος');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Έλεγχος')}",'Attention before keep decision');
  await clickText('.legacy-confirmation-toggle','Προβολή');
  await waitFor("function(){return Boolean(document.querySelector('.legacy-confirmation-row'))}",'expanded legacy confirmation');
  const keptReview=await c.call("function(){const row=document.querySelector('.legacy-confirmation-row');const title=(row?.querySelector('h3')?.textContent||'').trim();const button=[...row?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Κράτα ως είναι'));button?.click();return {title,clicked:Boolean(button)}}");
  assert(keptReview.clicked&&keptReview.title,'legacy review exposes Keep as-is decision');
  await waitFor("function(title){return ![...document.querySelectorAll('.legacy-confirmation-row h3')].some(node=>(node.textContent||'').trim()===title)}",'kept review leaves pending list',[keptReview.title]);
  await screenshot('action-center-review-kept');
  await clickText('.sidebar nav button','Αναφορές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Αναφορές')}",'Reports after keep decision');
  const reportAfterKeep=await c.call("function(){return (document.querySelector('.report-kpi-strip')?.textContent||'').replace(/\\s+/g,' ').trim()}");
  assert(reportAfterKeep===reportBeforeKeep,'Keep as-is preserves report KPIs and original transaction meaning');

  console.log('Action Center QA: exact recurring and loan deep actions');
  await navigate('attention');
  await clickAttention('recurring:rec-1');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πάγια')}",'Attention navigates to canonical Recurring domain');
  await waitFor("function(){return document.activeElement?.dataset.commandRecurringId==='rec-1'}",'exact recurring row focused after Attention');
  assert(await c.call("function(){return !document.querySelector('.contextual-quick-modal')}"),'Attention did not silently open a competing payment modal');
  await screenshot('action-center-recurring-domain-focus');
  const payFromRecurring=await c.call("function(){const row=document.querySelector('[data-command-recurring-id=rec-1]');const button=row?.querySelector('.pay-action');button?.click();return Boolean(button)}");
  assert(payFromRecurring,'pay action belongs to the focused Recurring row');
  await waitModal('Πληρωμή παγίου');
  assert(await c.call("function(){return [...document.querySelectorAll('.contextual-quick-modal input')].some(input=>String(input.value).length>0)}"),'Recurring payment context carries linked item defaults');
  await screenshot('action-center-recurring-domain-pay');
  await pressEscape();await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'recurring Escape close');
  await navigate('attention');
  await clickAttention('loan:loan-long');await waitModal('Πληρωμή δόσης');
  assert(await c.call("function(){return [...document.querySelectorAll('.contextual-quick-modal input')].some(input=>(input.value||'').includes('Δόση:'))}"),'loan context preserves exact obligation note');
  await closeModal();

  console.log('Action Center QA: exact credit statement context');
  await navigate('attention','overlimit');
  const creditAttentionId=await c.call("function(){const row=[...document.querySelectorAll('.attention-row')].find(node=>{const id=node.getAttribute('data-attention-id')||'';return id.startsWith('credit-statement:')&&(node.textContent||'').includes('Δήλωση')});return row?.getAttribute('data-attention-id')||''}");
  assert(Boolean(creditAttentionId),'statement-aware credit attention item exists');
  await clickAttention(creditAttentionId);await waitModal('Πληρωμή δήλωσης πιστωτικής');
  assert(await c.call("function(){return Boolean(document.querySelector('.contextual-quick-modal input[role=combobox]'))}"),'credit payment exposes constrained source account');
  assert(await c.call("function(){return Boolean(document.querySelector('[data-credit-statement-payment-preview]'))}"),'credit attention opens statement-aware payment preview');
  await closeModal();

  console.log('Action Center QA: exact scheduled completion is atomic');
  await navigate('attention');
  assert(await c.call("function(){return Boolean(document.querySelector('[data-attention-id=\"scheduled:qa-scheduled-transfer\"]'))}"),'scheduled attention item exists before completion');
  await clickAttention('scheduled:qa-scheduled-transfer');await waitModal('Ολοκλήρωση προγραμματισμένης');
  assert(await c.call("function(){return (document.querySelector('.contextual-quick-modal')?.textContent||'').includes('Μεταφορά στον στόχο')}") ,'scheduled context identifies exact item');
  console.log('Contextual Quick Entry blocks same-tick duplicate scheduled payment');
  const beforeScheduled=await c.call("function(){return Number(document.documentElement.dataset.qaScheduledCompletionAttempts||0)}");
  const doubleScheduled=await c.call("function(){const button=[...document.querySelectorAll('.contextual-quick-modal .save-button')].find(node=>(node.textContent||'').includes('Ολοκλήρωση'));if(!button)return false;button.click();button.click();return true}");
  assert(doubleScheduled,'contextual scheduled completion submitted twice in one browser turn');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'scheduled completion close');
  const afterScheduled=await c.call("function(){return Number(document.documentElement.dataset.qaScheduledCompletionAttempts||0)}");
  assert(afterScheduled===beforeScheduled+1,'same-turn contextual Quick Entry starts exactly one scheduled finance write');
  await waitFor("function(){return !document.querySelector('[data-attention-id=\"scheduled:qa-scheduled-transfer\"]')}",'completed scheduled attention removal');
  assert(await c.call("function(){return Boolean(document.querySelector('.top-actions button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]'))}"),'undo remains available after atomic completion');

  console.log('Action Center QA: account, savings and lending invocation contexts');
  await navigate('dashboard');
  const payrollOpened=await c.call("function(){const node=document.querySelector('[data-account-id=\"piraeus-payroll\"] [data-account-quick-entry=\"piraeus-payroll\"]');node?.click();return Boolean(node)}");assert(payrollOpened,'dashboard payroll quick action');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'payroll account-context generic quick add');
  assert(await c.call("function(){return [...document.querySelectorAll('.quick-modal:not(.contextual-quick-modal) input[role=combobox]')].some(input=>(input.value||'').includes('Μισθοδοσία'))}"),'payroll context preselects originating payroll account');
  const baselineWrites=await c.call("function(){return Number(document.documentElement.dataset.qaFinanceWrites||0)}");
  const genericNonDecimal=await c.call("function(){const input=document.querySelector('.generic-quick-modal input[data-autofocus=true]');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,'1e3');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}");
  assert(genericNonDecimal,'generic Quick Entry accepts synthetic text for validation');
  await clickText('.generic-quick-modal footer button','Καταχώριση');
  await waitFor("function(){return (document.querySelector('.generic-quick-modal #quick-add-error[role=alert]')?.textContent||'').includes('θετικό ποσό')}",'generic nondecimal notation rejected before finance POST');
  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaFinanceWrites||0)===expected&&Boolean(document.querySelector('.generic-quick-modal'))}",[baselineWrites]),'generic exponent notation never posts a finance event');
  await screenshot('quick-entry-nondecimal-rejected-desktop');
  const fundingDraft=await c.call("function(){const modal=document.querySelector('.generic-quick-modal'),amount=modal?.querySelector('input[data-autofocus=true]'),choice=modal?.querySelector('.multi-funding-choice input[type=checkbox]');if(!(amount instanceof HTMLInputElement)||!(choice instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(amount,'10.00');amount.dispatchEvent(new Event('input',{bubbles:true}));amount.dispatchEvent(new Event('change',{bubbles:true}));choice.click();return true}");
  assert(fundingDraft,'open multi-source purchase with a valid parent amount');
  await waitFor("function(){return document.querySelectorAll('.generic-quick-modal .multi-funding-row input.money-input-control').length>=2}",'multi-source amount editors ready');

  console.log('Quick Entry multi-source account choice must mean an actual funding source');
  const multiAccountHidden=await c.call("function(){const labels=[...document.querySelectorAll('.generic-quick-modal label.quick-field')];return !labels.some(x=>x.querySelector(':scope > span')?.textContent?.trim()==='Λογαριασμός')&&document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===2}");
  assert(multiAccountHidden,'multi-source entry hides the unrelated single-account selector');
  await viewport(375,812);
  assert(await c.call("function(){const rows=document.querySelectorAll('.generic-quick-modal .multi-funding-row');const labels=[...document.querySelectorAll('.generic-quick-modal label.quick-field')];rows[0]?.scrollIntoView({block:'center'});return rows.length===2&&!labels.some(x=>x.querySelector(':scope > span')?.textContent?.trim()==='Λογαριασμός')&&document.documentElement.scrollWidth<=innerWidth+1}"),'375px purchase form displays only actual funding sources, without horizontal overflow');
  await sleep(160);
  await screenshot('quick-entry-multi-funding-real-sources-mobile-375');
  await viewport(1440,1000);
  const toggledSingle=await c.call("function(){const choice=document.querySelector('.generic-quick-modal .multi-funding-choice input[type=checkbox]');if(!choice?.checked)return false;choice.click();return true}");
  assert(toggledSingle,'switch multi-source mode off without changing entered amount');
  await waitFor("function(){const labels=[...document.querySelectorAll('.generic-quick-modal label.quick-field')];return labels.some(x=>x.querySelector(':scope > span')?.textContent?.trim()==='Λογαριασμός')&&!document.querySelector('.generic-quick-modal .multi-funding-row')}",'ordinary expense account selector returns when multi-source mode closes');
  assert(await c.call("function(){const label=[...document.querySelectorAll('.generic-quick-modal label.quick-field')].find(x=>x.querySelector(':scope > span')?.textContent?.trim()==='Λογαριασμός');return (label?.querySelector('input[role=combobox]')?.value||'').includes('Μισθοδοσία')}"),'single-source account selection preserved on mode toggle');
  const toggledBack=await c.call("function(){const choice=document.querySelector('.generic-quick-modal .multi-funding-choice input[type=checkbox]');if(!choice||choice.checked)return false;choice.click();return true}");
  assert(toggledBack,'switch back to multi-source edit without losing source rows');
  await waitFor("function(){const labels=[...document.querySelectorAll('.generic-quick-modal label.quick-field')];return document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===2&&!labels.some(x=>x.querySelector(':scope > span')?.textContent?.trim()==='Λογαριασμός')}",'two funding rows retained; unrelated account remains hidden');
  const malformedFunding=await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row input.money-input-control')];if(fields.length<2)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;for(const [field,value] of [[fields[0],'1e3'],[fields[1],'2.00']]){setter?.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}))}return true}");
  assert(malformedFunding,'set a malformed exponent-source and a valid cent-source');
  await waitFor("function(){const total=document.querySelector('.generic-quick-modal .multi-funding-editor .split-head span[aria-live=polite]');return Boolean(total&&(total.textContent||'').includes('Άθροισμα: —'))}",'invalid funding preview never advertises fabricated 1002 Euro subtotal');
  await screenshot('quick-entry-multi-funding-invalid-subtotal-preview-desktop');
  await clickText('.generic-quick-modal footer button','Καταχώριση');
  await waitFor("function(){return (document.querySelector('.generic-quick-modal #quick-add-error[role=alert]')?.textContent||'').includes('Κάθε πηγή')}",'invalid multi-source leg rejected before finance POST');
  await waitFor("function(){const modal=document.querySelector('.generic-quick-modal'),alert=modal?.querySelector('#quick-add-error'),body=modal?.querySelector('.entry-body');if(!alert||!body)return false;const rect=alert.getBoundingClientRect(),panel=body.getBoundingClientRect();return document.activeElement===alert&&rect.top>=panel.top-2&&rect.bottom<=panel.bottom+2}",'multi-source validation focus and alert are actually onscreen');
  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaFinanceWrites||0)===expected&&Boolean(document.querySelector('.generic-quick-modal'))}",[baselineWrites]),'invalid funding subtotal never posts a finance event');
  await screenshot('quick-entry-multi-funding-invalid-subtotal-desktop');

  console.log('Quick Entry multi-source same-turn row additions retain independent controlled fields');
  const addedFundingRows=await c.call("async function(){const node=[...document.querySelectorAll('.generic-quick-modal .multi-funding-editor button')].find(b=>(b.textContent||'').includes('Προσθήκη πηγής'));if(!node)return false;const now=Date.now;Date.now=()=>1795011000000;try{node.click();node.click();await new Promise(resolve=>setTimeout(resolve,0))}finally{Date.now=now}return true}");
  assert(addedFundingRows,'two same-turn funding-row Add clicks executed under identical Date.now');
  await waitFor("function(){return document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===4}",'four finance-source rows after two rapid Add actions');
  assert(await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row input.money-input-control')];const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(fields[2],'3.00');fields[2].dispatchEvent(new Event('input',{bubbles:true}));fields[2].dispatchEvent(new Event('change',{bubbles:true}));return fields.length===4}"),'edit only third funding source amount');
  await waitFor("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row input.money-input-control')];return fields.length===4&&fields[2].value==='3.00'&&fields[3].value===''}",'fourth source remains independent and empty after third edited');
  await viewport(375,812);
  assert(await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row input.money-input-control')];fields[2]?.scrollIntoView({block:'center'});return fields.length===4&&fields[2].value==='3.00'&&fields[3].value===''&&document.documentElement.scrollWidth<=innerWidth+1}"),'375px funding rows do not share input or widen viewport');
  await sleep(160);
  await screenshot('quick-entry-multi-funding-stable-rows-mobile-375');
  await viewport(1440,1000);

  console.log('Quick Entry same-turn funding removals never reduce below two independent source rows');
  assert(await c.call("function(){const buttons=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row button[aria-label^=\"Αφαίρεση πηγής\"]')];if(buttons.length!==4)return false;buttons[3].click();return true}"),'remove fourth funding row while exactly three must remain');
  await waitFor("function(){return document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===3}",'three funding source rows before double remove');
  const removedFunding=await c.call("async function(){const buttons=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row button[aria-label^=\"Αφαίρεση πηγής\"]')];if(buttons.length!==3)return false;buttons[0].click();buttons[1].click();await new Promise(resolve=>setTimeout(resolve,0));return true}");
  assert(removedFunding,'two funding remove actions requested before next render');
  await waitFor("function(){const rows=[...document.querySelectorAll('.generic-quick-modal .multi-funding-row')],controls=rows.flatMap(row=>[...row.querySelectorAll('button[aria-label^=\"Αφαίρεση πηγής\"]')]);return rows.length===2&&controls.length===2&&controls.every(control=>control.disabled)}",'funding removal retains required two-source minimum');
  for(const count of [3,4]){
    assert(await c.call("function(){const button=[...document.querySelectorAll('.generic-quick-modal .multi-funding-editor button')].find(b=>(b.textContent||'').includes('Προσθήκη πηγής'));if(!button||button.disabled)return false;button.click();return true}"),'restore funding source row before cap test');
    await waitFor("function(count){return document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===count}",'funding rows restored for cap proof',[count]);
  }

  console.log('Quick Entry funding source limit survives two same-turn Add clicks at 11 rows');
  for(let target=5;target<=11;target++){
    assert(await c.call("function(){const button=[...document.querySelectorAll('.generic-quick-modal .multi-funding-editor button')].find(b=>(b.textContent||'').includes('Προσθήκη πηγής'));if(!button||button.disabled)return false;button.click();return true}"),'sequential funding source Add remains available below twelve');
    await waitFor("function(target){return document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===target}",'funding row count grows to capped penultimate size',[target]);
  }
  const limitDouble=await c.call("async function(){const button=[...document.querySelectorAll('.generic-quick-modal .multi-funding-editor button')].find(b=>(b.textContent||'').includes('Προσθήκη πηγής'));if(!button||button.disabled)return false;button.click();button.click();await new Promise(resolve=>setTimeout(resolve,0));return true}");
  assert(limitDouble,'two same-turn Add clicks from 11 rows attempted');
  await waitFor("function(){const rows=document.querySelectorAll('.generic-quick-modal .multi-funding-row'),button=[...document.querySelectorAll('.generic-quick-modal .multi-funding-editor button')].find(b=>(b.textContent||'').includes('Προσθήκη πηγής'));return rows.length===12&&Boolean(button?.disabled)}",'funding source editor stops at exactly twelve and disabled button');
  await viewport(375,812);
  assert(await c.call("function(){const button=[...document.querySelectorAll('.generic-quick-modal .multi-funding-editor button')].find(b=>(b.textContent||'').includes('Προσθήκη πηγής'));button?.scrollIntoView({block:'center'});return document.querySelectorAll('.generic-quick-modal .multi-funding-row').length===12&&Boolean(button?.disabled)&&document.documentElement.scrollWidth<=innerWidth+1}"),'cap remains exactly twelve before any finance receipt and 375px page has no overflow');
  await sleep(160);
  await screenshot('quick-entry-multi-funding-max12-mobile-375');
  await viewport(1440,1000);
  const splitSelected=await c.call("function(){const button=[...document.querySelectorAll('.generic-quick-modal .generic-kind-grid button')].find(node=>(node.textContent||'').includes('Σύνθετη αγορά'));button?.click();return Boolean(button)}");
  assert(splitSelected,'generic Quick Entry selects split purchase for independent cent-precision validation');
  await waitFor("function(){return document.querySelectorAll('.generic-quick-modal .split-box input[aria-label^=Ποσό]').length>=2}",'split part amount controls ready');
  const splitInvalid=await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .split-box input')].filter(node=>node.getAttribute('aria-label')?.startsWith('Ποσό μέρους'));if(fields.length<2)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;for(const [node,value] of [[fields[0],'1e3'],[fields[1],'2.00']]){setter?.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))}return true}");
  assert(splitInvalid,'synthetic split amount editor receives malformed and valid independent parts');
  await waitFor("function(){const field=[...document.querySelectorAll('.generic-quick-modal .split-box input')].find(node=>node.getAttribute('aria-label')==='Ποσό μέρους 1');return field?.value==='1e3'&&field.getAttribute('aria-invalid')==='true'}",'split malformed amount remains visible and explicitly invalid');
  await clickText('.generic-quick-modal footer button','Καταχώριση');
  await waitFor("function(){return (document.querySelector('.generic-quick-modal #quick-add-error[role=alert]')?.textContent||'').includes('επιμέρους')}",'split amount cannot silently coerce exponent notation');
  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaFinanceWrites||0)===expected&&Boolean(document.querySelector('.generic-quick-modal'))}",[baselineWrites]),'split malformed entry stays in draft without a posted event');
  assert(await c.call("function(){return (document.querySelector('.generic-quick-modal .split-box [aria-live=polite]')?.textContent||'').includes('—')}"),'invalid split subtotal is not presented as a confirmed amount');
  await screenshot('quick-entry-split-nondecimal-rejected-desktop');
  assert(await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .split-box input.money-input-control')];if(fields.length!==2)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;for(const [field,value] of [[fields[0],'3,25'],[fields[1],'4.75']]){setter?.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}))}return true}"),'shared split MoneyInput accepts comma and dot decimal drafts');
  await waitFor("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .split-box input.money-input-control')];return fields[0]?.value==='3.25'&&fields[1]?.value==='4.75'&&(document.querySelector('.generic-quick-modal .split-box [aria-live=polite]')?.textContent||'').includes('8,00')}",'comma decimal normalization retains exact split cents');
  await waitFor("function(){return !document.querySelector('.generic-quick-modal #quick-add-error')}",'corrected split no longer announces stale amount validation');
  for(const [width,height] of [[1440,1000],[768,1024],[375,812],[320,740]]){
    await viewport(width,height);
    try{
    await waitFor("function(width){const rows=[...document.querySelectorAll('.generic-quick-modal .split-line')];if(innerWidth!==width||rows.length!==2)return false;return rows.every(row=>{const bounds=row.getBoundingClientRect(),controls=[...row.children],rects=controls.map(node=>node.getBoundingClientRect());return controls.length===4&&Boolean(row.querySelector('input.app-text-input'))&&Boolean(row.querySelector('.category-select-input input[role=combobox]'))&&Boolean(row.querySelector('.money-input input.money-input-control'))&&rects.every(rect=>rect.width>0&&rect.height>0&&rect.left>=bounds.left-1&&rect.right<=bounds.right+1)&&rects[3].height>=44&&rects.every((a,i)=>rects.every((b,j)=>i===j||Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1))})&&document.documentElement.scrollWidth<=innerWidth+1}",'split shared control geometry at '+width,[width]);
    }catch(error){
      // Keep the full geometry predicate: expose the actual computed tracks,
      // children, containment and hit targets on failure instead of guessing.
      console.error('split geometry diagnostic',JSON.stringify(await c.call("function(){return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,rows:[...document.querySelectorAll('.generic-quick-modal .split-line')].map(row=>({tracks:getComputedStyle(row).gridTemplateColumns,bounds:row.getBoundingClientRect().toJSON(),children:[...row.children].map(node=>({tag:node.tagName,classes:node.className,bounds:node.getBoundingClientRect().toJSON(),minHeight:getComputedStyle(node).minHeight}))}))}}")));
      await screenshot('quick-entry-split-geometry-failure-'+width);
      throw error;
    }
    await c.call("function(){document.querySelector('.generic-quick-modal .split-line')?.scrollIntoView({block:'center'});return true}");
    await sleep(160);await screenshot('quick-entry-split-shared-controls-'+width);
  }
  await viewport(1440,1000);

  console.log('Quick Entry split same-turn row additions retain independent raw amount fields');
  const addedSplitParts=await c.call("async function(){const node=[...document.querySelectorAll('.generic-quick-modal .split-box button')].find(b=>(b.textContent||'').includes('Προσθήκη μέρους'));if(!node)return false;const now=Date.now;Date.now=()=>1795011000000;try{node.click();node.click();await new Promise(resolve=>setTimeout(resolve,0))}finally{Date.now=now}return true}");
  assert(addedSplitParts,'two same-turn split-part Add clicks executed under identical Date.now');
  await waitFor("function(){return document.querySelectorAll('.generic-quick-modal .split-box .split-line').length===4}",'four split parts after two rapid Add actions');
  assert(await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .split-box input[aria-label^=\"Ποσό μέρους\"]')];if(fields.length!==4)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(fields[2],'3.00');fields[2].dispatchEvent(new Event('input',{bubbles:true}));fields[2].dispatchEvent(new Event('change',{bubbles:true}));return true}"),'edit only third split part amount');
  await waitFor("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .split-box input[aria-label^=\"Ποσό μέρους\"]')];return fields.length===4&&fields[2].value==='3.00'&&fields[3].value===''}",'fourth split part remains distinct; no shared raw amount ID');
  await viewport(375,812);
  assert(await c.call("function(){const fields=[...document.querySelectorAll('.generic-quick-modal .split-box input[aria-label^=\"Ποσό μέρους\"]')];fields[2]?.scrollIntoView({block:'center'});return fields.length===4&&fields[2].value==='3.00'&&fields[3].value===''&&document.documentElement.scrollWidth<=innerWidth+1}"),'375px split editor retains independent fourth row and no page overflow');
  await sleep(160);
  await screenshot('quick-entry-split-stable-rows-mobile-375');
  await viewport(1440,1000);

  console.log('Quick Entry same-turn split removals never reduce below two independently keyed parts');
  assert(await c.call("function(){const buttons=[...document.querySelectorAll('.generic-quick-modal .split-box button[aria-label^=\"Αφαίρεση μέρους\"]')];if(buttons.length!==4)return false;buttons[3].click();return true}"),'remove fourth split part before double Remove');
  await waitFor("function(){return document.querySelectorAll('.generic-quick-modal .split-line').length===3}",'three split parts before double Remove');
  const removedSplit=await c.call("async function(){const buttons=[...document.querySelectorAll('.generic-quick-modal .split-box button[aria-label^=\"Αφαίρεση μέρους\"]')];if(buttons.length!==3)return false;buttons[0].click();buttons[1].click();await new Promise(resolve=>setTimeout(resolve,0));return true}");
  assert(removedSplit,'two split-part remove actions requested before next render');
  await waitFor("function(){const rows=[...document.querySelectorAll('.generic-quick-modal .split-line')],controls=rows.flatMap(row=>[...row.querySelectorAll('button[aria-label^=\"Αφαίρεση μέρους\"]')]);return rows.length===2&&controls.length===2&&controls.every(control=>control.disabled)}",'split removal retains required two-part minimum');
  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaFinanceWrites||0)===expected}",[baselineWrites]),'no finance write for rapid source or split draft removals');

  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaFinanceWrites||0)===expected}",[baselineWrites]),'two rapid row additions never post any finance event');
  await closeGenericModal();
  const cashOpened=await c.call("function(){const node=document.querySelector('[data-account-id=\"cash\"] [data-account-quick-entry=\"cash\"]');node?.click();return Boolean(node)}");assert(cashOpened,'dashboard cash quick action');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'cash account-context generic quick add');
  assert(await c.call("function(){return [...document.querySelectorAll('.quick-modal:not(.contextual-quick-modal) input[role=combobox]')].some(input=>(input.value||'').includes('Μετρητά'))}"),'cash context preselects originating cash account');
  await closeGenericModal();

  await navigate('savings');await clickText('.savings-action','Μεταφορά στην άκρη');await waitModal('Μεταφορά στην αποταμίευση');
  const contextualBeforeWrites=await c.call("function(){return Number(document.documentElement.dataset.qaFinanceWrites||0)}");
  const contextualNonDecimal=await c.call("function(){const input=document.querySelector('.contextual-quick-modal input[data-autofocus=true]');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,'0x10');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}");
  assert(contextualNonDecimal,'contextual Quick Entry receives synthetic nondecimal amount');
  await clickText('.contextual-quick-modal .editor-actions button','Καταχώριση');
  await waitFor("function(){return (document.querySelector('.contextual-quick-modal #context-quick-error[role=alert]')?.textContent||'').includes('θετικό ποσό')}",'contextual hex notation rejected before canonical posting');
  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaFinanceWrites||0)===expected&&Boolean(document.querySelector('.contextual-quick-modal'))}",[contextualBeforeWrites]),'contextual hex notation never posts a savings event');
  await screenshot('contextual-entry-hex-rejected-desktop');
  const before=await c.call("function(){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value||''}");
  const openedSelect=await c.call("function(){const input=document.querySelector('.contextual-quick-modal input[role=combobox]');input?.click();return Boolean(input)}");assert(openedSelect,'savings source selector opens');
  await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=listbox]'))}",'savings owned select');
  const changed=await c.call("function(before){const options=[...document.querySelectorAll('.owned-select-popover [role=option]')];const option=options.find(node=>(node.textContent||'').trim()!==before&&!node.disabled);option?.click();return Boolean(option)}",[before]);assert(changed,'user can change contextual account selection');
  await waitFor("function(before){const value=document.querySelector('.contextual-quick-modal input[role=combobox]')?.value||'';return Boolean(value&&value!==before)}",'savings selection update',[before]);
  const after=await c.call("function(){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value||''}");await sleep(160);assert(await c.call("function(expected){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value===expected}",[after]),'user-changed selection is not overwritten after open');
  const requestedDiscard=await c.call("function(){const button=document.querySelector('.contextual-quick-modal header button');button?.click();return Boolean(button)}");
  assert(requestedDiscard,'edited savings context close control');
  await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'unsaved contextual edits confirmation');
  const canceledDiscard=await c.call("function(){const dialog=document.querySelector('.app-confirm-dialog[role=alertdialog]');const button=[...dialog?.querySelectorAll('button')||[]].find(node=>(node.textContent||'').includes('Ακύρωση'));button?.click();return Boolean(button)}");
  assert(canceledDiscard,'discard cancellation remains available');
  await waitFor("function(){return !document.querySelector('.app-confirm-dialog[role=alertdialog]')}",'cancelled contextual discard');
  assert(await c.call("function(expected){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value===expected}",[after]),'cancelling discard preserves actual edited savings account');
  await closeModal();

  await navigate('lending');await clickText('.receivable-person-actions button','Επιστροφή');await waitModal('Επιστροφή δανεικών');
  assert(await c.call("function(){const values=[...document.querySelectorAll('.contextual-quick-modal input')].map(input=>input.value);return values.includes('Νίκος')&&values.includes('50')}"),'lending context carries exact person and outstanding amount');await closeModal();

  console.log('Action Center QA: real Transactions edit provenance, rejection and exact synthetic receipt');
  await navigate('transactions','entry-edit-provenance');
  const provenanceBefore=await c.call("function(){return {lending:globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-lending'),saving:globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-saving')}}");
  assert(provenanceBefore?.lending?.expectedReturnDate==='2026-08-25'&&provenanceBefore.lending.source==='migration'
    &&provenanceBefore.saving?.savingSource==='pay_and_save'&&provenanceBefore.saving.source==='review',
    'real Transactions QA events expose distinct confirmed lending and saving provenance');
  const chooseEditRow=async id=>{
    const rowSelected=await c.call("function(id){const row=[...document.querySelectorAll('.transactions-approved-table tr[data-transaction-id]')].find(item=>item.getAttribute('data-transaction-id')===id);row?.click();return Boolean(row)}",[id]);
    assert(rowSelected,`Transactions actual desktop ledger row for ${id}`);
    await waitFor("function(){return Boolean(document.querySelector('.transactions-detail-panel .transactions-detail-actions button.edit'))}",'Transactions details edit button ready');
    const editClicked=await c.call("function(){const button=document.querySelector('.transactions-detail-panel .transactions-detail-actions button.edit');button?.click();return Boolean(button)}");
    assert(editClicked,'Transactions detail invokes the real generic Quick Entry editor');
    await waitFor("function(){return (document.querySelector('.generic-quick-modal h2')?.textContent||'').includes('Επεξεργασία κίνησης')}",'real saved event Quick Entry edit ready');
  };
  const chooseProvenanceDate=async date=>{
    const opened=await c.call("function(){const input=document.querySelector('.generic-quick-modal .owned-date-shell input');input?.click();return Boolean(input)}");
    assert(opened,'existing entry date picker opens');
    await waitFor("function(){return Boolean(document.querySelector('.owned-date-popover[role=dialog]'))}",'entry edit calendar ready');
    const chosen=await c.call("function(date){const cell=[...document.querySelectorAll('.owned-date-popover [data-date]')].find(node=>node.getAttribute('data-date')===date&&!node.disabled);cell?.click();return Boolean(cell)}",[date]);
    assert(chosen,`date picker selects ${date}`);
    await waitFor("function(){return !document.querySelector('.owned-date-popover')}",'date chooser closes after a real calendar choice');
  };
  const setProvenanceNote=async value=>{
    const typed=await c.call("function(value){const input=document.querySelector('.generic-quick-modal input[placeholder=\"Σύντομη περιγραφή μόνο αν χρειάζεται\"]');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[value]);
    assert(typed,'real editor accepts a changed owner note without direct finance-state mutation');
    await waitFor("function(value){return document.querySelector('.generic-quick-modal input[placeholder=\"Σύντομη περιγραφή μόνο αν χρειάζεται\"]')?.value===value}",'changed owner note stays in the React form',[value]);
  };
  await chooseEditRow('qa-provenance-lending');
  const lendingWritesBefore=await c.call("function(){return Number(document.documentElement.dataset.qaFinanceWrites||0)}");
  const lendingAttemptsBefore=await c.call("function(){return Number(document.documentElement.dataset.qaQuickEventAttempts||0)}");
  await chooseProvenanceDate('2026-08-27');
  await clickText('.generic-quick-modal footer button','Εφαρμογή αλλαγών');
  await waitFor("function(){return (document.querySelector('.generic-quick-modal #quick-add-error[role=alert]')?.textContent||'').includes('μετά την ήδη καταγεγραμμένη αναμενόμενη επιστροφή')}",'due-date inconsistent lending edit visibly denied');
  assert(await c.call("function(attempts,writes){const alert=document.querySelector('.generic-quick-modal #quick-add-error');return Number(document.documentElement.dataset.qaQuickEventAttempts||0)===attempts&&Number(document.documentElement.dataset.qaFinanceWrites||0)===writes&&document.activeElement===alert&&Boolean(document.querySelector('.generic-quick-modal'))}",[lendingAttemptsBefore,lendingWritesBefore]),
    'rejected lending date must not even attempt a finance write; editor/accessible focus remain');
  assert(await c.call("function(){const original=globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-lending');return original?.date==='2026-08-16'&&original.expectedReturnDate==='2026-08-25'&&original.source==='migration'}"),
    'the already persisted lending event is unchanged after rejected edit');
  await screenshot('quick-entry-lending-return-conflict-desktop');
  await viewport(820,900);await sleep(130);await noOverflow('lending edit conflict tablet');
  await screenshot('quick-entry-lending-return-conflict-tablet');
  await viewport(375,812);await sleep(130);await noOverflow('lending edit conflict mobile');
  await screenshot('quick-entry-lending-return-conflict-mobile');
  await viewport(1440,1000);await sleep(130);
  await chooseProvenanceDate('2026-08-16');
  const correctedLendingNote='QA lending note corrected with original return intact';
  await setProvenanceNote(correctedLendingNote);
  await clickText('.generic-quick-modal footer button','Εφαρμογή αλλαγών');
  await waitFor("function(){return !document.querySelector('.generic-quick-modal')}",'confirmed lending note edit closes the actual editor');
  await waitFor("function(expected){const event=globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-lending');return event?.note==='QA lending note corrected with original return intact'&&event.source==='migration'&&event.expectedReturnDate==='2026-08-25'&&event.date==='2026-08-16'&&Number(document.documentElement.dataset.qaFinanceWrites||0)===expected}",'confirmed same-ID lending edit preserves return date and original source',[lendingWritesBefore+1]);
  assert(await c.call("function(expected){return Number(document.documentElement.dataset.qaQuickEventAttempts||0)===expected}",[lendingAttemptsBefore+1]),
    'one corrected real lending edit receives exactly one synthetic durable save');
  await screenshot('quick-entry-lending-provenance-corrected-desktop');
  await chooseEditRow('qa-provenance-saving');
  const savingWritesBefore=await c.call("function(){return Number(document.documentElement.dataset.qaFinanceWrites||0)}");
  const savingNote='QA saving note corrected without source rewrite';
  await setProvenanceNote(savingNote);
  await clickText('.generic-quick-modal footer button','Εφαρμογή αλλαγών');
  await waitFor("function(){return !document.querySelector('.generic-quick-modal')}",'confirmed savings note edit closes real editor');
  await waitFor("function(expected){const event=globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-saving');return event?.note==='QA saving note corrected without source rewrite'&&event.source==='review'&&event.savingSource==='pay_and_save'&&event.kind==='saving_cash_offset'&&Number(document.documentElement.dataset.qaFinanceWrites||0)===expected}",'confirmed saving edit preserves owner-confirmed saving origin and original audit source',[savingWritesBefore+1]);
  await screenshot('quick-entry-saving-provenance-corrected-desktop');

  console.log('Action Center QA: real Credit purchase same-statement and moved-cycle edit provenance');
  await navigate('credit','entry-edit-provenance');
  await waitFor("function(){return Boolean(document.querySelector('[data-credit-purchases] button[aria-label=\"Επεξεργασία QA credit provenance purchase\"]'))}",'owner credit purchase edit action visible');
  const cardBefore=await c.call("function(){return globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-card')}");
  assert(cardBefore?.cardId==='qa-card'&&cardBefore.statementId==='qa-card:2026-08-12'&&cardBefore.source==='migration',
    'the existing credit purchase links the exact owner card and first billing cycle');
  const cardEditsBefore=await c.call("function(){return Number(document.documentElement.dataset.qaFinanceWrites||0)}");
  await clickText('[data-credit-purchases] button[aria-label="Επεξεργασία QA credit provenance purchase"]','');
  await waitFor("function(){return (document.querySelector('.generic-quick-modal h2')?.textContent||'').includes('Επεξεργασία κίνησης')}",'credit purchase edits through actual generic Quick Entry');
  const creditNote='QA credit same-statement correction';
  await setProvenanceNote(creditNote);
  await clickText('.generic-quick-modal footer button','Εφαρμογή αλλαγών');
  await waitFor("function(){return !document.querySelector('.generic-quick-modal')}",'same-statement card edit confirms and closes');
  await waitFor("function(expected,note){const event=globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-card');return event?.note===note&&event.cardId==='qa-card'&&event.statementId==='qa-card:2026-08-12'&&event.source==='migration'&&event.creditDelta===-23.45&&Number(document.documentElement.dataset.qaFinanceWrites||0)===expected}",'same-date credit edit preserves card, statement, origin and purchase debit',[cardEditsBefore+1,creditNote]);
  await screenshot('quick-entry-credit-same-statement-corrected-desktop');
  await waitFor("function(){return Boolean(document.querySelector('[data-credit-purchases] button[aria-label=\"Επεξεργασία QA credit same-statement correction\"]'))}",'updated credit purchase remains editable');
  await clickText('[data-credit-purchases] button[aria-label="Επεξεργασία QA credit same-statement correction"]','');
  await waitFor("function(){return Boolean(document.querySelector('.generic-quick-modal .owned-date-shell input'))}",'credit purchase date editor ready');
  await chooseProvenanceDate('2026-08-14');
  await clickText('.generic-quick-modal footer button','Εφαρμογή αλλαγών');
  await waitFor("function(){return !document.querySelector('.generic-quick-modal')}",'changed-cycle card edit confirms and closes');
  await waitFor("function(expected){const event=globalThis.__myfinhubQaEntryEditProvenance?.('qa-provenance-card');return event?.date==='2026-08-14'&&event.cardId==='qa-card'&&event.statementId==='qa-card:2026-09-12'&&event.source==='migration'&&event.creditDelta===-23.45&&Number(document.documentElement.dataset.qaFinanceWrites||0)===expected}",'date-moved credit purchase recalculates next billing cycle without erasing card identity or creating a second expense',[cardEditsBefore+2]);
  await screenshot('quick-entry-credit-new-statement-corrected-desktop');

  console.log('Action Center QA: snooze, undo, empty state and responsive accessibility');
  await navigate('attention');
  const snoozed=await c.call("function(){const row=[...document.querySelectorAll('.attention-row')].find(node=>node.classList.contains('warning')||node.classList.contains('info'));const button=row?.querySelector('button[aria-label^=\"Αναβολή\"]');const id=row?.getAttribute('data-attention-id');button?.click();return id||''}");assert(Boolean(snoozed),'non-danger item can be snoozed');
  await waitFor("function(id){return !document.querySelector(`[data-attention-id=\"${CSS.escape(id)}\"]`)}",'snoozed row removal',[snoozed]);
  const undone=await c.call("function(){const button=document.querySelector('.top-actions button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');button?.click();return Boolean(button&&!button.disabled)}");assert(undone,'attention snooze exposes enabled undo');
  await waitFor("function(id){return Boolean(document.querySelector(`[data-attention-id=\"${CSS.escape(id)}\"]`))}",'snoozed row restored by undo',[snoozed]);
  const dismissed=await c.call("function(){const row=[...document.querySelectorAll('.attention-row')].find(node=>!node.classList.contains('danger')&&Boolean(node.querySelector('button[aria-label^=\"Απόκρυψη\"]')));const button=row?.querySelector('button[aria-label^=\"Απόκρυψη\"]');const id=row?.getAttribute('data-attention-id');button?.click();return id||''}");assert(Boolean(dismissed),'non-danger item can be dismissed');
  await waitFor("function(id){return !document.querySelector(`[data-attention-id=\"${CSS.escape(id)}\"]`)}",'dismissed row removal',[dismissed]);
  const undoDismiss=await c.call("function(){const button=document.querySelector('.top-actions button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]');button?.click();return Boolean(button&&!button.disabled)}");assert(undoDismiss,'attention dismiss exposes enabled undo');
  await waitFor("function(id){return Boolean(document.querySelector(`[data-attention-id=\"${CSS.escape(id)}\"]`))}",'dismissed row restored by undo',[dismissed]);
  await navigate('attention','empty');assert(await c.call("function(){return (document.querySelector('.attention-empty')?.textContent||'').includes('Δεν υπάρχει κάτι που χρειάζεται άμεση ενέργεια')}") ,'empty attention state');const emptyApproved=await approvedAttentionState();assert(emptyApproved.total===0&&emptyApproved.allClearText.includes('Όλα υπό έλεγχο!'),'empty desktop Attention reserves true all-clear language for zero actionable items');assert(emptyApproved.groups.every(group=>group.emptyClass&&!group.hasTableHead&&!group.hasLink),'empty desktop Attention keeps all four categories compact and discoverable');await screenshot('action-center-empty-desktop');
  await navigate('attention','extreme',375,812);await noOverflow('attention mobile extreme');await noUnnamed('attention mobile extreme');await touchTargets('attention mobile extreme');await screenshot('action-center-mobile');

  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);
  assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);
  if(recoverableAssets.length){const fallback=await c.call("function(){return document.querySelectorAll('.bank-logo-fallback').length}");assert(fallback>0,`external bank-logo request failed without rendering a local fallback: ${recoverableAssets.join(' | ')}`);console.warn(`Action Center QA recovered ${recoverableAssets.length} external bank-logo image failure(s) with local fallback: ${recoverableAssets.join(' | ')}`)}
  c.close();console.log('Action Center and contextual Quick Add rendered QA passed.');
}finally{child.kill('SIGTERM')}
