import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot=process.cwd();
const versionMarker=resolve(repositoryRoot,'visual-qa/current-version.txt');
const appVersion=(process.env.MYFINHUB_QA_APP_VERSION||(existsSync(versionMarker)?readFileSync(versionMarker,'utf8').trim():'v1.3')).trim();
if(!/^v\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?$/.test(appVersion))throw new Error(`Invalid visual QA app version: ${appVersion}`);
const timeZone=process.env.MYFINHUB_QA_TIME_ZONE||'Europe/Athens';
const generatedDate=new Date();
const timestampParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(generatedDate).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
const timestamp=`${timestampParts.year}-${timestampParts.month}-${timestampParts.day}_${timestampParts.hour}${timestampParts.minute}${timestampParts.second}`;
const gitValue=(...args)=>{try{return execFileSync('git',args,{encoding:'utf8'}).trim()}catch{return ''}};
const sourceSha=(process.env.GITHUB_SHA||gitValue('rev-parse','HEAD')||'local').trim();
const shortSha=sourceSha==='local'?'local':sourceSha.slice(0,8);
const sourceBranch=(process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||gitValue('rev-parse','--abbrev-ref','HEAD')||'local').trim();
const evidenceRoot=resolve(repositoryRoot,process.env.MYFINHUB_UX_EVIDENCE_ROOT||'visual-qa');
const versionDir=resolve(evidenceRoot,appVersion);
const runId=`${timestamp}__${shortSha}`;
const runDir=resolve(versionDir,'runs',runId);
const latestDir=resolve(versionDir,'latest');
rmSync(latestDir,{recursive:true,force:true});
mkdirSync(runDir,{recursive:true});
mkdirSync(latestDir,{recursive:true});

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for visual evidence QA.');
const port=9231;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/myfinhub-ui-visual-evidence-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(functionDeclaration,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const pages={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',review:'Έλεγχος παλιών κινήσεων',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',reports:'Αναφορές',settings:'Ρυθμίσεις'};
const viewports=[{mode:'desktop',width:1440,height:1000},{mode:'mobile',width:375,height:812}];
const screenshots=[];
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const navigate=async(page,heading)=>{const url=new URL(baseUrl);url.searchParams.set('page',page);await c.send('Page.navigate',{url:url.href});for(let i=0;i<100;i++){if(await c.call("function(text){return document.readyState==='complete'&&(document.querySelector('#main-workspace h1')?.textContent||'').includes(text)}",[heading]))break;if(i===99)throw new Error(`Timed out waiting for visual route ${page}`);await sleep(100)}await sleep(120)};
  const fullPage=async(page,mode,width,height)=>{const metrics=await c.send('Page.getLayoutMetrics');const size=metrics.cssContentSize||metrics.contentSize;const captureWidth=Math.max(1,Math.ceil(size.width));const captureHeight=Math.max(1,Math.min(16000,Math.ceil(size.height)));const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:captureWidth,height:captureHeight,scale:1}});const fileName=`${appVersion}__${timestamp}__${page}__${mode}-${width}x${height}__NEW.png`;const bytes=Buffer.from(shot.data,'base64');writeFileSync(resolve(runDir,fileName),bytes);writeFileSync(resolve(latestDir,fileName),bytes);screenshots.push({file:fileName,page,state:'NEW',viewport:{mode,width,height},capture:{width:captureWidth,height:captureHeight}})};
  for(const item of viewports){await viewport(item.width,item.height);for(const [page,heading] of Object.entries(pages)){await navigate(page,heading);await fullPage(page,item.mode,item.width,item.height)}}
  c.close();
  const manifest={schemaVersion:1,appVersion,runId,generatedAt:generatedDate.toISOString(),timeZone,source:{sha:sourceSha,shortSha,branch:sourceBranch},baseUrl,latestDirectory:`visual-qa/${appVersion}/latest`,runDirectory:`visual-qa/${appVersion}/runs/${runId}`,screenshots};
  const manifestText=`${JSON.stringify(manifest,null,2)}\n`;
  writeFileSync(resolve(runDir,'manifest.json'),manifestText);
  writeFileSync(resolve(latestDir,'manifest.json'),manifestText);
  console.log(`Full-page visual evidence QA passed: ${appVersion} ${runId} (${screenshots.length} screenshots).`);
}finally{child.kill('SIGTERM')}
