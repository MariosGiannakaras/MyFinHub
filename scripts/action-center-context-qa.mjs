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
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
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
  const touchTargets=async label=>{const offenders=await c.call("function(){return [...document.querySelectorAll('#main-workspace button,#main-workspace summary,.mobile-nav button,.topbar button,.contextual-quick-modal button')].filter(el=>{const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden'||el.disabled)return false;return r.width<40||r.height<40}).map(el=>({name:el.getAttribute('aria-label')||(el.textContent||'').trim().slice(0,45),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}))}");assert(offenders.length===0,`${label} touch targets below 40px: ${JSON.stringify(offenders.slice(0,8))}`)};
  const clickText=async(selector,text)=>{const clicked=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(clicked,`missing clickable ${text}`)};
  const clickAttention=async(id)=>{const clicked=await c.call("function(id){const row=document.querySelector(`[data-attention-id=\"${CSS.escape(id)}\"]`);const button=row?.querySelector('.attention-actions .save-button');button?.click();return Boolean(button)}",[id]);assert(clicked,`missing attention action ${id}`)};
  const assertDialogSemantics=async title=>{assert(await c.call("function(title){const modal=document.querySelector('.contextual-quick-modal');if(!modal)return false;const labelled=modal.getAttribute('aria-labelledby');return modal.getAttribute('role')==='dialog'&&modal.getAttribute('aria-modal')==='true'&&Boolean(labelled)&&((document.getElementById(labelled)?.textContent||'').includes(title))}",[title]),`${title} dialog semantics`)};
  const waitModal=async title=>{await waitFor("function(title){const modal=document.querySelector('.contextual-quick-modal');return Boolean(modal&&(modal.querySelector('h2')?.textContent||'').includes(title))}",`${title} contextual modal`,[title]);assert(await c.call("function(){return document.querySelector('.contextual-quick-modal input[data-autofocus=true]')===document.activeElement}"),`${title} autofocus`);await assertDialogSemantics(title)};
  const closeModal=async()=>{const closed=await c.call("function(){const button=document.querySelector('.contextual-quick-modal button[aria-label*=\"Κλείσιμο\"]');button?.click();return Boolean(button)}");assert(closed,'context modal close control');await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'context modal close')};
  const closeGenericModal=async()=>{const closed=await c.call("function(){const button=document.querySelector('.quick-modal:not(.contextual-quick-modal) button[aria-label=\"Κλείσιμο καταχώρισης\"]');button?.click();return Boolean(button)}");assert(closed,'generic account context closes');await waitFor("function(){return !document.querySelector('.quick-modal')}",'generic account context close')};
  const pressEscape=async()=>{for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27})};
  const approvedAttentionState=()=>c.call("function(){const groups=[...document.querySelectorAll('.attention-approved-desktop>.attention-approved-group')].filter(group=>!group.classList.contains('legacy-confirmation-panel')).slice(0,4).map(group=>{const title=group.querySelector('h2')?.textContent||'',match=title.match(/\\((\\d+)\\)/),count=Number(match?.[1]||0),link=group.querySelector('.attention-approved-group-link'),head=group.querySelector('.attention-approved-table-head');return {count,hasLink:Boolean(link),expanded:link?.getAttribute('aria-expanded')??null,hasTableHead:Boolean(head),emptyClass:group.classList.contains('is-empty'),height:group.getBoundingClientRect().height}});const rows=[...document.querySelectorAll('.attention-approved-desktop .attention-approved-row')],row=rows[0],primary=row?.querySelector('.attention-approved-actions>.save-button'),secondary=row?.querySelector('.attention-approved-icon-action'),reason=row?.querySelector('.attention-approved-copy>p'),context=row?.querySelector('.attention-approved-context'),dateSmall=row?.querySelector('.attention-approved-date>small'),table=document.querySelector('.attention-approved-table-head'),tableRect=table?.getBoundingClientRect(),style=node=>node?getComputedStyle(node):null,total=groups.reduce((sum,g)=>sum+g.count,0),danger=groups[0]?.count||0,clear=document.querySelector('.attention-approved-all-clear');return {groups,total,danger,allClearText:clear?.textContent||'',tableWidth:tableRect?.width||0,primaryBg:style(primary)?.backgroundColor||'',secondaryBg:style(secondary)?.backgroundColor||'',secondaryShadow:style(secondary)?.boxShadow||'',reasonSize:parseFloat(style(reason)?.fontSize||'0'),contextSize:parseFloat(style(context)?.fontSize||'0'),dateSize:parseFloat(style(dateSmall)?.fontSize||'0')}}");

  console.log('Action Center QA: desktop hierarchy, privacy and deterministic queue');
  await navigate('attention');
  assert(await c.call("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Έλεγχος')}") ,'attention heading');
  assert((await c.call("function(){return document.querySelectorAll('.attention-summary-grid>article').length}"))===3,'three severity summary cards');
  assert((await c.call("function(){return document.querySelectorAll('.attention-row').length}"))>0,'attention queue has actionable items');
  assert(await c.call("function(){return Boolean(document.querySelector('[data-legacy-confirmation-panel]'))}"),'legacy confirmation is integrated into Έλεγχος');
  assert(await c.call("function(){const toggle=document.querySelector('.attention-page .privacy-toggle');return toggle?.getAttribute('aria-pressed')==='false'}") ,'privacy starts hidden');
  await clickText('.attention-page .privacy-toggle','Εμφάνιση ποσών');
  assert(await c.call("function(){return document.querySelector('.attention-page .privacy-toggle')?.getAttribute('aria-pressed')==='true'}"),'privacy toggle exposes values only on request');
  const approved=await approvedAttentionState();assert(approved.groups.length===4,'desktop keeps exactly the four approved priority groups');assert(approved.groups.every(group=>group.count>4?group.hasLink:!group.hasLink),'Προβολή όλων exists only when a group actually truncates rows');assert(approved.groups.every(group=>group.count===0?group.emptyClass&&!group.hasTableHead:true),'zero-count groups stay discoverable without a table header shell');assert(approved.allClearText.includes('Όλα υπό έλεγχο!')===(approved.total===0),'true all-clear language appears only with zero active actionable items');assert(approved.primaryBg!==approved.secondaryBg&&approved.secondaryShadow==='none','row domain action remains primary while snooze/dismiss controls are visually quiet');assert(approved.reasonSize>=9&&approved.contextSize>=9&&approved.dateSize>=9,`desktop dense Attention text remains readable: ${JSON.stringify(approved)}`);
  await noOverflow('attention desktop');await noUnnamed('attention desktop');await screenshot('action-center-desktop');
  for(const [width,height,label] of [[1920,1080,'1920'],[2560,1440,'2560']]){await navigate('attention','',width,height);const wide=await approvedAttentionState();assert(wide.tableWidth<=1481,`${label}px Attention table measure is bounded: ${JSON.stringify(wide)}`);await noOverflow(`attention wide ${label}`);await screenshot(`action-center-wide-${label}`)}

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
  await clickAttention('recurring:rec-1');await waitModal('Πληρωμή παγίου');
  assert(await c.call("function(){return [...document.querySelectorAll('.contextual-quick-modal input')].some(input=>String(input.value).length>0)}"),'recurring context carries defaults');
  await pressEscape();await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'recurring Escape close');
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
  await clickText('.contextual-quick-modal .save-button','Ολοκλήρωση');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'scheduled completion close');
  await waitFor("function(){return !document.querySelector('[data-attention-id=\"scheduled:qa-scheduled-transfer\"]')}",'completed scheduled attention removal');
  assert(await c.call("function(){return Boolean(document.querySelector('.top-actions button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]'))}"),'undo remains available after atomic completion');

  console.log('Action Center QA: account, savings and lending invocation contexts');
  await navigate('dashboard');
  const payrollOpened=await c.call("function(){const node=document.querySelector('[data-account-id=\"piraeus-payroll\"] [data-account-quick-entry=\"piraeus-payroll\"]');node?.click();return Boolean(node)}");assert(payrollOpened,'dashboard payroll quick action');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'payroll account-context generic quick add');
  assert(await c.call("function(){return [...document.querySelectorAll('.quick-modal:not(.contextual-quick-modal) input[role=combobox]')].some(input=>(input.value||'').includes('Μισθοδοσία'))}"),'payroll context preselects originating payroll account');
  await closeGenericModal();
  const cashOpened=await c.call("function(){const node=document.querySelector('[data-account-id=\"cash\"] [data-account-quick-entry=\"cash\"]');node?.click();return Boolean(node)}");assert(cashOpened,'dashboard cash quick action');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}",'cash account-context generic quick add');
  assert(await c.call("function(){return [...document.querySelectorAll('.quick-modal:not(.contextual-quick-modal) input[role=combobox]')].some(input=>(input.value||'').includes('Μετρητά'))}"),'cash context preselects originating cash account');
  await closeGenericModal();

  await navigate('savings');await clickText('.savings-action','Μεταφορά στην άκρη');await waitModal('Μεταφορά στην αποταμίευση');
  const before=await c.call("function(){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value||''}");
  const openedSelect=await c.call("function(){const input=document.querySelector('.contextual-quick-modal input[role=combobox]');input?.click();return Boolean(input)}");assert(openedSelect,'savings source selector opens');
  await waitFor("function(){return Boolean(document.querySelector('.owned-select-popover [role=listbox]'))}",'savings owned select');
  const changed=await c.call("function(before){const options=[...document.querySelectorAll('.owned-select-popover [role=option]')];const option=options.find(node=>(node.textContent||'').trim()!==before&&!node.disabled);option?.click();return Boolean(option)}",[before]);assert(changed,'user can change contextual account selection');
  await waitFor("function(before){const value=document.querySelector('.contextual-quick-modal input[role=combobox]')?.value||'';return Boolean(value&&value!==before)}",'savings selection update',[before]);
  const after=await c.call("function(){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value||''}");await sleep(160);assert(await c.call("function(expected){return document.querySelector('.contextual-quick-modal input[role=combobox]')?.value===expected}",[after]),'user-changed selection is not overwritten after open');await closeModal();

  await navigate('lending');await clickText('.receivable-person-actions button','Επιστροφή');await waitModal('Επιστροφή δανεικών');
  assert(await c.call("function(){const values=[...document.querySelectorAll('.contextual-quick-modal input')].map(input=>input.value);return values.includes('Νίκος')&&values.includes('50')}"),'lending context carries exact person and outstanding amount');await closeModal();

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
