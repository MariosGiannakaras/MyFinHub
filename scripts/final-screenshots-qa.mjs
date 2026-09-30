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
const authScreens=['login','mfa','mfa-enroll'];
const viewports=[{mode:'desktop',width:1440,height:1000},{mode:'tablet',width:834,height:1112},{mode:'mobile',width:375,height:812}];
const screenshots=[];
const clean=value=>String(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'capture';

try{
  browserSession=await launchBrowser();
  const {port}=browserSession;
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,args=[],label='page')=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const navigatePage=async(page,heading)=>{
    const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('visual','1');
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(text){return document.readyState==='complete'&&(document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",[heading],page);
    const visibleQaControl=await c.call("function(){const node=document.querySelector('[data-qa-crash]');if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0}");
    if(visibleQaControl)throw new Error(`QA-only crash control is visible in final capture for ${page}`);
    await sleep(120);
  };
  const navigateAuth=async(screen)=>{
    const url=new URL(baseUrl);url.searchParams.set('screen',screen);url.searchParams.set('visual','1');
    await c.send('Page.navigate',{url:url.href});
    await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('.login-card h1'))}",[],screen);
    await sleep(120);
  };
  const capture=async(surface,state,mode,width,height)=>{
    const metrics=await c.send('Page.getLayoutMetrics');const size=metrics.cssContentSize||metrics.contentSize;
    const captureWidth=Math.max(1,Math.ceil(size.width));const captureHeight=Math.max(1,Math.min(16000,Math.ceil(size.height)));
    const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:captureWidth,height:captureHeight,scale:1}});
    const dir=resolve(evidenceRoot,clean(surface));mkdirSync(dir,{recursive:true});
    const fileName=`${appVersion}__${timestamp}__${clean(state)}__${mode}-${width}x${height}.png`;
    const path=resolve(dir,fileName);writeFileSync(path,Buffer.from(shot.data,'base64'));
    screenshots.push({file:relative(repositoryRoot,path).replaceAll('\\','/'),surface,state,viewport:{mode,width,height},capture:{width:captureWidth,height:captureHeight}});
  };

  for(const item of viewports){
    await viewport(item.width,item.height);
    for(const [page,heading] of Object.entries(pages)){
      await navigatePage(page,heading);
      await capture(page,'page',item.mode,item.width,item.height);
      if(page==='settings'){
        for(const tab of settingsTabs){
          const clicked=await c.call('function(tab){const node=document.querySelector(\'[aria-controls="settings-panel-'+tab+'"]\');if(!node)return false;node.click();return true}',[tab]);
          if(!clicked)throw new Error(`Missing Settings tab ${tab}`);
          await waitFor('function(tab){return document.querySelector(\'[aria-controls="settings-panel-'+tab+'"]\')?.getAttribute("aria-selected")==="true"}',[tab],`settings tab ${tab}`);
          await sleep(80);
          await capture('settings',`tab-${tab}`,item.mode,item.width,item.height);
        }
      }
    }
    for(const screen of authScreens){await navigateAuth(screen);await capture('auth',screen,item.mode,item.width,item.height)}
  }
  c.close();
  if(screenshots.length!==63)throw new Error(`Expected 63 final screenshots, captured ${screenshots.length}.`);
  const manifest={schemaVersion:1,kind:'final-release-screenshots',appVersion,captureId:`${timestamp}__${shortSha}`,generatedAt,timeZone,source:{sha:sourceSha,shortSha,branch:sourceBranch},baseUrl,count:screenshots.length,screenshots};
  writeFileSync(resolve(evidenceRoot,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
  console.log(`Final screenshot QA passed: ${screenshots.length} screenshots across application pages, Settings tabs and auth states.`);
}finally{
  if(browserSession){
    await stopBrowser(browserSession.child);
    cleanProfile(browserSession.profile);
  }
}
