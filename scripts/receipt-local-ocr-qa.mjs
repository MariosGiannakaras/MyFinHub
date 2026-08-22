import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const baseUrl = process.env.RHEOMIQ_QA_URL || 'http://127.0.0.1:5173/qa.html?page=dashboard';
const evidenceDir = process.env.MYFINHUB_UX_EVIDENCE_DIR || '/tmp/myfinhub-ui-ux-qa';
mkdirSync(evidenceDir, { recursive: true });
const configured = process.env.MYFINHUB_QA_USE_FALLBACK === '1'
  ? process.env.MYFINHUB_QA_FALLBACK_BROWSER
  : process.env.MYFINHUB_QA_PRIMARY_BROWSER;
const chrome = configured || execFileSync('bash', ['-lc', 'command -v google-chrome || command -v chromium || command -v chromium-browser'], { encoding: 'utf8' }).trim();
if (!chrome) throw new Error('Chrome/Chromium is required for receipt OCR QA.');

const port = 9253;
const profile = '/tmp/myfinhub-receipt-local-ocr-qa-chrome';
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
const child = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitHttp(url) {
  for (let i = 0; i < 120; i += 1) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id) {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id);
          message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
          return;
        }
        for (const fn of this.listeners.get(message.method) || []) fn(message.params);
      };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    const list = this.listeners.get(method) || [];
    list.push(fn);
    this.listeners.set(method, list);
  }
  async call(functionDeclaration, args = []) {
    const root = await this.send('Runtime.evaluate', { expression: 'globalThis' });
    const result = await this.send('Runtime.callFunctionOn', {
      objectId: root.result.objectId,
      functionDeclaration,
      arguments: args.map((value) => ({ value })),
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime function call failed');
    return result.result.value;
  }
  close() { this.ws?.close(); }
}

const assert = (value, message) => { if (!value) throw new Error(`Receipt OCR QA assertion failed: ${message}`); };
let c;
try {
  await waitHttp(`http://127.0.0.1:${port}/json/version`);
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' }).then((response) => response.json());
  c = new Cdp(target.webSocketDebuggerUrl);
  await c.open();
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Network.enable');

  const externalRequests = [];
  const baseOrigin = new URL(baseUrl).origin;
  let monitorOcrNetwork = false;
  c.on('Network.requestWillBeSent', (params) => {
    if (!monitorOcrNetwork) return;
    const url = params.request?.url || '';
    if (!/^https?:/i.test(url)) return;
    try { if (new URL(url).origin !== baseOrigin) externalRequests.push(url); } catch {}
  });

  const waitFor = async (fn, label, args = [], limit = 160) => {
    for (let i = 0; i < limit; i += 1) {
      if (await c.call(fn, args)) return;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const screenshot = async (name) => {
    const shot = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${evidenceDir}/${name}.png`, Buffer.from(shot.data, 'base64'));
  };
  const openReceiptInbox = async () => {
    const opened = await c.call("function(){const button=document.querySelector('.primary-action')||document.querySelector('.mobile-quick-action');button?.click();return Boolean(button)}");
    assert(opened, 'generic Quick Entry launch exists');
    await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))}", 'generic Quick Entry');
    const receipt = await c.call("function(){const button=document.querySelector('.receipt-quick-launch');button?.click();return Boolean(button)}");
    assert(receipt, 'receipt launch exists beside generic Quick Entry');
    await waitFor("function(){return Boolean(document.querySelector('.receipt-inbox'))}", 'receipt inbox');
  };
  const receiptCount = () => c.call(`async function(){
    return await new Promise((resolve,reject)=>{
      const request=indexedDB.open('myfinhub-local-receipts-v1',1);
      request.onsuccess=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('receipts')){db.close();resolve(0);return;}
        const tx=db.transaction('receipts','readonly');
        const count=tx.objectStore('receipts').count();
        count.onsuccess=()=>{const value=count.result;db.close();resolve(value)};
        count.onerror=()=>{db.close();reject(count.error)};
      };
      request.onerror=()=>reject(request.error);
    });
  }`);

  console.log('Receipt OCR QA: fast capture persists before OCR');
  await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}", 'QA workspace');
  await openReceiptInbox();
  const generated = await c.call(`async function(){
    const canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=900;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#000';ctx.textBaseline='top';ctx.font='700 78px Arial, sans-serif';
    ctx.fillText('MY MARKET',90,90);
    ctx.font='600 60px Arial, sans-serif';
    ctx.fillText('RECEIPT',90,220);
    ctx.fillText('DATE 22/08/2026',90,360);
    ctx.font='700 72px Arial, sans-serif';
    ctx.fillText('TOTAL 24.50 EUR',90,520);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('canvas blob failed')),'image/png'));
    const file=new File([blob],'qa-receipt.png',{type:'image/png',lastModified:Date.now()});
    const inputs=document.querySelectorAll('.receipt-file-input');
    const input=inputs[1];
    if(!input)return false;
    const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    return file.size>0;
  }`);
  assert(generated, 'synthetic PNG injected through normal file input');
  await waitFor("function(){return (document.querySelector('.receipt-success')?.textContent||'').includes('Αποθηκεύτηκε για αργότερα')}", 'capture persistence confirmation');
  assert((await receiptCount()) === 1, 'one durable local receipt exists immediately after capture');
  assert((await c.call("function(){return document.querySelectorAll('.receipt-draft-row').length}")) === 1, 'pending inbox shows captured draft');
  await screenshot('receipt-local-captured');

  console.log('Receipt OCR QA: receipt survives close and reload');
  await c.call("function(){document.querySelector('.receipt-inbox-header .icon-button')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.receipt-inbox')}", 'receipt inbox close');
  await c.call("function(){document.querySelector('.quick-modal:not(.contextual-quick-modal) button[aria-label=\"Κλείσιμο καταχώρισης\"]')?.click();return true}");
  await waitFor("function(){return !document.querySelector('.quick-modal')}", 'Quick Entry close');
  await c.send('Page.reload');
  await waitFor("function(){return Boolean(document.querySelector('#main-workspace h1'))}", 'workspace after reload');
  assert((await receiptCount()) === 1, 'receipt remains in IndexedDB after reload');
  await openReceiptInbox();
  assert((await c.call("function(){return document.querySelectorAll('.receipt-draft-row').length}")) === 1, 'reopened inbox restores receipt');

  console.log('Receipt OCR QA: self-hosted OCR scans locally and creates proposal');
  externalRequests.length = 0;
  monitorOcrNetwork = true;
  const scanClicked = await c.call("function(){const button=[...document.querySelectorAll('.receipt-review-actions button')].find(node=>(node.textContent||'').includes('Σάρωση τώρα'));button?.click();return Boolean(button)}");
  assert(scanClicked, 'scan now action exists');
  await waitFor("function(){return Boolean(document.querySelector('.receipt-proposal h3'))||Boolean(document.querySelector('.form-error'))}", 'OCR completion', [], 650);
  monitorOcrNetwork = false;
  const scanError = await c.call("function(){return document.querySelector('.form-error')?.textContent||''}");
  assert(!scanError, `local OCR failed: ${scanError}`);
  const proposalText = await c.call("function(){return document.querySelector('.receipt-proposal')?.textContent||''}");
  assert(/MY\s*MARKET/i.test(proposalText), `merchant proposal missing: ${proposalText}`);
  assert(proposalText.includes('2026-08-22'), `date proposal missing: ${proposalText}`);
  assert(/24[,.]50/.test(proposalText), `total proposal missing: ${proposalText}`);
  assert(proposalText.includes('EUR'), `currency proposal missing: ${proposalText}`);
  assert(externalRequests.length === 0, `OCR scan made external HTTP requests: ${externalRequests.join(', ')}`);
  await screenshot('receipt-local-ocr-proposal');

  console.log('Receipt OCR QA: proposal only prefills; normal submit owns transaction + cleanup');
  const applyClicked = await c.call("function(){const button=[...document.querySelectorAll('.receipt-review-actions button')].find(node=>(node.textContent||'').includes('Χρήση στη Γρήγορη Κίνηση'));button?.click();return Boolean(button)}");
  assert(applyClicked, 'proposal handoff action exists');
  await waitFor("function(){return Boolean(document.querySelector('.quick-modal:not(.contextual-quick-modal)'))&&!document.querySelector('.receipt-inbox')}", 'Quick Entry after proposal');
  assert((await receiptCount()) === 1, 'receipt remains pending before normal Quick Entry submit');
  const quickValues = await c.call("function(){return [...document.querySelectorAll('.quick-modal:not(.contextual-quick-modal) input')].map(input=>input.value)}");
  assert(quickValues.some((value) => /MY\s*MARKET/i.test(value)), `merchant not prefilled: ${JSON.stringify(quickValues)}`);
  assert(quickValues.some((value) => value === '2026-08-22' || /22\s+Αυγ\s+2026/i.test(value)), `date not prefilled: ${JSON.stringify(quickValues)}`);
  assert(quickValues.some((value) => Number(value) === 24.5), `amount not prefilled: ${JSON.stringify(quickValues)}`);
  const submitClicked = await c.call("function(){const button=[...document.querySelectorAll('.quick-modal:not(.contextual-quick-modal) .save-button')].find(node=>(node.textContent||'').includes('Καταχώριση'));button?.click();return Boolean(button)}");
  assert(submitClicked, 'normal Quick Entry submit exists');
  await waitFor("function(){return !document.querySelector('.quick-modal')}", 'normal transaction submit');
  await waitFor(`async function(){return await new Promise((resolve,reject)=>{const request=indexedDB.open('myfinhub-local-receipts-v1',1);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('receipts','readonly');const count=tx.objectStore('receipts').count();count.onsuccess=()=>{resolve(count.result===0);db.close()};count.onerror=()=>reject(count.error)};request.onerror=()=>reject(request.error)})}`, 'receipt cleanup after transaction');
  assert((await receiptCount()) === 0, 'receipt draft deleted only after normal submit');

  console.log('Receipt OCR QA: mobile inbox remains usable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await openReceiptInbox();
  const overflow = await c.call("function(){return Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}");
  assert(overflow <= 1, `mobile receipt inbox horizontal overflow ${overflow}px`);
  await screenshot('receipt-local-mobile-empty');

  console.log('Receipt local OCR rendered QA passed.');
} finally {
  c?.close();
  child.kill('SIGTERM');
  await sleep(250);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
