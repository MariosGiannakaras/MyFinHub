import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-keyboard-semantic-a11y';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for keyboard/semantic accessibility QA.');
const port=9347;
const profileBase='/tmp/myfinhub-keyboard-semantic-a11y-chrome';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cleanProfile=profile=>{try{rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150})}catch{}};
const diagnostics=value=>{const text=String(value||'').trim();return text?text.slice(-5000):'(no browser diagnostics)'};
async function stopBrowser(child){
 if(!child||child.exitCode!==null)return;
 await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},1800);child.once('exit',()=>{clearTimeout(timer);resolve()});child.kill('SIGTERM')});
}
async function launchBrowser(){
 let lastError=null;
 for(let attempt=0;attempt<3;attempt+=1){
   const activePort=port+attempt;
   const profile=`${profileBase}-${attempt+1}`;
   cleanProfile(profile);
   let output='',spawnError='';
   const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${activePort}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','pipe','pipe']});
   const capture=stream=>stream?.on('data',chunk=>{output+=chunk.toString();if(output.length>10000)output=output.slice(-10000)});
   capture(child.stdout);capture(child.stderr);child.on('error',error=>{spawnError=error.stack||error.message});
   try{
     for(let i=0;i<120;i++){
       if(spawnError)throw new Error(`Browser spawn failed: ${spawnError}`);
       if(child.exitCode!==null)throw new Error(`Browser exited before CDP became ready (exit ${child.exitCode}).\n${diagnostics(output)}`);
       try{const response=await fetch(`http://127.0.0.1:${activePort}/json/version`);if(response.ok)return {child,port:activePort,profile}}catch{}
       await sleep(150);
     }
     throw new Error(`Timed out waiting for http://127.0.0.1:${activePort}/json/version\n${diagnostics(output)}`);
   }catch(error){
     lastError=error;
     await stopBrowser(child);
     cleanProfile(profile);
     if(attempt<2)await sleep(1200*(attempt+1));
   }
 }
 throw lastError??new Error('Keyboard accessibility browser bootstrap failed.');
}
let browserSession=null;
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
 browserSession=await launchBrowser();
 const activePort=browserSession.port;
 const target=await fetch(`http://127.0.0.1:${activePort}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
 c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
 const waitFor=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(75)}throw new Error(`Timed out waiting for ${label}`)};
 const waitForAuthMotion=async(label)=>{
   await waitFor("function(){const card=document.querySelector('.login-card');return !card||[...card.getAnimations({subtree:true})].filter(animation=>/^rh-login-(card|content)-in$/.test(animation.animationName||'')).every(animation=>animation.playState!=='running')}",label);
   await c.call("function(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}");
 };
 const viewport=(width,height,mobile=false)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
 const navigate=async(page,heading,width,height,mobile)=>{await viewport(width,height,mobile);const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('motion','reduced');await c.send('Page.navigate',{url:url.href});await waitFor("function(text){return (document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",`${page} heading`,[heading]);await sleep(80)};
 const shot=async name=>{const image=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(image.data,'base64'))};
 const semanticAudit=()=>c.call(`function(){
   const visible=el=>{const closedDetails=el.closest?.('details:not([open])');if(closedDetails&&!(el.matches('summary')&&el.parentElement===closedDetails))return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
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
    const hiddenSelector='button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';
    const hiddenFocusable=[...document.querySelectorAll('[aria-hidden=true]')].flatMap(root=>[root,...root.querySelectorAll(hiddenSelector)]).filter(el=>el.matches(hiddenSelector)&&visible(el)).map(el=>el.outerHTML.slice(0,160));
   const h1=[...document.querySelectorAll('h1')].filter(visible);
   const imgs=[...document.querySelectorAll('img')].filter(visible).filter(img=>!img.hasAttribute('alt')).map(img=>img.outerHTML.slice(0,160));
   const tables=[...document.querySelectorAll('table')].filter(visible).map(table=>({caption:Boolean(table.querySelector('caption')||table.getAttribute('aria-label')||table.getAttribute('aria-labelledby')),headers:table.querySelectorAll('th').length}));
   const progress=[...document.querySelectorAll('[role=progressbar]')].filter(visible).map(el=>({name:labelText(el),hasNow:el.hasAttribute('aria-valuenow')||el.hasAttribute('aria-valuetext')}));
   const statuses=[...document.querySelectorAll('[role=status],[role=alert]')].filter(visible).map(el=>({role:el.getAttribute('role'),live:el.getAttribute('aria-live')||'',text:(el.textContent||'').trim().slice(0,80)}));
   return {unnamed,positiveTab,hiddenFocusable,h1:h1.length,main:document.querySelectorAll('main').length,imgs,tables,progress,statuses,controls:controls.length};
 }`);
 const tabSweep=async label=>{
   const setup=await c.call(`function(){
     const visible=el=>{const closedDetails=el.closest?.('details:not([open])');if(closedDetails&&!(el.matches('summary')&&el.parentElement===closedDetails))return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
     const nodes=[...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el=>visible(el)&&el.tabIndex>=0&&!el.matches(':disabled')&&!el.closest('[inert]'));
     const start=document.querySelector('.skip-link')&&visible(document.querySelector('.skip-link'))?document.querySelector('.skip-link'):nodes[0];
     start?.focus();
     return {count:nodes.length,started:Boolean(start)};
   }`);
   assert(setup.started&&setup.count>0,`${label}: no visible keyboard focus target`);
   const seen=[];
   const steps=Math.min(24,Math.max(0,setup.count-1));
   for(let i=0;i<steps;i++){
     await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});
     await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
     const state=await c.call(`function(){
       const el=document.activeElement;if(!(el instanceof Element))return null;
       const r=el.getBoundingClientRect(),s=getComputedStyle(el);
       const visible=r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
       const hasFocusRing=style=>(style.outlineStyle!=='none'&&parseFloat(style.outlineWidth||'0')>0)||style.boxShadow!=='none';
       const focusOwner=el.closest('.app-input-shell');
       const focusVisible=hasFocusRing(s)||(Boolean(focusOwner&&focusOwner.contains(el))&&hasFocusRing(getComputedStyle(focusOwner)));
       return {tag:el.tagName,name:(el.getAttribute('aria-label')||el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,80),visible,focusVisible,chartFocus:Boolean(el.closest('.recharts-wrapper')),positive:Number(el.getAttribute('tabindex')||0)>0};
     }`);
     if(!state||state.tag==='BODY'||!state.visible||!state.focusVisible||state.chartFocus){
       // Do not reinterpret a missing focus as PASS. Save the actual preceding
       // tab path, live candidates and screenshot so the missing stop is traceable.
       const detail=await c.call(`function(){
         const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
         const active=document.activeElement;
         const candidates=[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(visible).map(el=>({
           tag:el.tagName,name:(el.getAttribute('aria-label')||el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,55),
           tabIndex:el.tabIndex,disabled:el.matches(':disabled'),inert:Boolean(el.closest('[inert]')),
           ariaHidden:Boolean(el.closest('[aria-hidden=true]')),hiddenDetails:Boolean(el.closest('details:not([open])')),
           focusable:el.matches(':focus'),outer:el.outerHTML.slice(0,160)
         })).slice(0,90);
         return {active:active?.outerHTML?.slice(0,600),chart:active?.closest('.recharts-wrapper')?.outerHTML?.slice(0,600),candidates};
       }`);
       console.error('Keyboard Tab failure evidence',JSON.stringify({label,step:i+1,setup,previous:seen.slice(-9),state,liveCandidates:detail}));
       await shot('keyboard-tab-failure-'+label.replaceAll('/','-')+'-step-'+(i+1));
     }
     assert(state&&state.visible,`${label}: Tab left the visible focus order at step ${i+1}: ${JSON.stringify(state)}`);
     assert(!state.chartFocus,`${label}: decorative Recharts subtree entered sequential Tab order at step ${i+1}: ${JSON.stringify(state)}`);
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

 const assertAudit=(audit,label)=>{
   assert(audit.main===1,`${label}: expected one main landmark, got ${audit.main}`);
   assert(audit.h1===1,`${label}: expected one visible H1, got ${audit.h1}`);
   assert(audit.unnamed.length===0,`${label}: unnamed controls ${audit.unnamed.join(' | ')}`);
   assert(audit.positiveTab.length===0,`${label}: positive tabindex ${audit.positiveTab.join(' | ')}`);
   assert(audit.hiddenFocusable.length===0,`${label}: aria-hidden focusable controls ${audit.hiddenFocusable.join(' | ')}`);
   assert(audit.imgs.length===0,`${label}: visible images without alt attribute ${audit.imgs.join(' | ')}`);
   assert(audit.tables.every(row=>row.caption&&row.headers>0),`${label}: visible table missing caption/header semantics ${JSON.stringify(audit.tables)}`);
   assert(audit.progress.every(row=>row.name&&row.hasNow),`${label}: incomplete progressbar semantics ${JSON.stringify(audit.progress)}`);
 };

 console.log('Keyboard/semantic accessibility QA: every Settings tab on desktop/mobile');
 const settingsTabs=['profile','accounts','categories','icons','rules','data'];
 for(const [mode,width,height,mobile] of [['desktop',1440,1000,false],['mobile',375,812,true]]){
   await navigate('settings',pages.settings,width,height,mobile);
   // The six inactive Settings tabs are deliberately removed from sequential
   // Tab order. Arrow/Home/End navigation must still reach and focus each tab.
   const roving=await c.call("function(){const tabs=[...document.querySelectorAll('[role=tab][aria-controls^=\"settings-panel-\"]')];return {count:tabs.length,selected:tabs.filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.id),sequential:tabs.filter(t=>t.tabIndex===0).map(t=>t.id),excluded:tabs.filter(t=>t.tabIndex===-1).length}}");
   assert(roving.count===7&&roving.selected.length===1&&roving.sequential.length===1&&roving.selected[0]===roving.sequential[0]&&roving.excluded===6,mode+' Settings tablist has one sequential stop, six roving arrow-key stops: '+JSON.stringify(roving));
   assert(await c.call("function(){const t=document.querySelector('[role=tab][aria-selected=true]');t?.focus();return Boolean(t)}"),mode+' Settings roving current tab focusable');
   await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
   await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
   await waitFor("function(){const t=document.querySelector('[role=tab][aria-selected=true]');return Boolean(t&&t.id==='settings-tab-profile'&&t.tabIndex===0&&document.activeElement===t)}",mode+' Settings ArrowRight focuses and activates next tab');
   await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});
   await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});
   await waitFor("function(){const t=document.querySelector('[role=tab][aria-selected=true]');return Boolean(t&&t.id==='settings-tab-general'&&t.tabIndex===0&&document.activeElement===t)}",mode+' Settings Home restores first tab and focus');
   for(const tab of settingsTabs){
     const clicked=await c.call("function(tab){const node=document.querySelector('[aria-controls=\"settings-panel-'+tab+'\"]');node?.click();return Boolean(node)}",[tab]);
     assert(clicked,`${mode}/settings/${tab}: tab exists`);
     await waitFor("function(tab){return document.querySelector('[aria-controls=\"settings-panel-'+tab+'\"]')?.getAttribute('aria-selected')==='true'}",`${mode} settings tab ${tab}`,[tab]);
     const audit=await semanticAudit();assertAudit(audit,`${mode}/settings/${tab}`);
     await tabSweep(`${mode}/settings/${tab}`);
   }
 }

 console.log('Keyboard/semantic accessibility QA: auth and auth-error states');
 const authStates=[
   ['login',false],['login',true],['mfa',false],['mfa',true],['mfa-enroll',false],
 ];
 for(const [mode,width,height,mobile] of [['desktop',1440,1000,false],['mobile',375,812,true]]){
   await viewport(width,height,mobile);
   for(const [screen,error] of authStates){
     const url=new URL(baseUrl);url.searchParams.set('screen',screen);if(error)url.searchParams.set('error','1');
     await c.send('Page.navigate',{url:url.href});
     await waitFor("function(){return Boolean(document.querySelector('.login-card h1'))}",`${mode} auth ${screen}`);
     const audit=await semanticAudit();assertAudit(audit,`${mode}/auth/${screen}${error?'/error':''}`);
     if(error){
       assert(audit.statuses.some(item=>item.role==='alert'),`${mode}/auth/${screen}: error state must expose an alert`);
       const expectedMessage=screen==='login'?'Τα στοιχεία σύνδεσης δεν είναι σωστά.':'Ο κωδικός επαλήθευσης δεν είναι σωστός.';
       const alertText=await c.call("function(){const alert=document.querySelector('.login-error[role=alert]'),span=alert?.querySelector('span');if(!span)return null;const rect=span.getBoundingClientRect(),style=getComputedStyle(span);return {text:span.textContent?.trim(),width:rect.width,height:rect.height,visibility:style.visibility,display:style.display,opacity:style.opacity}}");
       assert(alertText?.text===expectedMessage&&alertText.width>=30&&alertText.height>=10&&alertText.visibility==='visible'&&alertText.display!=='none'&&Number(alertText.opacity)>0,`${mode}/auth/${screen}: error message must be rendered and readable: ${JSON.stringify(alertText)}`);
     }
     await tabSweep(`${mode}/auth/${screen}${error?'/error':''}`);
     if(screen==='login'&&!error){
       const fieldState=await c.call("function(){const input=document.querySelector('#login-email');const outer=input?.closest('.app-input-shell');if(!input||!outer)return null;input.focus();const a=getComputedStyle(outer),b=getComputedStyle(input);return {oneShell:document.querySelectorAll('.login-field:first-child .app-input-shell').length===1,parentHasRing:a.boxShadow!=='none',outerBorder:parseFloat(a.borderTopWidth||'0'),innerBorder:parseFloat(b.borderTopWidth||'0')}}");
       assert(fieldState?.oneShell&&fieldState.parentHasRing&&fieldState.outerBorder>=1&&fieldState.innerBorder===0,`${mode} Login has one accessible composite-field focus outline: ${JSON.stringify(fieldState)}`);
       if(mode==='mobile'){
         const theme=await c.call("async function(){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');return document.documentElement.dataset.theme}");
         assert(theme==='dark','Login dark mobile QA uses canonical theme');
         const eye=await c.call("function(){const node=document.querySelector('.login-password-toggle');const css=node?getComputedStyle(node):null;return {visible:Boolean(node),bg:css?.backgroundColor||'',height:node?.getBoundingClientRect().height||0}}");
         assert(eye.visible&&eye.height>=44&&eye.bg==='rgba(0, 0, 0, 0)',`Login reveal should be transparent with a 44px touch target: ${JSON.stringify(eye)}`);
         await waitForAuthMotion('mobile dark Login entrance settled before focus screenshot');
         const shot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/login-mobile-dark-focused-field.png`,Buffer.from(shot.data,'base64'));
         await c.call("async function(){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('light');return true}");
       }
     }
     if(screen==='mfa'&&!error){
       const typeCode=async value=>{
         const entered=await c.call("function(value){const input=document.querySelector('#mfa-code');if(!(input instanceof HTMLInputElement))return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));return true}",[value]);
         assert(entered,mode+' MFA synthetic code input exists');
       };
       const attempts=()=>c.call("function(){return Number(document.documentElement.dataset.qaMfaVerifyCount||'0')}");
       assert(await c.call("function(){return !document.querySelector('.login-form button[type=submit]')&&Boolean(document.querySelector('#mfa-auto-hint[role=status]'))}"),mode+' MFA no redundant verify button');
       await typeCode('12345');await sleep(100);
       assert((await attempts())===0,mode+' MFA never submits an incomplete code');
       await typeCode('123456');
       await waitFor("function(){return Number(document.documentElement.dataset.qaMfaVerifyCount||'0')===1}",mode+' MFA verifies on sixth digit');
       await waitFor("function(){return document.querySelector('#mfa-code')?.value===''}",mode+' MFA rejected code resets for retry');
       await sleep(100);
       assert((await attempts())===1,mode+' MFA rejection cannot resubmit on rerender');
       await typeCode('654321');
       await waitFor("function(){return Number(document.documentElement.dataset.qaMfaVerifyCount||'0')===2}",mode+' MFA new valid-length input verifies again');
       await waitFor("function(){return document.querySelector('#mfa-code')?.value===''}",mode+' MFA retry recovers');
       assert((await attempts())===2,mode+' MFA requests are one per complete input');
     }
     if(screen==='mfa'&&!error&&mode==='mobile'){
       await c.call("async function(){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');return true}");
       await waitForAuthMotion('mobile dark MFA entrance settled before screenshot');
       const shot=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`${evidenceDir}/mfa-mobile-dark.png`,Buffer.from(shot.data,'base64'));
       await c.call("async function(){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('light');return true}");
     }
   }
 }

 await navigate('dashboard',pages.dashboard,1440,1000,false);
 // A pre-existing native inert subtree is not owned by the modal coordinator.
 await c.call("function(){const el=document.createElement('div');el.id='qa-existing-inert';el.inert=true;document.body.append(el);return true}");
 const opener=await c.call("function(){const button=document.querySelector('[data-global-quick-entry=desktop]');button?.focus();button?.click();return button?.getAttribute('aria-label')||button?.textContent||''}");
 assert(opener,'Quick Entry keyboard opener exists');
 await waitFor("function(){return Boolean(document.querySelector('.quick-modal[aria-modal=true]'))}",'Quick Entry modal');
 assert(await c.call("function(){return Boolean(document.activeElement?.closest('.quick-modal[aria-modal=true]'))}"),'Quick Entry initial focus is inside modal');
 assert(await c.call("function(){const opener=document.querySelector('[data-global-quick-entry=desktop]');opener?.focus();return Boolean(opener?.closest('[inert]')&&document.activeElement?.closest('.quick-modal[aria-modal=true]'))}"),'native inert blocks programmatic focus into Quick Entry background');
 await c.call("function(){const el=document.createElement('button');el.id='qa-late-background';el.textContent='QA only';el.style.cssText='position:fixed;left:0;top:0;opacity:0';document.body.append(el);return true}");
 await waitFor("function(){return document.getElementById('qa-late-background')?.inert===true}",'late background subtree becomes inert');
 assert(await c.call("function(){document.getElementById('qa-late-background')?.focus();return Boolean(document.activeElement?.closest('.quick-modal[aria-modal=true]'))}"),'late background cannot receive programmatic focus');
 for(let i=0;i<20;i++){await pressTab(i%7===0);assert(await c.call("function(){return Boolean(document.activeElement?.closest('.quick-modal[aria-modal=true]'))}"),`Quick Entry focus trap step ${i+1}`)}
 // Exercise the real shared trap with rendered, non-tabbable descendants.
 // Test-only sentinels model pending inert forms, disabled fieldsets and hidden
 // controls without changing the finance fixture or product DOM after cleanup.
 const trapFixture=await c.call(`function(){
   const modal=document.querySelector('.quick-modal[aria-modal=true]');
   if(!modal)return false;
   const fixture=document.createElement('div');fixture.dataset.qaModalTabFixture='true';
   const button=name=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.qaModalTab=name;return b};
   const before=button('before'),after=button('after');
   const inert=document.createElement('div');inert.inert=true;inert.append(button('inert'));
   const disabled=document.createElement('fieldset');disabled.disabled=true;disabled.append(button('fieldset'));
   const hidden=button('hidden');hidden.style.visibility='hidden';
   const ariaHidden=document.createElement('div');ariaHidden.setAttribute('aria-hidden','true');ariaHidden.append(button('aria-hidden'));
   fixture.append(before,inert,disabled,hidden,ariaHidden,after);modal.prepend(fixture);before.focus({preventScroll:true});
   return document.activeElement===before&&[inert.firstElementChild,disabled.firstElementChild,hidden,ariaHidden.firstElementChild].every(el=>el.getClientRects().length>0);
 }`);
 assert(trapFixture,'modal trap regression fixture has real layout and initial focus');
 try{
   await pressTab();
   assert(await c.call("function(){return document.activeElement?.dataset.qaModalTab==='after'}"),'modal Tab skips inert, disabled-fieldset, hidden and aria-hidden controls');
   await pressTab(true);
   assert(await c.call("function(){return document.activeElement?.dataset.qaModalTab==='before'}"),'modal Shift+Tab skips unavailable controls in reverse');
 }finally{
   await c.call("function(){document.querySelector('[data-qa-modal-tab-fixture]')?.remove();document.querySelector('.quick-modal [data-autofocus=true]')?.focus({preventScroll:true});return true}");
 }
 const dateTrigger=await c.call("function(){const input=document.querySelector('.quick-modal .owned-date-shell input');input?.focus({preventScroll:true});return Boolean(input&&document.activeElement===input)}");
 assert(dateTrigger,'Quick Entry date control accepts keyboard focus');
 await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await waitFor("function(){const d=document.querySelector('.owned-date-popover[aria-modal=true]');return Boolean(d&&d.contains(document.activeElement))}",'keyboard opens and focuses nested date portal');
 assert(await c.call("function(){const input=document.querySelector('.quick-modal .owned-date-shell input');input?.focus();return Boolean(input?.closest('[inert]')&&document.activeElement?.closest('.owned-date-popover[aria-modal=true]'))}"),'nested body portal makes parent dialog inert');
 await pressTab();
 assert(await c.call("function(){return Boolean(document.activeElement?.closest('.owned-date-popover[aria-modal=true]'))}"),'nested date portal owns Tab');
 await pressEscape();
 await waitFor("function(){return !document.querySelector('.owned-date-popover')&&document.activeElement===document.querySelector('.quick-modal .owned-date-shell input')}",'nested date Escape restores parent date control');
 assert(await c.call("function(){return document.body.style.position==='fixed'}"),'nested date Escape retains parent scroll lock');
 assert(await c.call("function(){return !document.querySelector('.quick-modal')?.closest('[inert]')&&Boolean(document.querySelector('[data-global-quick-entry=desktop]')?.closest('[inert]'))}"),'nested close reactivates only parent dialog');
 await shot('keyboard-quick-entry-nested-date-restored');

 await pressEscape();await waitFor("function(){return !document.querySelector('.quick-modal[aria-modal=true]')}",'Quick Entry Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('[data-global-quick-entry=desktop]')}"),'Quick Entry restores focus to opener');
 assert(await c.call("function(){const late=document.getElementById('qa-late-background'),existing=document.getElementById('qa-existing-inert');const valid=late?.inert===false&&existing?.inert===true&&!document.querySelector('[data-global-quick-entry=desktop]')?.closest('[inert]');late?.remove();existing?.remove();return valid}"),'final close restores owned inert only and preserves pre-existing inert');

 const commandButton=await c.call("function(){const button=document.querySelector('.top-actions button[aria-label=\"Αναζήτηση και εντολές\"]');button?.focus();button?.click();return Boolean(button)}");
 assert(commandButton,'Command Palette opener exists');await waitFor("function(){return Boolean(document.querySelector('.command-palette[role=dialog]'))}",'Command Palette');
 assert(await c.call("function(){return Boolean(document.activeElement?.closest('.command-palette[role=dialog]'))}"),'Command Palette initial focus is inside dialog');
 assert(await c.call("function(){const opener=document.querySelector('.top-action-command');opener?.focus();return Boolean(opener?.closest('[inert]')&&document.activeElement?.closest('.command-palette[role=dialog]'))}"),'Command Palette background is inert');
 for(let i=0;i<14;i++){await pressTab();assert(await c.call("function(){return Boolean(document.activeElement?.closest('.command-palette[role=dialog]'))}"),`Command Palette focus trap step ${i+1}`)}
 await pressEscape();await waitFor("function(){return !document.querySelector('.command-palette[role=dialog]')}",'Command Palette Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('.top-actions button[aria-label=\"Αναζήτηση και εντολές\"]')}"),'Command Palette restores focus to opener');

 await navigate('dashboard',pages.dashboard,375,812,true);
 const more=await c.call("function(){const button=document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]');button?.focus();button?.click();return Boolean(button)}");
 assert(more,'mobile More opener exists');await waitFor("function(){return Boolean(document.querySelector('.mobile-more-menu[role=dialog]'))}",'mobile More dialog');
 assert(await c.call("function(){const opener=document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]');opener?.focus();return Boolean(opener?.closest('[inert]')&&document.activeElement?.closest('.mobile-more-menu[role=dialog]'))}"),'inline mobile More background is inert');
 for(let i=0;i<12;i++){await pressTab();assert(await c.call("function(){return Boolean(document.activeElement?.closest('.mobile-more-menu[role=dialog]'))}"),`mobile More focus trap step ${i+1}`)}
 await pressEscape();await waitFor("function(){return !document.querySelector('.mobile-more-menu[role=dialog]')}",'mobile More Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')}"),'mobile More restores focus to opener');
 await shot('keyboard-semantic-mobile-dashboard');

 // Actual shared period and topbar tooltip geometry with fine-pointer
 // keyboard focus, and the short sheet's last keyboard destination.
 await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const [width,height] of [[1440,1000],[768,600],[320,500]]){
   await navigate('dashboard',pages.dashboard,width,height,false);
   // Test both period and global action tooltips with a real keyboard focus modality.
   await pressTab();
   for(const [selector,name] of [['.period-control button','period'],['.top-actions .app-tooltip button','topbar']]){
     const focusTip=await c.call("function(selector){const button=[...document.querySelectorAll(selector)].find(node=>!node.disabled&&node.getClientRects().length);button?.focus();return Boolean(button&&document.activeElement===button)}",[selector]);
     assert(focusTip,name+' tooltip focus '+width);
     const tipGeometry=`function(){const button=document.activeElement,ids=(button?.getAttribute('aria-describedby')||'').split(/\\s+/),bubble=ids.map(id=>document.getElementById(id)).find(node=>node?.matches('.app-tooltip-bubble'));if(!bubble)return {ok:false,ids,active:button?.outerHTML?.slice(0,500)};const r=bubble.getBoundingClientRect(),a=button.getBoundingClientRect(),s=getComputedStyle(bubble),clips=[];for(let node=bubble.parentElement;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){const style=getComputedStyle(node),rect=node.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowX+' '+style.overflowY))clips.push({className:node.className,overflowX:style.overflowX,overflowY:style.overflowY,rect:rect.toJSON(),clientWidth:node.clientWidth,clientHeight:node.clientHeight})}const contained=clips.every(n=>(!/auto|scroll|hidden|clip/.test(n.overflowX)||(r.left>=n.rect.left-1&&r.right<=n.rect.right+1))&&(!/auto|scroll|hidden|clip/.test(n.overflowY)||(r.top>=n.rect.top-1&&r.bottom<=n.rect.bottom+1)));return {ok:s.visibility==='visible'&&Number(s.opacity)>.95&&r.width>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&contained&&(r.bottom<=a.top+1||r.top>=a.bottom-1||r.right<=a.left+1||r.left>=a.right-1),bubble:r.toJSON(),anchor:a.toJSON(),positioned:bubble.dataset.positioned,display:s.display,visibility:s.visibility,opacity:s.opacity,coarse:matchMedia('(pointer:coarse)').matches,focusWithin:bubble.parentElement.matches(':focus-within'),clips}}`;
     try{await waitFor('function(){return ('+tipGeometry+')().ok}',name+' tooltip contained and clear of trigger '+width)}
     catch(error){console.error('Tooltip geometry failure',JSON.stringify(await c.call(tipGeometry)));await shot('keyboard-'+name+'-tooltip-failure-'+width);throw error}
     await shot('keyboard-'+name+'-tooltip-'+width);
     await pressEscape();
     await waitFor("function(){const b=document.activeElement?.closest('.app-tooltip');return Boolean(b?.matches('[data-tooltip-dismissed]')&&getComputedStyle(b.querySelector('.app-tooltip-bubble')).display==='none')}",name+' tooltip Escape dismisses without moving keyboard focus '+width);
     assert(await c.call("function(){const b=document.activeElement;return Boolean(b?.matches('button')&&b.closest('.app-tooltip')?.matches('[data-tooltip-dismissed]')&&b.getAttribute('aria-describedby'))}"),name+' Escape retains trigger focus and description '+width);
     if(width===320)await shot('keyboard-'+name+'-tooltip-dismissed-'+width);
     await c.call("function(){const b=document.activeElement;b.blur();b.focus()}");
     await waitFor('function(){return ('+tipGeometry+')().ok}',name+' tooltip reopens on new keyboard focus '+width);
   }
 }
 await navigate('dashboard',pages.dashboard,320,420,false);
 assert(await c.call("function(){const button=document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]');button?.focus();button?.click();return Boolean(button)}"),'short viewport More opener exists');
 await waitFor("function(){const menu=document.querySelector('.mobile-more-menu');const r=menu?.getBoundingClientRect();return Boolean(r&&r.width>0&&r.top>=0&&r.bottom<=innerHeight&&menu.scrollHeight>menu.clientHeight)}",'short More sheet contained and scrollable');
 for(let index=0;index<8;index++)await pressTab();
 await waitFor("function(){const menu=document.querySelector('.mobile-more-menu'),button=document.activeElement;const r=menu.getBoundingClientRect(),b=button.getBoundingClientRect();return button===menu.querySelector('nav button:last-child')&&b.top>=r.top-1&&b.bottom<=r.bottom+1&&b.left>=r.left-1&&b.right<=r.right+1}",'last More destination scrolls into visible sheet');
 const moreLabels=await c.call("function(){return [...document.querySelectorAll('.mobile-more-menu nav button')].flatMap(button=>{const b=button.getBoundingClientRect(),label=button.querySelector('span');if(!label)return ['missing label'];const range=document.createRange();range.selectNodeContents(label);return [...range.getClientRects()].some(r=>r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)||label.scrollWidth>label.clientWidth+1?[label.textContent]:[]})}");
 assert(moreLabels.length===0,'short More labels fully contained: '+JSON.stringify(moreLabels));
 assert(await c.call("function(){const nav=document.querySelector('.mobile-more-menu nav');if(!nav)return false;const r=nav.getBoundingClientRect(),buttons=[...nav.querySelectorAll('button')];return buttons.length>0&&buttons.every(button=>{const b=button.getBoundingClientRect();return Math.abs(b.left-r.left)<=1&&Math.abs(b.right-r.right)<=1&&b.height>=44})}"),'short narrow More uses complete destination rows');
 await shot('keyboard-more-short-last-destination');
 await pressEscape();await waitFor("function(){return !document.querySelector('.mobile-more-menu[role=dialog]')}",'short More Escape close');
 assert(await c.call("function(){return document.activeElement===document.querySelector('button[aria-label=\"Περισσότερες ενότητες\"]')}"),'short More restores focus');

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
 await stopBrowser(browserSession?.child);
 if(browserSession?.profile)cleanProfile(browserSession.profile);
 await sleep(200);
}
