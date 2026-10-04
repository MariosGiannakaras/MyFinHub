import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for geometry QA.');
const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];
const viewports=[
  {name:'desktop',width:1440,height:1000,mobile:false},
  {name:'tablet',width:834,height:1112,mobile:false},
  {name:'mobile',width:375,height:812,mobile:true},
  {name:'narrow',width:320,height:700,mobile:true},
];
const port=9271;
const profile='/tmp/myfinhub-geometry-overflow-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i+=1){try{const response=await fetch(url);if(response.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const result=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime function call failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Geometry QA assertion failed: ${message}`)};
const analysisFn=`function(){
  const visible=node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
  const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const selector=node=>{const id=node.id?'#'+node.id:'';const cls=[...node.classList].slice(0,3).map(v=>'.'+v).join('');return (node.tagName.toLowerCase()+id+cls).slice(0,180)};
  const horizontalHost=node=>{let parent=node.parentElement;while(parent&&parent!==document.body){const s=getComputedStyle(parent);if(['auto','scroll'].includes(s.overflowX)&&parent.scrollWidth>parent.clientWidth+1)return parent;parent=parent.parentElement}return null};
  const rogue=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"],[role="radio"],[role="slider"]')].filter(visible).filter(node=>{const r=node.getBoundingClientRect();if(r.left>=-1&&r.right<=innerWidth+1)return false;const host=horizontalHost(node);if(!host)return true;const hr=host.getBoundingClientRect();return hr.left<-1||hr.right>innerWidth+1}).map(node=>({selector:selector(node),rect:rect(node)})).slice(0,20);
  const overflowNodes=[...document.querySelectorAll('body *')].filter(visible).map(node=>({node,r:node.getBoundingClientRect()})).filter(({r})=>r.left<-1||r.right>innerWidth+1).map(({node,r})=>({selector:selector(node),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},scrollWidth:node.scrollWidth,clientWidth:node.clientWidth})).slice(0,20);
  const chrome=[...document.querySelectorAll('.mobile-nav,.mobile-quick-action')].filter(visible);
  const actions=[...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[role="tab"],[role="radio"],[role="slider"]')].filter(visible).filter(node=>!chrome.some(item=>item===node||item.contains(node))).filter(node=>!node.hasAttribute('disabled'));
  const overlaps=[];
  for(const fixed of chrome){
    const fr=fixed.getBoundingClientRect();
    for(const action of actions){
      const ar=action.getBoundingClientRect();
      const width=Math.max(0,Math.min(fr.right,ar.right)-Math.max(fr.left,ar.left));
      const height=Math.max(0,Math.min(fr.bottom,ar.bottom)-Math.max(fr.top,ar.top));
      if(!width||!height)continue;
      const ratio=(width*height)/Math.max(1,ar.width*ar.height);
      if(ratio>.12)overlaps.push({chrome:selector(fixed),action:selector(action),ratio:Number(ratio.toFixed(2)),actionRect:rect(action)});
    }
  }
  const navLabels=[...document.querySelectorAll('.mobile-nav button>span')].filter(visible);
  const navLabelIssues=[];
  for(let i=0;i<navLabels.length;i+=1){
    const label=navLabels[i],lr=label.getBoundingClientRect(),button=label.closest('button'),br=button?.getBoundingClientRect();
    if(br&&(lr.left<br.left-1||lr.right>br.right+1))navLabelIssues.push({kind:'outside-button',text:(label.textContent||'').trim(),label:rect(label),button:rect(button)});
    for(let j=i+1;j<navLabels.length;j+=1){
      const other=navLabels[j],or=other.getBoundingClientRect();
      const width=Math.max(0,Math.min(lr.right,or.right)-Math.max(lr.left,or.left));
      const height=Math.max(0,Math.min(lr.bottom,or.bottom)-Math.max(lr.top,or.top));
      if(width>0.5&&height>0.5)navLabelIssues.push({kind:'label-overlap',a:(label.textContent||'').trim(),b:(other.textContent||'').trim(),width,height});
    }
  }
  const desktopShortcut=document.querySelector('.period-attention-shortcut');
  const desktopChromeOverlaps=[];
  if(desktopShortcut&&visible(desktopShortcut)){
    const sr=desktopShortcut.getBoundingClientRect();
    for(const button of [...document.querySelectorAll('.topbar button')].filter(visible)){
      const br=button.getBoundingClientRect();
      const left=Math.max(sr.left,br.left),right=Math.min(sr.right,br.right),top=Math.max(sr.top,br.top),bottom=Math.min(sr.bottom,br.bottom);
      const width=Math.max(0,right-left),height=Math.max(0,bottom-top);
      if(width&&height){
        const hit=document.elementFromPoint((left+right)/2,(top+bottom)/2);
        const shortcutIsTopmost=Boolean(hit&&(hit===desktopShortcut||desktopShortcut.contains(hit)));
        if(shortcutIsTopmost)desktopChromeOverlaps.push({shortcut:selector(desktopShortcut),button:selector(button),rect:rect(button),hit:selector(hit)});
      }
    }
  }
  const docOverflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;
  const main=document.querySelector('#main-workspace');
  const mainRect=main?rect(main):null;
  return {docOverflow,rogue,overflowNodes,overlaps:overlaps.slice(0,20),navLabelIssues,desktopChromeOverlaps,mainRect,scrollY,scrollHeight:document.documentElement.scrollHeight};
}`;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  for(const viewport of viewports){
    await c.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
    for(const page of pages){
      const url=new URL(baseUrl);url.searchParams.set('page',page);if(viewport.name==='narrow')url.searchParams.set('state','extreme');
      await c.send('Page.navigate',{url:url.href});
      for(let i=0;i<140;i+=1){if(await c.call("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}"))break;await sleep(80)}
      await sleep(120);
      const scrollHeight=await c.call("function(){return document.documentElement.scrollHeight}");
      const stops=[0,Math.max(0,Math.round((scrollHeight-viewport.height)/2)),Math.max(0,scrollHeight-viewport.height)];
      for(const y of [...new Set(stops)]){
        await c.call("function(y){scrollTo(0,y);return true}",[y]);await sleep(60);
        const result=await c.call(analysisFn);
        assert(result.docOverflow<=1,`${viewport.name}/${page}@${y}: document horizontal overflow ${result.docOverflow}px; nodes ${JSON.stringify(result.overflowNodes)}`);
        assert(result.rogue.length===0,`${viewport.name}/${page}@${y}: off-viewport controls ${JSON.stringify(result.rogue)}`);
        if(viewport.mobile)assert(result.navLabelIssues.length===0,`${viewport.name}/${page}@${y}: bottom-nav label collision ${JSON.stringify(result.navLabelIssues)}`);
        const maxScroll=Math.max(0,result.scrollHeight-viewport.height);
        const atBottom=result.scrollY>=maxScroll-2;
        if(viewport.mobile&&atBottom)assert(result.overlaps.length===0,`${viewport.name}/${page}@${y}: fixed mobile chrome prevents final actions from scrolling clear ${JSON.stringify(result.overlaps)}`);
        assert(result.desktopChromeOverlaps.length===0,`${viewport.name}/${page}@${y}: Dashboard shortcut overlaps topbar controls ${JSON.stringify(result.desktopChromeOverlaps)}`);
      }
      console.log(`${viewport.name}/${page}: geometry clean`);
    }
  }
  console.log('Completion geometry/overflow QA: intermediate breakpoints, resize transitions and landscape');
  const transitionPages=['dashboard','transactions','credit','planning','settings'];
  const transitionProfiles=[
    {name:'intermediate-1024',width:1024,height:768,mobile:false},
    {name:'tablet-landscape',width:1112,height:834,mobile:false},
    {name:'breakpoint-wide-681',width:681,height:812,mobile:false},
    {name:'breakpoint-mobile-680',width:680,height:812,mobile:true},
    {name:'phone-landscape',width:812,height:375,mobile:true},
  ];
  for(const page of transitionPages){
    const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state','extreme');
    await c.send('Page.navigate',{url:url.href});
    for(let i=0;i<140;i+=1){if(await c.call("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}"))break;await sleep(80)}
    for(const profile of transitionProfiles){
      await c.send('Emulation.setDeviceMetricsOverride',{width:profile.width,height:profile.height,deviceScaleFactor:1,mobile:profile.mobile});
      await c.call("function(){scrollTo(0,0);dispatchEvent(new Event('resize'));return true}");
      await sleep(120);
      const result=await c.call(analysisFn);
      assert(result.docOverflow<=1,`${profile.name}/${page}: document horizontal overflow ${result.docOverflow}px; nodes ${JSON.stringify(result.overflowNodes)}`);
      assert(result.rogue.length===0,`${profile.name}/${page}: off-viewport controls ${JSON.stringify(result.rogue)}`);
      if(profile.mobile)assert(result.navLabelIssues.length===0,`${profile.name}/${page}: bottom-nav label collision ${JSON.stringify(result.navLabelIssues)}`);
      assert(result.desktopChromeOverlaps.length===0,`${profile.name}/${page}: chrome overlap ${JSON.stringify(result.desktopChromeOverlaps)}`);
    }
  }
  console.log('Completion geometry/overflow QA: 200%-equivalent desktop reflow across every primary route');
  const zoomWidth=720;
  const zoomHeight=500;
  await c.send('Emulation.setDeviceMetricsOverride',{width:zoomWidth,height:zoomHeight,deviceScaleFactor:1,mobile:false});
  for(const page of pages){
    const url=new URL(baseUrl);url.searchParams.set('page',page);url.searchParams.set('state','extreme');url.searchParams.set('text','large');url.searchParams.set('motion','reduced');
    await c.send('Page.navigate',{url:url.href});
    for(let i=0;i<140;i+=1){if(await c.call("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}"))break;await sleep(80)}
    await sleep(120);
    const result=await c.call(analysisFn);
    assert(result.docOverflow<=1,`zoom-200pct/${page}: document horizontal overflow ${result.docOverflow}px; nodes ${JSON.stringify(result.overflowNodes)}`);
    assert(result.rogue.length===0,`zoom-200pct/${page}: off-viewport controls ${JSON.stringify(result.rogue)}`);
    assert(result.desktopChromeOverlaps.length===0,`zoom-200pct/${page}: chrome overlap ${JSON.stringify(result.desktopChromeOverlaps)}`);
  }
  c.close();
  console.log('Completion geometry/overflow QA passed across canonical, intermediate, resize-transition, landscape and 200%-equivalent profiles.');
}finally{child.kill('SIGTERM');await sleep(200);rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
