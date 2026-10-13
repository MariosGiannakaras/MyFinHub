import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
const evidenceDir=process.env.MYFINHUB_UX_EVIDENCE_DIR||'/tmp/myfinhub-content-entrance-evidence';
mkdirSync(evidenceDir,{recursive:true});

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];
const viewports=[{name:'desktop',width:1280,height:900,mobile:false},{name:'mobile',width:375,height:812,mobile:true}];
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for loading-shift audit.');
const port=9384;
const profile='/tmp/myfinhub-content-entrance-qa-chrome';
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<80;i++){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Content-motion assertion failed: ${message}`)};
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();
  try{
    await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__MYFINHUB_CLS=0;new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(!entry.hadRecentInput)globalThis.__MYFINHUB_CLS+=entry.value}}).observe({type:'layout-shift',buffered:true});`});
    for(const viewport of viewports){
      await c.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
      for(const page of pages){
        const qaUrl=`${baseUrl}?page=${page}`;
        await c.send('Page.navigate',{url:qaUrl});
        for(let i=0;i<100;i++){if(await c.eval("Boolean(document.querySelector('#main-workspace h1'))"))break;if(i===99)throw new Error(`${page} did not become ready`);await sleep(60)}
        await sleep(80);
        await c.eval('globalThis.__MYFINHUB_CLS=0');
        const started=await c.eval(`(()=>{const button=document.querySelector('.top-actions button[aria-label="Ανανέωση δεδομένων"]');if(!button)return false;button.click();return true})()`);
        assert(started,`${viewport.name}/${page}: refresh control is available`);
        let sawSkeleton=false;
        for(let i=0;i<60;i++){if(await c.eval("Boolean(document.querySelector('.qa-loading-route .page-skeleton'))")){sawSkeleton=true;break}await sleep(15)}
        assert(sawSkeleton,`${viewport.name}/${page}: refresh renders the route skeleton`);
        const skeletonPage=await c.eval("document.querySelector('.qa-loading-route .page-skeleton')?.dataset.skeletonPage||''");
        assert(skeletonPage===page,`${viewport.name}/${page}: skeleton route was ${skeletonPage}`);
        const loadingOverflow=await c.eval('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth');
        assert(loadingOverflow<=1,`${viewport.name}/${page}: skeleton horizontal overflow ${loadingOverflow}px`);
        for(let i=0;i<80;i++){if(!(await c.eval("Boolean(document.querySelector('.qa-loading-route'))")))break;if(i===79)throw new Error(`${viewport.name}/${page}: loading skeleton did not resolve`);await sleep(20)}
        // Capture deterministic motion phases after the real skeleton → data
        // transition. Restart only test animations to sample identical frames.
        if(['dashboard','transactions','cards','loans'].includes(page)){
          const selection=page==='dashboard'?'.approved-primary-grid':page==='transactions'?(viewport.mobile?'.mobile-transaction-list':'.transactions-approved-table tbody'):page==='cards'?'.cards-grid':'.loan-list';
          for(const theme of ['light','dark']){
            await c.eval(`document.documentElement.dataset.theme='${theme}'`);
            const count=await c.eval(`(()=>{const root=document.querySelector('${selection}');const nodes=[...root?.children||[]].filter(el=>el.getClientRects().length>0);if(!nodes.length)return 0;for(const node of nodes.slice(0,6)){node.style.animation='none';void node.offsetWidth;node.style.removeProperty('animation')}globalThis.__motionQaAnimations=nodes.flatMap(node=>node.getAnimations()).filter(a=>a.animationName==='rh-bank-in'||a.animationName==='rh-backdrop-in');for(const a of globalThis.__motionQaAnimations)a.pause();return globalThis.__motionQaAnimations.length})()`);
            assert(count>0,`${viewport.name}/${page}: opted-in content has running shared entrance animation`);
            for(const [state,ms] of [['first',0],['mid',90],['settled',600]]){
              await c.eval(`for(const a of globalThis.__motionQaAnimations){a.currentTime=${ms};a.pause()}`);
              const sample=await c.eval(`(()=>{const root=document.querySelector('${selection}'),node=[...root.children].find(el=>el.getClientRects().length>0);const opacity=Number(getComputedStyle(node).opacity),rect=node.getBoundingClientRect();return {opacity,top:rect.top,overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth}})()`);
              assert(sample.overflow<=1,`${viewport.name}/${page}/${state}: horizontal overflow ${sample.overflow}px`);
              if(state==='first')assert(sample.opacity<=0.1,`${viewport.name}/${page}: entrance first frame opacity ${sample.opacity}`);
              if(state==='settled')assert(sample.opacity>=.99,`${viewport.name}/${page}: entrance did not settle ${sample.opacity}`);
              const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
              writeFileSync(`${evidenceDir}/motion-${page}-${viewport.name}-${theme}-${state}.png`,Buffer.from(shot.data,'base64'));
            }
            await c.eval("globalThis.__motionQaAnimations?.forEach(a=>a.cancel());delete globalThis.__motionQaAnimations");
          }
        }
        await sleep(80);
        const cls=Number(await c.eval('globalThis.__MYFINHUB_CLS||0'));
        const overflow=await c.eval('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth');
        console.log(`${viewport.name}/${page}: skeleton → content CLS ${cls.toFixed(3)} · horizontal overflow ${Math.round(overflow)}px`);
        assert(cls<=0.10,`${viewport.name}/${page}: skeleton/content CLS ${cls.toFixed(3)} > 0.10`);
        assert(overflow<=1,`${viewport.name}/${page}: post-loading horizontal overflow ${overflow}px`);
      }
    }
    // Mandatory OS reduced-motion override: no nonessential collection animation.
    await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await c.send('Page.navigate',{url:`${baseUrl}?page=dashboard`});
    for(let i=0;i<100;i++){if(await c.eval("Boolean(document.querySelector('.approved-primary-grid > *'))"))break;await sleep(50)}
    const reduced=await c.eval("(()=>{const node=document.querySelector('.approved-primary-grid > *');return node?{animation:getComputedStyle(node).animationName,opacity:Number(getComputedStyle(node).opacity)}:null})()");
    assert(reduced?.animation==='none'&&reduced.opacity===1,`OS reduced motion must remove collection entrance: ${JSON.stringify(reduced)}`);
    await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    console.log('Cross-page content entrance frames and OS reduced-motion contract validated.');
    console.log('Skeleton/loading layout-shift audit passed for every route on desktop and narrow mobile.');
  }finally{c.close()}
}finally{
  child.kill('SIGTERM');
}
