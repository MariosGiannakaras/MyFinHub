import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for Lending remediation QA.');
const port=9248;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-lending-remediation-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Lending remediation QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=async(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async(state='')=>{const url=new URL(baseUrl);url.searchParams.set('page','lending');if(state)url.searchParams.set('state',state);await c.send('Page.navigate',{url:url.href});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Δανεικά / Οφειλές')&&Boolean(document.querySelector('.lending-approved-layout'))}",'Lending desktop');await sleep(100)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const state=()=>c.call(`function(){const layout=document.querySelector('.lending-approved-layout'),people=document.querySelector('.lending-people-panel'),detail=document.querySelector('.lending-detail-stack'),table=document.querySelector('.lending-approved-table'),quick=document.querySelector('.lending-quick-action.lending'),lent=document.querySelector('.receivable-action.lent'),root=getComputedStyle(document.documentElement);const rect=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width,height:r.height}:null};return {layout:rect(layout),people:rect(people),detail:rect(detail),table:rect(table),personCount:document.querySelectorAll('.lending-person-row').length,sparse:people?.classList.contains('is-sparse')||false,rowAvatarText:[...document.querySelectorAll('.lending-person-avatar')].map(node=>(node.textContent||'').trim()),selectedAvatarText:(document.querySelector('.lending-selected-avatar')?.textContent||'').trim(),hiddenNames:document.querySelectorAll('.lending-person-copy b.private-text,.lending-selected-identity h2.private-text').length,quickBg:quick?getComputedStyle(quick).backgroundColor:'',quickColor:quick?getComputedStyle(quick).color:'',lentBg:lent?getComputedStyle(lent).backgroundColor:'',lentColor:lent?getComputedStyle(lent).color:'',errorBg:root.getPropertyValue('--error-bg').trim(),error:root.getPropertyValue('--error').trim(),accentSoft:root.getPropertyValue('--accent-soft').trim(),accent:root.getPropertyValue('--accent').trim(),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}`);
  const togglePrivacy=async()=>{const ok=await c.call("function(){const button=[...document.querySelectorAll('.lending-selected-toolbar button')].find(node=>(node.textContent||'').includes('Εμφάνιση στοιχείων')||(node.textContent||'').includes('Απόκρυψη'));button?.click();return Boolean(button)}");assert(ok,'privacy toggle is reachable');await sleep(80)};
  const setTheme=async theme=>{await c.call("async function(theme){localStorage.setItem('myfinhub.theme',theme);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(theme);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}",[theme])};

  console.log('Lending remediation QA: sparse hidden state');
  await viewport(1440,1000);await navigate('');
  let current=await state();
  if(current.personCount<=2)assert(current.sparse,'low-person-count desktop state receives the deliberate sparse treatment');
  assert(current.rowAvatarText.every(text=>text==='')&&current.selectedAvatarText===''&&current.hiddenNames>=2,'privacy-hidden state masks avatar initials together with identity text');
  assert(current.layout.width<=1501&&current.people.width<=381&&current.overflow<=1,'1440 master/detail remains bounded and overflow-safe');
  await shot('lending-hidden-light-1440');

  console.log('Lending remediation QA: visible identity and direction semantics');
  await togglePrivacy();current=await state();
  assert(current.rowAvatarText.some(text=>text.length>0)&&current.selectedAvatarText.length>0&&current.hiddenNames===0,'privacy-visible state restores initials and identity text');
  assert(current.quickBg!==current.errorBg&&current.quickColor!==current.error&&current.lentBg!==current.errorBg&&current.lentColor!==current.error,'ordinary lending direction is not styled as destructive/error');
  await shot('lending-visible-light-1440');

  console.log('Lending remediation QA: rich wide desktop geometry');
  for(const width of [1920,2560]){await viewport(width,1200);await navigate('lending-rich');current=await state();assert(current.personCount>=5,'rich fixture renders multiple people');assert(current.layout.width<=1501&&current.people.width<=381&&current.detail.width>700&&current.table.width<=1121&&current.overflow<=1,`${width}px master/detail and history remain bounded without page overflow`);await shot(`lending-rich-hidden-${width}`)}

  console.log('Lending remediation QA: future repayments never settle current balances');
  await viewport(1440,1000);await navigate('lending-rich');
  const readCurrent=()=>c.call("function(){const text=s=>(document.querySelector(s)?.textContent||'').replace(/\\s+/g,' ').trim();return {people:text('.lending-people-list'),detail:text('.lending-selected-panel'),history:text('.lending-approved-table'),rows:document.querySelectorAll('.lending-approved-table tbody tr').length}}");
  const beforeFuture=await readCurrent();
  await navigate('lending-future');const afterFuture=await readCurrent();
  assert(JSON.stringify(beforeFuture)===JSON.stringify(afterFuture),'future-dated repayments or lending must not change the current receivables or visible history');
  await shot('lending-future-dated-events-ignored');

  console.log('Lending remediation QA: confirmed settlement plan is nonposting and reversible');
  await viewport(1440,1000);await navigate('lending-rich');
  const actualBefore=await c.call("function(){return document.querySelector('.lending-metric-grid article b')?.textContent||''}");
  const openPlan=await c.call("function(){const button=[...document.querySelectorAll('.lending-quick-panel button')].find(node=>(node.textContent||'').includes('Πρόγραμμα επιστροφής'));button?.click();return Boolean(button&&!button.disabled)}");
  assert(openPlan,'selected borrower with outstanding offers plan action');
  await waitFor("function(){return Boolean(document.querySelector('[data-lending-plan-preview]'))}",'settlement editor');
  const beforeConsent=await c.call("function(){return {plan:document.querySelector('[data-lending-plan-preview]')?.textContent||'',checkbox:!!document.querySelector('.contextual-quick-modal input[type=checkbox]'),events:[...document.querySelectorAll('.lending-approved-table tbody tr')].length}}");
  assert(beforeConsent.checkbox&&beforeConsent.plan.includes('Καμία προγραμματισμένη δόση'),'plan explicitly explains no posting');
  await c.call("function(){[...document.querySelectorAll('.contextual-quick-modal footer button')].find(node=>(node.textContent||'').includes('Αποθήκευση προγράμματος'))?.click()}");
  await waitFor("function(){return (document.querySelector('#lending-plan-save-error')?.textContent||'').includes('Επιβεβαίωσε')}",'plan blocks unconfirmed save');
  await shot('lending-settlement-owner-confirmation-desktop');
  const consent=await c.call("function(){const check=document.querySelector('.contextual-quick-modal input[type=checkbox]');check?.click();return Boolean(check?.checked)}");
  assert(consent,'owner selected positive confirmation');
  await c.call("function(){[...document.querySelectorAll('.contextual-quick-modal footer button')].find(node=>(node.textContent||'').includes('Αποθήκευση προγράμματος'))?.click()}");
  await waitFor("function(){return !document.querySelector('[data-lending-plan-preview]')&&Boolean(document.querySelector('[data-confirmed-lending-plan]'))}",'confirmed plan persisted');
  const actualAfter=await c.call("function(){return document.querySelector('.lending-metric-grid article b')?.textContent||''}");
  assert(actualBefore===actualAfter,'saving a plan does not book phantom cash or change receivable');
  await shot('lending-settlement-saved-desktop');
  await c.call("function(){document.querySelector('button[aria-label=\"Αναίρεση τελευταίας αλλαγής\"]')?.click()}");
  await waitFor("function(){return !document.querySelector('[data-confirmed-lending-plan]')}",'one Undo removes planned state');
  await c.call("function(){document.querySelector('button[aria-label=\"Επαναφορά τελευταίας αναιρεμένης αλλαγής\"]')?.click()}");
  await waitFor("function(){return Boolean(document.querySelector('[data-confirmed-lending-plan]'))}",'one Redo restores planned state');
  await viewport(375,812);
  await waitFor("function(){return Boolean(document.querySelector('.receivable-person-grid .receivable-person-actions button'))}",'mobile lending actions');
  const mobilePlan=await c.call("function(){const button=[...document.querySelectorAll('.receivable-person-grid button')].find(node=>(node.textContent||'').includes('Πρόγραμμα επιστροφής'));button?.click();return Boolean(button)}");
  assert(mobilePlan,'mobile borrower card opens the same plan editor');
  await waitFor("function(){return Boolean(document.querySelector('[data-lending-plan-preview]'))}",'mobile plan editor');
  await waitFor("function(){const modal=document.querySelector('.lending-settlement-modal');if(!modal)return false;const backdrop=modal.closest('.modal-backdrop');return Number(getComputedStyle(modal).opacity)>=.999&&Number(getComputedStyle(backdrop).opacity)>=.999}",'settled fully opaque modal entrance');
  const mobileFit=await c.call("function(){const modal=document.querySelector('.lending-settlement-modal');const rect=modal?.getBoundingClientRect();const header=modal?.querySelector(':scope>header');const title=header?.querySelector('h2');const description=header?.querySelector('p');const headerRect=header?.getBoundingClientRect(),titleRect=title?.getBoundingClientRect(),descriptionRect=description?.getBoundingClientRect();const preview=modal?.querySelector('[data-lending-plan-preview]');const previewStyle=preview?getComputedStyle(preview):null;const labels=[...modal.querySelectorAll('.form-grid>label')];const labelDetails=labels.map(label=>{const caption=label.querySelector('span'),input=label.querySelector('input');const a=caption?.getBoundingClientRect(),b=input?.getBoundingClientRect();return {name:caption?.textContent||'',captionBottom:a?.bottom??null,inputTop:b?.top??null,separate:!a||!b||a.bottom<=b.top+2}});const rows=[...modal.querySelectorAll('.lending-plan-schedule li')];const rowDetails=rows.map(row=>({text:row.textContent||'',scrollWidth:row.scrollWidth,clientWidth:row.clientWidth,fit:row.scrollWidth<=row.clientWidth+1}));return {modalDisplay:modal?getComputedStyle(modal).display:'',modalScrollTop:modal?.scrollTop??-1,headerDisplay:header?getComputedStyle(header).display:'',headerFlexShrink:header?getComputedStyle(header).flexShrink:'',headerBounds:headerRect?{top:headerRect.top,bottom:headerRect.bottom,height:headerRect.height}:null,titleBounds:titleRect?{top:titleRect.top,bottom:titleRect.bottom,height:titleRect.height}:null,descriptionBounds:descriptionRect?{top:descriptionRect.top,bottom:descriptionRect.bottom,height:descriptionRect.height}:null,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,left:rect?.left??-1,right:rect?.right??9999,labelsSeparate:labelDetails.every(x=>x.separate),scheduleFits:rowDetails.every(x=>x.fit),previewDirection:previewStyle?.flexDirection||'',headerFits:Boolean(headerRect&&titleRect&&descriptionRect&&headerRect.top<=titleRect.top&&titleRect.bottom<=descriptionRect.top+1&&descriptionRect.bottom<=headerRect.bottom+1),labelDetails,rowDetails}}");
  // Persist evidence before assertions, including a failed assertion: the
  // first failed review head lacked its own diagnostic screenshot.
  await shot('lending-settlement-preview-mobile');
  console.log('Lending settlement mobile geometry: '+JSON.stringify(mobileFit));
  assert(mobileFit.overflow<=1&&mobileFit.left>=-1&&mobileFit.right<=376,'plan editor has no mobile horizontal overflow');
  assert(mobileFit.labelsSeparate&&mobileFit.scheduleFits&&mobileFit.previewDirection==='column','mobile plan labels and installment rows do not overlap or clip');
  assert(mobileFit.modalDisplay==='flex'&&mobileFit.headerFlexShrink==='0'&&mobileFit.headerFits,'mobile settlement title and explanatory subtitle remain readable without header overlap');
  await c.call("function(){[...document.querySelectorAll('.contextual-quick-modal footer button')].find(node=>(node.textContent||'').includes('Ακύρωση'))?.click()}");
  await waitFor("function(){return !document.querySelector('[data-lending-plan-preview]')}",'mobile editor closes without mutation');
  await viewport(1440,1000);
  console.log('Lending remediation QA: noncash writeoff needs explicit confirmation');
  const writeoffOpen=await c.call("function(){const button=[...document.querySelectorAll('.lending-quick-panel button')].find(node=>(node.textContent||'').includes('Διαγραφή απαίτησης'));button?.click();return Boolean(button&&!button.disabled)}");
  assert(writeoffOpen,'writeoff quick action remains available');
  await waitFor("function(){return Boolean(document.querySelector('[data-lending-writeoff]'))}",'noncash writeoff confirmation');
  const isNoncash=await c.call("function(){const dialog=document.querySelector('.contextual-quick-modal');return {account:!![...dialog.querySelectorAll('label>span')].find(node=>(node.textContent||'').includes('Πληρωμή από')),consent:!!dialog.querySelector('[data-lending-writeoff] input[type=checkbox]')}}");
  assert(!isNoncash.account&&isNoncash.consent,'writeoff contains no cash account and requires explicit confirmation');
  await c.call("function(){[...document.querySelectorAll('.contextual-quick-modal button')].find(node=>(node.textContent||'').includes('Επιβεβαίωση διαγραφής'))?.click()}");
  await waitFor("function(){return (document.querySelector('#context-quick-error')?.textContent||'').includes('Επιβεβαίωσε')}",'unconfirmed writeoff rejected');
  await shot('lending-writeoff-requires-owner-desktop');
  await c.call("function(){document.querySelector('[data-lending-writeoff] input[type=checkbox]')?.click()}");
  await c.call("function(){[...document.querySelectorAll('.contextual-quick-modal button')].find(node=>(node.textContent||'').includes('Επιβεβαίωση διαγραφής'))?.click()}");
  await waitFor("function(){return !document.querySelector('[data-lending-writeoff]')&&Boolean(document.querySelector('.receivable-action.forgiven'))}",'noncash writeoff history persisted');
  await shot('lending-writeoff-history-desktop');

  console.log('Lending remediation QA: dark privacy parity');
  await viewport(1440,1000);await navigate('lending-rich');await setTheme('dark');assert(await c.call("function(){return document.documentElement.dataset.theme==='dark'}"),'dark theme remains active after Lending navigation');current=await state();
  assert(current.rowAvatarText.every(text=>text==='')&&current.selectedAvatarText===''&&current.hiddenNames>=2,'dark privacy-hidden state masks all identity decoration');
  await shot('lending-hidden-dark-1440');
  await togglePrivacy();current=await state();
  assert(current.rowAvatarText.some(text=>text.length>0)&&current.hiddenNames===0,'dark privacy-visible state restores identity coherently');
  assert(current.quickBg!==current.errorBg&&current.lentBg!==current.errorBg,'dark routine lending direction remains non-destructive');
  await shot('lending-visible-dark-1440');

  c.close();console.log(`Lending remediation QA passed. Evidence: ${evidenceDir}`);
}finally{child.kill('SIGTERM')}
