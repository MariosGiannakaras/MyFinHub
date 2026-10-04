import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'visual-qa/icons';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for icon packs QA.');
const port=9262;
const profile='/tmp/myfinhub-icon-packs-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();this.listeners=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return}for(const fn of this.listeners.get(message.method)||[])fn(message.params)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  on(method,fn){const list=this.listeners.get(method)||[];list.push(fn);this.listeners.set(method,list)}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Icon packs QA assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('page','settings');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');
  const runtimeErrors=[];const failedRequests=[];
  c.on('Runtime.exceptionThrown',params=>runtimeErrors.push(params.exceptionDetails?.text||'runtime exception'));
  c.on('Network.loadingFailed',params=>{if(!params.canceled&&params.errorText!=='net::ERR_ABORTED')failedRequests.push(`${params.errorText||'network failure'} [${params.type||'unknown'}]`)});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i+=1){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clickText=async(selector,text)=>{const ok=await c.call("function(selector,text){const node=[...document.querySelectorAll(selector)].find(item=>(item.textContent||'').trim().includes(text));node?.click();return Boolean(node)}",[selector,text]);assert(ok,`missing clickable ${text}`);await sleep(120)};
  const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(shot.data,'base64'))};
  const noOverflow=async label=>{const value=await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");assert(value<=1,`${label} horizontal overflow ${value}px`)};

  await waitFor("function(){return Boolean(document.querySelector('.settings-tablist'))}",'settings tabs');
  await clickText('.settings-tablist button','Εικονίδια');
  await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only .category-icon-assignment-workspace .category-icon-library'))}",'icons workspace');

  const packs=await c.call("function(){return [...document.querySelectorAll('.settings-icons-only .category-icon-pack-switcher-global button')].map(button=>({name:(button.querySelector('b')?.textContent||'').trim(),license:(button.querySelector('small')?.textContent||'').trim(),pressed:button.getAttribute('aria-pressed'),preview:[...button.querySelectorAll('[data-icon-pack]')].map(node=>node.getAttribute('data-icon-pack'))}))}");
  assert(packs.length===5,`expected five icon packs, got ${packs.length}`);
  assert(JSON.stringify(packs.map(item=>item.name))===JSON.stringify(['Lucide','Tabler Icons','Phosphor','Heroicons','Bootstrap Icons']),'pack order and labels');
  assert(packs[0].license.startsWith('ISC')&&packs.slice(1).every(item=>item.license.startsWith('MIT')),'pack licenses');
  assert(packs[0].license.includes('πλήρες semantic set'),'Lucide discloses full semantic coverage');
  assert(packs[1].license.includes('14 διαθέσιμα')&&packs[2].license.includes('7 διαθέσιμα')&&packs[3].license.includes('5 διαθέσιμα')&&packs[4].license.includes('5 διαθέσιμα'),'curated packs disclose their actual distinct glyph counts');
  const expectedPackIds=['lucide','tabler','phosphor','heroicons','bootstrap'];
  assert(packs.every((item,index)=>item.preview.length===3&&item.preview.every(pack=>pack===expectedPackIds[index])),'each library preview is rendered only by its own pack');
  assert(packs[0].pressed==='true'&&packs.slice(1).every(item=>item.pressed==='false'),'Lucide is the default global pack');
  await waitFor("function(){return document.querySelectorAll('.settings-icons-only .category-icon-unified-category').length>=4}",'dense category list below pack selector');
  await waitFor("function(){return document.querySelectorAll('.settings-icons-only .category-icon-unified-subrow').length>=4}",'dense subcategory rows');
  const targetLabel=await c.call("function(){const row=document.querySelector('.settings-icons-only .category-icon-unified-category .category-icon-unified-main');return (row?.querySelector('.category-icon-unified-copy b')?.textContent||'').trim()}");
  assert(Boolean(targetLabel),'category target label exists');
  const rowState=label=>c.call("function(label){const rows=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-category .category-icon-unified-main')];const row=rows.find(item=>(item.querySelector('.category-icon-unified-copy b')?.textContent||'').trim()===label);const glyph=row?.querySelector('[data-icon-pack]');return row&&glyph?{pack:glyph.getAttribute('data-icon-pack'),key:glyph.getAttribute('data-category-icon'),text:row.textContent||'',color:getComputedStyle(glyph).color}:null}",[label]);
  const openRow=async label=>{const ok=await c.call("function(label){const rows=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-category .category-icon-unified-main')];const row=rows.find(item=>(item.querySelector('.category-icon-unified-copy b')?.textContent||'').trim()===label);row?.click();return Boolean(row)}",[label]);assert(ok,`category row ${label} opens`);await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-picker'))}",'shared category icon picker')};
  const closeEditor=async()=>{const close=await c.call("function(){const button=document.querySelector('.settings-icons-only .category-icon-selection-close');button?.click();return Boolean(button)}");assert(close,'icon editor close');await waitFor("function(){return !document.querySelector('.settings-icons-only [data-icon-selection-panel]')}",'icon editor close')};

  const initial=await rowState(targetLabel);
  assert(initial?.pack==='lucide',`initial category preview should be Lucide: ${JSON.stringify(initial)}`);
  await noOverflow('icons desktop');
  await screenshot('icon-packs-desktop');

  await clickText('.settings-icons-only .category-icon-pack-switcher-global button','Phosphor');
  await waitFor("function(){const button=[...document.querySelectorAll('.settings-icons-only .category-icon-pack-switcher-global button')].find(item=>(item.querySelector('b')?.textContent||'').trim()==='Phosphor');return button?.getAttribute('aria-pressed')==='true'}",'Phosphor selected');
  await waitFor("function(){const glyphs=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-list [data-icon-pack]')];return glyphs.length>0&&glyphs.every(node=>node.getAttribute('data-icon-pack')==='phosphor')}",'taxonomy preview switches to Phosphor');
  const automaticPhosphor=await rowState(targetLabel);
  assert(automaticPhosphor?.pack==='phosphor'&&automaticPhosphor.text.includes('Phosphor · Αυτόματο'),`family switch must update row preview immediately: ${JSON.stringify(automaticPhosphor)}`);
  await screenshot('icon-family-phosphor-preview-desktop');

  await openRow(targetLabel);
  assert(!(await c.call("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-pack-switcher'))}")),'shared picker does not repeat the pack selector');
  const optionPacks=await c.call("function(){return [...document.querySelectorAll('.settings-icons-only [data-icon-selection-panel] .category-icon-options [data-icon-pack]')].map(node=>node.getAttribute('data-icon-pack'))}");
  assert(optionPacks.length>0&&optionPacks.every(pack=>pack==='phosphor'),'every visible picker glyph is Phosphor');
  const phosphorChoice=await c.call("function(){const buttons=[...document.querySelectorAll('.settings-icons-only [data-icon-selection-panel] .category-icon-options .category-icon-option')];const button=buttons[1]||buttons[0];const key=button?.querySelector('[data-category-icon]')?.getAttribute('data-category-icon')||'';button?.click();return key}");
  assert(Boolean(phosphorChoice),'a Phosphor picker option can be selected');
  await waitFor("function(label){const rows=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-category .category-icon-unified-main')];const row=rows.find(item=>(item.querySelector('.category-icon-unified-copy b')?.textContent||'').trim()===label);return Boolean(row&&(row.textContent||'').includes('Phosphor · Προσαρμοσμένο'))}",'Phosphor selection stored',[targetLabel]);

  const colorSet=await c.call("function(){const swatches=[...document.querySelectorAll('.settings-icons-only .category-icon-color-controls .color-swatch')];const button=swatches[4]||swatches[0];button?.click();return button?.getAttribute('aria-label')||''}");
  assert(Boolean(colorSet),'color preset is selectable');
  const colored=await rowState(targetLabel);
  assert(colored&&colored.color!=='rgb(0, 0, 0)'&&colored.text.includes('χρώμα'),`selected color must update list preview: ${JSON.stringify(colored)}`);
  await screenshot('icon-phosphor-custom-color-desktop');
  await closeEditor();

  await clickText('.settings-icons-only .category-icon-pack-switcher-global button','Lucide');
  await waitFor("function(){const glyphs=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-list [data-icon-pack]')];return glyphs.length>0&&glyphs.every(node=>node.getAttribute('data-icon-pack')==='lucide')}",'taxonomy preview switches back to Lucide');
  await openRow(targetLabel);
  const lucideChoice=await c.call("function(){const buttons=[...document.querySelectorAll('.settings-icons-only [data-icon-selection-panel] .category-icon-options .category-icon-option')];const button=buttons[2]||buttons[0];const key=button?.querySelector('[data-category-icon]')?.getAttribute('data-category-icon')||'';button?.click();return key}");
  assert(Boolean(lucideChoice)&&lucideChoice!==phosphorChoice,'Lucide can keep a distinct selection from Phosphor');
  await closeEditor();

  await clickText('.settings-icons-only .category-icon-pack-switcher-global button','Phosphor');
  await waitFor("function(){const glyphs=[...document.querySelectorAll('.settings-icons-only .category-icon-unified-list [data-icon-pack]')];return glyphs.length>0&&glyphs.every(node=>node.getAttribute('data-icon-pack')==='phosphor')}",'Phosphor restored');
  const restored=await rowState(targetLabel);
  assert(restored?.key===phosphorChoice,`switching back must restore the previous Phosphor choice: expected ${phosphorChoice}, got ${JSON.stringify(restored)}`);
  assert(restored?.text.includes('χρώμα'),'category color remains independent of family switch');
  await screenshot('icon-phosphor-choice-restored-desktop');

  await clickText('.sidebar nav button','Dashboard');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Οι λογαριασμοί μου')}",'Dashboard after icon auto-save');
  await clickText('.sidebar nav button','Ρυθμίσεις');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'Settings after navigation');
  await clickText('.settings-tablist button','Εικονίδια');
  await waitFor("function(){const button=[...document.querySelectorAll('.settings-icons-only .category-icon-pack-switcher-global button')].find(item=>(item.querySelector('b')?.textContent||'').trim()==='Phosphor');return button?.getAttribute('aria-pressed')==='true'}",'persisted Phosphor family after navigation');
  const persisted=await rowState(targetLabel);
  assert(persisted?.key===phosphorChoice,`auto-saved pack choice must survive navigation: ${JSON.stringify(persisted)}`);
  assert(persisted?.text.includes('χρώμα'),'auto-saved category color survives navigation');

  assert(targetLabel==='Τρόφιμα',`fixture category expected Τρόφιμα, got ${targetLabel}`);
  await clickText('.sidebar nav button','Συναλλαγές');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Συναλλαγές')}",'Transactions after icon auto-save');
  const searchSet=await c.call("function(){const input=document.querySelector('input[aria-label=\"Αναζήτηση συναλλαγών\"]');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,'Freddo espresso');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true}");
  assert(searchSet,'transaction search is available for icon adoption proof');
  await waitFor("function(){return [...document.querySelectorAll('[data-transaction-kind]')].some(row=>row.getClientRects().length>0&&(row.textContent||'').includes('Freddo espresso'))}",'Freddo transaction visible');
  const transactionVisual=await c.call("function(){const row=[...document.querySelectorAll('[data-transaction-kind]')].find(node=>node.getClientRects().length>0&&(node.textContent||'').includes('Freddo espresso'));const icon=row?.querySelector('.finance-icon');const glyph=icon?.querySelector('[data-icon-pack]');return icon&&glyph?{source:icon.getAttribute('data-icon-source'),key:icon.getAttribute('data-icon-key'),pack:glyph.getAttribute('data-icon-pack'),color:getComputedStyle(glyph).color}:null}");
  assert(transactionVisual?.source==='category-preference',`transaction should use persisted explicit category icon: ${JSON.stringify(transactionVisual)}`);
  assert(transactionVisual?.key===phosphorChoice&&transactionVisual?.pack==='phosphor',`transaction should render persisted Phosphor icon: ${JSON.stringify(transactionVisual)}`);
  assert(transactionVisual?.color===persisted?.color,`transaction should render persisted category color: settings ${persisted?.color}, transaction ${transactionVisual?.color}`);

  await clickText('.sidebar nav button','Ρυθμίσεις');
  await waitFor("function(){return (document.querySelector('#main-workspace h1')?.textContent||'').includes('Ρυθμίσεις')}",'Settings after transaction icon proof');
  await clickText('.settings-tablist button','Εικονίδια');
  await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only .category-icon-assignment-workspace'))}",'icons workspace restored');

  await c.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await noOverflow('icons mobile');
  await openRow(targetLabel);
  const mobileGeometry=await c.call("function(){const panel=document.querySelector('.settings-icons-only [data-icon-selection-panel]');const r=panel?.getBoundingClientRect();const swatches=[...document.querySelectorAll('.settings-icons-only .category-icon-color-controls button')].map(node=>node.getBoundingClientRect());return r?{left:r.left,right:r.right,viewport:innerWidth,targets:swatches.map(x=>({w:x.width,h:x.height}))}:null}");
  assert(mobileGeometry&&mobileGeometry.left>=0&&mobileGeometry.right<=mobileGeometry.viewport+1,`mobile icon editor escapes viewport: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.targets.every(target=>target.h>=40),`mobile icon color targets too small: ${JSON.stringify(mobileGeometry.targets)}`);
  await screenshot('icon-family-color-mobile');


  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);
  assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);
  c.close();
  console.log('Icon packs rendered QA passed.');
}finally{child.kill('SIGTERM')}
