import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-credit-statements-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for credit statements QA.');
const port=9258;
const profile='/tmp/myfinhub-credit-statements-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Credit statements QA assertion failed: ${message}`)};
const shot=async(c,name)=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','credit');url.searchParams.set('motion','reduced');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πιστωτική Κάρτα')&&Boolean(document.querySelector('[data-credit-statements]'))}",'credit statement page');

  const hierarchy=await c.call("function(){const statements=document.querySelector('[data-credit-statements]');const purchases=document.querySelector('.credit-purchases-table');const primary=document.querySelector('[data-primary-credit-statement]');return {statementBeforePurchases:Boolean(statements&&purchases&&(statements.compareDocumentPosition(purchases)&Node.DOCUMENT_POSITION_FOLLOWING)),primary:primary?.textContent||'',pay:primary?.querySelector('button.save-button')?.textContent||'',overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(hierarchy.statementBeforePurchases,'statements are presented before raw purchase history');
  assert(hierarchy.primary.includes('20/08/2026')&&hierarchy.primary.includes('90,00'),'primary statement exposes due date and remaining balance');
  assert(hierarchy.pay.includes('Πληρωμή'),'primary unpaid statement exposes payment CTA');
  assert(hierarchy.overflow<=1,`desktop horizontal overflow ${hierarchy.overflow}px`);
  await c.call("function(){document.querySelector('[data-credit-statements]')?.scrollIntoView({block:'start'});return true}");await sleep(120);
  await shot(c,'credit-statements-active-desktop');

  await c.call("function(){document.querySelector('[data-primary-credit-statement] button.save-button')?.click();return true}");
  await waitFor("function(){return Boolean(document.querySelector('[data-credit-statement-payment-preview]'))}",'statement payment preview');
  const preview=await c.call("function(){const box=document.querySelector('[data-credit-statement-payment-preview]');return {text:box?.textContent||'',effect:document.querySelector('.payment-effect-summary')?.textContent||''}}");
  assert(preview.text.includes('90,00')&&preview.text.includes('Ακουστικά'),'payment preview shows remaining balance and included purchase');
  assert(preview.effect.includes('δήλωση')&&preview.effect.includes('μία πραγματική κίνηση'),'payment confirmation preserves one-real-event semantics');
  await shot(c,'credit-statement-payment-desktop');
  await c.call("function(){document.querySelector('.contextual-quick-modal button[aria-label*=\"Κλείσιμο\"]')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'payment modal close');

  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return Boolean(document.querySelector('[data-primary-credit-statement]'))}",'mobile statement page');
  const mobile=await c.call("function(){const overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;const controls=[...document.querySelectorAll('[data-credit-statements] button,[data-credit-statements] summary')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});return {overflow,minTouch:controls.length?Math.min(...controls.map(el=>el.getBoundingClientRect().height)):99}}");
  assert(mobile.overflow<=1,`mobile horizontal overflow ${mobile.overflow}px`);
  assert(mobile.minTouch>=41,`mobile statement touch target ${mobile.minTouch}px`);
  await sleep(160);
  await c.call("function(){document.querySelector('[data-credit-statements]')?.scrollIntoView({block:'start'});return true}");
  await waitFor("function(){const node=document.querySelector('[data-primary-credit-statement]');if(!node)return false;const r=node.getBoundingClientRect();return r.bottom>90&&r.top<innerHeight-100}",'mobile primary statement visible in evidence viewport');
  await shot(c,'credit-statements-active-mobile');

  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return Boolean(document.querySelector('.page-heading'))}",'credit page reset');
  assert(await c.call("function(){const button=document.querySelector('.page-heading button[aria-label^=\\\"Αρχείο καρτών\\\"]');button?.click();return Boolean(button)}"),'credit archive action remains semantically reachable');
  await waitFor("function(){return Boolean(document.querySelector('.card-archive-manager'))}",'archive manager');
  const archive=await c.call("function(){const row=[...document.querySelectorAll('.card-archive-row')].find(item=>(item.textContent||'').includes('QA Settled'));return {text:row?.textContent||'',deleteEnabled:Boolean(row?.querySelector('button.danger:not([disabled])'))}}");
  assert(archive.text.includes('Statements 1'),'archive manager preserves statement count');
  assert(archive.deleteEnabled,'settled archived card remains eligible for hard delete');
  await c.call("function(){const row=[...document.querySelectorAll('.card-archive-row')].find(item=>(item.textContent||'').includes('QA Settled'));row?.querySelector('button.danger:not([disabled])')?.click();return true}");
  await waitFor("function(){return Boolean(document.querySelector('.app-confirm-dialog'))}",'hard-delete confirmation');
  await c.call("function(){const confirm=document.querySelector('.app-confirm-dialog button[data-action-tone=\"destructive\"]');confirm?.click();return Boolean(confirm)}");
  await waitFor("function(){return Boolean(document.querySelector('[data-deleted-statement-history]'))}",'deleted statement history');
  await c.call("function(){document.querySelector('.card-archive-manager .close-picker')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.card-archive-manager')}",'archive manager close after deletion');
  const deleted=await c.call("function(){const section=document.querySelector('.deleted-credit-history');const identity=section?.querySelector('.deleted-credit-history-card > .panel-head')?.textContent||'';const text=section?.textContent||'';return {text,identity,identityLeaksNickname:/QA Settled/.test(identity),leaksProtectedIdentity:/2222|ΠΕΙΡΑΙΩΣ/.test(text),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(deleted.text.includes('Διαγραμμένη κάρτα')&&deleted.text.includes('δήλωση'),'deleted-card statement history stays readable with neutral identity');
  assert(!deleted.identityLeaksNickname,'deleted card identity does not retain the former nickname');
  assert(!deleted.leaksProtectedIdentity,'deleted statement history does not retain last4 or bank identity');
  assert(deleted.overflow<=1,`deleted history desktop overflow ${deleted.overflow}px`);
  await c.call("function(){document.querySelector('.deleted-credit-history')?.scrollIntoView({block:'start'});return true}");await sleep(120);
  await shot(c,'credit-deleted-statement-history-desktop');
  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await sleep(180);
  const deletedMobile=await c.call("function(){const section=document.querySelector('.deleted-credit-history');const controls=[...section?.querySelectorAll('summary')||[]].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0});return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,minTouch:controls.length?Math.min(...controls.map(el=>el.getBoundingClientRect().height)):99}}");
  assert(deletedMobile.overflow<=1,`deleted statement mobile overflow ${deletedMobile.overflow}px`);
  assert(deletedMobile.minTouch>=41,`deleted statement mobile disclosure target ${deletedMobile.minTouch}px`);
  await c.call("function(){document.querySelector('.deleted-credit-history')?.scrollIntoView({block:'start'});return true}");
  await waitFor("function(){const node=document.querySelector('.deleted-credit-history-card > .panel-head');if(!node)return false;const r=node.getBoundingClientRect();return r.bottom>90&&r.top<innerHeight-100}",'deleted statement history header visible in mobile evidence viewport');
  await shot(c,'credit-deleted-statement-history-mobile');

  console.log('Credit statement QA: future-dated payment must not settle historical as-of balance');
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const futureUrl=new URL(baseUrl);futureUrl.searchParams.set('page','credit');futureUrl.searchParams.set('state','credit-future-payment');
  await c.send('Page.navigate',{url:futureUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('[data-primary-credit-statement]'))}",'historical statement with future payment');
  const earlierStatement=await c.call("function(){const panel=document.querySelector('[data-primary-credit-statement]');return {text:panel?.textContent||'',canPay:Boolean(panel?.querySelector('button.save-button'))}}");
  assert(earlierStatement.text.includes('90,00')&&earlierStatement.canPay,'future-dated payment prematurely settled historical statement');
  await c.call("function(){document.querySelector('[data-primary-credit-statement]')?.scrollIntoView({block:'start'});return true}");
  await shot(c,'credit-statement-future-payment-ignored');


  console.log('Credit rate QA: rate modal, exact rate, advisory payment, duplicate and failed persistence');
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return Boolean(document.querySelector('[data-credit-rates]'))}",'credit rate section');
  assert(await c.call("function(){return (document.querySelector('[data-credit-rates]')?.textContent||'').includes('Άγνωστο — δεν έχει καταχωριστεί')}"),'unknown legacy rate stays unknown');
  const beforeRows=await c.call("function(){return document.querySelectorAll('.credit-purchases-table tbody tr').length}");
  const openRate=async()=>{const clicked=await c.call("function(){const b=[...document.querySelectorAll('[data-credit-rates] button')].find(x=>x.textContent.includes('Νέο επιτόκιο'));b?.click();return Boolean(b)}");assert(clicked,'new rate action exists');await waitFor("function(){return Boolean(document.querySelector('#credit-rate-dialog-title'))}",'credit rate modal');await waitFor("function(){const node=document.querySelector('.credit-dialog'),backdrop=node?.closest('.editor-backdrop');if(!node||!backdrop)return false;const panel=getComputedStyle(node),overlay=getComputedStyle(backdrop),rgba=panel.backgroundColor.match(/[\\d.]+/g)||[];const alpha=rgba.length===4?Number(rgba[3]):1;return Number(panel.opacity)>=.999&&Number(overlay.opacity)>=.999&&alpha>=.999}",'rate dialog entrance settled and opaque')};
  const setRate=async value=>{const changed=await c.call("function(value){const node=document.querySelector('.credit-dialog input[data-autofocus=true]');if(!node)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));return true}",[value]);assert(changed,'editable annual nominal rate field')};
  const submitRate=async()=>{const clicked=await c.call("function(){const b=[...document.querySelectorAll('.credit-dialog button')].find(x=>x.textContent.includes('Καταχώριση επιτοκίου'));b?.click();return Boolean(b)}");assert(clicked,'rate submit action exists')};
  await openRate();
  assert(await c.call("function(){return document.activeElement===document.querySelector('.credit-dialog input[data-autofocus=true]')}"),'rate modal autofocus');
  await submitRate();
  await waitFor("function(){return (document.querySelector('.credit-dialog .form-error')?.textContent||'').includes('Συμπλήρωσε')}",'empty nominal rate validation');
  await setRate('15.125');
  await waitFor("function(){return !document.querySelector('.credit-dialog .form-error')}",'corrected rate clears stale empty error');
  await shot(c,'credit-rate-modal-desktop');
  await submitRate();
  await waitFor("function(){return !document.querySelector('#credit-rate-dialog-title')&&(document.querySelector('[data-credit-rates]')?.textContent||'').includes('15,125%')}",'durable synthetic rate readback');
  const rateModel=await c.call("function(){const panel=document.querySelector('[data-credit-rates]');return {text:panel?.textContent||'',details:panel?.querySelector('details summary')?.textContent||'',history:panel?.querySelectorAll('details li').length,rows:document.querySelectorAll('.credit-purchases-table tbody tr').length}}");
  assert(rateModel.details.includes('1')&&rateModel.history===1,'one effective-dated version after save');
  assert(rateModel.rows===beforeRows,'rate change never posts or edits credit purchase events');
  const setPayoff=await c.call("function(){const node=document.querySelector('[data-credit-rates] input[aria-label=\"Ποσό προσομοιωμένης μηνιαίας αποπληρωμής\"]');if(!node)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter.call(node,'50');node.dispatchEvent(new Event('input',{bubbles:true}));return true}");
  assert(setPayoff,'optional payoff amount editable');
  await waitFor("function(){return (document.querySelector('[data-credit-rates] [role=status]')?.textContent||'').includes('Ενδεικτική εξόφληση')}",'advisory payoff result');
  assert((await c.call("function(){return document.querySelectorAll('.credit-purchases-table tbody tr').length}"))===beforeRows,'payoff simulation never posts ledger events');
  await shot(c,'credit-rate-payoff-desktop');
  await openRate();
  await submitRate();
  await waitFor("function(){return (document.querySelector('.credit-dialog .form-error')?.textContent||'').includes('Υπάρχει ήδη επιτόκιο')}",'duplicate effective-from date rejected');
  assert((await c.call("function(){return document.querySelectorAll('[data-credit-rates] details li').length}"))===1,'duplicate date did not rewrite history');
  await shot(c,'credit-rate-duplicate-validation-desktop');
  await c.call("function(){document.querySelector('.credit-dialog button[aria-label=\"Κλείσιμο επιτοκίου\"]')?.click();return true}");

  await c.send('Emulation.setDeviceMetricsOverride',{width:834,height:1112,deviceScaleFactor:1,mobile:false});
  await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');return true}");
  await openRate();
  const tabletRate=await c.call("function(){const modal=document.querySelector('.credit-dialog'),r=modal?.getBoundingClientRect();return {theme:document.documentElement.dataset.theme,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,left:r?.left,right:r?.right}}");
  assert(tabletRate.theme==='dark'&&tabletRate.overflow<=1&&tabletRate.left>=0&&tabletRate.right<=834,'dark tablet rate modal contained in viewport');
  await shot(c,'credit-rate-modal-dark-tablet');

  const failureUrl=new URL(baseUrl);failureUrl.searchParams.set('page','credit');failureUrl.searchParams.set('card-profile-save-failure','1');
  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await c.send('Page.navigate',{url:failureUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('[data-credit-rates]'))}",'rate failure fixture');
  // Each Page.navigate creates a new document; QA fixtures do not run the production theme bootstrap.
  // Initialize the same opaque semantic surface tokens as the real app before inspecting a mobile sheet.
  const mobileTheme=await c.call("async function(){const theme=await import('/src/lib/theme.ts');theme.applyThemePreference('light');return {resolved:document.documentElement.dataset.theme,surface:getComputedStyle(document.documentElement).getPropertyValue('--surface-elevated').trim()}}");
  assert(mobileTheme.resolved==='light'&&mobileTheme.surface==='#ffffff','mobile rate fixture initializes the real opaque light-theme surface');
  await openRate();
  await setRate('16.5');
  await submitRate();
  await waitFor("function(){return (document.querySelector('.credit-dialog .form-error')?.textContent||'').includes('δοκιμαστική αποθήκευση')}",'failed rate save retains actionable error');
  const failedRate=await c.call("function(){const modal=document.querySelector('.credit-dialog'),r=modal?.getBoundingClientRect(),panel=document.querySelector('[data-credit-rates]');return {keptOpen:Boolean(modal),unchanged:(panel?.textContent||'').includes('Άγνωστο — δεν έχει καταχωριστεί'),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,left:r?.left,right:r?.right}}");
  assert(failedRate.keptOpen&&failedRate.unchanged&&failedRate.overflow<=1&&failedRate.left>=0&&failedRate.right<=375,'failed mobile save preserves model and modal within viewport');
  const mobilePaint=await c.call("function(){const panel=document.querySelector('.credit-dialog'),backdrop=panel?.closest('.editor-backdrop');if(!panel||!backdrop)return null;const style=getComputedStyle(panel),bStyle=getComputedStyle(backdrop),v=style.backgroundColor.match(/[\\d.]+/g)||[];return {panelOpacity:Number(style.opacity),backdropOpacity:Number(bStyle.opacity),background:style.backgroundColor,alpha:v.length===4?Number(v[3]):1,backgroundImage:style.backgroundImage}}");
  assert(mobilePaint&&mobilePaint.panelOpacity>=.999&&mobilePaint.backdropOpacity>=.999&&mobilePaint.alpha>=.999,`mobile failure modal must be fully opaque after entrance, not a translucent view of the bank card: ${JSON.stringify(mobilePaint)}`);
  await shot(c,'credit-rate-save-failure-mobile');

  c.close();console.log('Credit statement and interest-rate lifecycle rendered QA passed.');
}finally{child.kill('SIGTERM')}
