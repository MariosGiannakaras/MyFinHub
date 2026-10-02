import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-keyboard-semantic-a11y';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for keyboard/semantic accessibility QA.');
const port=9347;
const profile='/tmp/myfinhub-keyboard-semantic-a11y-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<100;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
 constructor(url){this.url=url;this.id=0;this.pending=new Map()}
 async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
 async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime call failed');return result.result.value}
 close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Keyboard/semantic accessibility QA assertion failed: ${message}`)};
const pages={
 dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',
 loans:'Δόσεις & Δάνεια',lending:'Δανεικά',recurring:'Πάγια',planning:'Προγραμματισμός',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'
};
let c=null;
try{
 await waitHttp(`http://127.0.0.1:${port}/json/version`);
 const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
 c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
 const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
 const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 const navigate=async(page,heading,width,height,mobile)=>{await viewport(width,height,mobile);const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('motion','reduced');await c.send('Page.navigate',{url:url.href});await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`${page} heading`,[heading]);await sleep(80)};
 const shot=async name=>{const image=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(image.data,'base64'))};
 const semanticAudit=()=>c.call(`function(){
   const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
   const labelText=el=>{
     const aria=(el.getAttribute('aria-label')||'').trim();if(aria)return aria;
     const by=(el.getAttribute('aria-labelledby')||'').split(/\\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();if(by)return by;
     if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el instanceof HTMLSelectElement){
       const labels=el.labels?[...el.labels].map(label=>label.textContent||'').join(' ').trim():'';if(labels)return labels;
       if(el instanceof HTMLInputElement&&['hidden'].includes(el.type))return 'hidden';
       return (el.getAttribute('placeholder')||el.getAttribute('title')||'').trim();
     }
     return ((el.textContent||'').trim()||el.getAttribute('title')||'').trim();
   };
   const controls=[...document.querySelectorAll('button,a[href],summary,input:not([type=hidden]),textarea,select,[role=tab],[role=radio],[role=option],[role=combobox]')].filter(visible);
   const unnamed=controls.filter(el=>!labelText(el)).map(el=>el.outerHTML.slice(0,180));
   const positiveTab=[...document.querySelectorAll('[tabindex]')].filter(el=>Number(el.getAttribute('tabindex'))>0).map(el=>el.outerHTML.slice(0,160));
   const hiddenFocusable=[...document.querySelectorAll('[aria-hidden=true]')].filter(el=>el.matches('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')&&visible(el)).map(el=>el.outerHTML.slice(0,160));
   const h1=[...document.querySelectorAll('#main-workspace h1')].filter(visible);
   const imgs=[...document.querySelectorAll('img')].filter(visible).filter(img=>!img.hasAttribute('alt')).map(img=>img.outerHTML.slice(0,160));
   const tables=[...document.querySelectorAll('table')].filter(visible).map(table=>({caption:Boolean(table.querySelector('caption')||table.getAttribute('aria-label')||table.getAttribute('aria-labelledby')),headers:table.querySelectorAll('th').length}));
   const progress=[...document.querySelectorAll('[role=progressbar]')].filter(visible).map(el=>({name:labelText(el),hasNow:el.hasAttribute('aria-valuenow')||el.hasAttribute('aria-valuetext')}));
   const statuses=[...document.querySelectorAll('[role=status],[role=alert]')].filter(visible).map(el=>({role:el.getAttribute('role'),live:el.getAttribute('aria-live')||'',text:(el.textContent||'').trim().slice(0,80)}));
   return {unnamed,positiveTab,hiddenFocusable,h1:h1.length,main:document.querySelectorAll('main').length,imgs,tables,progress,statuses,controls:controls.length};
 }`);
 const tabSweep=async label=>{
   await c.call("function(){const node=document.querySelector('.skip-link')||document.querySelector('button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex=\"-1\"])');node?.focus();return true}");
   const seen=[];
   for(let i=0;i<24;i++){
     await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
     await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
     const state=await c.call(`function(){
       const el=document.activeElement;if(!(el instanceof HTMLElement))return null;
       const r=el.getBoundingClientRect(),s=getComputedStyle(el);
       const visible=r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
       const focusVisible=(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth||'0')>0)||s.boxShadow!=='none';
       return {tag:el.tagName,name:(el.getAttribute('aria-label')||el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,80),visible,focusVisible,positive:Number(el.getAttribute('tabindex')||0)>0};
     }`);
     assert(state&&state.visible,`${label}: Tab left the visible focus order at step ${i+1}: ${JSON.stringify(state)}`);
     assert(!state.positive,`${label}: positive tabindex at step ${i+1}`);
     assert(state.focusVisible,`${label}: focused control has no visible focus indicator at step ${i+1}: ${JSON.stringify(state)}`);
     seen.push(state);
   }
   return seen;
 };
 const pressEscape=async()=>{await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'})};
 const pressTab=async(shift=false)=>{await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',modifiers:shift?8:0});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',modifiers:shift?8:0})};

 const summary={};
 for(const [mode,width,height,mobile] of [['desktop',1440,1000,false],['mobile',375,812,true]]){
   for(const [page,heading] of Object.entries(pages)){
     await navigate(page,heading,width,height,mobile);
     const audit=await semanticAudit();
     assert(audit.main===1,`${mode}/${page}: expected one main landmark, got ${audit.main}`);
     assert(audit.h1===1,`${mode}/${page}: expected one visible H1, got ${audit.h1}`);
     assert(audit.unnamed.length===0,`${mode}/${page}: unnamed controls ${audit.unnamed.join(' | ')}`);
     assert(audit.positiveTab.length===0,`${mode}/${page}: positive tabindex ${audit.positiveTab.join(' | ')}`);
     assert(audit.hiddenFocusable.length===0,`${mode}/${page}: aria-hidden focusable controls ${audit.hiddenFocusable.join(' | ')}`);
     assert(audit.imgs.length===0,`${mode}/${page}: visible images without alt attribute ${audit.imgs.join(' | ')}`);
     assert(audit.tables.every(row=>row.caption&&row.headers>0),`${mode}/${page}: visible table missing caption/header semantics ${JSON.stringify(audit.tables)}`);
     assert(audit.progress.every(row=>row.name&&row.hasNow),`${mode}/${page}: incomplete progressbar semantics ${JSON.stringify(audit.progress)}`);
     const seen=await tabSweep(`${mode}/${page}`);
     summary[`${mode}-${page}`]={controls:audit.controls,tabSample:seen.length,statuses:audit.statuses.length};
   }
 }

 await navigate('dashboard',pages.dashboard,1440,1000,false);
 const opener=await c.call("function(){const button=document.querySelector('[data-global-quick-entry=desktop]');button?.focus();button?.click();return button?.getAttribute('aria-label')||button?.textContent||''}");
 assert(opener,'Quick Entry keyboard opener exists');
 await waitFor("function(){return Boolean(document.querySelector('.quick-modal[aria-modal=true]'))}",'Quick Entry modal');
 assert(await c.call("function(){return Boolean(document.activeElement?.closest('.quick-modal[aria-modal=true]'))}"),'Quick Entry initial focus is inside modal');
 for(let i=0;i<20;i++){await pressTab(i%7===0);assert(await c.call("function(){return Boolean(document.activeElement?.closest('.quick-modal[aria-modal=true]'))}"),`Quick Entry focus trap step ${i+1}`)}
 await pressEscape();await waitFor("function(){return !document.querySelector('.quick-modal[aria-modal=true]')}",'Quick Entry Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('[data-global-quick-entry=desktop]')}"),'Quick Entry restores focus to opener');

 const commandButton=await c.call("function(){const button=document.querySelector('.top-actions button[aria-label=\"Αναζήτηση και εντολές\"]');button?.focus();button?.click();return Boolean(button)}");
 assert(commandButton,'Command Palette opener exists');await waitFor("function(){return Boolean(document.querySelector('.command-palette[role=dialog]'))}",'Command Palette');
 assert(await c.call("function(){return Boolean(document.activeElement?.closest('.command-palette[role=dialog]'))}"),'Command Palette initial focus is inside dialog');
 for(let i=0;i<14;i++){await pressTab();assert(await c.call("function(){return Boolean(document.activeElement?.closest('.command-palette[role=dialog]'))}"),`Command Palette focus trap step ${i+1}`)}
 await pressEscape();await waitFor("function(){return !document.querySelector('.command-palette[role=dialog]')}",'Command Palette Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('.top-actions button[aria-label=\"Αναζήτηση και εντολές\"]')}"),'Command Palette restores focus to opener');

 await navigate('dashboard',pages.dashboard,375,812,true);
 const more=await c.call("function(){const button=document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]');button?.focus();button?.click();return Boolean(button)}");
 assert(more,'mobile More opener exists');await waitFor("function(){return Boolean(document.querySelector('.mobile-more-menu[role=dialog]'))}",'mobile More dialog');
 for(let i=0;i<12;i++){await pressTab();assert(await c.call("function(){return Boolean(document.activeElement?.closest('.mobile-more-menu[role=dialog]'))}"),`mobile More focus trap step ${i+1}`)}
 await pressEscape();await waitFor("function(){return !document.querySelector('.mobile-more-menu[role=dialog]')}",'mobile More Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')}"),'mobile More restores focus to opener');
 await shot('keyboard-semantic-mobile-dashboard');

 console.log('Keyboard/semantic accessibility QA: 404 focus, keyboard, reduced-motion and 200%-equivalent viewport');
 await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await viewport(720,500,false);
 const notFoundUrl=new URL(baseUrl);notFoundUrl.searchParams.set('screen','404');
 await c.send('Page.navigate',{url:notFoundUrl.href});
 await waitFor("function(){return Boolean(document.querySelector('#not-found-title'))}",'404 title');
 await waitFor("function(){return document.activeElement?.id==='not-found-title'}",'404 title focus');
 const notFoundState=await c.call(`function(){
   const main=document.querySelector('.not-found-screen'),card=document.querySelector('.not-found-card'),missing=document.querySelector('.not-found-route-node.is-missing');
   const buttons=[...document.querySelectorAll('.not-found-actions button')];
   const rect=card?.getBoundingClientRect();
   return {
     main:Boolean(main),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
     card:rect?{left:rect.left,right:rect.right,width:rect.width}:null,
     animation:missing?getComputedStyle(missing).animationName:'',
     buttons:buttons.map(button=>({text:(button.textContent||'').trim(),w:button.getBoundingClientRect().width,h:button.getBoundingClientRect().height}))
   };
 }`);
 assert(notFoundState.main,'404 main surface exists');
 assert(notFoundState.overflow<=1,`404 200%-equivalent viewport has horizontal overflow: ${JSON.stringify(notFoundState)}`);
 assert(notFoundState.card&&notFoundState.card.left>=0&&notFoundState.card.right<=720+1,`404 card escapes effective 200% viewport: ${JSON.stringify(notFoundState.card)}`);
 assert(notFoundState.animation==='none',`404 missing-route pulse must be disabled under reduced motion: ${notFoundState.animation}`);
 assert(notFoundState.buttons.length===2&&notFoundState.buttons.every(button=>button.h>=44),`404 actions are not keyboard/touch safe: ${JSON.stringify(notFoundState.buttons)}`);
 await pressTab();
 assert(await c.call("function(){return (document.activeElement?.textContent||'').trim().includes('Dashboard')}"),'404 first Tab reaches Dashboard recovery');
 await pressTab();
 assert(await c.call("function(){return (document.activeElement?.textContent||'').trim()==='Πίσω'}"),'404 second Tab reaches Back recovery');
 await shot('keyboard-semantic-404-zoom-reduced');

 await c.send('Emulation.setEmulatedMedia',{features:[]});
 writeFileSync(`${evidenceDir}/summary.json`,JSON.stringify(summary,null,2));
 console.log('Keyboard and semantic accessibility QA passed across all primary routes on desktop/mobile, shared modal focus contracts and the 404 recovery surface.');
}finally{
 try{c?.close()}catch{}
 child.kill('SIGTERM');
}
