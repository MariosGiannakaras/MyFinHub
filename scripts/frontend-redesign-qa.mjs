import { spawn, execFileSync } from 'node:child_process';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v chromium || command -v chromium-browser'],{encoding:'utf8'}).trim();
if(!chrome)throw new Error('Chrome/Chromium is required for redesign QA.');
const port=9223;
const child=spawn(chrome,['--headless=new',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--user-data-dir=/tmp/rheomiq-redesign-qa-chrome','--no-sandbox','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitHttp(url){for(let i=0;i<60;i++){try{const response=await fetch(url);if(response.ok)return response}catch{}await sleep(250)}throw new Error(`Timed out waiting for ${url}`)}
class Cdp{
  constructor(url){this.url=url;this.id=0;this.pending=new Map()}
  async open(){await new Promise((resolve,reject)=>{this.ws=new WebSocket(this.url);this.ws.onopen=resolve;this.ws.onerror=reject;this.ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result)}})}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}))})}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'Runtime evaluation failed');return result.result.value}
  close(){this.ws?.close()}
}
const assert=(value,message)=>{if(!value)throw new Error(`Mobile redesign QA assertion failed: ${message}`)};
const q=value=>JSON.stringify(value);
try{
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`,{method:'PUT'}).then(response=>response.json());
  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');
  const viewport=(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=680});
  const navigate=async(url=baseUrl)=>{await c.send('Page.navigate',{url});for(let i=0;i<80;i++){if(await c.eval(`document.readyState==='complete'&&Boolean(document.querySelector('#main-workspace h1'))`))return;await sleep(100)}throw new Error(`Page not ready: ${url}`)};
  const waitFor=async(expression,label)=>{for(let i=0;i<70;i++){if(await c.eval(expression))return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
  const waitHeading=text=>waitFor(`(document.querySelector('#main-workspace h1')?.textContent||'').includes(${q(text)})`,`heading ${text}`);
  const clickText=async(selector,text)=>{const clicked=await c.eval(`(()=>{const node=[...document.querySelectorAll(${q(selector)})].find(item=>(item.textContent||'').trim().includes(${q(text)}));if(!node)return false;node.click();return true})()`);assert(clicked,`missing clickable ${text}`)};
  const clickAria=async label=>{const ok=await c.eval(`(()=>{const node=[...document.querySelectorAll('button[aria-label]')].find(item=>item.getAttribute('aria-label')===${q(label)});if(!node)return false;node.click();return true})()`);assert(ok,`missing aria button ${label}`)};
  const openMore=async()=>{const open=await c.eval(`document.querySelector('button[aria-label="Περισσότερες ενότητες"]')?.getAttribute('aria-expanded')==='true'`);if(!open)await clickText('.mobile-nav button','Περισσότερα');await waitFor(`Boolean(document.querySelector('[aria-labelledby="mobile-more-title"]'))`,'More sheet');await sleep(180)};
  const morePage=async(label,heading)=>{await openMore();await clickText('.mobile-more-menu button',label);await waitHeading(heading)};
  const noOverflow=async label=>{const overflow=await c.eval(`document.documentElement.scrollWidth-window.innerWidth`);assert(overflow<=1,`${label} page overflow ${overflow}px`)};
  const fullWidthStack=async(containerSelector,childSelector,min=1)=>c.eval(`(()=>{const container=document.querySelector(${q(containerSelector)});if(!container)return false;const cr=container.getBoundingClientRect();const nodes=[...document.querySelectorAll(${q(childSelector)})].filter(node=>node.getBoundingClientRect().width>0);if(nodes.length<${min})return false;const wide=nodes.every(node=>node.getBoundingClientRect().width>=cr.width*.86);if(nodes.length<2)return wide;return wide&&Math.abs(nodes[1].getBoundingClientRect().top-nodes[0].getBoundingClientRect().top)>8})()`);

  /* Desktop isolation: phone redesign layers must remain inert above the breakpoint. */
  await viewport(1440,1000);await navigate();await waitHeading('Οι λογαριασμοί μου');
  assert(await c.eval(`getComputedStyle(document.querySelector('.sidebar')).display!=='none'`),'desktop sidebar remains visible');
  assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-nav')).display==='none'`),'mobile dock remains hidden on desktop');
  assert(await c.eval(`getComputedStyle(document.querySelector('.command-pill')).position!=='fixed'`),'desktop Quick Entry stays in the topbar, not floating');
  assert(await c.eval(`getComputedStyle(document.querySelector('.dashboard-grid')).display!=='contents'`),'desktop dashboard retains its grid container');
  await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');
  assert(await c.eval(`getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden="true"]')).display!=='none'`),'desktop report category chart remains visible');
  await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');
  assert(await c.eval(`getComputedStyle(document.querySelector('.settings-draft-actions')).position!=='sticky'`),'desktop Settings action bar is not converted to mobile sticky UI');

  /* 375px: stable, user-visible signatures of the redesigned phone hierarchy. */
  await viewport(375,812);await navigate();await waitHeading('Οι λογαριασμοί μου');await noOverflow('Dashboard 375');
  assert(await c.eval(`getComputedStyle(document.querySelector('.sidebar')).display==='none'`),'phone sidebar is hidden');
  assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-nav')).display==='grid'`),'phone dock is active');
  assert(await c.eval(`getComputedStyle(document.querySelector('.command-pill')).position==='fixed'`),'Quick Entry is a floating phone action');
  assert(await fullWidthStack('.primary-balance-grid','.primary-balance-grid>.primary-balance-card',2),'Payroll/Savings are stacked as primary mobile balances');
  assert(await c.eval(`getComputedStyle(document.querySelector('.compact-account-grid')).display==='flex'&&['auto','scroll'].includes(getComputedStyle(document.querySelector('.compact-account-grid')).overflowX)`),'secondary accounts use a horizontal rail');
  assert(await c.eval(`document.querySelectorAll('.flow-metric-grid>.metric-card').length===3&&[...document.querySelectorAll('.flow-metric-grid>.metric-card')].every(node=>node.getBoundingClientRect().height<=125)`),'monthly flow stays compact and scan-friendly');
  assert(await c.eval(`getComputedStyle(document.querySelector('.quick-panel')).boxShadow==='none'`),'mobile quick actions avoid an extra nested card');
  assert(await c.eval(`getComputedStyle(document.querySelector('.dashboard-grid .chart-panel:nth-child(2) .chart-wrap')).display==='none'`),'mobile Dashboard category chart becomes list-first');

  await clickText('.mobile-nav button','Συναλλαγές');await waitHeading('Συναλλαγές');await noOverflow('Transactions 375');
  assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-transaction-list')).display!=='none'&&getComputedStyle(document.querySelector('.desktop-finance-table')).display==='none'`),'Transactions uses the mobile finance feed');
  assert(await c.eval(`parseFloat(getComputedStyle(document.querySelector('.mobile-transaction-row')).borderRadius)>=16`),'transaction feed uses redesigned mobile row surface');

  await clickText('.mobile-nav button','Αποταμίευση');await waitHeading('Αποταμίευση');await noOverflow('Savings 375');
  assert(await c.eval(`parseFloat(getComputedStyle(document.querySelector('.savings-hero')).borderRadius)>=20&&document.querySelector('.gauge-ring').getBoundingClientRect().width<=92`),'Savings uses the compact progress hero');
  assert(await fullWidthStack('.savings-action-grid','.savings-action-grid>.savings-action',2),'Savings actions become thumb-friendly rows');
  assert(await c.eval(`document.querySelector('.savings-action').getBoundingClientRect().height>=64`),'Savings primary actions retain usable row height');

  await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες & Δόσεις');await noOverflow('Credit 375');
  assert(await fullWidthStack('.card-workspace','.card-workspace>article',2),'credit debt and available-limit surfaces stack on phone');
  assert(await fullWidthStack('.loan-cards','.loan-cards>article',1),'installments use one-column operational cards');
  assert(await c.eval(`parseFloat(getComputedStyle(document.querySelector('.credit-hero')).borderRadius)>=20`),'credit status uses redesigned mobile hero');

  await morePage('Δανεικά / Οφειλές','Δανεικά & επιστροφές');await noOverflow('Lending 375');
  assert(await fullWidthStack('.receivable-person-grid','.receivable-person-grid>article',1),'Lending people are primary one-column cards');
  assert(await c.eval(`Boolean(document.querySelector('.private-text'))`),'Lending privacy remains masked by default');
  assert(await c.eval(`getComputedStyle(document.querySelector('.receivables-table td:first-child')).position==='sticky'`),'audit history keeps sticky identity while scrolling locally');

  await morePage('Πάγια','Πάγια & Συνδρομές');await noOverflow('Recurring 375');
  assert(await c.eval(`document.querySelectorAll('.recurring-summary-grid>article').length===3&&document.querySelector('.recurring-summary-grid>article').getBoundingClientRect().height<=115`),'Recurring opens with a compact monthly pulse');
  assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-recurring-list')).display!=='none'`),'Recurring active obligations use phone cards');
  assert(await c.eval(`document.querySelector('.mobile-pay-action').getBoundingClientRect().height>=44`),'Recurring Payment stays the primary thumb-safe action');

  await morePage('Αναφορές','Αναφορές');await noOverflow('Reports 375');
  assert(await c.eval(`document.querySelectorAll('.useful-report-kpis>div').length===4&&document.querySelector('.useful-report-kpis>div').getBoundingClientRect().height<=105`),'Reports opens with a compact four-KPI brief');
  assert(await c.eval(`document.querySelectorAll('.report-comparison>div').length===3`),'monthly comparison strip preserves all three signals');
  assert(await c.eval(`document.querySelectorAll('.report-operations-grid>article').length===4`),'operational reports keep four compact domain signals');
  assert(await c.eval(`getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden="true"]')).display==='none'`),'phone Reports stays list-first for categories');

  await morePage('Ρυθμίσεις','Ρυθμίσεις');await noOverflow('Settings 375');
  assert(await fullWidthStack('.settings-grid','.settings-grid>article',2),'Settings becomes one-column grouped preferences');
  assert(await c.eval(`(()=>{const nodes=[...document.querySelectorAll('.settings-actions button')];return nodes.length>=2&&nodes.every(node=>node.getBoundingClientRect().height>=46)})()`),'Settings backup/import actions are thumb-safe');
  assert(await c.eval(`getComputedStyle(document.querySelector('.settings-draft-actions')).position==='sticky'`),'Settings apply/cancel actions remain reachable');
  assert(await c.eval(`parseFloat(getComputedStyle(document.querySelector('.category-editor textarea')).minHeight)>=180`),'mobile category editors remain comfortably readable');

  /* Quick Add shares the redesigned bottom-sheet anatomy. */
  await clickText('.mobile-nav button','Dashboard');await waitHeading('Οι λογαριασμοί μου');await clickText('.command-pill','Γρήγορη κίνηση');
  await waitFor(`Boolean(document.querySelector('[aria-labelledby="quick-add-title"]'))`,'Quick Add redesign');
  assert(await c.eval(`parseFloat(getComputedStyle(document.querySelector('.quick-modal')).borderTopLeftRadius)>=20`),'Quick Add uses the shared phone sheet radius');
  assert(await c.eval(`getComputedStyle(document.querySelector('.quick-modal>footer')).position==='sticky'`),'Quick Add keeps a persistent phone action zone');
  await clickAria('Κλείσιμο καταχώρισης');
  await waitFor(`!document.querySelector('[aria-labelledby="quick-add-title"]')`,'Quick Add close');

  /* Edge widths and short-height mode preserve the redesigned hierarchy without desktop leakage. */
  for(const width of [320,430]){await viewport(width,812);await navigate();await waitHeading('Οι λογαριασμοί μου');await noOverflow(`Dashboard ${width}`);assert(await fullWidthStack('.primary-balance-grid','.primary-balance-grid>.primary-balance-card',2),`primary accounts remain stacked at ${width}`);assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-nav')).display==='grid'`),`mobile dock remains active at ${width}`)}
  await viewport(667,375);await navigate();await waitHeading('Οι λογαριασμοί μου');await noOverflow('landscape Dashboard');
  assert(await c.eval(`getComputedStyle(document.querySelector('.mobile-nav')).display==='grid'`),'short-height landscape retains mobile dock');
  await openMore();assert(await c.eval(`document.querySelector('.mobile-more-menu').getBoundingClientRect().height<window.innerHeight`),'redesigned More sheet stays constrained in landscape');

  c.close();console.log('Mobile redesign fidelity QA passed.');
}finally{child.kill('SIGTERM')}
