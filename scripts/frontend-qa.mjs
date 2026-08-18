import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for rendered frontend QA.');
const port=9222;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/rheomiq-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function waitHttp(url){for(let i=0;i<60;i++){try{const r=await fetch(url);if(r.ok)return r}catch{}await sleep(250)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Runtime evaluation failed');return r.result.value}
  close(){this.ws?.close()}
}
function assert(v,m){if(!v)throw new Error(`Frontend QA assertion failed: ${m}`)}
const q=v=>JSON.stringify(v);

try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(r=>r.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const navigate=async(url)=>{await c.send('Page.navigate',{url});for(let i=0;i<80;i++){if(await c.eval(`document.readyState==='complete'&&Boolean(document.body?.innerText.trim())`))return;await sleep(100)}throw new Error(`Page not ready: ${url}`)};
  const waitFor=async(expression,label)=>{for(let i=0;i<60;i++){if(await c.eval(expression))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const clickText=async(selector,text)=>{const ok=await c.eval(`(()=>{const e=[...document.querySelectorAll(${q(selector)})].find(x=>(x.textContent||'').trim().includes(${q(text)}));if(!e)return false;e.click();return true})()`);assert(ok,`missing clickable ${text}`)};
  const clickLabel=async(label)=>{const ok=await c.eval(`(()=>{const e=document.querySelector('button[aria-label=${q(label)}]');if(!e)return false;e.click();return true})()`);assert(ok,`missing labelled button ${label}`)};
  const waitHeading=async(text)=>waitFor(`(document.querySelector('#main-workspace h1')?.textContent||'').includes(${q(text)})`,`heading ${text}`);
  const openMobileMore=async()=>{if(!await c.eval(`Boolean(document.querySelector('[aria-labelledby="mobile-more-title"]'))`))await clickLabel('Περισσότερες ενότητες');await waitFor(`Boolean(document.querySelector('[aria-labelledby="mobile-more-title"]'))`,'mobile More dialog')};
  const mobileMorePage=async(label,heading)=>{await openMobileMore();await clickText('.mobile-more-menu button',label);await waitHeading(heading)};
  const audit=async(label)=>{const x=await c.eval(`(()=>{const v=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const names=[...document.querySelectorAll('button')].filter(v).filter(b=>!((b.getAttribute('aria-label')||b.getAttribute('title')||b.textContent||'').trim())).map(b=>b.outerHTML.slice(0,120));const controls=[...document.querySelectorAll('input,select,textarea')].filter(v).filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.closest('label')||(e.id&&document.querySelector('label[for="'+CSS.escape(e.id)+'"]')))).map(e=>e.outerHTML.slice(0,120));return {names,controls,overflow:document.documentElement.scrollWidth-window.innerWidth}})()`);assert(!x.names.length,`${label}: unnamed buttons ${x.names.join(' | ')}`);assert(!x.controls.length,`${label}: unnamed controls ${x.controls.join(' | ')}`);assert(x.overflow<=1,`${label}: page overflow ${x.overflow}px`)};
  const shot=async name=>{mkdirSync('/tmp/rheomiq-frontend-qa',{recursive:true});const r=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});writeFileSync(`/tmp/rheomiq-frontend-qa/${name}.png`,Buffer.from(r.data,'base64'))};
  const assertMobileControlFonts=async(label)=>{const result=await c.eval(`(()=>{const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};return [...document.querySelectorAll('input,select,textarea')].filter(visible).map(e=>({tag:e.tagName,size:parseFloat(getComputedStyle(e).fontSize),html:e.outerHTML.slice(0,90)})).filter(x=>x.size<15.9)})()`);assert(!result.length,`${label}: phone form controls below 16px ${JSON.stringify(result)}`)};

  /* Login interaction and phone form sizing. */
  await viewport(430,800);await navigate(`${baseUrl}?screen=login`);await waitFor(`Boolean(document.querySelector('#login-title'))`,'login');await audit('login');await assertMobileControlFonts('login');
  assert(await c.eval(`document.querySelector('#login-password')?.type==='password'`),'password starts masked');
  assert(await c.eval(`Boolean(document.querySelector('button[aria-label="Εμφάνιση κωδικού"]'))`),'password reveal control');
  await c.eval(`document.querySelector('#login-email').focus()`);assert(await c.eval(`Boolean(document.querySelector('.login-input:focus-within'))`),'login focus-within state');
  await clickLabel('Εμφάνιση κωδικού');assert(await c.eval(`document.querySelector('#login-password')?.type==='text'&&document.querySelector('button[aria-label="Απόκρυψη κωδικού"]')?.getAttribute('aria-pressed')==='true'`),'password reveal state');await shot('login-interaction');

  /* Desktop regression: current tables/charts stay active; mobile alternatives stay hidden. */
  await viewport(1440,1000);await navigate(baseUrl);await waitHeading('Οι λογαριασμοί μου');await audit('desktop dashboard');
  assert(await c.eval(`Boolean(document.querySelector('.primary-balance-card .bank-brand-mark'))`),'dashboard account brand mark');await shot('desktop-dashboard');
  await clickText('button','Γρήγορη προσθήκη');await waitFor(`Boolean(document.querySelector('[role="dialog"][aria-labelledby="quick-add-title"]'))`,'Smart Entry');
  assert(await c.eval(`document.querySelector('[aria-labelledby="quick-add-title"]').contains(document.activeElement)`),'Smart Entry focus');
  assert(await c.eval(`getComputedStyle(document.querySelector('.generic-kind-grid')).display==='grid'`),'desktop Quick Add movement chooser remains grid');
  await clickText('button','Καταχώριση');await waitFor(`Boolean(document.querySelector('.form-error[role="alert"]'))`,'validation alert');await audit('desktop Smart Entry');
  await clickLabel('Κλείσιμο καταχώρισης');await waitFor(`!document.querySelector('[aria-labelledby="quick-add-title"]')`,'Smart Entry close');await waitFor(`(document.activeElement?.textContent||'').includes('Γρήγορη προσθήκη')`,'Smart Entry focus restoration');

  await clickText('.sidebar nav button','Συναλλαγές');await waitHeading('Συναλλαγές');await audit('desktop transactions');
  assert(await c.eval(`getComputedStyle(document.querySelector('.desktop-finance-table')).display!=='none'&&getComputedStyle(document.querySelector('.mobile-transaction-list')).display==='none'`),'desktop Transactions keeps semantic table and hides phone list');
  assert(await c.eval(`(document.querySelector('.transaction-comment')?.textContent||'').includes('IRIS')`),'transaction comment is visible below description');
  assert(await c.eval(`Boolean(document.querySelector('.transaction-row.kind-expense[data-transaction-kind="expense"]'))`),'transaction semantic row class');
  assert(await c.eval(`getComputedStyle(document.querySelector('.transaction-row.kind-expense')).backgroundColor!=='rgba(0, 0, 0, 0)'`),'transaction row has subtle semantic tint');
  assert(await c.eval(`['coffee','supermarket','fuel','pharmacy'].every(key=>Boolean(document.querySelector('.transaction-row [data-icon-key="'+key+'"]')))`),'transaction rows resolve distinct semantic icons');
  assert(await c.eval(`new Set([...document.querySelectorAll('.transaction-row [data-icon-key]')].map(node=>node.getAttribute('data-icon-key'))).size>=4`),'transaction semantic icons should not collapse to one generic icon');await shot('desktop-transactions');

  await clickText('.sidebar nav button','Πάγια');await waitHeading('Πάγια & Συνδρομές');await audit('desktop recurring');
  assert(await c.eval(`getComputedStyle(document.querySelector('.desktop-finance-table')).display!=='none'&&getComputedStyle(document.querySelector('.mobile-recurring-list')).display==='none'`),'desktop Recurring keeps semantic table and hides phone list');
  assert(await c.eval(`Boolean(document.querySelector('.recurring-workspace-table [data-icon-key]'))`),'recurring rows use semantic icons');
  assert(await c.eval(`(()=>{const b=document.querySelector('.recurring-workspace-table button[aria-label^="Πληρωμή "]');if(!b)return false;b.click();return true})()`),'recurring payment');
  await waitFor(`Boolean(document.querySelector('[aria-labelledby="recurring-pay-title"]'))`,'recurring payment editor');assert(await c.eval(`document.querySelector('[aria-labelledby="recurring-pay-title"]').contains(document.activeElement)`),'recurring payment focus');await clickLabel('Κλείσιμο πληρωμής');
  assert(await c.eval(`(()=>{const b=[...document.querySelectorAll('.recurring-workspace-table button[aria-label^="Επεξεργασία"]')][0];if(!b)return false;b.click();return true})()`),'recurring edit');await waitFor(`Boolean(document.querySelector('[aria-labelledby="recurring-editor-title"]'))`,'recurring editor');assert(await c.eval(`document.querySelector('[aria-labelledby="recurring-editor-title"]').contains(document.activeElement)`),'recurring focus');await clickLabel('Κλείσιμο επεξεργασίας παγίου');

  await clickText('.sidebar nav button','Κάρτες & Δόσεις');await waitHeading('Κάρτες & Δόσεις');assert(await c.eval(`Boolean(document.querySelector('.credit-usage[role="progressbar"]'))`),'credit progress');await audit('desktop credit');assert(await c.eval(`Boolean(document.querySelector('.card-history [data-icon-key]'))`),'credit purchases use semantic icons');
  await clickText('.sidebar nav button','Δανεικά / Οφειλές');await waitHeading('Δανεικά & επιστροφές');await audit('desktop receivables');assert(await c.eval(`Boolean(document.querySelector('.private-text'))`),'receivables private values are masked');await clickText('button','Εμφάνιση στοιχείων');assert(await c.eval(`!document.querySelector('.private-text')`),'receivables reveal removes masking');await clickText('button','Νέα κίνηση');await waitFor(`Boolean(document.querySelector('[aria-labelledby="lending-dialog-title"]'))`,'lending dialog');assert(await c.eval(`document.querySelector('[aria-labelledby="lending-dialog-title"]').contains(document.activeElement)`),'lending dialog focus');await clickLabel('Κλείσιμο κίνησης δανεικών');
  await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');await waitFor(`Boolean(document.querySelector('.chart-alt'))`,'report alternative');await waitFor(`Boolean(document.querySelector('.report-operations-grid'))`,'operational reports');assert(await c.eval(`![...document.querySelectorAll('.report-kpis span')].some(x=>(x.textContent||'').includes('Refund'))`),'reports must not headline refunds');assert(await c.eval(`Boolean(document.querySelector('.category-icon-list [data-icon-key]'))`),'report categories use semantic icons');assert(await c.eval(`getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden="true"]')).display!=='none'`),'desktop category chart remains visible');await audit('desktop reports');
  await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');await waitFor(`Boolean([...document.querySelectorAll('label span')].find(x=>x.textContent.includes('Πιστωτικό όριο')))`,'credit setting');await audit('desktop settings');
  await c.eval(`document.querySelector('[data-qa-crash]').click()`);await waitFor(`Boolean(document.querySelector('.workspace-error[role="alert"]'))`,'error boundary');await clickText('.workspace-error button','Dashboard');await waitHeading('Οι λογαριασμοί μου');

  /* Persistent save/conflict feedback stays usable on phone. */
  await viewport(430,800);await navigate(`${baseUrl}?save=conflict`);await waitFor(`Boolean(document.querySelector('.persistence-notice.conflict[role="alert"]'))`,'conflict notice');assert(await c.eval(`document.querySelector('.persistence-notice.conflict').textContent.includes('Σύγκρουση έκδοσης')`),'conflict copy');await audit('conflict notice');await clickText('.persistence-notice button','Φόρτωση τελευταίας έκδοσης');await waitFor(`Boolean(document.querySelector('.persistence-notice.saved'))`,'conflict recovery');

  /* Narrow-edge smoke at 320 and 430. */
  for(const width of [320,430]){
    await viewport(width,812);await navigate(baseUrl);await waitHeading('Οι λογαριασμοί μου');await audit(`mobile dashboard ${width}`);
    assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-nav')).bottom==='8px'`),`mobile nav uses one outer safe-area strategy at ${width}`);
    await openMobileMore();assert(await c.eval(`document.querySelector('[aria-labelledby="mobile-more-title"]').contains(document.activeElement)`),`mobile More focus ${width}`);assert(await c.eval(`Number(getComputedStyle(document.querySelector('.mobile-more-backdrop')).zIndex)>Number(getComputedStyle(document.querySelector('.mobile-nav')).zIndex)`),`mobile modal backdrop covers nav ${width}`);assert(await c.eval(`(()=>{const menu=document.querySelector('.mobile-more-menu').getBoundingClientRect(),nav=document.querySelector('.mobile-nav').getBoundingClientRect();return menu.bottom<=nav.top+2})()`),`mobile More stays above nav ${width}`);await clickText('.mobile-more-menu button','Πάγια');await waitHeading('Πάγια & Συνδρομές');
    assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-recurring-list')).display!=='none'&&getComputedStyle(document.querySelector('.desktop-finance-table')).display==='none'`),`mobile recurring presentation active ${width}`);await audit(`mobile recurring ${width}`);
    await clickText('.mobile-nav button','Συναλλαγές');await waitHeading('Συναλλαγές');assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-transaction-list')).display!=='none'&&getComputedStyle(document.querySelector('.desktop-finance-table')).display==='none'`),`mobile transaction presentation active ${width}`);await audit(`mobile transactions ${width}`);
  }

  /* Full phone route matrix at 375px. */
  await viewport(375,812);await navigate(baseUrl);await waitHeading('Οι λογαριασμοί μου');await audit('mobile 375 dashboard');
  assert(await c.eval(`(()=>{const values=[...document.querySelectorAll('.mobile-nav button')].map(x=>x.getBoundingClientRect().height);return values.every(h=>h>=44)})()`),'mobile bottom navigation targets are >=44px');

  await clickText('.mobile-nav button','Συναλλαγές');await waitHeading('Συναλλαγές');await audit('mobile 375 transactions');
  assert(await c.eval(`Boolean(document.querySelector('.mobile-transaction-filters'))&&getComputedStyle(document.querySelector('.mobile-transaction-filters')).display!=='none'`),'mobile transaction filters are above list');
  assert(await c.eval(`Boolean(document.querySelector('.mobile-transaction-row [data-icon-key="coffee"]'))&&Boolean(document.querySelector('.mobile-transaction-comment'))`),'mobile transaction row keeps semantic icon and comment');
  assert(await c.eval(`(()=>{const row=document.querySelector('.mobile-transaction-row');const amount=row?.querySelector('.mobile-transaction-main>strong');return Boolean(row&&amount&&amount.getBoundingClientRect().right<=window.innerWidth)})()`),'mobile transaction amount is visible without horizontal swipe');
  await assertMobileControlFonts('mobile Transactions');await shot('mobile-transactions');

  await clickText('.mobile-nav button','Αποταμίευση');await waitHeading('Αποταμίευση');await audit('mobile 375 savings');await assertMobileControlFonts('mobile Savings');
  await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες & Δόσεις');await audit('mobile 375 credit');await assertMobileControlFonts('mobile Credit');

  await mobileMorePage('Δανεικά / Οφειλές','Δανεικά & επιστροφές');await audit('mobile 375 lending');await assertMobileControlFonts('mobile Lending');
  assert(await c.eval(`document.querySelector('.semantic-table-wrap').scrollWidth>=document.querySelector('.semantic-table-wrap').clientWidth&&getComputedStyle(document.querySelector('.receivables-table td:first-child')).position==='sticky'`),'mobile lending history remains a contained audit scroller with sticky identity');

  await mobileMorePage('Πάγια','Πάγια & Συνδρομές');await audit('mobile 375 recurring');
  assert(await c.eval(`Boolean(document.querySelector('.mobile-pay-action'))&&document.querySelector('.mobile-pay-action').getBoundingClientRect().height>=44`),'mobile recurring payment is primary usable action');
  assert(await c.eval(`Boolean(document.querySelector('.mobile-action-menu summary'))`),'mobile recurring secondary action menu exists');await shot('mobile-recurring');

  await mobileMorePage('Αναφορές','Αναφορές');await audit('mobile 375 reports');
  assert(await c.eval(`getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden="true"]')).display==='none'`),'mobile reports hide desktop-shaped category chart');
  assert(await c.eval(`getComputedStyle(document.querySelector('.category-icon-list')).display!=='none'`),'mobile reports keep category/value list visible');
  await c.eval(`window.scrollTo(0,Math.min(700,document.documentElement.scrollHeight-window.innerHeight))`);assert(await c.eval(`window.scrollY>50`),'reports page is scrollable for navigation reset test');
  await clickText('.mobile-nav button','Dashboard');await waitHeading('Οι λογαριασμοί μου');await waitFor(`window.scrollY<=1`,'page navigation scroll reset');

  /* Mobile Quick Add: dynamic viewport, horizontal type chooser, scroll lock/restore and 16px controls. */
  await c.eval(`window.scrollTo(0,Math.min(260,document.documentElement.scrollHeight-window.innerHeight))`);const beforeModalScroll=await c.eval(`window.scrollY`);
  await clickText('button','Άνοιγμα καταχώρισης');await waitFor(`Boolean(document.querySelector('[aria-labelledby="quick-add-title"]'))`,'mobile Quick Add');
  assert(await c.eval(`getComputedStyle(document.body).position==='fixed'`),'mobile modal locks document body');
  assert(await c.eval(`(()=>{const g=document.querySelector('.generic-kind-grid'),s=getComputedStyle(g);return s.display==='flex'&&g.scrollWidth>g.clientWidth})()`),'mobile Quick Add movement chooser is horizontal and scrollable');
  assert(await c.eval(`(()=>{const r=document.querySelector('.quick-modal').getBoundingClientRect();return r.top>=-1&&r.bottom<=window.innerHeight+1})()`),'mobile Quick Add fits dynamic viewport');
  await assertMobileControlFonts('mobile Quick Add');await audit('mobile Quick Add');await shot('mobile-quick-add');
  await clickLabel('Κλείσιμο καταχώρισης');await waitFor(`!document.querySelector('[aria-labelledby="quick-add-title"]')`,'mobile Quick Add close');assert(await c.eval(`document.body.style.position===''`),'modal unlocks body after close');assert(Math.abs((await c.eval(`window.scrollY`))-beforeModalScroll)<=2,'modal close restores prior document scroll');

  await mobileMorePage('Ρυθμίσεις','Ρυθμίσεις');await audit('mobile 375 settings');await assertMobileControlFonts('mobile Settings');
  assert(await c.eval(`(()=>{const nodes=[...document.querySelectorAll('.settings-actions button,.settings-draft-actions button')].filter(x=>getComputedStyle(x).display!=='none');return nodes.every(x=>x.getBoundingClientRect().height>=44)})()`),'mobile Settings actions use practical touch targets');

  /* Short-height landscape/keyboard-proxy geometry. */
  await viewport(667,375);await navigate(baseUrl);await waitHeading('Οι λογαριασμοί μου');await audit('mobile landscape dashboard');
  await clickText('button','Νέα κίνηση');await waitFor(`Boolean(document.querySelector('[aria-labelledby="quick-add-title"]'))`,'landscape Quick Add');assert(await c.eval(`(()=>{const r=document.querySelector('.quick-modal').getBoundingClientRect();return r.height<=window.innerHeight+1&&r.bottom<=window.innerHeight+1})()`),'landscape Quick Add remains inside visual viewport');await assertMobileControlFonts('landscape Quick Add');await clickLabel('Κλείσιμο καταχώρισης');
  await openMobileMore();assert(await c.eval(`document.querySelector('.mobile-more-menu').getBoundingClientRect().height<window.innerHeight`),'short-height More menu is constrained');await clickLabel('Κλείσιμο μενού');

  await viewport(430,800);await navigate(`${baseUrl}?motion=reduced`);await waitHeading('Οι λογαριασμοί μου');assert(await c.eval(`document.documentElement.dataset.motion==='reduced'`),'reduced-motion setting');await audit('reduced motion');

  c.close();console.log('Rendered frontend QA passed.');
}finally{child.kill('SIGTERM')}
