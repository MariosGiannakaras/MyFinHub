import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-provider-brand-management-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for provider branding QA.');
// Reserve a free loopback CDP port rather than assuming a fixed one is idle.
const port=await new Promise((resolve,reject)=>{
  const listener=createServer();
  listener.once('error',reject);
  listener.listen(0,'127.0.0.1',()=>{
    const address=listener.address();
    listener.close(error=>{
      if(error)reject(error);
      else if(!address||typeof address==='string')reject(new Error('Provider QA could not reserve a local Chromium port.'));
      else resolve(address.port);
    });
  });
});
const profile='/tmp/myfinhub-provider-brand-management-qa-chrome';
// As in receipt QA, never inherit Chromium's possibly locked transient profile.
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:['ignore','ignore','pipe']});
let chromiumDiagnostics='';
child.stderr?.on('data',chunk=>{chromiumDiagnostics=(chromiumDiagnostics+chunk.toString()).slice(-4096)});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){
  for(let i=0;i<120;i++){
    try{const response=await fetch(url);if(response.ok)return}catch{}
    if(child.exitCode!==null)throw new Error(`Chromium exited before CDP was ready (code ${child.exitCode}): ${chromiumDiagnostics}`);
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url} (Chrome exit: ${child.exitCode??'running'}) ${chromiumDiagnostics}`);
}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Provider branding QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('visual','1');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  const press=async(key,code,vk)=>{await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key,code,windowsVirtualKeyCode:vk});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk})};
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const applyTheme=preference=>c.call(`async function(pref){localStorage.setItem('myfinhub.theme',pref);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}`,[preference]);
  const clickAccounts=async()=>{const ok=await c.call("function(){const node=[...document.querySelectorAll('.settings-tablist button')].find(item=>(item.textContent||'').trim()==='Λογαριασμοί');if(!node)return false;node.click();return true}");assert(ok,'Accounts tab is available');await waitFor("function(){return !!document.querySelector('.provider-management')&&document.querySelectorAll('.provider-list-row').length>=8}",'compact provider list')};
  const noOverflow=async label=>{const value=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(value<=1,`${label} horizontal overflow ${value}px`)};
  const shot=async name=>{await c.call("function(){const active=document.activeElement;if(active instanceof HTMLElement)active.blur();return true}");await sleep(160);const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const fullShot=async name=>{await sleep(120);const metrics=await c.send('Page.getLayoutMetrics');const width=Math.ceil(metrics.cssContentSize?.width||1440),height=Math.ceil(metrics.cssContentSize?.height||1000);const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').includes(text));if(!node)return false;node.click();return true}",[selector,text]);assert(ok,`${text} action is available`)};
  const uploadSyntheticSvg=async name=>{
    const ok=await c.call(`function(name){const input=document.querySelector('.provider-management > input[type="file"]');if(!input)return false;const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" rx="12" fill="#1d4ed8"/><path d="M20 42 36 18h12L32 42zm28 0 16-24h12L60 42z" fill="white"/></svg>';const file=new File([svg],name,{type:'image/svg+xml'});const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true}`,[name]);
    assert(ok,'hidden app-owned upload input accepts a synthetic file');
  };
  const installProviderReplacementBackend=async()=>{
    const installed=await c.call(`async function(){
      const control=globalThis;
      if(control.__myfinhubProviderReplaceOriginalFetch)return true;
      const mod=await import('/src/lib/financialProviderClient.ts');
      const provider=mod.getFinancialProviderSnapshot().providers.find(item=>item.id==='piraeus');
      if(!provider)return false;
      const original=globalThis.fetch.bind(globalThis);
      // Reuse a real served QA asset URL; the server never returns data: URLs.
      const assetUrl=provider.assets?.find(asset=>asset.role==='wordmark'&&asset.variant==='light'&&asset.url!==provider.logoUrl)?.url;
      if(!assetUrl)return false;
      const assetKey='piraeus-asset-123456abcdef';
      control.__myfinhubProviderReplaceOriginalFetch=original;
      globalThis.fetch=async function(input,init){
        const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
        const requestUrl=new URL(raw,location.href);
        const method=String(init?.method||'GET').toUpperCase();
        const resource=requestUrl.searchParams.get('resource');
        if(requestUrl.pathname==='/api/account-metadata'&&resource==='financial-providers'&&method==='PATCH'){
          return new Response(JSON.stringify({provider:{
            id:provider.id,displayName:provider.displayName,shortName:provider.shortName,
            providerKind:provider.kind,countryCode:provider.countryCode??null,sortOrder:provider.sortOrder
          }}),{status:200,headers:{'content-type':'application/json'}});
        }
        if(requestUrl.pathname==='/api/account-metadata'&&resource==='financial-provider-assets'&&method==='PUT'){
          const asset={assetKey,role:requestUrl.searchParams.get('role')||'logo',variant:requestUrl.searchParams.get('variant')||'universal',url:assetUrl,fileName:requestUrl.searchParams.get('fileName')||'qa-shared.svg',mimeType:init?.body?.type||'image/svg+xml',sizeBytes:init?.body?.size??0,updatedAt:'2026-10-03T00:00:00.000Z'};
          provider.assets=[...(provider.assets||[]).filter(item=>item.assetKey!==assetKey),asset];
          return new Response(JSON.stringify({asset}),{status:200,headers:{'content-type':'application/json'}});
        }
        if(requestUrl.pathname==='/api/account-metadata'&&resource==='financial-provider-asset-binding'&&method==='PUT'){
          let body={};try{body=JSON.parse(typeof init?.body==='string'?init.body:'{}')}catch{}
          const role=body.role,variant=body.variant,bindingKey=body.assetKey;
          provider.bindings=[...(provider.bindings||[]).filter(item=>!(item.role===role&&item.variant===variant))];
          if(bindingKey)provider.bindings.push({role,variant,assetKey:bindingKey});
          if(role==='logo'&&variant==='universal'){provider.logoAssetKey=bindingKey||null;provider.logoUrl=bindingKey===assetKey?assetUrl:null}
          if(role==='wordmark'&&variant==='universal'){provider.wordmarkAssetKey=bindingKey||null;provider.wordmarkUrl=bindingKey===assetKey?assetUrl:null}
          return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
        }
        return original(input,init);
      };
      return true;
    }`);
    assert(installed,'synthetic provider replacement backend installs');
  };
  const restoreProviderReplacementBackend=async()=>{
    const restored=await c.call(`function(){const control=globalThis;const original=control.__myfinhubProviderReplaceOriginalFetch;if(typeof original!=='function')return false;globalThis.fetch=original;delete control.__myfinhubProviderReplaceOriginalFetch;return true}`);
    assert(restored,'synthetic provider replacement backend restores original fetch');
  };

  const openBranding=async()=>{
    await clickText('.provider-editor-tabs button','Εικόνες');
    await waitFor("function(){return document.querySelectorAll('.provider-slot-card').length===9}",'nine semantic branding slots');
  };
  const chooseSlot=async label=>{
    const ok=await c.call("function(label){const card=[...document.querySelectorAll('.provider-slot-card')].find(item=>(item.textContent||'').includes(label));const button=card?.querySelector('.provider-slot-select');if(!button)return false;button.click();return true}",[label]);
    assert(ok,`slot picker opens for ${label}`);
    await waitFor("function(){return !!document.querySelector('.provider-asset-picker')}",'asset picker');
  };

  await viewport(1440,1000,false);
  await c.send('Page.navigate',{url:url.href});
  await waitFor("function(){return document.readyState==='complete'&&!!document.querySelector('.settings-tablist')}",'Settings ready');
  assert(await applyTheme('light')==='light','light theme resolves');
  await clickAccounts();
  await waitFor("function(){const mark=document.querySelector('[data-bank-brand=\\\"piraeus\\\"][data-bank-logo-source=\\\"provider-storage\\\"] img');return !!mark&&mark.complete&&mark.naturalWidth>0&&mark.src.includes('/financial-provider-assets/providers/piraeus/piraeus-logo-universal.svg')}",'production Piraeus logo');
  await waitFor("function(){const images=[...document.querySelectorAll('.provider-list img[src*=\\\"financial-provider-assets\\\"]')];return images.length>=8&&images.every(img=>img.complete&&img.naturalWidth>0)}",'production provider artwork');
  const piraeusSource=await c.call("function(){return document.querySelector('[data-bank-brand=\\\"piraeus\\\"] img')?.src||''}");
  assert(piraeusSource.includes('/financial-provider-assets/providers/piraeus/piraeus-logo-universal.svg'),'Piraeus visual comes from production Storage fixture');
  const listState=await c.call(`function(){const rows=[...document.querySelectorAll('.provider-list-row')];const expanded=document.querySelectorAll('.provider-slot-card').length;const nativeVisible=[...document.querySelectorAll('.provider-management input[type=file]')].filter(node=>{const s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'}).length;return {rows:rows.length,expanded,nativeVisible,editButtons:document.querySelectorAll('.provider-edit-action').length}}`);
  assert(listState.rows>=8&&listState.editButtons===listState.rows,'provider list is compact and directly editable');
  assert(listState.expanded===0,'Settings does not expand artwork slots outside edit');
  assert(listState.nativeVisible===0,'native file controls are never visible');
  await noOverflow('provider list desktop');
  await shot('provider-list-light-desktop');

  const opened=await c.call("function(){const button=document.querySelector('.provider-edit-action');button?.click();return Boolean(button)}");assert(opened,'existing provider editor opens');
  await waitFor("function(){return !!document.querySelector('.provider-editor-modal')}",'provider editor');
  const tabs=await c.call("function(){return [...document.querySelectorAll('.provider-editor-tabs [role=tab]')].map(node=>(node.textContent||'').trim())}");
  assert(JSON.stringify(tabs)===JSON.stringify(['Στοιχεία','Εικόνες']),'provider editor has Details and Images tabs');
  console.log('Provider editor keyboard arrows wrap and preserve labelled panels');
  assert(await c.call("function(){const tab=document.querySelector('#provider-editor-tab-details');tab?.focus();return document.activeElement===tab}"),'Details tab receives keyboard focus');
  const verifyEditorTab=async id=>{await waitFor("function(id){const tabs=[...document.querySelectorAll('.provider-editor-tabs [role=tab]')],selected=tabs.filter(tab=>tab.getAttribute('aria-selected')==='true'),active=selected[0],panel=document.querySelector('.provider-editor-body [role=tabpanel]');return selected.length===1&&tabs.filter(tab=>tab.tabIndex===0).length===1&&active?.id==='provider-editor-tab-'+id&&document.activeElement===active&&panel?.id==='provider-editor-panel-'+id&&panel.getAttribute('aria-labelledby')===active.id}",'provider keyboard selects '+id,[id])};
  await press('ArrowRight','ArrowRight',39);await verifyEditorTab('branding');
  await press('Home','Home',36);await verifyEditorTab('details');
  await press('ArrowLeft','ArrowLeft',37);await verifyEditorTab('branding');
  await press('End','End',35);await verifyEditorTab('branding');
  await press('Home','Home',36);await verifyEditorTab('details');
  const providerIdLayout=await c.call("function(){const root=document.querySelector('.provider-id-field'),label=root?.querySelector('span'),key=root?.querySelector('code'),hint=root?.querySelector('small');if(!root||!label||!key||!hint)return null;const a=label.getBoundingClientRect(),b=key.getBoundingClientRect(),c=hint.getBoundingClientRect();return {display:getComputedStyle(root).display,wrap:getComputedStyle(root).overflowWrap,spaced:a.bottom+2<=b.top&&b.bottom+2<=c.top,overflow:root.scrollWidth-root.clientWidth}}");
  assert(providerIdLayout?.display==='grid'&&providerIdLayout.wrap==='anywhere'&&providerIdLayout.spaced&&providerIdLayout.overflow<=1,'Provider ID label, read-only key and help are separate readable rows: '+JSON.stringify(providerIdLayout));
  await shot('provider-editor-details-light-desktop');
  await viewport(375,812,true);await noOverflow('provider details mobile');await shot('provider-editor-details-light-mobile');await viewport(1440,1000,false);
  await openBranding();
  const brandingState=await c.call(`function(){const groups=[...document.querySelectorAll('.provider-brand-group>header h4')].map(node=>(node.textContent||'').trim());const text=document.querySelector('.provider-branding-panel')?.textContent||'';return {groups,slots:document.querySelectorAll('.provider-slot-card').length,text}}`);
  assert(brandingState.slots===9,'branding editor exposes nine semantic slots');
  assert(brandingState.groups.includes('Λογότυπο εφαρμογής')&&brandingState.groups.includes('Λεκτικό σήμα εφαρμογής')&&brandingState.groups.includes('Κάρτες'),'branding groups are task-oriented');
  assert(brandingState.text.includes('Το θέμα της εφαρμογής δεν επηρεάζει τις κάρτες.'),'card artwork is explicitly independent from app theme');
  await chooseSlot('Βασικό λογότυπο');
  await waitFor("function(){const picker=document.querySelector('.provider-asset-picker[aria-modal=true]');return !!picker&&picker.contains(document.activeElement)}",'asset picker owns focus');
  const escaped=await c.call("function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true}");
  assert(escaped,'Escape is dispatched to topmost asset picker');
  await waitFor("function(){return !document.querySelector('.provider-asset-picker')&&!!document.querySelector('.provider-editor-modal')}",'Escape closes picker but preserves provider editor');
  await chooseSlot('Βασικό λογότυπο');
  await uploadSyntheticSvg('qa-shared.svg');
  await waitFor("function(){return [...document.querySelectorAll('.provider-slot-card')].some(card=>(card.textContent||'').includes('Βασικό λογότυπο')&&(card.textContent||'').includes('qa-shared.svg'))}",'uploaded logo assigned once');
  assert(await c.call("function(){return document.querySelectorAll('.provider-library-item').length}")===6,'one upload extends the five-asset Piraeus library to six');

  await chooseSlot('Βασικό λεκτικό σήμα');
  const pickerAssets=await c.call("function(){return [...document.querySelectorAll('.provider-picker-asset b')].map(node=>(node.textContent||'').trim())}");
  assert(pickerAssets.includes('qa-shared.svg'),'already-uploaded asset is available in picker');
  await shot('provider-asset-picker-reuse-light-desktop');
  await clickText('.provider-picker-asset','qa-shared.svg');
  await waitFor("function(){return [...document.querySelectorAll('.provider-slot-card')].filter(card=>(card.textContent||'').includes('qa-shared.svg')).length>=2}",'same asset reused in second slot');
  const reuse=await c.call("function(){return [...document.querySelectorAll('.provider-slot-card')].some(card=>(card.textContent||'').includes('χρησιμοποιείται σε 2 θέσεις'))}");
  assert(reuse,'reuse count is visible to the user');
  assert(await c.call("function(){return document.querySelectorAll('.provider-library-item').length}")===6,'reuse does not duplicate the six-item asset library');
  await shot('provider-editor-branding-reuse-light-desktop');

  assert(await applyTheme('dark')==='dark','dark theme resolves while editor is open');
  await shot('provider-editor-branding-reuse-dark-desktop');
  await installProviderReplacementBackend();
  await clickText('.provider-editor-footer button','Αποθήκευση');
  await waitFor("function(){return !document.querySelector('.provider-editor-modal')}",'saved provider editor closes for dark provider-list evidence');
  await waitFor("function(){const image=document.querySelector('[data-bank-brand=\\\"piraeus\\\"] img');return !!image&&image.complete&&image.naturalWidth>0}",'rebound provider-list artwork');
  const replacedSource=await c.call("function(){return document.querySelector('[data-bank-brand=\\\"piraeus\\\"] img')?.src||''}");
  assert(Boolean(replacedSource)&&replacedSource!==piraeusSource,'uploaded provider asset replaces the prior base-logo binding');
  await shot('provider-list-dark-desktop');
  await clickText('.sidebar nav button','Dashboard');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Οι λογαριασμοί μου')}",'Dashboard after provider artwork replacement');
  await waitFor("function(expected){const image=document.querySelector('[data-bank-brand=\\\"piraeus\\\"] img');return !!image&&image.complete&&image.naturalWidth>0&&image.src===expected}",'Dashboard refreshes the replaced provider artwork binding',[replacedSource]);
  await shot('provider-replaced-artwork-dashboard-dark-desktop');
  await restoreProviderReplacementBackend();
  await clickText('.sidebar nav button','Ρυθμίσεις');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')&&!!document.querySelector('.settings-tablist')}",'Settings after cross-surface provider proof');
  await clickAccounts();
  const reopened=await c.call("function(){const button=document.querySelector('.provider-edit-action');button?.click();return Boolean(button)}");assert(reopened,'existing provider editor reopens');
  await waitFor("function(){return !!document.querySelector('.provider-editor-modal')}",'provider editor reopens');
  await openBranding();
  await viewport(375,812,true);await noOverflow('provider editor mobile');await shot('provider-editor-branding-dark-mobile');

  await viewport(1440,1000,false);
  assert(await applyTheme('light')==='light','create flow resets to light theme for desktop evidence');
  await c.call(`function(){document.querySelector('.provider-editor-header button[aria-label="Κλείσιμο"]')?.click();return true}`);
  await waitFor("function(){return !document.querySelector('.provider-editor-modal')}",'existing editor closes');
  await clickText('.provider-management button','Νέος πάροχος');
  await waitFor("function(){return !!document.querySelector('.provider-editor-modal')}",'new provider editor');
  console.log('Provider new provider cannot bypass validation by keyboard');
  assert(await c.call("function(){const tab=document.querySelector('#provider-editor-tab-details');tab?.focus();return document.activeElement===tab}"),'new provider starts on Details tab');
  await press('ArrowRight','ArrowRight',39);
  await waitFor("function(){return Boolean(document.querySelector('.provider-editor-error'))}",'new provider validation error');
  assert(await c.call("function(){return Boolean(document.querySelector('.provider-details-panel'))&&!document.querySelector('.provider-branding-panel')&&document.activeElement?.id==='provider-editor-tab-details'}"),'new provider cannot bypass validation by keyboard');
  const details=await c.call(`function(){const set=(placeholder,value)=>{const input=[...document.querySelectorAll('.provider-details-panel input')].find(node=>node.getAttribute('placeholder')===placeholder);if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));return true};return set('π.χ. Νέα Τράπεζα','QA Bank')}`);
  assert(details,'new-provider details are editable through app-owned controls');
  await sleep(100);
  await shot('provider-create-details-light-desktop');
  await clickText('.provider-editor-footer button','Συνέχεια στις εικόνες');
  await waitFor("function(){return !!document.querySelector('.provider-branding-panel')}",'new provider branding tab');
  await chooseSlot('Βασικό λογότυπο');
  await uploadSyntheticSvg('qa-new-provider.svg');
  await waitFor("function(){return document.querySelectorAll('.provider-library-item').length===1}",'new-provider upload enters local asset library');
  await chooseSlot('Βασικό λεκτικό σήμα');
  await clickText('.provider-picker-asset','qa-new-provider.svg');
  const createReuse=await c.call("function(){return document.querySelectorAll('.provider-library-item').length===1&&[...document.querySelectorAll('.provider-slot-card')].filter(card=>(card.textContent||'').includes('qa-new-provider.svg')).length>=2}");
  assert(createReuse,'create flow reuses one pending image for logo and wordmark');
  await shot('provider-create-branding-light-desktop');

  await viewport(375,812,true);assert(await applyTheme('dark')==='dark','mobile create flow follows dark app theme');await noOverflow('new provider mobile');await shot('provider-create-branding-dark-mobile');
  await viewport(1440,1000,false);await fullShot('provider-editor-branding-full-desktop');

  console.log('Provider branding task-flow QA: partial provider metadata commit must not look like a failed initial write');
  await c.call(`async function(){
    const original=globalThis.fetch.bind(globalThis);
    const provider=globalThis.__qaNewProvider={creates:0,updates:0,uploads:0,bindings:0,bindingSlots:[],assetKey:'qa-bank-asset-abcdef123456',invalidReceipts:0,badReceiptOnce:true};
    globalThis.__myfinhubOriginalFetch=original;
    globalThis.fetch=async function(input,init){
      const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
      const url=new URL(raw,location.href);
      const method=String(init?.method||'GET').toUpperCase();
      const resource=url.searchParams.get('resource');
      if(url.pathname==='/api/account-metadata'&&resource==='financial-providers'&&(method==='POST'||method==='PATCH')){
        if(method==='POST'&&provider.badReceiptOnce){
          provider.badReceiptOnce=false;provider.invalidReceipts+=1;
          // Ambiguous metadata response: even HTTP 200 must not imply durable
          // success if it omitted the requested provider receipt.
          return new Response(JSON.stringify({provider:{id:'qa-bank'}}),{status:200,headers:{'content-type':'application/json'}});
        }
        if(method==='POST')provider.creates+=1;else provider.updates+=1;
        const saved=JSON.parse(String(init?.body||'{}'));
        const catalog=(await import('/src/lib/financialProviderClient.ts')).getFinancialProviderSnapshot().providers;
        let row=catalog.find(item=>item.id===saved.id);
        if(!row){
          row={id:saved.id,displayName:saved.displayName,shortName:saved.shortName,kind:saved.providerKind,kindLabel:'Τράπεζα',
            countryCode:saved.countryCode,sortOrder:saved.sortOrder,logoAssetKey:null,wordmarkAssetKey:null,
            logoUrl:null,wordmarkUrl:null,assets:[],bindings:[]};
          catalog.push(row);
        }else{
          Object.assign(row,{displayName:saved.displayName,shortName:saved.shortName,kind:saved.providerKind,countryCode:saved.countryCode,sortOrder:saved.sortOrder});
        }
        return new Response(JSON.stringify({provider:saved}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.pathname==='/api/account-metadata'&&resource==='financial-provider-assets'&&method==='PUT'){
        provider.uploads+=1;
        const asset={assetKey:provider.assetKey,role:'logo',variant:'universal',url:'https://assets.example/qa-new-provider.svg',fileName:'qa-new-provider.svg',mimeType:init?.body?.type||'image/svg+xml',sizeBytes:init?.body?.size??0};
        const catalog=(await import('/src/lib/financialProviderClient.ts')).getFinancialProviderSnapshot().providers;
        const row=catalog.find(item=>item.id==='qa-bank');
        if(!row)throw new Error('QA provider metadata missing before asset upload');
        row.assets=[...(row.assets||[]).filter(item=>item.assetKey!==asset.assetKey),asset];
        return new Response(JSON.stringify({asset}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.pathname==='/api/account-metadata'&&resource==='financial-provider-asset-binding'&&method==='PUT'){
        provider.bindings+=1;
        const data=JSON.parse(String(init?.body||'{}'));
        provider.bindingSlots.push(data.role+':'+data.variant);
        // First logo binding is durable, second wordmark binding fails.
        // Retry must not repeat the already acknowledged logo mutation.
        if(provider.bindings===2)return new Response(JSON.stringify({error:'Synthetic wordmark binding rejection after durable provider, upload and logo binding'}),{status:503,headers:{'content-type':'application/json'}});
        const catalog=(await import('/src/lib/financialProviderClient.ts')).getFinancialProviderSnapshot().providers;
        const row=catalog.find(item=>item.id===data.providerId);
        if(!row)throw new Error('QA provider metadata missing before asset binding');
        row.bindings=[...(row.bindings||[]).filter(item=>item.role!==data.role||item.variant!==data.variant)];
        if(data.assetKey)row.bindings.push({role:data.role,variant:data.variant,assetKey:data.assetKey});
        if(data.variant==='universal'&&(data.role==='logo'||data.role==='wordmark')){
          const key=data.role==='logo'?'logoAssetKey':'wordmarkAssetKey',urlKey=data.role==='logo'?'logoUrl':'wordmarkUrl';
          row[key]=data.assetKey??null;row[urlKey]=row.assets?.find(item=>item.assetKey===data.assetKey)?.url??null;
        }
        return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
      }
      return original(input,init);
    };
    return true;
  }`);
  console.log('Provider save HTTP 200 without a valid matching receipt cannot show success or upload assets');
  await clickText('.provider-editor-footer button','Δημιουργία παρόχου');
  await waitFor("function(){return (document.querySelector('.provider-editor-error[role=alert]')?.textContent||'').includes('δεν επιβεβαιώθηκε με έγκυρη απόκριση')}",'metadata 200 without matching receipt is reported as unverified instead of green');
  const invalidReceipt=await c.call("function(){const mock=globalThis.__qaNewProvider;return {bad:mock?.invalidReceipts,creates:mock?.creates,uploads:mock?.uploads,bindings:mock?.bindings,editor:Boolean(document.querySelector('.provider-editor-modal')),success:(document.querySelector('.provider-management-message')?.textContent||'').trim()}}");
  assert(invalidReceipt.bad===1&&invalidReceipt.creates===0&&invalidReceipt.uploads===0&&invalidReceipt.bindings===0&&invalidReceipt.editor&&!invalidReceipt.success,
    'invalid provider HTTP 200 receipt cannot trigger upload, binding or all-success; draft remains editable');
  await shot('provider-create-invalid-200-receipt-warning-desktop');

  console.log('Provider save single-flight blocks same-tick double click before React busy state');
  const doubleProviderCreate=await c.call("function(){const button=[...document.querySelectorAll('.provider-editor-footer button')].find(el=>(el.textContent||'').includes('Δημιουργία παρόχου'));if(!button)return false;button.click();button.click();return true}");
  assert(doubleProviderCreate,'provider create can be activated twice synchronously in synthetic probe');
  await waitFor("function(){const warning=document.querySelector('.provider-editor-warning[data-feedback-tone=\"warning\"]');return Boolean(warning)&&(warning.textContent||'').includes('Τα στοιχεία του παρόχου αποθηκεύτηκαν')}",'partial provider warning state after binding rejection');
  const partialFailure=await c.call("function(){const mock=globalThis.__qaNewProvider;const notice=document.querySelector('.provider-editor-warning'),footer=document.querySelector('.provider-editor-footer'),save=footer?.querySelector('button:last-child');const nr=notice?.getBoundingClientRect(),sr=save?.getBoundingClientRect();return {editorOpen:Boolean(document.querySelector('.provider-editor-modal')),success:(document.querySelector('.provider-management-message')?.textContent||'').trim(),saveLabel:(save?.textContent||'').trim(),warning:(notice?.textContent||'').trim(),role:notice?.getAttribute('role'),inFooter:Boolean(notice?.closest('.provider-editor-feedback')),visible:Boolean(nr&&nr.top>=0&&nr.bottom<=innerHeight&&sr&&sr.bottom<=innerHeight&&nr.bottom<=sr.top),uploads:mock?.uploads,creates:mock?.creates,bindings:mock?.bindings,slots:mock?.bindingSlots,hasError:Boolean(document.querySelector('.provider-editor-error'))}}");
  assert(partialFailure.editorOpen,'partial provider failure keeps the editor recoverable');
  assert(!partialFailure.success&&!partialFailure.hasError,'acknowledged metadata save is announced as partial warning, not all success or initial rejection');
  assert(partialFailure.role==='alert','partially saved provider operation is announced accessibly');
  assert(partialFailure.creates===1&&partialFailure.uploads===1&&partialFailure.bindings===2,'provider and binary each acknowledged once, first binding committed before second rejected');
  assert(JSON.stringify(partialFailure.slots)===JSON.stringify(['logo:universal','wordmark:universal']),'provider writes the logo before rejecting wordmark');
  assert(partialFailure.inFooter&&partialFailure.visible,'partial save warning and retry remain visibly anchored above the actions');
  assert(partialFailure.saveLabel.includes('Αποθήκευση'),'new provider is treated as existing after the provider row was already created');
  await shot('provider-create-partial-binding-warning-desktop');
  await viewport(375,812,true);
  await noOverflow('provider partial save warning mobile');
  const mobileWarning=await c.call("function(){const notice=document.querySelector('.provider-editor-warning'),button=document.querySelector('.provider-editor-footer button:last-child');const a=notice?.getBoundingClientRect(),b=button?.getBoundingClientRect();return Boolean(a&&b&&a.left>=-1&&a.right<=innerWidth+1&&a.top>=0&&a.bottom<=innerHeight&&a.bottom<=b.top&&b.bottom<=innerHeight)}");
  assert(mobileWarning,'375px partial save warning and retry button stay visible without scrolling the branding gallery');
  await shot('provider-create-partial-binding-warning-mobile');
  await viewport(1440,1000,false);
  await clickText('.provider-editor-footer button','Αποθήκευση');
  await waitFor("function(){return !document.querySelector('.provider-editor-modal')}",'retry completes provider bindings without retransmitting uploaded file');
  const settled=await c.call("function(){const p=globalThis.__qaNewProvider;return {creates:p.creates,updates:p.updates,uploads:p.uploads,bindings:p.bindings,slots:p.bindingSlots,success:(document.querySelector('.provider-management-message')?.textContent||'').trim()}}");
  assert(settled.creates===1&&settled.updates===1&&settled.uploads===1&&settled.bindings===3,'acknowledged upload and logo binding are not duplicated after later wordmark failure');
  assert(JSON.stringify(settled.slots)===JSON.stringify(['logo:universal','wordmark:universal','wordmark:universal']),'only rejected wordmark binding is retried');
  assert(settled.success.includes('ενημερώθηκε')||settled.success.includes('δημιουργήθηκε'),'eventual provider success follows accepted bindings');
  await c.call("function(){if(globalThis.__myfinhubOriginalFetch){globalThis.fetch=globalThis.__myfinhubOriginalFetch;delete globalThis.__myfinhubOriginalFetch;delete globalThis.__qaNewProvider}return true}");


  console.log('Provider upload HTTP 200 with an invalid binary receipt cannot silently succeed or replay a fresh-key upload');
  await clickText('.provider-management button','Νέος πάροχος');
  await waitFor("function(){return !!document.querySelector('.provider-details-panel')}",'new provider for ambiguous asset response');
  const filled=await c.call(`function(){
    const field=[...document.querySelectorAll('.provider-details-panel input')].find(input=>input.placeholder==='π.χ. Νέα Τράπεζα');
    if(!field)return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'QA Unverified');
    field.dispatchEvent(new Event('input',{bubbles:true}));return true;
  }`);
  assert(filled,'provider details accept synthetic ambiguous receipt fixture');
  await waitFor("function(){return document.querySelector('.provider-id-field input')?.value==='qa-unverified'}",'unverified provider key is derived from name');
  await clickText('.provider-editor-footer button','Συνέχεια στις εικόνες');
  await waitFor("function(){return !!document.querySelector('.provider-branding-panel')}",'ambiguous provider branding');
  await chooseSlot('Βασικό λογότυπο');
  await uploadSyntheticSvg('qa-unverified.svg');
  await waitFor("function(){return !!document.querySelector('.provider-picker-asset')===false&&!document.querySelector('.provider-asset-picker')}",'local upload selects pending logo');
  await chooseSlot('Βασικό λεκτικό σήμα');
  await clickText('.provider-picker-asset','qa-unverified.svg');
  await c.call(`function(){
    const original=globalThis.fetch.bind(globalThis);
    globalThis.__myfinhubUnverifiedOriginalFetch=original;
    const state=globalThis.__qaUnverifiedAsset={creates:0,uploads:0,bindings:0};
    globalThis.fetch=async function(input,init){
      const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
      const url=new URL(raw,location.href),method=String(init?.method||'GET').toUpperCase();
      const resource=url.searchParams.get('resource');
      if(url.pathname==='/api/account-metadata'&&resource==='financial-providers'&&method==='POST'){
        state.creates++;
        return new Response(JSON.stringify({provider:JSON.parse(String(init?.body||'{}'))}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.pathname==='/api/account-metadata'&&resource==='financial-provider-assets'&&method==='PUT'){
        state.uploads++;
        // The upstream write might have committed, but its HTTP-200 body
        // does not identify the binary. Retrying could generate a second key.
        return new Response(JSON.stringify({asset:{assetKey:'unexpected-key'}}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.pathname==='/api/account-metadata'&&resource==='financial-provider-asset-binding'&&method==='PUT'){
        state.bindings++;return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
      }
      return original(input,init);
    };
    return true;
  }`);
  await clickText('.provider-editor-footer button','Δημιουργία παρόχου');
  await waitFor("function(){const warning=document.querySelector('.provider-editor-warning');const save=document.querySelector('.provider-editor-footer button:last-child');return !!warning&&(warning.textContent||'').includes('αβέβαιη')&&save?.disabled}",'unverified binary receipt warning prevents blind repeat');
  const unknown=await c.call("function(){const mock=globalThis.__qaUnverifiedAsset,warning=document.querySelector('.provider-editor-warning'),save=document.querySelector('.provider-editor-footer button:last-child'),bounds=warning?.getBoundingClientRect(),button=save?.getBoundingClientRect();return {creates:mock?.creates,uploads:mock?.uploads,bindings:mock?.bindings,disabled:save?.disabled,editorOpen:!!document.querySelector('.provider-editor-modal'),warningRole:warning?.getAttribute('role'),visible:!!(bounds&&button&&bounds.top>=0&&bounds.bottom<=button.top&&button.bottom<=innerHeight),success:!!document.querySelector('.provider-management-message')}}");
  assert(unknown.creates===1&&unknown.uploads===1&&unknown.bindings===0&&unknown.disabled&&unknown.editorOpen&&!unknown.success,
    'an ambiguous HTTP-200 upload is neither all-green nor eligible for automatic replay');
  assert(unknown.warningRole==='alert'&&unknown.visible,'the warning remains accessible and visibly above disabled actions');
  await shot('provider-create-unverified-asset-warning-desktop');
  await c.call("function(){document.querySelector('.provider-editor-footer button:last-child')?.click();return true}");
  const afterDisabled=await c.call("function(){const p=globalThis.__qaUnverifiedAsset;return {creates:p.creates,uploads:p.uploads,bindings:p.bindings}}");
  assert(afterDisabled.creates===1&&afterDisabled.uploads===1&&afterDisabled.bindings===0,'clicking disabled Save never duplicates any uncertain write');
  await viewport(375,812,true);await noOverflow('unverified asset warning mobile');
  const unknownMobile=await c.call("function(){const a=document.querySelector('.provider-editor-warning')?.getBoundingClientRect(),b=document.querySelector('.provider-editor-footer button:last-child')?.getBoundingClientRect();return !!(a&&b&&a.left>=-1&&a.right<=innerWidth+1&&a.top>=0&&a.bottom<=b.top&&b.bottom<=innerHeight)}");
  assert(unknownMobile,'375px unverified receipt warning and disabled Save fit without clipping');
  await shot('provider-create-unverified-asset-warning-mobile');
  await clickText('.provider-editor-footer button','Ακύρωση');
  await waitFor("function(){return !document.querySelector('.provider-editor-modal')}",'close unverified provider without a second write');
  await c.call("function(){globalThis.fetch=globalThis.__myfinhubUnverifiedOriginalFetch;delete globalThis.__myfinhubUnverifiedOriginalFetch;delete globalThis.__qaUnverifiedAsset;return true}");


  console.log('Provider catalog 200 with stale metadata and absent asset/bindings must never close with all-success');
  await viewport(1440,1000,false);
  await clickText('.provider-management button','Νέος πάροχος');
  await waitFor("function(){return !!document.querySelector('.provider-details-panel')}",'stale-catalog provider editor');
  const entered=await c.call(`function(){
    const field=[...document.querySelectorAll('.provider-details-panel input')].find(input=>input.placeholder==='π.χ. Νέα Τράπεζα');
    if(!field)return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'QA Stale');
    field.dispatchEvent(new Event('input',{bubbles:true}));return true;
  }`);
  assert(entered,'stale provider name is edited through the real input');
  await waitFor("function(){return document.querySelector('.provider-id-field input')?.value==='qa-stale'}",'stale provider id generated');
  await clickText('.provider-editor-footer button','Συνέχεια στις εικόνες');
  await waitFor("function(){return !!document.querySelector('.provider-branding-panel')}",'stale provider branding');
  await chooseSlot('Βασικό λογότυπο');
  await uploadSyntheticSvg('qa-stale.svg');
  await waitFor("function(){return !document.querySelector('.provider-asset-picker')}",'stale provider local image selected');
  await chooseSlot('Βασικό λεκτικό σήμα');
  await clickText('.provider-picker-asset','qa-stale.svg');
  await c.call(`function(){
    const original=globalThis.fetch.bind(globalThis),state=globalThis.__qaStaleReadback={creates:0,updates:0,uploads:0,bindings:0};
    globalThis.__qaStaleOriginalFetch=original;
    globalThis.fetch=async function(input,init){
      const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
      const url=new URL(raw,location.href),method=String(init?.method||'GET').toUpperCase(),resource=url.searchParams.get('resource');
      if(url.pathname==='/api/account-metadata'&&resource==='financial-providers'&&(method==='POST'||method==='PATCH')){
        if(method==='POST')state.creates++;else state.updates++;
        // The write receipt is valid but catalog readback remains stale.
        return new Response(JSON.stringify({provider:JSON.parse(String(init?.body||'{}'))}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.pathname==='/api/account-metadata'&&resource==='financial-provider-assets'&&method==='PUT'){
        state.uploads++;
        return new Response(JSON.stringify({asset:{
          assetKey:'qa-stale-asset-112233aabbcc',role:'logo',variant:'universal',fileName:'qa-stale.svg',
          mimeType:init?.body?.type||'image/svg+xml',sizeBytes:init?.body?.size??0,
          url:'https://assets.example/qa-stale.svg',
        }}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.pathname==='/api/account-metadata'&&resource==='financial-provider-asset-binding'&&method==='PUT'){
        state.bindings++;return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
      }
      return original(input,init);
    };return true;
  }`);
  await clickText('.provider-editor-footer button','Δημιουργία παρόχου');
  await waitFor("function(){return (document.querySelector('.provider-editor-warning')?.textContent||'').includes('δεν επιβεβαίωσε ακόμη')}",'valid-looking stale catalog refuses all-green completion');
  await waitFor("function(){const progress=document.querySelector('[data-save-progress=error]');return !!progress&&progress.getAttribute('role')==='alert'&&(progress.getAttribute('aria-label')||'').includes('επαλήθευση αποθήκευσης δεν ολοκληρώθηκε')}",'stale catalog readback has red top-edge feedback labelled unverified, not a green success receipt');
  const stale=await c.call("function(){const s=globalThis.__qaStaleReadback,w=document.querySelector('.provider-editor-warning'),save=document.querySelector('.provider-editor-footer button:last-child'),a=w?.getBoundingClientRect(),b=save?.getBoundingClientRect();return {creates:s.creates,updates:s.updates,uploads:s.uploads,bindings:s.bindings,open:!!document.querySelector('.provider-editor-modal'),success:!!document.querySelector('.provider-management-message'),role:w?.getAttribute('role'),visible:!!(a&&b&&a.top>=0&&a.bottom<=b.top&&b.bottom<=innerHeight)}}");
  assert(stale.creates===1&&stale.updates===0&&stale.uploads===1&&stale.bindings===2&&stale.open&&!stale.success,'HTTP 200 stale catalog retains editor with no false success after acknowledged writes');
  assert(stale.role==='alert'&&stale.visible,'stale catalog discrepancy appears visibly and accessibly before Save');
  assert(await c.call("function(){return !document.querySelector('[data-save-progress=success]')&&!!document.querySelector('[data-save-progress=error]')}"),'unverified aggregate readback never retains a green save status');
  await shot('provider-create-stale-catalog-warning-desktop');
  await viewport(375,812,true);await noOverflow('stale provider catalog mobile');
  const staleMobile=await c.call("function(){const a=document.querySelector('.provider-editor-warning')?.getBoundingClientRect(),b=document.querySelector('.provider-editor-footer button:last-child')?.getBoundingClientRect();return !!(a&&b&&a.left>=-1&&a.right<=innerWidth+1&&a.top>=0&&a.bottom<=b.top&&b.bottom<=innerHeight)}");
  assert(staleMobile,'375px stale-catalog warning is visible above Save');
  await shot('provider-create-stale-catalog-warning-mobile');
  await viewport(1440,1000,false);
  await clickText('.provider-editor-footer button','Αποθήκευση');
  await waitFor("function(){return globalThis.__qaStaleReadback?.updates===1&&!!document.querySelector('.provider-editor-warning')&&!document.querySelector('.provider-editor-footer button:last-child')?.disabled}",'stale-catalog retry finishes and remains unverified without duplicating the binary');
  const staleRetry=await c.call("function(){const s=globalThis.__qaStaleReadback;return {creates:s.creates,updates:s.updates,uploads:s.uploads,bindings:s.bindings}}");
  assert(staleRetry.creates===1&&staleRetry.updates===1&&staleRetry.uploads===1&&staleRetry.bindings===2,'stale catalog retry never re-uploads acknowledged binary or already acknowledged slots');
  await clickText('.provider-editor-footer button','Ακύρωση');
  await waitFor("function(){return !document.querySelector('.provider-editor-modal')}",'stale provider editor closes explicitly');
  await c.call("function(){globalThis.fetch=globalThis.__qaStaleOriginalFetch;delete globalThis.__qaStaleOriginalFetch;delete globalThis.__qaStaleReadback;return true}");

  console.log('Shared compact Transactions filters remain at least 12px');
  const transactionUrl=new URL(baseUrl);transactionUrl.searchParams.set('page','transactions');
  await viewport(1440,1000,false);
  await c.send('Page.navigate',{url:transactionUrl.href});
  await waitFor("function(){return Boolean(document.querySelector('.transaction-filter-controls .owned-input'))}",'Transactions owned filters');
  const filters=await c.call("function(){const nodes=[...document.querySelectorAll('.transaction-filter-controls .owned-input')].filter(node=>node.getClientRects().length);if(!nodes.length)return {present:false};nodes[0].scrollIntoView({block:'center',behavior:'instant'});return {present:true,fontSizes:nodes.map(node=>parseFloat(getComputedStyle(node).fontSize)),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}}");
  assert(filters.present&&filters.fontSizes.every(size=>size>=12)&&filters.overflow<=1,'compact Transactions filters remain at least 12px without document overflow: '+JSON.stringify(filters));
  await shot('shared-compact-transaction-filters-desktop');
  console.log('Provider branding task-flow QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
