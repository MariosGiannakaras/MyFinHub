import { execFileSync, spawn } from 'node:child_process';

const baseUrl=process.env.MYFINHUB_PERF_URL||'http://127.0.0.1:4173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for loading-shift audit.');
const port=9334;
const profile='/tmp/myfinhub-loading-shift-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Loading-shift assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}?page=dashboard&motion=reduced`)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();
  try{
    await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__MYFINHUB_CLS=0;new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(!entry.hadRecentInput)globalThis.__MYFINHUB_CLS+=entry.value}}).observe({type:'layout-shift',buffered:true});`});
    await c.send('Page.navigate',{url:`${baseUrl}?page=dashboard&motion=reduced`});
    for(let i=0;i<100;i++){if(await c.eval("document.querySelector('#main-workspace h1')?.textContent.includes('Οι λογαριασμοί μου')"))break;if(i===99)throw new Error('Dashboard did not become ready');await sleep(100)}
    await sleep(250);
    await c.eval('globalThis.__MYFINHUB_CLS=0');
    const started=await c.eval(`(()=>{const button=document.querySelector('.top-actions button[aria-label="Ανανέωση δεδομένων"]');if(!button)return false;button.click();return true})()`);
    assert(started,'refresh control is available');
    let sawSkeleton=false;
    for(let i=0;i<50;i++){if(await c.eval("Boolean(document.querySelector('.qa-loading-route'))")){sawSkeleton=true;break}await sleep(20)}
    assert(sawSkeleton,'refresh renders the route skeleton');
    for(let i=0;i<80;i++){if(!(await c.eval("Boolean(document.querySelector('.qa-loading-route'))")))break;if(i===79)throw new Error('Loading skeleton did not resolve');await sleep(25)}
    await sleep(150);
    const cls=await c.eval('globalThis.__MYFINHUB_CLS||0');
    const overflow=await c.eval('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth');
    console.log(`Skeleton → content CLS ${Number(cls).toFixed(3)} · horizontal overflow ${Math.round(overflow)}px`);
    assert(Number(cls)<=0.10,`skeleton/content CLS ${Number(cls).toFixed(3)} > 0.10`);
    assert(overflow<=1,`post-loading horizontal overflow ${overflow}px`);
    console.log('Skeleton/loading layout-shift audit passed.');
  }finally{c.close()}
}finally{
  child.kill('SIGTERM');
}
