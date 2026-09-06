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
  assert(JSON.stringify(packs.map(item=>item.license))===JSON.stringify(['ISC','MIT','MIT','MIT','MIT']),'pack licenses');
  assert(packs.every(item=>item.preview.length===3&&item.preview.every(pack=>Boolean(pack))),'each pack has three live preview glyphs');
  assert(packs[0].pressed==='true'&&packs.slice(1).every(item=>item.pressed==='false'),'Lucide is the default global pack');
  await waitFor("function(){return document.querySelectorAll('.settings-icons-only .category-icon-unified-category').length>=4}",'dense category list below pack selector');
  await waitFor("function(){return document.querySelectorAll('.settings-icons-only .category-icon-unified-subrow').length>=4}",'dense subcategory rows');
  await noOverflow('icons desktop');
  await screenshot('icon-packs-desktop');

  await clickText('.settings-icons-only .category-icon-pack-switcher-global button','Phosphor');
  await waitFor("function(){const button=[...document.querySelectorAll('.settings-icons-only .category-icon-pack-switcher-global button')].find(item=>(item.querySelector('b')?.textContent||'').trim()==='Phosphor');return button?.getAttribute('aria-pressed')==='true'}",'Phosphor selected');
  const firstEditorOpened=await c.call("function(){const button=document.querySelector('.settings-icons-only .category-icon-unified-category .category-icon-unified-main');if(!button)return false;button.click();return true}");
  assert(firstEditorOpened,'first category icon editor is available');
  await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-picker'))}",'shared category icon picker');
  assert(!(await c.call("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-pack-switcher'))}")),'shared picker does not repeat the pack selector');
  assert((await c.call("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-selection-close'))}")),'shared picker has an explicit close action');
  const optionPack=await c.call("function(){return document.querySelector('.settings-icons-only [data-icon-selection-panel] .category-icon-option [data-icon-pack]')?.getAttribute('data-icon-pack')||''}");
  assert(optionPack==='phosphor',`expanded picker should use Phosphor, got ${optionPack}`);
  await noOverflow('icons picker desktop');
  await screenshot('icon-picker-phosphor-desktop');

  assert(runtimeErrors.length===0,`runtime exceptions: ${runtimeErrors.join(' | ')}`);
  assert(failedRequests.length===0,`network loading failures: ${failedRequests.join(' | ')}`);
  c.close();
  console.log('Icon packs rendered QA passed.');
}finally{child.kill('SIGTERM')}
