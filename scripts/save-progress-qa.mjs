import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-save-progress-qa';
mkdirSync(evidenceDir,{recursive:true});
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium required for save-progress QA');
const port=9287;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-save-progress-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<90;i++){try{const response=await fetch(url);if(response.ok)return;}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,label)=>{if(!value)throw new Error(`Save-progress QA assertion failed: ${label}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const url=new URL(baseUrl);url.searchParams.set('screen','persistence-probe');
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url.href)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<90;i++){if(await c.call(fn,args))return;await sleep(85)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async()=>{await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null}",'finance probe ready')};
  // The isolated QA entrypoint does not initialize the app theme on navigation.
  // Activate the real dark tokens before every screenshot labeled "-dark",
  // then verify the computed visual theme rather than trusting the filename.
  const shot=async name=>{
    if(name.endsWith('-dark')){
      const theme=await c.call("async function(){const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const root=document.documentElement;const style=getComputedStyle(root);return {applied:root.dataset.theme,colorScheme:style.colorScheme,canvas:style.getPropertyValue('--canvas').trim(),expected:mod.DARK_THEME_TOKENS['--canvas'],background:getComputedStyle(document.body).backgroundImage}}");
      assert(theme.applied==='dark'&&theme.colorScheme==='dark'&&theme.canvas===theme.expected&&theme.background.startsWith('linear-gradient('),'dark-labeled screenshot must use actual dark semantic theme: '+name+' '+JSON.stringify(theme));
      // Protect the readable light error surface from dark-context muted tokens.
      const noticeContrast=await c.call("function(){const el=document.querySelector('.persistence-notice.error small,.persistence-notice.conflict small');if(!el)return null;const notice=el.closest('.persistence-notice');const luminance=color=>{const rgb=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const fg=getComputedStyle(el),bg=getComputedStyle(notice),a=luminance(fg.color),b=luminance(bg.backgroundColor),rect=notice.getBoundingClientRect();return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),fontSize:parseFloat(fg.fontSize),fits:rect.left>=-1&&rect.right<=innerWidth+1,overflows:notice.scrollWidth>notice.clientWidth+1,foreground:fg.color,background:bg.backgroundColor,textWidth:notice.firstElementChild?.getBoundingClientRect().width??0,stacked:(notice.querySelector('button')?.getBoundingClientRect().top??-1)>=(notice.firstElementChild?.getBoundingClientRect().bottom??1)-1}}");
      if(noticeContrast)assert(noticeContrast.ratio>=4.5&&noticeContrast.fontSize>=11.5&&noticeContrast.fits&&!noticeContrast.overflows,'readable error notice at '+name+': '+JSON.stringify(noticeContrast));
      if(noticeContrast&&name.includes('-375-'))assert(noticeContrast.textWidth>=260&&noticeContrast.stacked,'mobile error notice must show full-width readable message above recovery action: '+name+' '+JSON.stringify(noticeContrast));
    }
    const result=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    writeFileSync(`${evidenceDir}/${name}.png`,Buffer.from(result.data,'base64'));
  };
  const callMode=mode=>c.call("function(mode){globalThis.__myfinhubQaPersistenceMode(mode);return true}",[mode]);
  const mutate=()=>c.call("function(){const button=document.querySelector('[data-persistence-mutate]');button?.click();return Boolean(button)}");
  const release=()=>c.call("function(){return globalThis.__myfinhubQaReleaseSave?.()===true}");
  const phase=mode=>`function(){return document.querySelector('[data-save-progress="${mode}"]')!==null}`;
  const verifyTop=async()=>{const box=await c.call("function(){const node=document.querySelector('[data-save-progress]');if(!node)return null;const r=node.getBoundingClientRect();const progress=node.querySelector('[role=progressbar]');return {top:r.top,width:r.width,height:r.height,value:progress?.getAttribute('aria-valuenow'),role:progress?.getAttribute('role'),status:node.dataset.saveProgress,alert:node.getAttribute('role'),safe:getComputedStyle(node).pointerEvents==='none'}}");assert(Boolean(box&&box.top===0&&box.height>=3&&box.height<=6&&box.safe&&box.width>300&&box.role==='progressbar'),`fixed unobtrusive top line ${JSON.stringify(box)}`);return box};

  await viewport(375,812);await navigate();
  assert(await c.call("function(){return !document.querySelector('[data-save-progress]')&&!document.querySelector('.persistence-toast.saved')}",[]),'no false saved bar at initial load');
  await callMode('held');assert(await mutate(),'first synthetic finance write clicked');
  await waitFor(phase('saving'),'indeterminate pending bar');
  assert((await verifyTop()).value===null,'pending does not fabricate 100%');
  await shot('save-progress-pending-375-light');
  await sleep(620);
  assert(await c.call("function(){return document.querySelector('[data-save-progress=saving]')!==null&&(window.__myfinhubQaPersistencePutCount?.()||0)===1}"),'save remains pending without fake completion');
  assert(await release(),'release actual backend receipt');
  await waitFor(phase('success'),'receipt-confirmed success');
  assert((await verifyTop()).value==='100','100% only after committed response');
  await shot('save-progress-success-375-light');
  await waitFor("function(){return !document.querySelector('[data-save-progress]')}",'success acknowledgement clears only after receipt');

  // Rapid consecutive saves must not create a false green gap after the first receipt.
  await callMode('held');await c.call("function(){document.querySelector('[data-persistence-mutate]')?.click();document.querySelector('[data-persistence-mutate]')?.click();return true}");
  await waitFor(phase('saving'),'double queued save pending');
  await waitFor("function(){return (globalThis.__myfinhubQaPersistencePutCount?.()||0)===2}",'first queued HTTP PUT reaches held backend');
  assert(await release(),'release first of double queued save');
  await waitFor("function(){return (window.__myfinhubQaPersistencePutCount?.()||0)===3}",'second queued write begins after first');
  assert((await verifyTop()).value===null,'first receipt cannot complete while second pending');
  await shot('save-progress-consecutive-375-light');
  assert(await release(),'release second queued receipt');
  await waitFor(phase('success'),'both receipts confirmed');

  // Failure must be a persistent red line and retain a recovery action.
  await viewport(1440,900);await navigate();
  await c.call("async function(){localStorage.setItem('myfinhub.theme','dark');const mod=await import('/src/lib/theme.ts');mod.applyThemePreference('dark');return true}");
  await callMode('offline');assert(await mutate(),'offline write attempted');
  await waitFor(phase('error'),'real rejected write shows red');
  const error=await verifyTop();assert(error.alert==='alert'&&error.value===null,'failed write never becomes 100%');
  assert(await c.call("function(){return Boolean(document.querySelector('.persistence-notice.error button'))}"),'error retains recovery');
  await shot('save-progress-error-1440-dark');
  await sleep(500);
  assert(await c.call("function(){return document.querySelector('[data-save-progress=error]')!==null}"),'red error does not vanish on fake timer');

  // 409 revision conflict is also a failed save, never success.
  await navigate();await callMode('conflict');assert(await mutate(),'conflict write attempted');
  await waitFor(phase('error'),'revision conflict produces red');
  assert(await c.call("function(){return document.querySelector('[data-persistence-state=conflict]')!==null}"),'revision error is not successful');
  await shot('save-progress-conflict-1440-dark');

  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate();await callMode('held');assert(await mutate(),'reduced motion save attempted');
  await waitFor(phase('saving'),'reduced-motion pending');
  const motion=await c.call("function(){const node=document.querySelector('.save-progress-fill');return node?getComputedStyle(node).animationName:''}");
  assert(motion==='none','reduced motion disables animated fill');
  await shot('save-progress-pending-reduced-motion-1440-dark');
  assert(await release(),'reduced-motion receipt release');
  await waitFor(phase('success'),'reduced-motion backend-confirmed green');
  // Actual useFinance hook under a held old GET and subsequent successful,
  // QA-only import; the old server response must not replace newer state.
  await navigate();
  const initialBudget=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
  assert(await c.call("function(){return globalThis.__myfinhubQaHoldNextRead?.()===true}"),'schedule held old finance GET');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-reload]');b?.click();return Boolean(b)}"),'start reload before synthetic import');
  await waitFor("function(){return globalThis.__myfinhubQaHeldReadCount?.()===1}",'old GET remains held');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-import]');b?.click();return Boolean(b)}"),'synthetic import outruns held GET');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${initialBudget+13}}`,'synthetic imported finance budget applied');
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'synthetic import receipt confirmed');
  assert(await c.call("function(){return globalThis.__myfinhubQaReleaseRead?.()===true}"),'release stale GET');
  await sleep(180);
  const finalState=await c.call("function(){return {budget:Number(document.querySelector('[data-persistence-budget]')?.textContent||0),state:document.querySelector('[data-persistence-state]')?.textContent}}");
  assert(finalState.budget===initialBudget+13&&finalState.state==='saved',`old database GET cannot overwrite a newer successful import: ${JSON.stringify(finalState)}`);
  await shot('history-refresh-stale-read-after-import-1440-dark');
  // A request that began before an accepted import may also fail late; its
  // obsolete network error must not replace the newer database save receipt.
  await navigate();
  const beforeFailedRead=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
  assert(await c.call("function(){return globalThis.__myfinhubQaHoldNextRead?.()===true}"),'hold older GET that will reject');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-reload]');b?.click();return Boolean(b)}"),'start reload that later fails');
  await waitFor("function(){return globalThis.__myfinhubQaHeldReadCount?.()===1}",'failed GET remains pending');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-import]');b?.click();return Boolean(b)}"),'import while earlier GET pending');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${beforeFailedRead+13}}`,'new confirmed budget after pending GET');
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'new import save receipt confirmed before old GET rejects');
  assert(await c.call("function(){return globalThis.__myfinhubQaReleaseRead?.(true)===true}"),'reject now-stale GET');
  await sleep(180);
  const afterFailedRead=await c.call("function(){return {budget:Number(document.querySelector('[data-persistence-budget]')?.textContent||0),state:document.querySelector('[data-persistence-state]')?.textContent,failedBar:Boolean(document.querySelector('[data-save-progress=error]'))}}");
  assert(afterFailedRead.budget===beforeFailedRead+13&&afterFailedRead.state==='saved'&&!afterFailedRead.failedBar,`obsolete database GET error cannot replace a confirmed import: ${JSON.stringify(afterFailedRead)}`);
  await shot('history-refresh-stale-error-after-import-1440-dark');

  // Synthetic DB receipts run the production useFinance hook through Do / Undo /
  // Redo / Undo / divergent Do and one rejected history move. No live services.
  const historyHookUrl=new URL(url.href);
  historyHookUrl.searchParams.set('history-test','1');
  await c.send('Page.navigate',{url:historyHookUrl.href});
  await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'real-hook history initialized');
  const hookBudget=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
  const hookState=()=>c.call("function(){return {budget:Number(document.querySelector('[data-persistence-budget]')?.textContent||0),undo:Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0),redo:Number(document.querySelector('[data-persistence-redo-depth]')?.textContent||0),state:document.querySelector('[data-persistence-state]')?.textContent}}");
  let hook=await hookState();
  assert(hook.undo===0&&hook.redo===0,'initial history cannot undo');
  assert(await mutate(),'save first reversible synthetic change');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${hookBudget+1}&&Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0)===1&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'confirmed mutation enables Undo');
  const press=selector=>c.call("function(selector){const b=document.querySelector(selector);if(!b||b.disabled)return false;b.click();return true}",[selector]);
  assert(await press('[data-persistence-undo]'),'Undo uses actual hook');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${hookBudget}&&Number(document.querySelector('[data-persistence-redo-depth]')?.textContent||0)===1&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'server-backed Undo restores prior synthetic budget');
  assert(await press('[data-persistence-redo]'),'Redo uses actual hook');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${hookBudget+1}&&Number(document.querySelector('[data-persistence-redo-depth]')?.textContent||0)===0&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'server-backed Redo restores confirmed budget');
  assert(await press('[data-persistence-undo]'),'Undo creates new redo candidate');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${hookBudget}&&Number(document.querySelector('[data-persistence-redo-depth]')?.textContent||0)===1&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'redo candidate after Undo');
  assert(await mutate(),'divergent save after Undo');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${hookBudget+1}&&Number(document.querySelector('[data-persistence-redo-depth]')?.textContent||0)===0&&Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0)===1&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'new confirmed write invalidates old Redo branch');
  assert(await c.call("function(){const b=document.querySelector('[data-persistence-redo]');return Boolean(b&&b.disabled&&globalThis.__myfinhubQaHistoryMoveCount?.()===3)}"),'server received three history moves and Redo is disabled');
  await shot('history-real-hook-undo-redo-branch-1440-dark');

  assert(await c.call("function(){return globalThis.__myfinhubQaRejectNextHistoryMove?.()===true}"),'reject next synthetic history move');
  assert(await press('[data-persistence-undo]'),'attempt synthetic rejected Undo');
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='conflict'}",'rejected history cursor enters conflict');
  hook=await hookState();
  assert(hook.budget===hookBudget+1&&hook.undo===1&&hook.redo===0,'rejected Undo preserves confirmed finance state and cursor');
  assert(await c.call("function(){return Boolean(document.querySelector('[data-save-progress=error]'))&&document.querySelector('[data-persistence-undo]')?.disabled===true}"),'rejected Undo shows red failure and disables history');
  await shot('history-real-hook-undo-conflict-1440-dark');

  // Real useFinance + intercepted API: direct multi-step jump must send one
  // revision/generation-protected server move per edge, never fake a shortcut.
  await c.send('Page.navigate',{url:historyHookUrl.href});
  await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'multi-step hook probe initialized');
  const beforeJump=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
  for(let step=1;step<=3;step++){
    assert(await press('[data-persistence-mutate]'),'create navigation history point '+step);
    await waitFor(`function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'&&Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0)===${step}}`,'persisted navigation point '+step);
  }
  assert(await press('[data-persistence-jump-first]'),'request 3-step navigation to earliest point');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${beforeJump}&&Number(document.querySelector('[data-persistence-redo-depth]')?.textContent||0)===3&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'three server-authoritative Undo receipts reached selected target');
  assert(await c.call("function(){return globalThis.__myfinhubQaHistoryMoveCount?.()===3}"),'direct jump used 3 exact SQL-style cursor moves');
  await shot('history-real-hook-jump-three-back-1440-dark');
  assert(await press('[data-persistence-jump-last]'),'request 3-step return to latest point');
  await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${beforeJump+3}&&Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0)===3&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'three server-authoritative Redo receipts reached latest target');
  assert(await c.call("function(){return globalThis.__myfinhubQaHistoryMoveCount?.()===6}"),'direct return used 6 total protected moves');
  await shot('history-real-hook-jump-three-forward-1440-dark');

  // A conflict in step 2 after step 1 committed must fail closed at the
  // actually confirmed intermediate cursor, with the top-edge error bar red.
  await c.send('Page.navigate',{url:historyHookUrl.href});
  await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'partial-jump probe initialized');
  const partialBase=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
  for(let step=1;step<=3;step++){
    assert(await press('[data-persistence-mutate]'),'create partial-jump point '+step);
    await waitFor(`function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'&&Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0)===${step}}`,'confirmed partial-jump point '+step);
  }
  assert(await c.call("function(){return globalThis.__myfinhubQaRejectHistoryAfterSteps?.(2)===true}"),'arm conflict on second server cursor move');
  assert(await press('[data-persistence-jump-first]'),'start multi-step jump with synthetic second-step conflict');
  await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='conflict'}",'partial navigation enters conflict, not success');
  const partial=await hookState();
  assert(partial.budget===partialBase+2&&partial.undo===2&&partial.redo===1&&await c.call("function(){return globalThis.__myfinhubQaHistoryMoveCount?.()===2&&Boolean(document.querySelector('[data-save-progress=error]'))}"),`failed second step retains exact first confirmed move and red bar: ${JSON.stringify(partial)}`);
  await shot('history-real-hook-jump-partial-conflict-1440-dark');

  // Rejected before commit (409 or 503) is distinct from a committed import
  // whose separate history read failed. Use the production finance hook and
  // assert that no synthetic database mutation or replay has taken place.
  for(const preCommitFailure of ['conflict','unavailable']){
    await c.send('Page.navigate',{url:historyHookUrl.href});
    await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'pre-commit import rejection probe initialized');
    const untouchedBudget=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
    assert(await press('[data-persistence-mutate]'),'establish confirmed finance/history before rejected import');
    await waitFor(`function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===${untouchedBudget+1}&&Number(document.querySelector('[data-persistence-undo-depth]')?.textContent||0)===1&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}`,'pre-import acknowledged finance baseline');
    assert(await c.call("function(mode){return globalThis.__myfinhubQaRejectNextImport?.(mode)===true}",[preCommitFailure]),'arm isolated pre-commit import '+preCommitFailure);
    assert(await press('[data-persistence-import]'),'attempt rejected import with actual useFinance hook');
    const expectedState=preCommitFailure==='conflict'?'conflict':'error';
    await waitFor("function(state){return document.querySelector('[data-persistence-import-outcome]')?.textContent==='error'&&document.querySelector('[data-persistence-state]')?.textContent===state}",'rejected import never reports a confirmed receipt',[expectedState]);
    const rejected=await c.call("function(){return {budget:Number(document.querySelector('[data-persistence-budget]')?.textContent||0),state:document.querySelector('[data-persistence-state]')?.textContent,outcome:document.querySelector('[data-persistence-import-outcome]')?.textContent,attempts:globalThis.__myfinhubQaImportAttemptCount?.(),commits:globalThis.__myfinhubQaImportCommitCount?.(),undoDisabled:document.querySelector('[data-persistence-undo]')?.disabled,redoDisabled:document.querySelector('[data-persistence-redo]')?.disabled,progress:document.querySelector('[data-save-progress]')?.getAttribute('data-save-progress')}}");
    assert(rejected.budget===untouchedBudget+1&&rejected.state===expectedState&&rejected.outcome==='error'&&rejected.attempts===1&&rejected.commits===0&&rejected.undoDisabled&&rejected.redoDisabled&&rejected.progress==='error','pre-commit rejection preserves exact confirmed finance without false success, duplicate import or stale Undo: '+JSON.stringify(rejected));
    await shot('history-rejected-import-'+preCommitFailure+'-1440-dark');
    await viewport(375,812);
    await shot('history-rejected-import-'+preCommitFailure+'-375-dark');
    await viewport(1440,900);
    assert(await press('[data-persistence-reload]'),'read-only reload after rejected import');
    await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'rejected import recovery by read-only reload');
    assert(await c.call("function(expected){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===expected&&globalThis.__myfinhubQaImportCommitCount?.()===0&&globalThis.__myfinhubQaImportAttemptCount?.()===1}",[untouchedBudget+1]),'read-only recovery preserves prior finance and never replays rejected import');
  }

  // The real finance hook accepts the import before its separate history GET.
  // Neither an HTTP error nor a mismatched history revision may show green
  // success or permit stale Undo/Redo; recovery must not repeat the import.
  for(const historyFailure of ['read-failure','revision-mismatch']){
    await c.send('Page.navigate',{url:historyHookUrl.href});
    await waitFor("function(){return document.querySelector('[data-persistence-probe=ready]')!==null&&document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'import history negative probe initialized');
    const beforeImport=await c.call("function(){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)}");
    const armed=await c.call("function(mode){return globalThis.__myfinhubQaImportHistoryCase?.(mode)===true}",[historyFailure]);
    assert(armed,'synthetic post-commit history '+historyFailure+' armed');
    assert(await press('[data-persistence-import]'),'committed synthetic import started');
    await waitFor("function(){return document.querySelector('[data-persistence-import-outcome]')?.textContent==='committed-history-unverified'&&document.querySelector('[data-persistence-state]')?.textContent==='conflict'}",'committed import reports unverified history rather than full success');
    const outcome=await c.call("function(){return {budget:Number(document.querySelector('[data-persistence-budget]')?.textContent||0),outcome:document.querySelector('[data-persistence-import-outcome]')?.textContent,state:document.querySelector('[data-persistence-state]')?.textContent,notice:document.querySelector('.persistence-notice.conflict')?.textContent||'',undoDisabled:document.querySelector('[data-persistence-undo]')?.disabled,redoDisabled:document.querySelector('[data-persistence-redo]')?.disabled,progress:document.querySelector('[data-save-progress]')?.getAttribute('data-save-progress')}}");
    assert(outcome.budget===beforeImport+13&&outcome.outcome==='committed-history-unverified'&&outcome.state==='conflict'&&outcome.notice.includes('Η εισαγωγή επιβεβαιώθηκε')&&outcome.notice.includes('Μην επαναλάβεις την εισαγωγή')&&outcome.undoDisabled&&outcome.redoDisabled&&outcome.progress==='error','committed import keeps finance revision, blocks stale history and displays truthful recovery: '+JSON.stringify(outcome));
    await shot('history-committed-import-'+historyFailure+'-1440-dark');
    assert(await press('[data-persistence-reload]'),'reload accepted imported finance after unverified history');
    await waitFor("function(){return document.querySelector('[data-persistence-state]')?.textContent==='saved'}",'read-only reload recovered imported finance and history');
    assert(await c.call("function(expected){return Number(document.querySelector('[data-persistence-budget]')?.textContent||0)===expected}",[beforeImport+13]),'recovery preserves acknowledged import without reposting finance');
  }

  c.close();
  console.log('Save-progress QA passed: pending remains active, receipt only green, persistent red failure/conflict, FIFO burst, viewport/theme/reduced-motion evidence');
}catch(error){console.error(error);process.exitCode=1}
finally{child.kill('SIGTERM')}
