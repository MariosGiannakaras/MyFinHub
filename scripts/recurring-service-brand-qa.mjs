import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-recurring-brand-qa';
mkdirSync(evidenceDir,{recursive:true});
const uploadFile='/tmp/myfinhub-recurring-brand-replacement.svg';
writeFileSync(uploadFile,'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#111827"/><path d="M29 31h18l13 20 13-20h18L69 62l24 27H74L60 70 46 89H27l24-27Z" fill="#fff"/></svg>');
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for recurring service-brand QA.');
const port=9272;
const child=spawn(chrome,['--headless=new','--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-recurring-service-brand-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error('Timed out waiting for '+url)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id){this.onEvent?.(message);return}const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error('Recurring service-brand QA assertion failed: '+message)};
try{
  await waitHttp('http://127.0.0.1:'+port+'/json/version');
  const target=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(baseUrl),{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('DOM.enable');
  const origin=new URL(baseUrl).origin;
  const storagePrefix=origin+'/storage/v1/object/public/recurring-service-assets/services/';
  const svgBody=readFileSync(uploadFile).toString('base64');
  c.onEvent=message=>{
    if(message.method!=='Fetch.requestPaused')return;
    const requestId=message.params.requestId;
    const path=new URL(message.params.request.url).pathname;
    // Only the QA's synthetic recurring Storage images are intercepted;
    // auth, finance and catalog requests keep their normal scoped mocks.
    if(/^\/storage\/v1\/object\/public\/recurring-service-assets\/services\/service-asset-[a-f0-9]{24}\.svg$/.test(path)){
      void c.send('Fetch.fulfillRequest',{requestId,responseCode:200,
        responseHeaders:[{name:'content-type',value:'image/svg+xml'}],
        body:svgBody}).catch(error=>{throw error});
    }else void c.send('Fetch.continueRequest',{requestId}).catch(error=>{throw error});
  };
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*/storage/v1/object/public/recurring-service-assets/services/*',requestStage:'Request'}]});
  const installMock=function(storagePrefix){
    const realFetch=globalThis.fetch.bind(globalThis);
    const assetUrl=key=>storagePrefix+key+'.svg';
    const initial={assetKey:'service-asset-aaaaaaaaaaaaaaaaaaaaaaaa',recurringId:'qa-service-branded',url:assetUrl('service-asset-aaaaaaaaaaaaaaaaaaaaaaaa'),fileName:'streaming.svg',mimeType:'image/svg+xml',sizeBytes:512,updatedAt:'2026-10-08T18:00:00.000Z'};
    let replacement={assetKey:'service-asset-bbbbbbbbbbbbbbbbbbbbbbbb',recurringId:'qa-service-branded',url:assetUrl('service-asset-bbbbbbbbbbbbbbbbbbbbbbbb'),fileName:'replacement.svg',mimeType:'image/svg+xml',sizeBytes:512,updatedAt:'2026-10-08T18:05:00.000Z'};
    const paused={assetKey:'service-asset-cccccccccccccccccccccccc',recurringId:'qa-service-paused',url:assetUrl('service-asset-cccccccccccccccccccccccc'),fileName:'paused.svg',mimeType:'image/svg+xml',sizeBytes:512,updatedAt:'2026-10-08T18:06:00.000Z'};
    let registered=[initial,paused];
    globalThis.__recurringAssetWrites=0;
    globalThis.__recurringAssetDeletes=0;
    globalThis.fetch=async function(input,init){
      const url=typeof input==='string'?input:input instanceof Request?input.url:String(input);
      const method=String((init&&init.method)||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
      if(url.includes('/api/account-metadata')&&url.includes('resource=recurring-service-assets')){
        if(method==='GET')return new Response(JSON.stringify({assets:registered}),{status:200,headers:{'content-type':'application/json'}});
        if(method==='PUT'){
          globalThis.__recurringAssetWrites+=1;
          const file=init?.body;
          const params=new URL(url,location.origin).searchParams;
          // Mirror the server contract: file name is a request query field,
          // media type is a header, and size comes from the binary File body.
          replacement={...replacement,
            recurringId:params.get('recurringId')||replacement.recurringId,
            fileName:params.get('fileName')||replacement.fileName,
            mimeType:new Headers(init?.headers).get('content-type')||replacement.mimeType,
            sizeBytes:file?.size??replacement.sizeBytes};
          globalThis.__recurringAssetMockLast={
            fileName:replacement.fileName,headerType:replacement.mimeType,
            binarySize:typeof file?.size==='number'?file.size:null,
            bodyName:typeof file?.name==='string'?file.name:null,
            recurringId:replacement.recurringId,
          };
          registered=[replacement,...registered.filter(asset=>asset.assetKey!==replacement.assetKey)];
          return new Response(JSON.stringify({asset:replacement}),{status:200,headers:{'content-type':'application/json'}});
        }
        if(method==='DELETE'){
          globalThis.__recurringAssetDeletes+=1;
          const key=new URL(url,location.origin).searchParams.get('assetKey');
          registered=registered.filter(asset=>asset.assetKey!==key);
          if(new URLSearchParams(location.search).has('recurring-release-unverified')){
            // Simulate a release RPC that deactivated its row, followed by
            // failed Storage deletion. An active-only empty GET is not purge
            // proof, and a second DELETE must never be issued blindly.
            return new Response(JSON.stringify({error:'Storage purge unavailable'}),{
              status:503,headers:{'content-type':'application/json'},
            });
          }
          return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
        }
      }
      return realFetch(input,init);
    };
  };
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installMock.toString()+')('+JSON.stringify(storagePrefix)+');'});
  const viewport=async(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{
    for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}
    if(label==='replaced recurring logo'){
      // A failed UI assertion is not evidence of failure cause. Preserve a
      // synthetic-only error-state screenshot and narrow redacted debug facts.
      const facts=await c.call("function(){const row=[...document.querySelectorAll('[data-recurring-status=active]')].find(item=>(item.textContent||'').includes('QA Streaming'));return {editorOpen:Boolean(document.querySelector('.recurring-editor-dialog')),error:(document.querySelector('#recurring-editor-error')?.textContent||'').slice(0,250),assetKey:row?.querySelector('.recurring-brand-mark')?.getAttribute('data-recurring-brand-key')||'',writes:globalThis.__recurringAssetWrites||0,deletes:globalThis.__recurringAssetDeletes||0,request:globalThis.__recurringAssetMockLast||null}}");
      await shot('recurring-service-brand-replace-failed');
      throw new Error('Timed out waiting for '+label+': '+JSON.stringify(facts));
    }
    throw new Error('Timed out waiting for '+label);
  };
  const navigate=async(width=1440,height=1100,failSave=false,releaseUnverified=false,longName=false)=>{await viewport(width,height);const url=new URL(baseUrl);url.searchParams.set('page','recurring');url.searchParams.set('state','recurring-branding');if(failSave)url.searchParams.set('recurring-save-failure',failSave===true?'1':failSave);if(releaseUnverified)url.searchParams.set('recurring-release-unverified','1');if(longName)url.searchParams.set('recurring-branding-long-name','1');await c.send('Page.navigate',{url:url.href});await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Πάγια')&&Boolean(document.querySelector('[data-recurring-status=active]'))}",'recurring branding fixture');await waitFor("function(){return document.querySelectorAll('[data-recurring-brand-source=service-storage]').length>=1}",'storage recurring brand mark')};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(evidenceDir+'/'+name+'.png',Buffer.from(result.data,'base64'))};
  const clickAria=async label=>{const clicked=await c.call("function(label){const node=[...document.querySelectorAll('button,[role=button],summary')].find(item=>item.getAttribute('aria-label')===label);if(!node)return false;node.click();return true}",[label]);assert(clicked,'missing control '+label)};
  const clickText=async(selector,text)=>{const clicked=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(clicked,'missing clickable '+text)};
  const setLogoFile=async()=>{const doc=await c.send('DOM.getDocument',{depth:2,pierce:true});const q=await c.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.editor-backdrop input[type=file]'});assert(q.nodeId,'recurring logo file input');await c.send('DOM.setFileInputFiles',{nodeId:q.nodeId,files:[uploadFile]});await waitFor("function(){return document.querySelector('.recurring-brand-local-selection')?.getAttribute('data-recurring-brand-source')==='local-selection'}",'local recurring logo selection state')};
  const state=()=>c.call("function(){const rows=[...document.querySelectorAll('[data-recurring-status=active]')];const branded=rows.find(row=>(row.textContent||'').includes('QA Streaming'));const fallback=rows.find(row=>(row.textContent||'').includes('QA Utility'));const brandedMark=branded?.querySelector('.recurring-brand-mark'),fallbackMark=fallback?.querySelector('.recurring-brand-mark');return {brandedSource:brandedMark?.getAttribute('data-recurring-brand-source')||'',brandedKey:brandedMark?.getAttribute('data-recurring-brand-key')||'',fallbackSource:fallbackMark?.getAttribute('data-recurring-brand-source')||'',writes:globalThis.__recurringAssetWrites||0,deletes:globalThis.__recurringAssetDeletes||0,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");

  console.log('Recurring service-brand QA: stored mark and fallback');
  await navigate();
  let current=await state();
  assert(current.brandedSource==='service-storage'&&current.brandedKey==='service-asset-aaaaaaaaaaaaaaaaaaaaaaaa','stored recurring logo renders on exact service identity');
  assert(current.fallbackSource==='fallback','no-logo recurring item uses canonical fallback');
  assert(current.overflow<=1,'recurring service branding does not introduce desktop overflow');
  await clickText('.inactive-recurring>summary','Παγωμένα & ανενεργά');
  assert(await c.call("function(){const row=[...document.querySelectorAll('.inactive-recurring-list article')].find(item=>(item.textContent||'').includes('QA Paused Service'));return row?.querySelector('.recurring-brand-mark')?.getAttribute('data-recurring-brand-key')==='service-asset-cccccccccccccccccccccccc'}"),'paused recurring item retains stored logo reference');
  await shot('recurring-service-brand-stored-and-fallback');

  console.log('Recurring service-brand QA: cancel is upload-free');
  await clickAria('Επεξεργασία QA Streaming');
  await waitFor("function(){return Boolean(document.querySelector('.recurring-logo-editor'))}",'recurring logo editor');
  await setLogoFile();
  assert((await state()).writes===0,'selecting a logo remains local until Save');
  await clickText('.editor-actions button','Ακύρωση');
  await waitFor("function(){return !document.querySelector('.recurring-editor-dialog')}",'recurring editor cancel');
  assert((await state()).writes===0,'Cancel does not upload a recurring service asset');

  console.log('Recurring service-brand QA: replace propagates to payment and lifecycle');
  await clickAria('Επεξεργασία QA Streaming');await setLogoFile();
  // Two click events in one browser task precede a React state rerender.
  // Their single durable result must not allocate two generated Storage keys.
  const doubleSave=await c.call("function(){const button=[...document.querySelectorAll('.recurring-editor-dialog .editor-actions button')].find(item=>(item.textContent||'').includes('Αποθήκευση'));if(!button||button.disabled)return false;button.click();button.click();return true}");
  assert(doubleSave,'recurring Save is available for same-turn duplicate proof');
  await waitFor("function(){const row=[...document.querySelectorAll('[data-recurring-status=active]')].find(item=>(item.textContent||'').includes('QA Streaming'));return !document.querySelector('.recurring-editor-dialog')&&row?.querySelector('.recurring-brand-mark')?.getAttribute('data-recurring-brand-key')==='service-asset-bbbbbbbbbbbbbbbbbbbbbbbb'}",'replaced recurring logo');
  assert((await state()).writes===1,'same-turn recurring Save cannot launch two Storage PUTs');
  current=await state();assert(current.writes===1&&current.deletes===1,'replacement uploads one asset and releases the old unshared asset after the save');
  await clickAria('Πληρωμή QA Streaming');
  await waitFor("function(){return Boolean(document.querySelector('.contextual-quick-modal'))}",'recurring payment dialog');
  assert(await c.call("function(){return document.querySelector('.contextual-quick-modal #context-quick-title .recurring-brand-mark')?.getAttribute('data-recurring-brand-key')==='service-asset-bbbbbbbbbbbbbbbbbbbbbbbb'}"),'payment flow uses the same recurring brand mark');
  await shot('recurring-service-brand-payment');
  await clickAria('Κλείσιμο contextual καταχώρισης');
  await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'payment dialog close');
  await clickAria('Παύση QA Streaming');
  await waitFor("function(){return ![...document.querySelectorAll('[data-recurring-status=active]')].some(row=>(row.textContent||'').includes('QA Streaming'))}",'recurring pause transition');
  const detailsOpen=await c.call("function(){const details=document.querySelector('.inactive-recurring');if(!details)return false;if(!details.open)details.querySelector('summary')?.click();return true}");assert(detailsOpen,'inactive recurring history exists');
  await waitFor("function(){const row=[...document.querySelectorAll('.inactive-recurring-list article')].find(item=>(item.textContent||'').includes('QA Streaming'));return row?.querySelector('.recurring-brand-mark')?.getAttribute('data-recurring-brand-key')==='service-asset-bbbbbbbbbbbbbbbbbbbbbbbb'}",'paused replacement brand mark');
  await shot('recurring-service-brand-paused');

  console.log('Recurring service-brand QA: remove falls back without asset mutation');
  await clickAria('Επεξεργασία QA Streaming');await clickText('.recurring-logo-editor-actions button','Αφαίρεση');await clickText('.editor-actions button','Αποθήκευση');
  await waitFor("function(){const row=[...document.querySelectorAll('.inactive-recurring-list article')].find(item=>(item.textContent||'').includes('QA Streaming'));return !document.querySelector('.recurring-editor-dialog')&&row?.querySelector('.recurring-brand-mark')?.getAttribute('data-recurring-brand-source')==='fallback'}",'removed recurring logo fallback');
  current=await state();assert(current.writes===1&&current.deletes===2,'removing the last logo reference releases the replacement asset after save');
  await shot('recurring-service-brand-removed');

  console.log('Recurring service-brand QA: failed durable finance save cleans newly uploaded asset');
  await navigate(1440,1100,true);
  await clickAria('Επεξεργασία QA Streaming');await setLogoFile();await clickText('.editor-actions button','Αποθήκευση');
  await waitFor("function(){return Boolean(document.querySelector('.recurring-editor-dialog #recurring-editor-error'))}",'recurring persistence error keeps editor open');
  current=await state();
  assert(current.writes===1&&current.deletes===1&&current.brandedKey==='service-asset-aaaaaaaaaaaaaaaaaaaaaaaa','failed finance write retains old logo reference and deletes only newly uploaded asset');
  await shot('recurring-service-brand-save-failure');

  console.log('Recurring service-brand QA: committed finance with lost reply retains referenced image');
  await navigate(1440,1100,'uncertain');
  await clickAria('Επεξεργασία QA Streaming');await setLogoFile();
  await clickText('.editor-actions button','Αποθήκευση');
  await waitFor("function(){return Boolean(document.querySelector('.recurring-editor-dialog #recurring-editor-error'))}",'recurring uncertain finance feedback');
  current=await state();
  assert(current.writes===1&&current.deletes===0,
    'An ambiguous finance receipt must not delete the uploaded asset or upload twice.');
  const uncertain=await c.call("function(){const editor=document.querySelector('.recurring-editor-dialog');const save=[...(editor?.querySelectorAll('.editor-actions button')||[])].find(button=>button.textContent?.includes('Αποθήκευση'));return {disabled:save?.disabled===true,error:editor?.querySelector('#recurring-editor-error')?.textContent||''}}");
  assert(uncertain.disabled&&uncertain.error.includes('Η εικόνα διατηρήθηκε'),
    'Ambiguous finance receipt must visibly block repeat Save and explain retained Storage.');
  await clickText('.editor-actions button','Αποθήκευση');
  assert((await state()).writes===1,
    'Blocked editor retried an unverified logo and generated another Storage key.');
  await shot('recurring-service-brand-finance-receipt-unverified');

  console.log('Recurring service-brand QA: an ambiguous asset release after a committed finance save never retries');
  for(const [width,height,label] of [[1440,1100,'desktop'],[375,812,'mobile']]){
    await navigate(width,height,false,true);
    await clickAria('Επεξεργασία QA Streaming');await setLogoFile();
    await clickText('.editor-actions button','Αποθήκευση');
    await waitFor("function(){return !document.querySelector('.recurring-editor-dialog')&&Boolean(document.querySelector('.recurring-approved-page>.action-status'))}",'recurring release uncertainty warning');
    current=await state();
    assert(current.writes===1&&current.deletes===1&&current.brandedKey==='service-asset-bbbbbbbbbbbbbbbbbbbbbbbb',
      'Finance save remains committed, new logo retained and only one old asset release attempted: '+label);
    const notice=await c.call("function(){const el=document.querySelector('.recurring-approved-page>.action-status');if(!el)return {visible:false,text:'',overflow:999};const box=el.getBoundingClientRect();return {visible:box.top>=0&&box.bottom<=innerHeight&&box.width>0,text:el.textContent||'',overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth}}");
    assert(notice.visible&&notice.overflow<=1&&notice.text.includes('προηγούμενο λογότυπο'),
      'A visible, contained cleanup warning must distinguish committed finance from uncertain Storage: '+label);
    const blocked=await c.call("async function(){const mod=await import('/src/lib/recurringServiceAssetClient.ts');try{await mod.deleteRecurringServiceAsset('service-asset-aaaaaaaaaaaaaaaaaaaaaaaa');return 'unexpected success'}catch(error){return String(error?.message||error)}}");
    assert(blocked.includes('δεν επιβεβαιώθηκε')&&(await state()).deletes===1,
      'The same-key uncertain release must not send a second DELETE: '+label);
    await shot('recurring-service-brand-release-unverified-'+label);
  }

  console.log('Recurring service-brand QA: dark and mobile containment');
  await navigate();await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}");
  assert(await c.call("function(){const mark=document.querySelector('[data-recurring-brand-source=service-storage]');return document.documentElement.dataset.theme==='dark'&&Boolean(mark)&&getComputedStyle(mark).overflow==='hidden'}"),'stored recurring brand remains contained in Dark');
  await shot('recurring-service-brand-dark');
  await navigate(390,844);current=await state();assert(current.overflow<=1&&current.brandedSource==='service-storage'&&current.fallbackSource==='fallback','mobile recurring branding remains overflow-safe with storage and fallback marks');await shot('recurring-service-brand-mobile');


  console.log('Recurring service-brand QA: long Greek name, exact brand identity and payment action at narrow widths');
  const longName='QA Streaming — Πολύ μεγάλη ελληνική ονομασία υπηρεσίας με ανανέωση συνδρομής και δοκιμή αναγνωσιμότητας';
  for(const [width,height,theme] of [[320,760,'dark'],[375,812,'light']]){
    await navigate(width,height,false,false,true);
    await c.call("async function(theme){localStorage.setItem('myfinhub.theme',theme);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(theme);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}",[theme]);
    await waitFor("function(theme){const row=document.querySelector('.mobile-recurring-row[data-mobile-recurring=qa-service-branded]');const route=document.querySelector('.recurring-approved-page');return document.documentElement.dataset.theme===theme&&row instanceof HTMLElement&&row.getClientRects().length>0&&route instanceof HTMLElement&&Number(getComputedStyle(row).opacity)>=.995&&Number(getComputedStyle(route).opacity)>=.995&&!route.getAnimations({subtree:true}).some(anim=>anim.playState==='running'&&['rh-bank-in','rh-backdrop-in'].includes(anim.animationName))}",'long recurring name settled',[theme]);
    const facts=await c.call("function(name){const row=document.querySelector('.mobile-recurring-row[data-mobile-recurring=qa-service-branded]');const mark=row?.querySelector('.recurring-brand-mark');const title=row?.querySelector('.semantic-list-title b');const amount=row?.querySelector('.mobile-recurring-amount');const pay=row?.querySelector('.mobile-pay-action');if(!row||!mark||!title||!amount||!pay)return null;const outer=row.getBoundingClientRect(),m=mark.getBoundingClientRect(),t=title.getBoundingClientRect(),a=amount.getBoundingClientRect(),p=pay.getBoundingClientRect();const head=row.querySelector('.mobile-recurring-head').getBoundingClientRect(),value=amount.querySelector('strong').getBoundingClientRect(),mode=amount.querySelector('small').getBoundingClientRect();const inside=b=>b.width>0&&b.height>0&&b.left>=outer.left-1&&b.right<=outer.right+1;return {name:title.textContent,source:mark.getAttribute('data-recurring-brand-source'),key:mark.getAttribute('data-recurring-brand-key'),payLabel:pay.getAttribute('aria-label'),contained:[m,t,a,p].every(inside),noOverlap:t.right<=a.left+1&&m.right<=t.left+1,nameWidthShare:t.width/head.width,amountStacked:value.bottom<=mode.top+1&&value.width>0&&mode.width>0,markAtStart:Math.abs(m.top-t.top)<=4,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,theme:document.documentElement.dataset.theme,ready:!pay.disabled,writes:globalThis.__recurringAssetWrites,deletes:globalThis.__recurringAssetDeletes}}",[longName]);
    assert(facts&&facts.name===longName&&facts.source==='service-storage'&&facts.key==='service-asset-aaaaaaaaaaaaaaaaaaaaaaaa'&&facts.payLabel==='Πληρωμή '+longName&&facts.contained&&facts.noOverlap&&facts.overflow<=1&&facts.nameWidthShare>=.5&&facts.amountStacked&&facts.markAtStart&&facts.theme===theme&&facts.ready&&facts.writes===0&&facts.deletes===0,'long Greek service identity, mark, amount and payment affordance remain contained: '+width+' '+theme+' '+JSON.stringify(facts));
    await c.call("function(){document.querySelector('.mobile-recurring-row[data-mobile-recurring=qa-service-branded]').scrollIntoView({block:'center'})}");
    await shot('recurring-service-brand-long-name-'+width+'-'+theme);
    await clickAria('Πληρωμή '+longName);
    await waitFor("function(){const mark=document.querySelector('.contextual-quick-modal #context-quick-title .recurring-brand-mark');return mark?.getAttribute('data-recurring-brand-key')==='service-asset-aaaaaaaaaaaaaaaaaaaaaaaa'}",'long-name linked recurring payment');
    assert(await c.call("function(){return globalThis.__recurringAssetWrites===0&&globalThis.__recurringAssetDeletes===0}"),'opening exact linked payment does not mutate artwork');
    await clickAria('Κλείσιμο contextual καταχώρισης');
    await waitFor("function(){return !document.querySelector('.contextual-quick-modal')}",'long-name payment close');
  }
  c.close();console.log('Recurring service-brand QA passed. Evidence: '+evidenceDir);
}finally{child.kill('SIGTERM')}
