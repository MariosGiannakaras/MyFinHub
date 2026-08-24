import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-theme-system-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for theme system QA.');
const port=9249;
const profile='/tmp/myfinhub-theme-system-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(120)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{constructor(url){this.url=url;this.id=0;this.pending=new Map()}async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}close(){this.ws?.close()}}
const assert=(value,message)=>{if(!value)throw new Error(`Theme system QA assertion failed: ${message}`)};
const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Τι χρειάζεται προσοχή',reports:'Αναφορές · Η οικονομική εικόνα του μήνα',settings:'Ρυθμίσεις'};
const tabletPages=new Set(['dashboard','transactions','credit','reports','settings']);
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const shot=async name=>{const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'))};
  const navigate=async(page,heading,state='normal')=>{const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('visual','1');if(state!=='normal')url.searchParams.set('state',state);await c.send('Page.navigate',{url:url.href});await waitFor("function(text){return document.readyState==='complete'&&(document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`${page} ready`,[heading]);await sleep(100)};
  const applyTheme=async preference=>c.call(`async function(pref){localStorage.setItem('myfinhub.theme',pref);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {theme:document.documentElement.dataset.theme,pref:document.documentElement.dataset.themePreference,stored:localStorage.getItem('myfinhub.theme')}}`,[preference]);
  const pageState=async()=>c.call(`function(){const root=getComputedStyle(document.documentElement);const raised=document.querySelector('.neo-raised');const raisedStyle=raised?getComputedStyle(raised):null;return {theme:document.documentElement.dataset.theme,pref:document.documentElement.dataset.themePreference,canvas:root.getPropertyValue('--canvas').trim(),ink:root.getPropertyValue('--ink').trim(),muted:root.getPropertyValue('--muted').trim(),raisedBackground:raisedStyle?.backgroundImage||raisedStyle?.backgroundColor||'',overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,qaControlVisible:(()=>{const node=document.querySelector('[data-qa-crash]');if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0})()}}`);
  const assertThemePage=async(expected,page)=>{const state=await pageState();assert(state.theme===expected,`${page} resolves ${expected} theme`);assert(state.canvas&&state.ink&&state.muted,`${page} exposes semantic root tokens`);assert(state.overflow<=1,`${page} ${expected} has no horizontal document overflow`);assert(!state.qaControlVisible,`${page} hides QA-only crash control in visual mode`);if(expected==='dark')assert(!/^#?(fff|ffffff)$/i.test(state.canvas),`${page} dark canvas is not white`)};

  console.log('Theme system QA: full Light/Dark desktop + mobile route matrix');
  for(const theme of ['light','dark']){
    for(const item of [{mode:'desktop',width:1440,height:900,mobile:false},{mode:'mobile',width:375,height:812,mobile:true}]){
      await viewport(item.width,item.height,item.mobile);
      for(const [page,heading] of Object.entries(pages)){
        await navigate(page,heading);const applied=await applyTheme(theme);assert(applied.theme===theme&&applied.pref===theme&&applied.stored===theme,`${theme} preference is explicit and persisted`);await assertThemePage(theme,page);await shot(`${theme}-${page}-${item.mode}`);
      }
    }
  }

  console.log('Theme system QA: representative tablet parity');
  await viewport(820,900,false);
  for(const theme of ['light','dark'])for(const [page,heading] of Object.entries(pages)){if(!tabletPages.has(page))continue;await navigate(page,heading);await applyTheme(theme);await assertThemePage(theme,page);await shot(`${theme}-${page}-tablet`)}

  console.log('Theme system QA: Settings switching, selection and focus contract');
  await viewport(1440,900,false);await navigate('settings',pages.settings);await applyTheme('dark');
  let settings=await c.call(`function(){const groups=[...document.querySelectorAll('[role="radiogroup"]')];const group=groups.find(node=>node.getAttribute('aria-label')==='Θέμα εμφάνισης');const buttons=[...group?.querySelectorAll('button')||[]];const selected=buttons.find(button=>button.getAttribute('aria-checked')==='true');selected?.focus();const style=selected?getComputedStyle(selected):null;return {buttons:buttons.map(button=>button.innerText.trim()),selected:selected?.innerText||'',outlineWidth:style?.outlineWidth||'',outlineStyle:style?.outlineStyle||'',heading:document.querySelector('#main-workspace h1')?.textContent||''}}`);
  assert(settings.buttons.length===3,'Settings exposes exactly System, Light and Dark theme choices');assert(settings.selected.includes('Dark'),'Dark choice is selected');assert(settings.heading.includes('Ρυθμίσεις'),'theme selection preserves current route');assert(parseFloat(settings.outlineWidth)>=2&&settings.outlineStyle!=='none','focused selected theme control has a visible focus indicator');await shot('dark-settings-selected-focus-desktop');
  const switched=await c.call(`async function(){const before={theme:document.documentElement.dataset.theme,pref:document.documentElement.dataset.themePreference,stored:localStorage.getItem('myfinhub.theme')};const group=[...document.querySelectorAll('[role="radiogroup"]')].find(node=>node.getAttribute('aria-label')==='Θέμα εμφάνισης');const target=[...group.querySelectorAll('button')].find(button=>button.innerText.includes('Light'));const disabled=target.disabled;target.click();await new Promise(resolve=>setTimeout(resolve,160));return {before,disabled,theme:document.documentElement.dataset.theme,pref:document.documentElement.dataset.themePreference,stored:localStorage.getItem('myfinhub.theme'),heading:document.querySelector('#main-workspace h1')?.textContent||'',selected:target.getAttribute('aria-checked')}}`);
  assert(switched.theme==='light'&&switched.stored==='light',`Settings Light choice applies and persists locally: ${JSON.stringify(switched)}`);assert(switched.heading.includes('Ρυθμίσεις'),'theme switch does not navigate away');assert(switched.selected==='true','theme radio semantics update after switching');await shot('light-settings-selected-desktop');

  console.log('Theme system QA: System preference follows OS emulation');
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});let system=await applyTheme('system');assert(system.theme==='dark'&&system.pref==='system','System preference resolves OS dark');
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});system=await applyTheme('system');assert(system.theme==='light'&&system.pref==='system','System preference resolves OS light');
  await c.send('Emulation.setEmulatedMedia',{features:[]});

  console.log('Theme system QA: actual app startup applies persisted theme before authenticated workspace resolution');
  await c.call("function(){localStorage.setItem('myfinhub.theme','dark');return true}");const rootUrl=new URL('/',baseUrl).href;await c.send('Page.navigate',{url:rootUrl});await waitFor("function(){return document.readyState==='complete'&&document.documentElement.dataset.theme==='dark'}",'actual app dark startup');const startup=await c.call("function(){return {theme:document.documentElement.dataset.theme,style:!!document.getElementById('myfinhub-semantic-theme'),body:document.body?.innerText||''}}");assert(startup.theme==='dark'&&startup.style,'actual app boot initializes persisted Dark theme before normal rendering completes');await shot('dark-actual-app-startup');

  console.log('Theme system QA: dark modal/focus and grayscale semantic review evidence');
  await c.send('Page.navigate',{url:baseUrl});await waitFor("function(){return document.readyState==='complete'&&!!document.querySelector('#main-workspace')}",'QA workspace restored');await applyTheme('dark');await c.call("function(){document.querySelector('.primary-action')?.click();return true}");await waitFor("function(){return !!document.querySelector('.quick-modal')}",'Quick Entry modal');await c.call("function(){const input=document.querySelector('.quick-modal input:not([type=hidden])');input?.focus();return true}");await shot('dark-quick-entry-focus-desktop');
  await c.call("function(){document.querySelector('.quick-modal header button')?.click();return true}");await navigate('reports',pages.reports);await applyTheme('dark');await c.call("function(){document.documentElement.style.filter='grayscale(1)';return true}");await shot('dark-reports-grayscale-desktop');await c.call("function(){document.documentElement.style.filter='';return true}");
  await navigate('attention',pages.attention);await applyTheme('light');await c.call("function(){document.documentElement.style.filter='grayscale(1)';return true}");await shot('light-attention-grayscale-desktop');await c.call("function(){document.documentElement.style.filter='';return true}");

  c.close();console.log('Theme system rendered QA passed.');
}finally{child.kill('SIGTERM')}
