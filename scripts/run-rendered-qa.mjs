import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { persistSuiteEvidence, prepareSuiteEvidence, visualEvidenceContext } from './visual-evidence-store.mjs';

const scripts=[
  {path:'scripts/local-server-routing-qa.mjs',key:'server-routing',surface:'routing',profiles:[],persist:false},
  {path:'scripts/frontend-qa.mjs',key:'frontend',surface:'core-flows',profiles:['/tmp/rheomiq-qa-chrome'],extraEvidenceDirs:['/tmp/rheomiq-frontend-qa']},
  {path:'scripts/completion-geometry-qa.mjs',key:'completion-geometry',surface:'all-pages',profiles:['/tmp/myfinhub-geometry-overflow-qa-chrome']},
  {path:'scripts/completion-dialog-geometry-qa.mjs',key:'completion-dialog-geometry',surface:'interaction-dialogs',profiles:['/tmp/myfinhub-dialog-geometry-qa-chrome']},
  {path:'scripts/completion-functional-crud-qa.mjs',key:'completion-functional',surface:'functional-flows',profiles:['/tmp/myfinhub-completion-functional-qa-chrome']},
  {path:'scripts/card-vault-runtime-qa.mjs',key:'card-vault-runtime',surface:'card-vault',profiles:['/tmp/myfinhub-card-vault-runtime-qa-chrome']},
  {path:'scripts/mutation-validation-qa.mjs',key:'mutation-validation',surface:'validation-errors',profiles:['/tmp/myfinhub-mutation-validation-qa-chrome']},
  {path:'scripts/owned-controls-qa.mjs',key:'owned-controls',surface:'controls',profiles:['/tmp/rheomiq-owned-controls-qa']},
  {path:'scripts/quick-entry-reference-qa.mjs',key:'quick-entry-reference',surface:'quick-entry',profiles:['/tmp/myfinhub-quick-entry-reference-qa-chrome']},
  {path:'scripts/ui-ux-hardening-qa.mjs',key:'ui-hardening',surface:'app-shell',profiles:['/tmp/myfinhub-ui-ux-qa-chrome']},
  {path:'scripts/ui-ux-completion-qa.mjs',key:'ui-completion',surface:'app-shell',profiles:['/tmp/myfinhub-ui-completion-qa-chrome']},
  {path:'scripts/ui-ux-runtime-qa.mjs',key:'ui-runtime',surface:'runtime',profiles:['/tmp/myfinhub-ui-runtime-qa-chrome']},
  {path:'scripts/ui-ux-credit-overlimit-qa.mjs',key:'credit-overlimit',surface:'credit',profiles:['/tmp/myfinhub-credit-overlimit-qa-chrome']},
  {path:'scripts/cards-remediation-qa.mjs',key:'cards-remediation',surface:'cards',profiles:['/tmp/myfinhub-cards-remediation-qa-chrome']},
  {path:'scripts/credit-stack-remediation-qa.mjs',key:'credit-stack-remediation',surface:'credit',profiles:['/tmp/myfinhub-credit-stack-remediation-qa-chrome']},
  {path:'scripts/loans-remediation-qa.mjs',key:'loans-remediation',surface:'loans',profiles:['/tmp/myfinhub-loans-remediation-qa-chrome']},
  {path:'scripts/lending-remediation-qa.mjs',key:'lending-remediation',surface:'lending',profiles:['/tmp/myfinhub-lending-remediation-qa-chrome']},
  {path:'scripts/recurring-remediation-qa.mjs',key:'recurring-remediation',surface:'recurring',profiles:['/tmp/myfinhub-recurring-remediation-qa-chrome']},
  {path:'scripts/recurring-service-brand-qa.mjs',key:'recurring-service-brand',surface:'recurring-branding',profiles:['/tmp/myfinhub-recurring-service-brand-qa-chrome']},
  {path:'scripts/credit-statements-qa.mjs',key:'credit-statements',surface:'credit',profiles:['/tmp/myfinhub-credit-statements-qa-chrome']},
  {path:'scripts/refresh-route-qa.mjs',key:'refresh-route',surface:'navigation',profiles:['/tmp/myfinhub-refresh-route-qa-chrome']},
  {path:'scripts/recovered-surface-qa.mjs',key:'recovered-surface',surface:'recovery',profiles:['/tmp/myfinhub-recovered-surface-qa-chrome']},
  {path:'scripts/session-runtime-qa.mjs',key:'session-runtime',surface:'auth-session',profiles:['/tmp/myfinhub-session-runtime-qa-chrome']},
  {path:'scripts/reports-visual-qa.mjs',key:'reports-visual',surface:'reports',profiles:['/tmp/myfinhub-reports-visual-qa-chrome']},
  {path:'scripts/brand-visual-qa.mjs',key:'brand-visual',surface:'branding',profiles:['/tmp/myfinhub-brand-visual-qa-chrome']},
  {path:'scripts/theme-system-qa.mjs',key:'theme-system',surface:'theme',profiles:['/tmp/myfinhub-theme-system-qa-chrome']},
  {path:'scripts/desktop-titlebar-qa.mjs',key:'desktop-titlebar',surface:'desktop-titlebar',profiles:['/tmp/myfinhub-desktop-titlebar-qa-chrome']},
  {path:'scripts/desktop-host-visual-qa.mjs',key:'desktop-host-visual',surface:'desktop-host',profiles:['/tmp/myfinhub-desktop-host-visual-qa-chrome']},
  {path:'scripts/planning-forecast-qa.mjs',key:'planning-forecast',surface:'planning',profiles:['/tmp/myfinhub-planning-forecast-qa-chrome']},
  {path:'scripts/savings-remediation-qa.mjs',key:'savings-remediation',surface:'savings',profiles:['/tmp/myfinhub-savings-remediation-qa-chrome']},
  {path:'scripts/action-center-context-qa.mjs',key:'action-center',surface:'action-center',profiles:['/tmp/myfinhub-action-center-context-qa-chrome']},
  {path:'scripts/budget-rules-qa.mjs',key:'budget-rules',surface:'budgets',profiles:['/tmp/myfinhub-budget-rules-qa-chrome']},
  {path:'scripts/settings-tabs-qa.mjs',key:'settings-tabs',surface:'settings',profiles:['/tmp/myfinhub-settings-tabs-qa-chrome']},
  {path:'scripts/provider-brand-management-qa.mjs',key:'provider-brand-management',surface:'settings-provider-branding',profiles:['/tmp/myfinhub-provider-brand-management-qa-chrome']},
  {path:'scripts/settings-rules-modal-qa.mjs',key:'settings-rules-modal',surface:'settings',profiles:['/tmp/myfinhub-settings-rules-modal-qa-chrome']},
  {path:'scripts/command-palette-qa.mjs',key:'command-palette',surface:'command-palette',profiles:['/tmp/myfinhub-command-palette-qa-chrome']},
  {path:'scripts/payment-flow-normalization-qa.mjs',key:'payment-flow',surface:'payments',profiles:['/tmp/myfinhub-payment-flow-qa-chrome']},
  {path:'scripts/primitives-adoption-qa.mjs',key:'primitives-adoption',surface:'controls',profiles:['/tmp/myfinhub-primitives-adoption-qa-chrome']},
  {path:'scripts/ui-ux-visual-evidence-qa.mjs',key:'full-page',surface:'pages',profiles:['/tmp/myfinhub-ui-visual-evidence-chrome'],persist:false},
  {path:'scripts/shell-dashboard-hierarchy-qa.mjs',key:'shell-dashboard-hierarchy',surface:'dashboard',profiles:['/tmp/myfinhub-shell-dashboard-hierarchy-chrome']},
  {path:'scripts/taxonomy-management-qa.mjs',key:'taxonomy-management',surface:'taxonomy',profiles:['/tmp/myfinhub-taxonomy-management-qa-chrome']},
  {path:'scripts/account-metadata-qa.mjs',key:'account-metadata',surface:'accounts',profiles:['/tmp/myfinhub-account-metadata-qa-chrome']},
  {path:'scripts/category-icon-adoption-qa.mjs',key:'category-icons',surface:'categories',profiles:['/tmp/myfinhub-category-icon-adoption-qa-chrome']},
  {path:'scripts/icon-packs-qa.mjs',key:'icon-packs',surface:'icons',profiles:['/tmp/myfinhub-icon-packs-qa-chrome']},
  {path:'scripts/legacy-transaction-management-qa.mjs',key:'legacy-transactions',surface:'transactions',profiles:['/tmp/myfinhub-legacy-transaction-management-qa-chrome']},
  {path:'scripts/transactions-scanability-qa.mjs',key:'transactions-scanability',surface:'transactions',profiles:['/tmp/myfinhub-transactions-scanability-qa-chrome']},
  {path:'scripts/obligation-lifecycle-qa.mjs',key:'obligation-lifecycle',surface:'obligations',profiles:['/tmp/myfinhub-obligation-lifecycle-qa-chrome']},
  {path:'scripts/recurring-cadence-qa.mjs',key:'recurring-cadence',surface:'recurring',profiles:['/tmp/myfinhub-recurring-cadence-qa-chrome']},
  {path:'scripts/receipt-local-ocr-qa.mjs',key:'receipt-local-ocr',surface:'receipts',profiles:['/tmp/myfinhub-receipt-local-ocr-qa-chrome']},
  {path:'scripts/ledger-foundations-qa.mjs',key:'ledger-foundations',surface:'ledger',profiles:['/tmp/myfinhub-ledger-foundations-qa-chrome']},
  {path:'scripts/large-data-boundaries-qa.mjs',key:'large-data-boundaries',surface:'large-data',profiles:['/tmp/myfinhub-large-data-boundaries-qa-chrome']},
  {path:'scripts/keyboard-semantic-accessibility-qa.mjs',key:'keyboard-semantic-a11y',surface:'accessibility',profiles:['/tmp/myfinhub-keyboard-semantic-a11y-chrome']},
  {path:'scripts/not-found-accessibility-qa.mjs',key:'not-found-accessibility',surface:'not-found',profiles:['/tmp/myfinhub-not-found-accessibility-qa-chrome']},
];
function validateRenderedQaModules(){
  for(const item of scripts){
    try{execFileSync(process.execPath,['--check',item.path],{encoding:'utf8',stdio:['ignore','pipe','pipe']})}
    catch(error){
      const stdout=error?.stdout?.toString?.()||'';
      const stderr=error?.stderr?.toString?.()||'';
      const detail=stderr||stdout||(error instanceof Error?error.message:String(error));
      throw new Error(`Rendered QA module syntax check failed: ${item.path}\n${detail}`);
    }
  }
  console.log(`Rendered QA module syntax preflight passed for ${scripts.length} scripts.`);
}
validateRenderedQaModules();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function cleanPaths(paths){for(const path of paths){try{rmSync(path,{recursive:true,force:true,maxRetries:8,retryDelay:150})}catch(error){console.warn(`Rendered QA cleanup skipped for ${path}: ${error instanceof Error?error.message:String(error)}`)}}}
function trimDiagnostics(text){const normalized=text.trim();if(!normalized)return '(no browser stderr/stdout captured)';return normalized.length>6000?normalized.slice(-6000):normalized}
function resolvePrimaryBrowser(){if(process.env.MYFINHUB_QA_PRIMARY_BROWSER)return process.env.MYFINHUB_QA_PRIMARY_BROWSER;try{return execFileSync('bash',['-lc','command -v chromium || command -v chromium-browser || command -v google-chrome'],{encoding:'utf8'}).trim()}catch{return ''}}
async function stopBrowser(child){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve()},2000);child.once('exit',()=>{clearTimeout(timer);resolve()});child.kill('SIGTERM')})}
async function preflightBrowser(browser,attempt){
  const profile=`/tmp/myfinhub-primary-browser-preflight-${process.pid}`;
  const port=9300+attempt;
  cleanPaths([profile]);
  let diagnostics='',spawnError='';
  const child=spawn(browser,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','pipe','pipe']});
  const capture=stream=>stream?.on('data',chunk=>{diagnostics+=chunk.toString();if(diagnostics.length>12000)diagnostics=diagnostics.slice(-12000)});
  capture(child.stdout);capture(child.stderr);child.on('error',error=>{spawnError=error.stack||error.message});
  try{
    for(let index=0;index<100;index+=1){
      if(spawnError)throw new Error(`Primary browser spawn failed: ${spawnError}`);
      if(child.exitCode!==null)throw new Error(`Primary browser exited before CDP became ready (exit ${child.exitCode}).\n${trimDiagnostics(diagnostics)}`);
      try{
        const response=await fetch(`http://127.0.0.1:${port}/json/version`);
        if(response.ok){const version=await response.json();console.log(`Primary Chromium preflight passed on attempt ${attempt} via fixed CDP port ${port}: ${version.Browser||'browser ready'}`);return}
      }catch{}
      await sleep(200);
    }
    throw new Error(`Primary browser did not expose fixed CDP endpoint ${port} within 20s.\n${trimDiagnostics(diagnostics)}`);
  }finally{await stopBrowser(child);await sleep(250);cleanPaths([profile])}
}
function runScript(path,useFallback,evidenceDir){return new Promise(resolve=>{let output='';const env={...process.env,MYFINHUB_QA_USE_FALLBACK:useFallback?'1':'0',MYFINHUB_UX_EVIDENCE_DIR:evidenceDir};const child=spawn(process.execPath,['scripts/qa-script-runner.mjs',path],{env,stdio:['ignore','pipe','pipe']});const forward=(stream,target)=>stream.on('data',chunk=>{const text=chunk.toString();output+=text;target.write(text)});forward(child.stdout,process.stdout);forward(child.stderr,process.stderr);child.on('error',error=>resolve({code:1,output:`${output}\n${error.stack||error.message}`}));child.on('close',code=>resolve({code:code??1,output}))})}
function isBrowserBootstrapFailure(output){return /Timed out waiting for http:\/\/127\.0\.0\.1:9\d{3}\/json\/version/.test(output)||/Chrome\/Chromium is required/.test(output)||/ECONNREFUSED.*9\d{3}/i.test(output)}
const primaryBrowser=resolvePrimaryBrowser();const fallbackBrowser=process.env.MYFINHUB_QA_FALLBACK_BROWSER||'';const hasDistinctFallback=Boolean(fallbackBrowser&&fallbackBrowser!==primaryBrowser);const requirePrimary=process.env.MYFINHUB_QA_REQUIRE_PRIMARY==='1';if(!primaryBrowser)throw new Error('Chrome/Chromium is required for rendered frontend QA.');
let preflightError=null;for(let attempt=1;attempt<=2;attempt+=1){try{await preflightBrowser(primaryBrowser,attempt);preflightError=null;break}catch(error){preflightError=error;console.warn(`Primary Chromium preflight attempt ${attempt} failed: ${error instanceof Error?error.message:String(error)}`);if(attempt<2)await sleep(750)}}if(preflightError)throw preflightError;
const evidenceContext=visualEvidenceContext();let primaryBootstrapRetries=0,fallbackActivations=0,persistedScreenshots=0;
const parallelism=Math.max(1,Math.min(4,Number(process.env.MYFINHUB_QA_PARALLELISM||3)||3));
const activePorts=new Set();
function scriptPort(path){try{const source=readFileSync(path,'utf8');const match=source.match(/\\bport\\s*=\\s*(\\d+)/);return match?Number(match[1]):null}catch{return null}}
async function acquirePort(port){if(!port)return;while(activePorts.has(port))await sleep(100);activePorts.add(port)}
function releasePort(port){if(port)activePorts.delete(port)}
async function runRenderedItem(item){
  const port=scriptPort(item.path);await acquirePort(port);
  try{
    cleanPaths(item.profiles);const evidenceDir=prepareSuiteEvidence(item.key);cleanPaths(item.extraEvidenceDirs||[]);
    let result=await runScript(item.path,false,evidenceDir);
    if(result.code!==0&&isBrowserBootstrapFailure(result.output)){primaryBootstrapRetries+=1;console.warn(`Rendered QA browser bootstrap failed for ${item.path}; cleaning the isolated profile and retrying once with primary Chromium.`);await sleep(750);cleanPaths(item.profiles);result=await runScript(item.path,false,evidenceDir)}
    if(result.code!==0&&isBrowserBootstrapFailure(result.output)&&!requirePrimary&&hasDistinctFallback){fallbackActivations+=1;console.warn(`FALLBACK ACTIVATED for ${item.path}: primary Chromium failed twice to expose CDP; retrying once with ${fallbackBrowser}.`);await sleep(750);cleanPaths(item.profiles);result=await runScript(item.path,true,evidenceDir)}
    await sleep(350);cleanPaths(item.profiles);if(result.code!==0)throw new Error(`Rendered QA suite failed: ${item.path} (exit ${result.code})`);
    if(item.persist!==false)persistedScreenshots+=persistSuiteEvidence({key:item.key,surface:item.surface,evidenceDirs:[evidenceDir,...(item.extraEvidenceDirs||[])],context:evidenceContext});
  }finally{releasePort(port)}
}
let cursor=0;
async function worker(){while(true){const index=cursor++;if(index>=scripts.length)return;await runRenderedItem(scripts[index])}}
await Promise.all(Array.from({length:Math.min(parallelism,scripts.length)},()=>worker()));
if(requirePrimary&&fallbackActivations!==0)throw new Error(`Primary-browser enforcement violated: ${fallbackActivations} fallback activation(s).`);console.log(`All rendered browser QA suites passed on primary Chromium with parallelism ${parallelism}. Primary bootstrap retries: ${primaryBootstrapRetries}; fallback activations: ${fallbackActivations}; persisted latest focused screenshots: ${persistedScreenshots}.`);