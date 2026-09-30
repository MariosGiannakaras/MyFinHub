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
  assert(brandingState.groups.includes('Logo εφαρμογής')&&brandingState.groups.includes('Wordmark εφαρμογής')&&brandingState.groups.includes('Κάρτες'),'branding groups are task-oriented');
  assert(brandingState.text.includes('Το Light/Dark theme της εφαρμογής δεν συμμετέχει.'),'card artwork is explicitly independent from app theme');
  await chooseSlot('Προεπιλεγμένο logo');
  await uploadSyntheticSvg('qa-shared.svg');
  await waitFor("function(){return [...document.querySelectorAll('.provider-slot-card')].some(card=>(card.textContent||'').includes('Προεπιλεγμένο logo')&&(card.textContent||'').includes('qa-shared.svg'))}",'uploaded logo assigned once');
  assert(await c.call("function(){return document.querySelectorAll('.provider-library-item').length}")===1,'one upload creates one library asset');

  await chooseSlot('Προεπιλεγμένο wordmark');
  const pickerAssets=await c.call("function(){return [...document.querySelectorAll('.provider-picker-asset b')].map(node=>(node.textContent||'').trim())}");
  assert(pickerAssets.includes('qa-shared.svg'),'already-uploaded asset is available in picker');
  await clickText('.provider-picker-asset','qa-shared.svg');
  await waitFor("function(){return [...document.querySelectorAll('.provider-slot-card')].filter(card=>(card.textContent||'').includes('qa-shared.svg')).length>=2}",'same asset reused in second slot');
  const reuse=await c.call("function(){return [...document.querySelectorAll('.provider-slot-card')].some(card=>(card.textContent||'').includes('χρησιμοποιείται σε 2 θέσεις'))}");
  assert(reuse,'reuse count is visible to the user');
  assert(await c.call("function(){return document.querySelectorAll('.provider-library-item').length}")===1,'reuse does not duplicate the asset library');
  await shot('provider-editor-branding-reuse-light-desktop');

  assert(await applyTheme('dark')==='dark','dark theme resolves while editor is open');
  await shot('provider-editor-branding-reuse-dark-desktop');
  await viewport(375,812,true);await noOverflow('provider editor mobile');await shot('provider-editor-branding-dark-mobile');

  await viewport(1440,1000,false);
  await c.call("function(){document.querySelector('.provider-editor-header button[aria-label=Κλείσιμο]')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.provider-editor-modal')}",'existing editor closes');
  await clickText('.provider-management button','Νέος πάροχος');
  await waitFor("function(){return !!document.querySelector('.provider-editor-modal')}",'new provider editor');
  const details=await c.call(`function(){const set=(placeholder,value)=>{const input=[...document.querySelectorAll('.provider-details-panel input')].find(node=>node.getAttribute('placeholder')===placeholder);if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));return true};return set('π.χ. Νέα Τράπεζα','QA Bank')}`);
  assert(details,'new-provider details are editable through app-owned controls');
  await sleep(100);
  await clickText('.provider-editor-footer button','Συνέχεια στις εικόνες');
  await waitFor("function(){return !!document.querySelector('.provider-branding-panel')}",'new provider branding tab');
  await chooseSlot('Προεπιλεγμένο logo');
  await uploadSyntheticSvg('qa-new-provider.svg');
  await waitFor("function(){return document.querySelectorAll('.provider-library-item').length===1}",'new-provider upload enters local asset library');
  await chooseSlot('Προεπιλεγμένο wordmark');
  await clickText('.provider-picker-asset','qa-new-provider.svg');
  const createReuse=await c.call("function(){return document.querySelectorAll('.provider-library-item').length===1&&[...document.querySelectorAll('.provider-slot-card')].filter(card=>(card.textContent||'').includes('qa-new-provider.svg')).length>=2}");
  assert(createReuse,'create flow reuses one pending image for logo and wordmark');
  await shot('provider-create-branding-light-desktop');

  await viewport(375,812,true);assert(await applyTheme('dark')==='dark','mobile create flow follows dark app theme');await noOverflow('new provider mobile');await shot('provider-create-branding-dark-mobile');
  await viewport(1440,1000,false);await fullShot('provider-editor-branding-full-desktop');

  console.log('Provider branding task-flow QA passed.');
}finally{c?.close();child.kill('SIGTERM')}
