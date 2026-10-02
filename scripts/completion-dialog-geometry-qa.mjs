import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const configured=process.env.MYFINHUB_QA_USE_FALLBACK==='1'?process.env.MYFINHUB_QA_FALLBACK_BROWSER:process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome=configured||execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for dialog geometry QA.');
const viewports=[{name:'mobile',width:375,height:812},{name:'narrow',width:320,height:700},{name:'virtual-keyboard',width:375,height:500}];
const port=9273;
const profile='/tmp/myfinhub-dialog-geometry-qa-chrome';
rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<120;i+=1){try{const r=await fetch(url);if(r.ok)return}catch{}await sleep(150)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const m=JSON.parse(event.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async call(fn,args=[]){const root=await this.send('Runtime.evaluate',{expression:'globalThis'});const r=await this.send('Runtime.callFunctionOn',{objectId:root.result.objectId,functionDeclaration:fn,arguments:args.map(value=>({value})),returnByValue:true,awaitPromise:true});if(r.exceptionDetails){const detail=r.exceptionDetails.exception?.description||r.exceptionDetails.text||'Runtime call failed';const stack=r.exceptionDetails.stackTrace?.callFrames?.map(frame=>`${frame.functionName||'<anonymous>'}@${frame.url||'<page>'}:${frame.lineNumber+1}:${frame.columnNumber+1}`).join(' <- ');throw new Error(stack?`${detail} · ${stack}`:detail)}return r.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Dialog geometry QA assertion failed: ${message}`)};
const visible=`function(node){if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}`;
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const waitFor=async(fn,label,args=[])=>{for(let i=0;i<140;i+=1){if(await c.call(fn,args))return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
  const navigate=async page=>{const url=new URL(baseUrl);url.searchParams.set('page',page);await c.send('Page.navigate',{url:url.href});await waitFor("function(){return document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))}",`${page} page`);await sleep(100)};
  const click=async(selector,label)=>{const ok=await c.call(`function(selector){const visible=${visible};const node=[...document.querySelectorAll(selector)].find(visible);node?.click();return Boolean(node)}`,[selector]);assert(ok,`missing ${label}`);await sleep(100)};
  const clickText=async(selector,text)=>{const ok=await c.call(`function(selector,text){const visible=${visible};const node=[...document.querySelectorAll(selector)].find(n=>visible(n)&&(n.textContent||'').includes(text));node?.click();return Boolean(node)}`,[selector,text]);assert(ok,`missing ${text}`);await sleep(100)};
  const inspect=async(selector,label,{vertical=true}={})=>{
    await sleep(220);
    const result=await c.call(`function(selector){
      const visible=node=>{
        if(!node)return false;
        const style=getComputedStyle(node),rect=node.getBoundingClientRect();
        return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0;
      };
      const root=[...document.querySelectorAll(selector)].find(visible);
      if(!root)return null;
      const rect=root.getBoundingClientRect();
      const controls=[...root.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="radio"],[role="tab"]')].filter(visible);
      const horizontalHost=node=>{
        let parent=node.parentElement;
        while(parent&&parent!==root){
          const style=getComputedStyle(parent);
          if((style.overflowX==='auto'||style.overflowX==='scroll')&&parent.scrollWidth>parent.clientWidth+1)return parent;
          parent=parent.parentElement;
        }
        return null;
      };
      const rogue=controls.filter(node=>{
        const controlRect=node.getBoundingClientRect();
        if(controlRect.left>=-1&&controlRect.right<=innerWidth+1)return false;
        const host=horizontalHost(node);
        if(!host)return true;
        const hostRect=host.getBoundingClientRect();
        return hostRect.left<-1||hostRect.right>innerWidth+1;
      }).map(node=>({tag:node.tagName,aria:node.getAttribute('aria-label'),text:(node.textContent||'').trim().slice(0,80)}));
      const accessible=node=>{
        const ariaLabel=(node.getAttribute('aria-label')||'').trim();
        const labelledBy=(node.getAttribute('aria-labelledby')||'').trim();
        const wrapped=Boolean(node.closest('label'));
        const labels=('labels' in node&&node.labels)?node.labels.length:0;
        return Boolean(ariaLabel||labelledBy||wrapped||labels);
      };
      const unnamedButtons=[...root.querySelectorAll('button')].filter(visible).filter(node=>!((node.getAttribute('aria-label')||node.getAttribute('title')||node.textContent||'').trim())).map(node=>node.outerHTML.slice(0,140));
      const unnamedControls=[...root.querySelectorAll('input,select,textarea')].filter(visible).filter(node=>!accessible(node)).map(node=>node.outerHTML.slice(0,140));
      const footers=[...root.querySelectorAll('footer,.modal-actions,.editor-actions,.account-management-modal-footer')].filter(visible).map(node=>{
        const footerRect=node.getBoundingClientRect();
        return {top:footerRect.top,bottom:footerRect.bottom,left:footerRect.left,right:footerRect.right};
      });
      return {
        viewportWidth:innerWidth,viewportHeight:innerHeight,
        left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,
        scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,
        rogue,unnamedButtons,unnamedControls,footers
      };
    }`,[selector]);
    assert(result,`${label} is not visible`);
    assert(result.left>=-1&&result.right<=result.viewportWidth+1,`${label} escapes viewport horizontally: ${JSON.stringify(result)}`);
    if(vertical)assert(result.top>=-1&&result.bottom<=result.viewportHeight+1,`${label} escapes viewport vertically: ${JSON.stringify(result)}`);
    assert(result.scrollWidth<=result.clientWidth+1,`${label} has internal horizontal overflow: ${result.scrollWidth}-${result.clientWidth}`);
    assert(result.rogue.length===0,`${label} has off-viewport controls: ${JSON.stringify(result.rogue)}`);
    assert(result.unnamedButtons.length===0,`${label} has unnamed buttons: ${result.unnamedButtons.join(' | ')}`);
    assert(result.unnamedControls.length===0,`${label} has unnamed form controls: ${result.unnamedControls.join(' | ')}`);
    for(const footer of result.footers)assert(footer.left>=-1&&footer.right<=result.viewportWidth+1,`${label} footer escapes horizontally`);
    return result;
  };

  for(const viewport of viewports){
    await c.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:true});

    await navigate('dashboard');
    await click('[data-global-quick-entry="mobile"]','mobile Quick Entry nav action');
    await waitFor("function(){return Boolean(document.querySelector('.quick-modal'))}",'Quick Entry dialog');
    await inspect('.quick-modal',`${viewport.name} Quick Entry`);

    await navigate('cards');
    await click('[aria-label^="Επεξεργασία κάρτας"]','card profile editor');
    await waitFor("function(){return Boolean(document.querySelector('.card-create-modal'))}",'card profile editor');
    await inspect('.card-create-modal',`${viewport.name} card profile editor`);

    await navigate('settings');
    await clickText('[role="tab"]','Λογαριασμοί');
    await clickText('button','Νέος λογαριασμός');
    await waitFor("function(){return Boolean(document.querySelector('.account-management-modal'))}",'account editor');
    await inspect('.account-management-modal',`${viewport.name} account editor`);

    await navigate('settings');
    await clickText('[role="tab"]','Εικονίδια');
    await click('.category-icon-unified-main','icon assignment row');
    await waitFor("function(){return Boolean(document.querySelector('[data-icon-selection-panel]'))}",'icon selection panel');
    const iconPanel=await inspect('[data-icon-selection-panel]',`${viewport.name} icon selection panel`,{vertical:false});
    assert(iconPanel.bottom>0,`${viewport.name} icon selection panel is not reachable`);

    await navigate('cards');
    await clickText('.page-heading button','Προσθήκη τράπεζας');
    await waitFor("function(){return Boolean(document.querySelector('#new-bank-title'))}",'new bank dialog');
    await inspect('.picker.compact',`${viewport.name} new bank dialog`);
    await c.call("function(){document.querySelector('.picker.compact .close-picker')?.click()}");
    await waitFor("function(){return !document.querySelector('#new-bank-title')}",'new bank dialog close');

    await click('button[aria-label^="Ασφαλή στοιχεία"]','secure card details editor');
    await waitFor("function(){return Boolean(document.querySelector('.app-card-details-dialog'))}",'secure card details editor');
    await inspect('.app-card-details-dialog',`${viewport.name} secure card details editor`);

    await navigate('savings');
    await clickText('button','Νέος στόχος');
    await waitFor("function(){return Boolean(document.querySelector('#savings-goal-editor-title'))}",'savings goal editor');
    await inspect('.savings-dialog',`${viewport.name} savings goal editor`);

    await navigate('loans');
    await clickText('.page-heading button','Νέο');
    await waitFor("function(){return Boolean(document.querySelector('#loan-editor-title'))}",'loan editor');
    await inspect('.loan-editor-dialog',`${viewport.name} loan editor`);

    await navigate('lending');
    await clickText('.page-heading button','Νέα κίνηση');
    await waitFor("function(){return Boolean(document.querySelector('#lending-dialog-title'))}",'lending editor');
    await inspect('.lending-dialog',`${viewport.name} lending editor`);

    await navigate('recurring');
    await clickText('button','Νέο πάγιο');
    await waitFor("function(){return Boolean(document.querySelector('#recurring-editor-title'))}",'recurring editor');
    await inspect('.editor-dialog',`${viewport.name} recurring editor`);

    await navigate('planning');
    await clickText('button','Νέα προγραμματισμένη');
    await waitFor("function(){return Boolean(document.querySelector('#scheduled-editor-title'))}",'planning editor');
    await inspect('.planning-editor',`${viewport.name} planning editor`);

    await navigate('dashboard');
    await click('[aria-label="Περισσότερες ενότητες"]','mobile More navigation');
    await waitFor("function(){return Boolean(document.querySelector('.mobile-more-menu'))}",'mobile more menu');
    await inspect('.mobile-more-menu',`${viewport.name} mobile more menu`);

    console.log(`${viewport.name}: interaction geometry clean`);
  }
  c.close();
  console.log('Completion dialog/interaction geometry QA passed.');
}finally{child.kill('SIGTERM');await sleep(200);rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
