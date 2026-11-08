import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

// Deterministic visual QA: Electron-only Settings with synthetic bridge.
// No real filesystem, backend credentials, owner data or Production requests.
const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-desktop-backup-qa';
mkdirSync(evidenceDir,{recursive:true});
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v chromium || command -v google-chrome'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chromium is required for Desktop Backup rendered QA.');
const browserAttempt=process.env.MYFINHUB_BACKUP_BROWSER_ATTEMPT==='2'?2:1;
const port=9271+browserAttempt;
const profile='/tmp/myfinhub-desktop-backup-qa-chrome-'+browserAttempt;
const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe'],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:''},detached:true});
let chromiumDiagnostics='';
for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{chromiumDiagnostics+=String(chunk);if(chromiumDiagnostics.length>6000)chromiumDiagnostics=chromiumDiagnostics.slice(-6000)});
child.on('error',error=>{chromiumDiagnostics+='; spawn error: '+error.message});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,label)=>{if(!value)throw new Error('Desktop backup rendered QA: '+label)};
async function ready(url){for(let i=0;i<120;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await delay(150)}throw new Error('Desktop backup Chromium CDP bootstrap failed: '+url+'; diagnostics: '+(chromiumDiagnostics.slice(-2500)||'(no stderr)'))}
class Cdp {
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'JS runtime failure');return result.result.value}
  close(){this.ws?.close()}
}
function injectNativeBackupFixture(){
  const mode=new URL(location.href).searchParams.get('backup-ui-state')||'empty';
  const good={name:'MyFinHub-finance-2026-10-24T12-00-00-000Z-r465-abcdef12.json',createdAt:'2026-10-24T12:00:00.000Z',revision:'465',bytes:89412,valid:true};
  const invalid={name:'MyFinHub-finance-2026-10-23T12-00-00-000Z-r460-abcdef12.json',createdAt:'2026-10-23T12:00:00.000Z',revision:'460',bytes:88312,valid:false};
  const empty=mode==='empty'||mode==='retry';
  const status={folder:'C:\\Users\\Owner\\Documents\\MyFinHub\\Backups',intervalHours:24,retentionDays:30,
    backups:empty?[]:mode==='invalid-only'?[invalid]:[good,invalid],
    lastValidBackupAt:empty||mode==='invalid-only'?null:good.createdAt,
    lastFailureAt:mode==='failure'?'2026-10-24T12:30:00.000Z':null};
  // React StrictMode can run effects twice; preserve the synthetic failure
  // until the QA explicitly activates recovery and clicks the real Refresh.
  let transientStatusFailure=mode==='retry';
  window.__myfinhubQaEnableBackupStatusRetry=()=>{transientStatusFailure=false};
  Object.defineProperty(window,'myFinHubDesktop',{configurable:false,writable:false,value:{
    getInfo:async()=>({productName:'MyFinHub',version:'1.6.0',packaged:true}),
    getUpdateState:async()=>({supported:true,currentVersion:'1.6.0',status:'up-to-date',availableVersion:null,progress:100,message:'Ενημερωμένη'}),
    checkForUpdates:async()=>({supported:true,currentVersion:'1.6.0',status:'up-to-date',availableVersion:null,progress:100,message:'Ενημερωμένη'}),
    downloadUpdate:async()=>({supported:false,currentVersion:'1.6.0',status:'unsupported',availableVersion:null,progress:0,message:''}),
    installUpdate:async()=>({supported:false,currentVersion:'1.6.0',status:'unsupported',availableVersion:null,progress:0,message:''}),
    onUpdateState:()=>()=>{},
    getBackupStatus:async()=>{
      if(transientStatusFailure)throw new Error('synthetic transient status failure')
      return status;
    },saveLocalBackup:async()=>({name:good.name,createdAt:good.createdAt,revision:'465',verified:true}),
    reportBackupFailure:async()=>true,chooseBackupFolder:async()=>status,openBackupFolder:async()=>true,
    // Restore Candidate must pass the same non-destructive client preview as
    // genuine FinanceData before a destructive confirmation is possible.
    getRestoreCandidate:async()=>({
      app:'RheomIQ',schemaVersion:3,updatedAt:good.createdAt,
      seed:{accounts:[],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
      state:{settings:{},events:[]},
    })
  }});
}
let c;
try{
  await ready('http://127.0.0.1:'+port+'/json/version');
  const target=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(response=>response.json());
  c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+injectNativeBackupFixture.toString()+')();'});
  const wait=async(fn,label,args=[])=>{for(let i=0;i<120;i++){if(await c.call(fn,args))return;await delay(100)}throw new Error('Timed out waiting for '+label)};
  const viewports=[{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'mobile',width:375,height:812}];
  for(const viewport of viewports){
    for(const mode of ['empty','populated','failure','invalid-only','retry']){
      await c.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,mobile:viewport.width<680,deviceScaleFactor:1});
      const url=new URL(baseUrl);url.searchParams.set('page','settings');url.searchParams.set('backup-ui-state',mode);
      await c.send('Page.navigate',{url:url.href});
      await wait("function(expected){return new URLSearchParams(location.search).get('backup-ui-state')===expected&&Boolean(document.querySelector('.settings-tablist'))}",'Settings tabs on correct state',[mode]);
      const clicked=await c.call("function(){const button=[...document.querySelectorAll('.settings-tablist button')].find(el=>(el.textContent||'').trim()==='Δεδομένα');if(!button)return false;button.click();return true}");
      assert(clicked,'Data tab must be clickable');
      await wait("function(){return Boolean(document.querySelector('.settings-data-tab .desktop-backup-panel .desktop-backup-controls'))}",'native backup panel');
      if(mode==='retry'){
        await wait("function(){return (document.querySelector('.desktop-backup-error[role=alert]')?.textContent||'').includes('κατάσταση των τοπικών αντιγράφων')}",'native transient status failure');
        const errorShot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        writeFileSync(evidenceDir+'/desktop-backup-retry-initial-error-'+viewport.name+'.png',Buffer.from(errorShot.data,'base64'));
        const triggered=await c.call("function(){const enable=globalThis.__myfinhubQaEnableBackupStatusRetry;const button=[...document.querySelectorAll('.desktop-backup-controls button')].find(el=>(el.textContent||'').includes('Ανανέωση κατάστασης'));if(typeof enable!=='function'||!button||button.disabled)return false;enable();button.click();return true}");
        assert(triggered,'native backup retry button must be available after a failed status read');
        await wait("function(){const panel=document.querySelector('.desktop-backup-panel');return Boolean(panel?.querySelector('.desktop-backup-health')?.textContent?.includes('Αναμονή πρώτου αντιγράφου')&&!panel.querySelector('.desktop-backup-error[role=alert]'))}",'native status refresh clears transient error');
      }
      await wait("function(){return !document.querySelector('.desktop-backup-path')?.textContent?.includes('Έλεγχος')}",'native status');
      const themeApplied=await c.call("async function(){localStorage.setItem('myfinhub.theme','light');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('light');return document.documentElement.dataset.theme;}");
      assert(themeApplied==='light','light theme must apply to native backup panel');
      const result=await c.call("function(){const panel=document.querySelector('.desktop-backup-panel');const buttons=[...panel.querySelectorAll('button')];const rows=[...panel.querySelectorAll('.desktop-backup-entry')];const status=panel.textContent||'';const overflow=Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth;const head=panel.querySelector('.panel-head')?.getBoundingClientRect();const health=panel.querySelector('.desktop-backup-health')?.getBoundingClientRect();const facts=panel.querySelector('.desktop-backup-facts')?.getBoundingClientRect();const panelWidth=panel.getBoundingClientRect().width;const layout={headBottom:head?.bottom,healthTop:health?.top,healthBottom:health?.bottom,factsTop:facts?.top,healthWidth:health?.width,factsWidth:facts?.width,panelWidth};const layoutOK=Boolean(head&&health&&facts&&health.top>=head.bottom-2&&facts.top>=health.bottom-2&&health.width>=panelWidth*.87&&facts.width>=panelWidth*.87);return {overflow,layoutOK,layout,rows:rows.length,invalid:rows.filter(row=>row.textContent.includes('Μη έγκυρο αρχείο')).length,disabledRestore:rows.filter(row=>row.textContent.includes('Μη έγκυρο αρχείο')&&row.querySelector('button')?.disabled).length,missingTouch:buttons.filter(el=>{const r=el.getBoundingClientRect();return r.width<40||r.height<40}).map(el=>el.textContent?.trim()),hasFolder:status.includes('MyFinHub')&&status.includes('Backups'),hasFailure:status.includes('Τελευταία αποτυχημένη προσπάθεια'),invalidOnlyAlert:Boolean(panel.querySelector('.desktop-backup-health[role=alert]')?.textContent?.includes('Δεν υπάρχει έγκυρο τοπικό αντίγραφο'))};}");
      assert(result.overflow<=1,viewport.name+'/'+mode+': overflow '+result.overflow+'px');
      assert(result.layoutOK,viewport.name+'/'+mode+': status and finance details must stack in a full-width panel '+JSON.stringify(result.layout));
      assert(result.hasFolder,viewport.name+'/'+mode+': folder not visible');
      const expectedRows=mode==='empty'||mode==='retry'?0:mode==='invalid-only'?1:2;
      const expectedInvalid=mode==='empty'||mode==='retry'?0:1;
      assert(result.rows===expectedRows,viewport.name+'/'+mode+': wrong backup count');
      assert(result.invalid===expectedInvalid,viewport.name+'/'+mode+': damaged file not marked');
      assert(result.disabledRestore===expectedInvalid,viewport.name+'/'+mode+': damaged restore not blocked');
      assert(result.hasFailure===(mode==='failure'),viewport.name+'/'+mode+': failure state inaccurate');
      assert(result.invalidOnlyAlert===(mode==='invalid-only'),viewport.name+'/'+mode+': invalid-only alert mismatch');
      if(mode==='invalid-only')assert(await c.call("function(){return (document.querySelector('.desktop-backup-health')?.textContent||'').includes('κανένα δεν πέρασε τον έλεγχο ακεραιότητας SHA-256')&&!document.querySelector('.desktop-backup-health')?.textContent?.includes('Δεν έχει δημιουργηθεί ακόμη τοπικό backup')}"),viewport.name+'/'+mode+': corrupted catalog falsely announced first install');
      if(viewport.name==='mobile')assert(result.missingTouch.length===0,'mobile '+mode+': touch targets <40px '+JSON.stringify(result.missingTouch));
      const dims=await c.call("function(){const root=document.documentElement;return {width:innerWidth,height:Math.min(2800,Math.ceil(Math.max(root.scrollHeight,document.body.scrollHeight)))}}");
      const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:dims.width,height:dims.height,scale:1}});
      writeFileSync(evidenceDir+'/desktop-backup-'+mode+'-'+viewport.name+'.png',Buffer.from(shot.data,'base64'));
      if(mode==='populated'&&viewport.name!=='tablet'){
        const dark=await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.documentElement.dataset.theme;}");
        assert(dark==='dark','dark theme must apply to native backup panel');
        const darkShot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:dims.width,height:dims.height,scale:1}});
        writeFileSync(evidenceDir+'/desktop-backup-populated-dark-'+viewport.name+'.png',Buffer.from(darkShot.data,'base64'));
        await c.call("async function(){localStorage.setItem('myfinhub.theme','light');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('light');return true;}");
      }
      if(mode==='populated'&&viewport.name==='desktop'){
        const opened=await c.call("function(){const row=[...document.querySelectorAll('.desktop-backup-entry')].find(el=>el.textContent.includes('Επαληθευμένο (SHA-256)'));const button=row?.querySelector('button');if(!button||button.disabled)return false;button.click();return true}");
        assert(opened,'valid restore action enabled');
        try{
          await wait("function(){return Boolean(document.querySelector('[role=alertdialog]')&&document.querySelector('.settings-import-preview'))}",'destructive restore confirmation with validated JSON preview');
        }catch(error){
          const diagnostic=await c.call("function(){return {preview:document.querySelector('.settings-import-preview')?.textContent||'',feedback:[...document.querySelectorAll('.operation-feedback')].map(node=>node.textContent||''),dialog:Boolean(document.querySelector('[role=alertdialog]'))}}");
          const failed=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
          writeFileSync(evidenceDir+'/desktop-backup-restore-diagnostic-desktop.png',Buffer.from(failed.data,'base64'));
          throw new Error('Desktop backup restore preview/confirmation failed: '+JSON.stringify(diagnostic),{cause:error});
        }
        const text=await c.call("function(){return document.querySelector('[role=alertdialog]')?.textContent||''}");
        assert(text.includes('Εισαγωγή')&&text.includes('αντικαθιστά'),'restore must require destructive import confirmation');
        // Capture the fully visible modal, not its intermediate Framer entry frame.
        await delay(440);
        const dialog=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        writeFileSync(evidenceDir+'/desktop-backup-restore-confirm-desktop.png',Buffer.from(dialog.data,'base64'));
      }
    }
  }
  console.log('Desktop backup rendered QA passed: 15 responsive native panel states, 3 error-to-retry screenshots, 2 dark-theme states, corruption-only warning, failure recovery and destructive restore confirmation.');
}finally{
  c?.close();
  // Chromium wrappers can leave grandchildren holding the CDP port after the
  // parent exits. The QA process group is detached from this Node runner.
  if(child.pid){try{process.kill(-child.pid,'SIGTERM')}catch{child.kill('SIGTERM')}}
  else child.kill('SIGTERM');
  await delay(350);
  rmSync(profile,{recursive:true,force:true,maxRetries:6,retryDelay:150});
}
