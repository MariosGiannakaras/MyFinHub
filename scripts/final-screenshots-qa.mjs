import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { visualEvidenceContext } from './visual-evidence-store.mjs';

if(process.argv.includes('--validate-only')){
  console.log('Final screenshot harness module validation passed.');
  process.exit(0);
}

const context=visualEvidenceContext();
const {repositoryRoot,appVersion,timeZone,timestamp,generatedAt,sourceSha,shortSha,sourceBranch,evidenceRoot}=context;
if(process.env.MYFINHUB_FINAL_SCREENSHOTS!=='1')throw new Error('Final screenshot capture requires MYFINHUB_FINAL_SCREENSHOTS=1.');
rmSync(evidenceRoot,{recursive:true,force:true});
mkdirSync(evidenceRoot,{recursive:true});

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const browser=process.env.MYFINHUB_QA_PRIMARY_BROWSER||execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!browser)throw new Error('Chrome/Chromium is required for final screenshots.');
const basePort=9238;
const profileBase='/tmp/myfinhub-final-screenshots-chrome';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cleanProfile=profile=>{try{rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150})}catch{}};
const trimDiagnostics=value=>{const text=String(value||'').trim();return text?text.slice(-6000):'(no browser stderr/stdout captured)'};
async function stopBrowser(child){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},2000);child.once('exit',()=>{clearTimeout(timer);resolve()});child.kill('SIGTERM')})}
async function launchBrowser(){
  let lastError=null;
  for(let attempt=0;attempt<2;attempt+=1){
    const port=basePort+attempt;
    const profile=`${profileBase}-${attempt+1}`;
    cleanProfile(profile);
    let diagnostics='',spawnError='';
    const child=spawn(browser,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','pipe','pipe']});
    const capture=stream=>stream?.on('data',chunk=>{diagnostics+=chunk.toString();if(diagnostics.length>12000)diagnostics=diagnostics.slice(-12000)});
    capture(child.stdout);capture(child.stderr);child.on('error',error=>{spawnError=error.stack||error.message});
    try{
      for(let i=0;i<100;i+=1){
        if(spawnError)throw new Error(`Browser spawn failed: ${spawnError}`);
        if(child.exitCode!==null)throw new Error(`Browser exited before CDP became ready (exit ${child.exitCode}).\n${trimDiagnostics(diagnostics)}`);
        try{const response=await fetch(`http://127.0.0.1:${port}/json/version`);if(response.ok)return {child,port,profile}}catch{}
        await sleep(200);
      }
      throw new Error(`Browser did not expose CDP port ${port} within 20s.\n${trimDiagnostics(diagnostics)}`);
    }catch(error){
      lastError=error;
      await stopBrowser(child);
      cleanProfile(profile);
      if(attempt===0)await sleep(750);
    }
  }
  throw lastError??new Error('Final screenshot browser bootstrap failed.');
}
let browserSession=null;
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά / Οφειλές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές',settings:'Ρυθμίσεις'};
const settingsTabs=['profile','accounts','categories','icons','rules','data'];
const authScreens=[
  {screen:'login',state:'login'},
  {screen:'login-error',state:'login-error'},
  {screen:'auth-unavailable',state:'auth-unavailable'},
  {screen:'session-expired',state:'session-expired'},
  {screen:'session-revoked',state:'session-revoked'},
  {screen:'mfa',state:'mfa'},
  {screen:'mfa-error',state:'mfa-error'},
  {screen:'mfa-enroll',state:'mfa-enroll'},
  {screen:'mfa-enroll-error',state:'mfa-enroll-error'},
];
const utilityScreens=['404'];
const viewports=[{mode:'desktop',width:1440,height:1000},{mode:'tablet',width:834,height:1112},{mode:'mobile',width:375,height:812}];
const themes=['light','dark'];
const screenshots=[];
const clean=value=>String(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'capture';

try{
  browserSession=await launchBrowser();
  const {port}=browserSession;
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  let activeTheme='light';
  const applyTheme=async preference=>{const resolved=await c.call(`async function(pref){localStorage.setItem('myfinhub.theme',pref);const mod=await import('/src/lib/theme.ts');mod.applyThemePreference(pref);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme}`,[preference]);if(resolved!==preference)throw new Error(`Theme ${preference} did not resolve before final capture (got ${resolved}).`);activeTheme=preference};
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,args=[],label='page')=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigatePage=async(page,heading)=>{
    const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('visual','1');
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(text){return document.readyState==='complete'&&(document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",[heading],page);
    await applyTheme(activeTheme);
    if(page==='dashboard'){
      await waitFor("function(){if(innerWidth<=680)return true;const selectors=['.summary-donut .recharts-surface','.approved-bar-wrap .recharts-surface','.approved-category-donut .recharts-surface'];return selectors.every(selector=>Boolean(document.querySelector(selector)))}",[],'Dashboard deferred charts');
      await waitFor("function(){if(innerWidth<=680)return true;const visibleShape=selector=>[...document.querySelectorAll(selector)].some(node=>{try{const box=node.getBBox();return box.width>2&&box.height>2}catch{return false}});return visibleShape('.approved-bar-wrap .recharts-rectangle')&&visibleShape('.summary-donut .recharts-sector')&&visibleShape('.approved-category-donut .recharts-sector')}",[],'Dashboard painted charts');
    }
    if(page==='credit'&&await c.call("function(){return innerWidth<=680}")){
      const geometry=await c.call("function(){const card=document.querySelector('#myfinhub-card-stack .stack-card.top .payment-card'),network=card?.querySelector('.card-network.card-network-assets');if(!card||!network)return null;const outer=card.getBoundingClientRect(),inner=network.getBoundingClientRect();return {card:{left:outer.left,top:outer.top,right:outer.right,bottom:outer.bottom,width:outer.width,height:outer.height},network:{left:inner.left,top:inner.top,right:inner.right,bottom:inner.bottom,width:inner.width,height:inner.height},bottomInset:outer.bottom-inner.bottom,rightInset:outer.right-inner.right}}");
      if(!geometry||geometry.bottomInset<4||geometry.rightInset<0)throw new Error(`Mobile Credit network mark escapes card safe area: ${JSON.stringify(geometry)}`);
    }
    const visibleQaControl=await c.call("function(){const node=document.querySelector('[data-qa-crash]');if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0}");
    if(visibleQaControl)throw new Error(`QA-only crash control is visible in final capture for ${page}`);
    await sleep(260);
  };
  const navigateAuth=async(screen)=>{
    const url=new URL(baseUrl);url.searchParams.set('screen',screen);url.searchParams.set('visual','1');
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('.login-card h1'))}",[],screen);
    await applyTheme(activeTheme);
    await sleep(220);
  };
  const navigateUtility=async(screen)=>{
    const url=new URL(baseUrl);url.searchParams.set('screen',screen);url.searchParams.set('visual','1');
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#not-found-title'))}",[],screen);
    await applyTheme(activeTheme);
    await sleep(220);
  };
  const captureSettingsNestedStates=async(tab,theme,item)=>{
    const captureNested=async state=>{await sleep(240);return capture('settings',state,theme,item.mode,item.width,item.height)};
    const closeAndWait=async(selector,closeSelector,label)=>{
      const closed=await c.call("function(rootSelector,buttonSelector){const root=document.querySelector(rootSelector);const button=root?.querySelector(buttonSelector);button?.click();return Boolean(button)}",[selector,closeSelector]);
      if(!closed)throw new Error('Missing close action for '+label);
      await waitFor("function(selector){return !document.querySelector(selector)}",[selector],label+' close');
    };
    if(tab==='accounts'){
      const providerOpened=await c.call("function(){const button=document.querySelector('.provider-edit-action');button?.click();return Boolean(button)}");
      if(!providerOpened)throw new Error('Missing provider edit action for final nested Settings evidence');
      await waitFor("function(){return Boolean(document.querySelector('.provider-editor-modal'))}",[],'provider editor');
      await captureNested('provider-editor-details');
      const brandingOpened=await c.call("function(){const button=[...document.querySelectorAll('.provider-editor-tabs [role=tab]')].find(node=>(node.textContent||'').trim()==='Εικόνες');button?.click();return Boolean(button)}");
      if(!brandingOpened)throw new Error('Missing provider branding tab');
      await waitFor("function(){return document.querySelector('.provider-editor-tabs [role=tab][aria-selected=true]')?.textContent?.trim()==='Εικόνες'}",[],'provider branding tab');
      await captureNested('provider-editor-branding');
      const pickerOpened=await c.call("function(){const button=document.querySelector('.provider-editor-modal .provider-slot-select');button?.click();return Boolean(button)}");
      if(!pickerOpened)throw new Error('Missing provider asset slot action');
      await waitFor("function(){return Boolean(document.querySelector('.provider-asset-picker[role=dialog]'))}",[],'provider asset picker');
      await captureNested('provider-asset-picker');
      await closeAndWait('.provider-asset-picker','button[aria-label=\"Κλείσιμο επιλογής εικόνας\"]','provider asset picker');
      await closeAndWait('.provider-editor-modal','button[aria-label=\"Κλείσιμο\"]','provider editor');

      const accountOpened=await c.call("function(){const button=document.querySelector('.account-management-create');button?.click();return Boolean(button)}");
      if(!accountOpened)throw new Error('Missing new-account action');
      await waitFor("function(){return Boolean(document.querySelector('.account-management-modal.is-new'))}",[],'new account editor');
      await captureNested('account-editor-new');
      await closeAndWait('.account-management-modal','button[aria-label=\"Κλείσιμο\"]','account editor');
    }
    if(tab==='categories'){
      const opened=await c.call("function(){const button=document.querySelector('.settings-categories-only .category-taxonomy-head .taxonomy-row-actions button[aria-label^=\"Μετονομασία \"]');button?.click();return Boolean(button)}");
      if(!opened)throw new Error('Missing category rename action');
      await waitFor("function(){return Boolean(document.querySelector('.settings-categories-only .taxonomy-inline-editor'))}",[],'category rename editor');
      await captureNested('category-rename-editor');
      const cancel=await c.call("function(){const button=document.querySelector('.settings-categories-only .taxonomy-inline-editor button[aria-label=\"Ακύρωση μετονομασίας\"]');button?.click();return Boolean(button)}");
      if(!cancel)throw new Error('Missing category rename cancel action');
      await waitFor("function(){return !document.querySelector('.settings-categories-only .taxonomy-inline-editor')}",[],'category rename close');
    }
    if(tab==='icons'){
      const opened=await c.call("function(){const button=document.querySelector('.settings-icons-only .category-icon-unified-main');button?.click();return Boolean(button)}");
      if(!opened)throw new Error('Missing icon assignment row');
      await waitFor("function(){return Boolean(document.querySelector('.settings-icons-only [data-icon-selection-panel]'))}",[],'icon selection editor');
      await captureNested('icon-selection-editor');
      const close=await c.call("function(){const button=document.querySelector('.settings-icons-only .category-icon-selection-close');button?.click();return Boolean(button)}");
      if(!close)throw new Error('Missing icon selection close action');
      await waitFor("function(){return !document.querySelector('.settings-icons-only [data-icon-selection-panel]')}",[],'icon selection close');
    }
    if(tab==='rules'){
      const opened=await c.call("function(){const button=document.querySelector('.settings-rules-only .rules-new-button');button?.click();return Boolean(button)}");
      if(!opened)throw new Error('Missing new-rule action');
      await waitFor("function(){return Boolean(document.querySelector('.settings-rules-only [data-rule-editor]'))}",[],'rule editor');
      await captureNested('rule-editor-new');
      const close=await c.call("function(){const button=document.querySelector('.settings-rules-only [data-rule-editor] button[aria-label=\"Κλείσιμο επεξεργασίας κανόνα\"]');button?.click();return Boolean(button)}");
      if(!close)throw new Error('Missing rule editor close action');
      await waitFor("function(){return !document.querySelector('.settings-rules-only [data-rule-editor]')}",[],'rule editor close');
    }
    if(tab==='data'){
      const opened=await c.call("function(){const input=document.querySelector('.settings-data-import-card input[type=file]');if(!(input instanceof HTMLInputElement))return false;const transfer=new DataTransfer();transfer.items.add(new File(['{}'],'myfinhub-visual-evidence.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true}");
      if(!opened)throw new Error('Missing Settings data import input');
      await waitFor("function(){const dialog=document.querySelector('.app-confirm-dialog[role=alertdialog]');return Boolean(dialog&&(dialog.textContent||'').includes('Εισαγωγή δεδομένων από JSON'))}",[],'data import confirmation');
      await captureNested('data-import-confirmation');
      const cancel=await c.call("function(){const dialog=document.querySelector('.app-confirm-dialog[role=alertdialog]');const button=[...(dialog?.querySelectorAll('button')||[])].find(node=>(node.textContent||'').trim()==='Ακύρωση');button?.click();return Boolean(button)}");
      if(!cancel)throw new Error('Missing data import cancel action');
      await waitFor("function(){return !document.querySelector('.app-confirm-dialog[role=alertdialog]')}",[],'data import confirmation close');
    }
  };

  const capture=async(surface,state,theme,mode,width,height)=>{
    const metrics=await c.send('Page.getLayoutMetrics');const size=metrics.cssContentSize||metrics.contentSize;
    const captureWidth=Math.max(1,Math.ceil(size.width));const captureHeight=Math.max(1,Math.min(16000,Math.ceil(size.height)));
    const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:captureWidth,height:captureHeight,scale:1}});
    const dir=resolve(evidenceRoot,clean(surface));mkdirSync(dir,{recursive:true});
    const fileName=`${appVersion}__${timestamp}__${clean(state)}-${theme}__${mode}-${width}x${height}.png`;
    const path=resolve(dir,fileName);writeFileSync(path,Buffer.from(shot.data,'base64'));
    screenshots.push({file:relative(repositoryRoot,path).replaceAll('\\','/'),surface,state,theme,viewport:{mode,width,height},capture:{width:captureWidth,height:captureHeight}});
  };

  for(const theme of themes){
    await applyTheme(theme);
    for(const item of viewports){
      await viewport(item.width,item.height);
      for(const [page,heading] of Object.entries(pages)){
        await navigatePage(page,heading);
        await capture(page,'page',theme,item.mode,item.width,item.height);
        if(page==='settings'){
          for(const tab of settingsTabs){
            const clicked=await c.call('function(tab){const node=document.querySelector(\'[aria-controls="settings-panel-'+tab+'"]\');if(!node)return false;node.click();return true}',[tab]);
            if(!clicked)throw new Error(`Missing Settings tab ${tab}`);
            await waitFor('function(tab){return document.querySelector(\'[aria-controls="settings-panel-'+tab+'"]\')?.getAttribute("aria-selected")==="true"}',[tab],`settings tab ${tab}`);
            await sleep(180);
            await capture('settings',`tab-${tab}`,theme,item.mode,item.width,item.height);
            await captureSettingsNestedStates(tab,theme,item);
          }
        }
      }
      for(const auth of authScreens){await navigateAuth(auth.screen);await capture('auth',auth.state,theme,item.mode,item.width,item.height)}
      for(const screen of utilityScreens){await navigateUtility(screen);await capture('not-found','route-404',theme,item.mode,item.width,item.height)}
    }
  }
  c.close();
  const settingsNestedStateCount=8;
  const expectedScreenshots=themes.length*viewports.length*(Object.keys(pages).length+settingsTabs.length+authScreens.length+utilityScreens.length+settingsNestedStateCount);
  if(screenshots.length!==expectedScreenshots)throw new Error(`Expected ${expectedScreenshots} final screenshots, captured ${screenshots.length}.`);
  const manifest={schemaVersion:1,kind:'final-release-screenshots',appVersion,captureId:`${timestamp}__${shortSha}`,generatedAt,timeZone,source:{sha:sourceSha,shortSha,branch:sourceBranch},baseUrl,count:screenshots.length,screenshots};
  writeFileSync(resolve(evidenceRoot,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
  console.log(`Final screenshot QA passed: ${screenshots.length} screenshots across light/dark application pages, Settings tabs and nested editors, auth success/failure states and the 404 surface.`);
}finally{
  if(browserSession){
    await stopBrowser(browserSession.child);
    cleanProfile(browserSession.profile);
  }
}
