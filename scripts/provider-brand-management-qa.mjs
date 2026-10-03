import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-provider-brand-management-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for provider branding QA.');
const port=9263;
const profile='/tmp/myfinhub-provider-brand-management-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Provider branding QA assertion failed: ${message}`)};
let c=null;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('visual','1');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
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
      const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" rx="12" fill="#0f766e"/><path d="M18 42 34 18h12L30 42zm32 0 16-24h12L62 42z" fill="white"/></svg>';
      const assetUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
      const assetKey='qa-provider-replacement-logo';
      control.__myfinhubProviderReplaceOriginalFetch=original;
      globalThis.fetch=async function(input,init){
        const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
        const requestUrl=new URL(raw,location.href);
        const method=String(init?.method||'GET').toUpperCase();
        const resource=requestUrl.searchParams.get('resource');
        if(requestUrl.pathname==='/api/account-metadata'&&resource==='financial-providers'&&method==='PATCH'){
          return new Response(JSON.stringify({provider:{id:provider.id}}),{status:200,headers:{'content-type':'application/json'}});
        }
        if(requestUrl.pathname==='/api/account-metadata'&&resource==='financial-provider-assets'&&method==='PUT'){
          const asset={assetKey,role:requestUrl.searchParams.get('role')||'logo',variant:requestUrl.searchParams.get('variant')||'universal',url:assetUrl,fileName:requestUrl.searchParams.get('fileName')||'qa-shared.svg',mimeType:'image/svg+xml',sizeBytes:svg.length,updatedAt:'2026-10-03T00:00:00.000Z'};
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
          return new Response(JSON.stringify({binding:{providerId:provider.id,role,variant,assetKey:bindingKey}}),{status:200,headers:{'content-type':'application/json'}});
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
  await shot('provider-editor-details-light-desktop');
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

  console.log('Provider branding task-flow QA: partial create/upload failure recovery');
  await c.call(`function(){
    globalThis.__myfinhubOriginalFetch=globalThis.fetch;
    let count=0;
    globalThis.fetch=async function(input,init){
      const url=String(input);const method=String(init?.method||'GET');
      if(url.startsWith('/api/account-metadata?resource=financial-providers')&&method==='POST'){
        count+=1;
        return new Response(JSON.stringify({provider:{id:'qa-bank',displayName:'QA Bank',shortName:'QA Bank',providerKind:'bank',sortOrder:1000}}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(url.includes('/api/account-metadata?')&&url.includes('resource=financial-provider-assets')&&method==='PUT'){
        count+=1;
        return new Response(JSON.stringify({error:'Synthetic provider asset upload failure'}),{status:503,headers:{'content-type':'application/json'}});
      }
      return globalThis.__myfinhubOriginalFetch(input,init);
    };
    return true;
  }`);
  await clickText('.provider-editor-footer button','Δημιουργία παρόχου');
  await waitFor("function(){const error=document.querySelector('.provider-editor-error');return Boolean(error)&&(error.textContent||'').includes('Synthetic provider asset upload failure')}",'partial provider failure error state');
  const partialFailure=await c.call("function(){return {editorOpen:Boolean(document.querySelector('.provider-editor-modal')),success:(document.querySelector('.provider-management-message')?.textContent||'').trim(),saveLabel:(document.querySelector('.provider-editor-footer .primary')?.textContent||document.querySelector('.provider-editor-footer button:last-child')?.textContent||'').trim(),error:(document.querySelector('.provider-editor-error')?.textContent||'').trim()}}");
  assert(partialFailure.editorOpen,'partial provider failure keeps the editor recoverable');
  assert(!partialFailure.success,'partial provider failure never emits a false all-success message');
  assert(partialFailure.error.includes('Synthetic provider asset upload failure'),'partial provider failure surfaces the actionable task-local error');
  assert(partialFailure.saveLabel.includes('Αποθήκευση'),'new provider is treated as existing after the provider row was already created');
  await shot('provider-create-partial-upload-error-desktop');
  await c.call("function(){if(globalThis.__myfinhubOriginalFetch){globalThis.fetch=globalThis.__myfinhubOriginalFetch;delete globalThis.__myfinhubOriginalFetch}return true}");

  console.log('Provider branding task-flow QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
