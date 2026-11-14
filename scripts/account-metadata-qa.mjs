import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-account-metadata-qa';mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for account metadata QA.');
const port=9250;
const profile='/tmp/myfinhub-account-metadata-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const fn of this.listeners.get(message.method)||[])fn(message.params)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Account metadata QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];
  c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
  c.on('Network.loadingFailed',params=>{if(!params.canceled&&params.errorText!=='net::ERR_ABORTED')failedRequests.push(`${params.errorText||'network failure'} [${params.type||'unknown'}]`)});
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const press=async(key,code,vk)=>{await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:vk});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk})};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const navigate=async page=>{const url=new URL(baseUrl);url.searchParams.set('page',page);await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.readyState==='complete'||document.readyState==='interactive'}",`${page} document`)};
  const scrollTo=async selector=>{const ok=await c.call("function(selector){const node=document.querySelector(selector);node?.scrollIntoView({block:'start',inline:'nearest'});return Boolean(node)}",[selector]);assert(ok,`missing scroll target ${selector}`);await sleep(160)};
  const noOverflow=async label=>{const overflow=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(overflow<=1,`${label} horizontal overflow ${overflow}px`)};
  const touchTargets=async(label,selector,min=40)=>{const offenders=await c.call("function(selector,min){return [...document.querySelectorAll(selector)].filter(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);if(!r.width||!r.height||style.visibility==='hidden'||style.display==='none'||el.disabled)return false;return r.width<min||r.height<min}).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {label:el.getAttribute('aria-label')||(el.textContent||'').trim().slice(0,40),width:r.width,height:r.height,layoutWidth:el.offsetWidth,layoutHeight:el.offsetHeight,cssWidth:s.width,cssHeight:s.height}})}",[selector,min]);assert(offenders.length===0,`${label} touch targets below ${min}px: ${JSON.stringify(offenders)}`)};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));node?.click();return Boolean(node)}",[selector,text]);assert(ok,`missing clickable ${text}`)};
  const trustedClick=async selector=>{const point=await c.call("function(selector){const node=document.querySelector(selector);if(!node)return null;node.scrollIntoView({block:'nearest',inline:'nearest'});const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}}",[selector]);assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),`missing trusted-click control ${selector}`);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1})};
  const expandedHitClick=async selector=>{const point=await c.call("function(selector){const node=document.querySelector(selector);if(!node)return null;node.scrollIntoView({block:'nearest',inline:'nearest'});const r=node.getBoundingClientRect();const x=r.right-4;const y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);const compactRadius=13;const outsideCompact=Math.abs(x-(r.left+r.width/2))>compactRadius;return {x,y,width:r.width,height:r.height,outsideCompact,hit:Boolean(hit?.closest(selector))}}",[selector]);assert(point&&point.width>=47.5&&point.height>=47.5&&point.outsideCompact&&point.hit,`expanded desktop hit area missing for ${selector}: ${JSON.stringify(point)}`);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1})};
  const openPayrollEditor=async()=>{
    const opened=await c.call("function(){const row=[...document.querySelectorAll('.account-management-row')].find(item=>(item.textContent||'').includes('Μισθοδοσία'));const button=row?.querySelector('.account-management-edit');if(!button)return false;button.click();return true}");
    assert(opened,'payroll Account Management editor opens');
    await waitFor("function(){return Boolean(document.querySelector('.account-management-modal.is-edit'))}",'payroll Account Management edit modal');
    await sleep(240);
  };
  const editIban=async value=>{const changed=await c.call("function(value){const modal=document.querySelector('.account-management-modal.is-edit');const field=[...(modal?.querySelectorAll('.account-management-field')||[])].find(item=>(item.textContent||'').includes('IBAN'));const input=field?.querySelector('input');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}",[value]);assert(changed,'Account Management IBAN input accepts edit')};
  const currentEditIban=()=>c.call("function(){const modal=document.querySelector('.account-management-modal.is-edit');const field=[...(modal?.querySelectorAll('.account-management-field')||[])].find(item=>(item.textContent||'').includes('IBAN'));const input=field?.querySelector('input');return input instanceof HTMLInputElement?input.value:''}");
  const closeEditor=async()=>{const closed=await c.call("function(){const button=document.querySelector('.account-management-modal.is-edit button[aria-label=\"Κλείσιμο\"]');if(!button)return false;button.click();return true}");assert(closed,'Account Management editor closes');await waitFor("function(){return !document.querySelector('.account-management-modal.is-edit')}",'Account Management editor close')};

  console.log('Account metadata QA: Dashboard configured, missing and copyable IBAN');
  await viewport(1440,1000);await navigate('dashboard');
  await waitFor("function(){return Boolean(document.querySelector('[data-account-iban=\"piraeus-payroll\"]'))}",'dashboard IBAN');
  const dashboardState=await c.call("function(){const payroll=document.querySelector('[data-account-iban=\"piraeus-payroll\"]')?.textContent||'';const cash=document.querySelector('[data-account-iban=\"cash\"]')?.textContent||'';const copy=document.querySelector('.primary-balance-card[data-account-id=\"piraeus-payroll\"] .account-iban-copy');const rect=copy?.getBoundingClientRect();const style=copy?getComputedStyle(copy):null;return {payroll,cash,copies:document.querySelectorAll('.account-iban-copy').length,copyOpacity:Number(style?.opacity||0),copyVisible:Boolean(copy&&rect&&rect.width>=47.5&&rect.height>=47.5&&style?.display!=='none'&&style?.visibility!=='hidden')}}");
  assert(dashboardState.payroll.includes('GR16 •••• •••• •••• 0695'),'configured payroll IBAN is masked on Dashboard');
  assert(!dashboardState.payroll.includes('0110 1250 0000 0001 2300 695'),'Dashboard does not expose the full payroll IBAN');
  assert(dashboardState.cash.includes('Πορτοφόλι'),'cash account uses a wallet label instead of implying a missing IBAN');
  assert(dashboardState.copies>=2,'configured IBANs expose copy controls');
  assert(dashboardState.copyVisible&&dashboardState.copyOpacity>=.99,'wide-desktop Dashboard keeps the 48px IBAN copy affordance visibly discoverable before hover/focus');
  await expandedHitClick('.primary-balance-card[data-account-id="piraeus-payroll"] .account-iban-copy');
  await waitFor("function(){return Boolean(document.querySelector('.primary-balance-card[data-account-id=\"piraeus-payroll\"] [role=status]'))}",'copy confirmation through expanded desktop hit area');
  await noOverflow('account metadata dashboard desktop');await screenshot('account-metadata-dashboard-desktop');
  console.log('Account metadata QA: denied clipboard and false legacy fallback must show error, not success');
  const clipboardOverride=await c.call("function(){const own=Object.getOwnPropertyDescriptor(navigator,'clipboard'),original=document.execCommand;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('QA clipboard rejected'))}});document.execCommand=()=>false;window.__qaRestoreIbanCopy=()=>{if(own)Object.defineProperty(navigator,'clipboard',own);else delete navigator.clipboard;document.execCommand=original};return true}");
  assert(clipboardOverride,'clipboard denial fixture installed');
  try{
    await expandedHitClick('.primary-balance-card[data-account-id="piraeus-payroll"] .account-iban-copy');
    await waitFor("function(){return Boolean(document.querySelector('.primary-balance-card[data-account-id=\"piraeus-payroll\"] [role=alert]'))}",'failed clipboard has accessible alert');
    const copyFailure=await c.call("function(){const root=document.querySelector('.primary-balance-card[data-account-id=\"piraeus-payroll\"]');return {error:root?.querySelector('[role=alert]')?.textContent||'',falseSuccess:Boolean(root?.querySelector('[role=status]')),errorControl:root?.querySelector('.account-iban-copy')?.getAttribute('data-copy-error')==='true',leakedField:[...document.querySelectorAll('textarea')].some(node=>node.value.includes('GR1601101250000000012300695'))}}");
    assert(copyFailure.error.includes('απέτυχε')&&copyFailure.errorControl&&!copyFailure.falseSuccess&&!copyFailure.leakedField,'copy rejection never reports success or leaves account identifier in a temporary field');
    await screenshot('account-metadata-clipboard-denied-desktop');
  }finally{
    await c.call("function(){window.__qaRestoreIbanCopy?.();delete window.__qaRestoreIbanCopy;return true}");
  }


  console.log('Account metadata QA: Account Management edit saves IBAN independently');
  await navigate('settings');await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'settings tabs');
  await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'Account Management settings');
  await scrollTo('.account-management-settings');await openPayrollEditor();
  console.log('Account provider radio group supports roving keyboard and one Tab stop');
  const originalRadio=await c.call("function(){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')];const index=nodes.findIndex(node=>node.getAttribute('aria-checked')==='true');if(index<0||nodes.length<2)return {count:nodes.length,index};nodes[index].focus();return {count:nodes.length,index}}");
  assert(originalRadio.index>=0&&originalRadio.count>1,'payroll opens with a selected, focusable bank radio');
  const radioState=()=>c.call("function(){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')],index=nodes.findIndex(node=>node.getAttribute('aria-checked')==='true');return {index,focused:nodes.indexOf(document.activeElement),stops:nodes.filter(node=>node.tabIndex===0).length}}");
  await press('ArrowRight','ArrowRight',39);
  await waitFor("function(index){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')],next=(index+1)%nodes.length;return nodes[next]?.getAttribute('aria-checked')==='true'&&document.activeElement===nodes[next]}",'provider ArrowRight moves selection and focus',[originalRadio.index]);
  await press('ArrowUp','ArrowUp',38);
  await waitFor("function(index){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')];return nodes[index]?.getAttribute('aria-checked')==='true'&&document.activeElement===nodes[index]}",'provider ArrowUp restores selection',[originalRadio.index]);
  const state=await radioState();
  assert(state.stops===1&&state.index===originalRadio.index&&state.focused===originalRadio.index,'roving provider keyboard leaves one sequential Tab stop');
  await press('End','End',35);
  await waitFor("function(){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')];return nodes.at(-1)?.getAttribute('aria-checked')==='true'}",'provider End selects final item');
  await press('Home','Home',36);
  await waitFor("function(){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')];return nodes[0]?.getAttribute('aria-checked')==='true'}",'provider Home selects first item');

  await press('A','KeyA',65);
  await waitFor("function(){const radio=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')].find(node=>(node.textContent||'').includes('Alpha Bank'));return radio?.getAttribute('aria-checked')==='true'&&document.activeElement===radio}",'provider Latin A typeahead selects Alpha Bank');
  await press('Ε','KeyE',69);
  await waitFor("function(){const radio=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')].find(node=>(node.textContent||'').includes('Εθνική Τράπεζα'));return radio?.getAttribute('aria-checked')==='true'&&document.activeElement===radio}",'provider Greek Ε typeahead selects Εθνική');
  assert(await c.call("function(index){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')];return Boolean(nodes[index]&&(nodes[index].click()||true))}",[originalRadio.index]),'restore original provider before finance IBAN save');
  await waitFor("function(index){const nodes=[...document.querySelectorAll('.account-management-provider-picker [role=radio]')];return nodes[index]?.getAttribute('aria-checked')==='true'}",'original provider restored',[originalRadio.index]);
  assert((await currentEditIban()).includes('GR16'),'Account Management loads the current payroll IBAN');
  await editIban('GB82 WEST 1234 5698 7654 32');
  console.log('Account durable save single-flight blocks same-tick repeated submit before React busy re-render');
  const beforeDurable=await c.call("function(){return Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}");
  const saved=await c.call("function(){const button=document.querySelector('.account-management-modal.is-edit .save-button');if(!button)return false;button.click();button.click();return true}");assert(saved,'Account Management saves edited IBAN once on repeated activation');
  await waitFor("function(){return !document.querySelector('.account-management-modal.is-edit')&&((document.querySelector('.account-management-message')?.textContent||'').includes('Οι αλλαγές του λογαριασμού αποθηκεύτηκαν.'))}",'Account Management save confirmation');
  const afterDurable=await c.call("function(){return Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}");
  assert(afterDurable===beforeDurable+1,'same-tick double activation produces one durable account settings revision, not two: '+JSON.stringify({beforeDurable,afterDurable}));
  await openPayrollEditor();assert((await currentEditIban())==='GB82 WEST 1234 5698 7654 32','saved IBAN stays normalized and human-readable');
  const providerChanged=await c.call("function(){const button=[...document.querySelectorAll('.account-management-modal.is-edit .account-management-provider-picker [role=radio]')].find(item=>(item.textContent||'').includes('Alpha Bank'));button?.click();return Boolean(button)}");assert(providerChanged,'existing account provider can be corrected');
  const saveProvider=await c.call("function(){const button=document.querySelector('.account-management-modal.is-edit .save-button');button?.click();return Boolean(button)}");assert(saveProvider,'provider correction saves');
  await waitFor("function(){const row=[...document.querySelectorAll('.account-management-row')].find(item=>(item.textContent||'').includes('Μισθοδοσία'));return Boolean(row&&(row.textContent||'').includes('Alpha Bank')&&row.querySelector('[data-bank-brand=alpha]'))}",'provider correction reflected in account row');
  await openPayrollEditor();const alphaSelected=await c.call("function(){const button=[...document.querySelectorAll('.account-management-modal.is-edit .account-management-provider-picker [role=radio]')].find(item=>(item.textContent||'').includes('Alpha Bank'));return button?.getAttribute('aria-checked')==='true'}");assert(alphaSelected,'corrected provider reloads in edit mode');
  await screenshot('account-metadata-settings-desktop');await closeEditor();await noOverflow('account metadata settings desktop');

  console.log('Account metadata QA: failed durable finance write never commits IBAN metadata');
  const failUrl=new URL(baseUrl);failUrl.searchParams.set('page','settings');failUrl.searchParams.set('account-save-failure','1');
  await c.send('Page.navigate',{url:failUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'failing Settings fixture');
  await clickText('.settings-tablist button','Λογαριασμοί');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'failing Account Management fixture');
  await scrollTo('.account-management-settings');await openPayrollEditor();
  const beforeFailedSave=await currentEditIban();
  await editIban('GB82 WEST 1234 5698 7654 32');
  await clickText('.account-management-modal.is-edit button','Αποθήκευση');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-modal.is-edit .account-management-editor-error'))}",'durable finance failure keeps editor and shows error');
  const failure=await c.call("function(){const modal=document.querySelector('.account-management-modal.is-edit');return {open:Boolean(modal),error:(modal?.querySelector('.account-management-editor-error')?.textContent||''),message:(document.querySelector('.account-management-message')?.textContent||'')}}");
  assert(failure.open&&failure.error.includes('απέτυχε')&&!failure.message.includes('αποθηκεύτηκαν'),'failed durable finance write never reports successful account save');
  await screenshot('account-metadata-durable-save-failure');
  await closeEditor();await openPayrollEditor();
  assert((await currentEditIban())===beforeFailedSave,'failed finance write did not mutate IBAN metadata');
  await closeEditor();

  console.log('Account metadata QA: stale delete confirmation cannot erase newly referenced finance account');
  const deleteRaceUrl=new URL(baseUrl);deleteRaceUrl.searchParams.set('page','settings');deleteRaceUrl.searchParams.set('state','account-delete-race');
  await c.send('Page.navigate',{url:deleteRaceUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'account deletion race Settings');
  await clickText('.settings-tablist button','Λογαριασμοί');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-row[data-account-id=\"qa-account-delete-race\"]'))}",'custom account still unreferenced');
  const deleteOpened=await c.call("function(){const button=document.querySelector('.account-management-row[data-account-id=\"qa-account-delete-race\"] button[aria-label^=\"Διαγραφή\"]');button?.click();return Boolean(button)}");
  assert(deleteOpened,'custom unreferenced account can request confirmation before a concurrent write');
  await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog[role=alertdialog]'))}",'unreferenced delete confirmation');
  const beforeDeleteWrites=await c.call("function(){return Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}");
  const injected=await c.call("function(){return globalThis.__myfinhubQaInjectAccountReference?.()===true}");
  assert(injected,'QA-only concurrent reference injection exists');
  await waitFor("function(){return document.documentElement.dataset.qaAccountReferenceApplied==='true'}",'late finance reference applied before confirm');
  await clickText('.app-confirm-dialog button','Διαγραφή');
  await waitFor("function(){return !document.querySelector('.app-confirm-dialog')&&Boolean(document.querySelector('.account-management-message[data-feedback-tone=warning]'))}",'stale confirm rejected without deleting referenced account');
  const blockedDelete=await c.call("function(){const warning=document.querySelector('.account-management-message[data-feedback-tone=warning]');return {warning:(warning?.textContent||'').trim(),role:warning?.getAttribute('role'),accountPresent:Boolean(document.querySelector('.account-management-row[data-account-id=\"qa-account-delete-race\"]')),durableWrites:Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}}");
  assert(blockedDelete.role==='alert'&&blockedDelete.warning.includes('οικονομικές κινήσεις')&&blockedDelete.accountPresent&&blockedDelete.durableWrites===beforeDeleteWrites,'late-referenced account remains intact, warning announces blocked deletion, no second finance write: '+JSON.stringify(blockedDelete));
  await scrollTo('.account-management-message');await screenshot('account-delete-late-reference-blocked-desktop');

  console.log('Account metadata QA: pending account save locks every editor/default/list control');
  await viewport(375,812);
  const pendingUrl=new URL(baseUrl);pendingUrl.searchParams.set('page','settings');pendingUrl.searchParams.set('account-save-pending','1');
  await c.send('Page.navigate',{url:pendingUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'pending account save Settings fixture');
  await clickText('.settings-tablist button','Λογαριασμοί');
  await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'pending account settings');
  await scrollTo('.account-management-settings');await openPayrollEditor();
  await editIban('GB82 WEST 1234 5698 7654 32');
  const pendingBefore=await currentEditIban();
  await clickText('.account-management-modal.is-edit button','Αποθήκευση');
  await waitFor("function(){return Boolean(globalThis.__myfinhubQaCompleteAccountReceipt&&document.querySelector('.account-management-modal.is-edit .save-button:disabled'))}",'pending durable account save');
  const pendingLock=await c.call("function(){const modal=document.querySelector('.account-management-modal.is-edit'),actions=document.querySelector('.account-management-list-head .account-management-create'),editor=[...(modal?.querySelectorAll('input,button')||[])],defaults=[...document.querySelectorAll('.account-management-default-grid .owned-select-shell input')],rows=[...document.querySelectorAll('.account-management-row-actions button')],iban=[...(modal?.querySelectorAll('.account-management-field input')||[])].find(input=>input.value.includes('GB82'));return {editorCount:editor.length,editorDisabled:editor.every(node=>node.disabled),defaults:defaults.length,defaultsDisabled:defaults.every(node=>node.disabled),rows:rows.length,rowsDisabled:rows.every(node=>node.disabled),addDisabled:actions?.disabled===true,iban:iban?.value||'',writeCount:Number(document.documentElement.dataset.qaSettingsDurableWrites||0),overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth}}");
  assert(pendingLock.editorCount>=7&&pendingLock.editorDisabled&&pendingLock.defaults===3&&pendingLock.defaultsDisabled&&pendingLock.rows>0&&pendingLock.rowsDisabled&&pendingLock.addDisabled,'pending account receipt locks all editor/default/list controls: '+JSON.stringify(pendingLock));
  assert(pendingLock.iban===pendingBefore&&pendingLock.writeCount===0&&pendingLock.overflow<=1,'pending account save leaves actual draft and finance revision unchanged at 375px: '+JSON.stringify(pendingLock));
  await screenshot('account-metadata-pending-locked-mobile-375');
  const released=await c.call("function(){const complete=globalThis.__myfinhubQaCompleteAccountReceipt;if(typeof complete!=='function')return false;delete globalThis.__myfinhubQaCompleteAccountReceipt;complete();return true}");
  assert(released,'one pending finance acknowledgment released');
  await waitFor("function(){return !document.querySelector('.account-management-modal.is-edit')&&Number(document.documentElement.dataset.qaSettingsDurableWrites||0)===1}",'single pending account revision acknowledged');
  assert((await c.call("function(){return (document.querySelector('.account-management-message')?.textContent||'').includes('Οι αλλαγές του λογαριασμού αποθηκεύτηκαν.')}")),'account success reported only after pending revision');
  console.log('Account metadata QA: mobile Dashboard keeps masked IBAN and copy target');
  await viewport(375,812);await navigate('dashboard');await waitFor("function(){return Boolean(document.querySelector('[data-account-iban=\"piraeus-payroll\"]'))}",'mobile dashboard IBAN');
  await scrollTo('.primary-balance-grid');await noOverflow('account metadata dashboard mobile');await touchTargets('account metadata dashboard mobile','.primary-balance-grid .account-iban-copy',48);
  const mobilePayroll=await c.call("function(){return document.querySelector('[data-account-iban=\"piraeus-payroll\"]')?.textContent||''}");assert(mobilePayroll.includes('GR16 •••• •••• •••• 0695'),'fresh mobile QA route keeps the payroll IBAN masked');assert(!mobilePayroll.includes('0110 1250 0000 0001 2300 695'),'mobile Dashboard does not expose the full payroll IBAN');
  await screenshot('account-metadata-dashboard-mobile');

  console.log('Account metadata QA: mobile Account Management editor stays usable');
  await navigate('settings');await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'mobile settings tabs');
  await clickText('.settings-tablist button','Λογαριασμοί');await waitFor("function(){return Boolean(document.querySelector('.account-management-settings'))}",'mobile Account Management settings');
  await scrollTo('.account-management-settings');await noOverflow('account metadata settings mobile');await touchTargets('account metadata settings mobile','.account-management-settings button,.account-management-settings [role=combobox]');
  await openPayrollEditor();await noOverflow('account metadata edit modal mobile');await touchTargets('account metadata edit modal mobile','.account-management-modal.is-edit button,.account-management-modal.is-edit .account-management-field input');await screenshot('account-metadata-settings-mobile');await closeEditor();
  await viewport(320,700);await scrollTo('.account-management-settings');await noOverflow('account metadata settings narrow mobile');await touchTargets('account metadata settings narrow mobile','.account-management-settings button,.account-management-settings [role=combobox]');

  console.log('Account metadata QA: 320px account editor keeps keyboard, invalid IBAN error and actions contained');
  await openPayrollEditor();await noOverflow('account metadata edit modal narrow mobile');
  const narrowBounds=await c.call("function(){const modal=document.querySelector('.account-management-modal.is-edit'),r=modal?.getBoundingClientRect();return {x:r?.left??-1,right:r?.right??999,width:r?.width??0,focused:Boolean(modal?.contains(document.activeElement)),viewport:innerWidth}}");
  assert(narrowBounds.x>=-1&&narrowBounds.right<=narrowBounds.viewport+1&&narrowBounds.width>=260&&narrowBounds.focused,'320px account form stays in viewport with initial focus inside: '+JSON.stringify(narrowBounds));
  await press('Tab','Tab',9);
  assert(await c.call("function(){return Boolean(document.querySelector('.account-management-modal.is-edit')?.contains(document.activeElement))}"),'320px account editor Tab retains focus within the modal');
  const narrowBeforeWrites=await c.call("function(){return Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}");
  await editIban('INVALID-IBAN-000');
  await clickText('.account-management-modal.is-edit button','Αποθήκευση');
  await waitFor("function(){return (document.querySelector('.account-management-modal.is-edit [role=alert]')?.textContent||'').includes('Έλεγξε το IBAN')}","320px invalid IBAN validation alert");
  const narrowInvalid=await c.call("function(){const modal=document.querySelector('.account-management-modal.is-edit'),alert=modal?.querySelector('[role=alert]'),footer=modal?.querySelector('.account-management-modal-footer');alert?.scrollIntoView({block:'center'});const r=alert?.getBoundingClientRect(),m=modal?.getBoundingClientRect(),f=footer?.getBoundingClientRect();return {error:alert?.textContent||'',alertVisible:Boolean(r&&m&&f&&r.top>=m.top-1&&r.bottom<=f.top+1),footerVisible:Boolean(f&&f.top>=0&&f.bottom<=innerHeight+1),modalBounded:Boolean(m&&m.left>=-1&&m.right<=innerWidth+1),writeCount:Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}}");
  assert(narrowInvalid.error.includes('Έλεγξε το IBAN')&&narrowInvalid.alertVisible&&narrowInvalid.footerVisible&&narrowInvalid.modalBounded&&narrowInvalid.writeCount===narrowBeforeWrites,'320px invalid form remains readable, no save receipt or overflow: '+JSON.stringify(narrowInvalid));
  assert((await currentEditIban())==='INVALID-IBAN-000','320px invalid form preserves unsaved IBAN draft');
  await screenshot('account-metadata-invalid-iban-mobile-320');
  await press('Escape','Escape',27);
  await waitFor("function(){return !document.querySelector('.account-management-modal.is-edit')}","Escape closes 320px invalid account editor without finance write");
  assert((await c.call("function(){return Number(document.documentElement.dataset.qaSettingsDurableWrites||0)}"))===narrowBeforeWrites,'Escape discard does not commit invalid account draft');


  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);
  c.close();console.log('Account metadata rendered QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
