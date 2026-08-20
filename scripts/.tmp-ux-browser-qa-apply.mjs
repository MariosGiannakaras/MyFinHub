import { readFileSync, writeFileSync } from 'node:fs';

function replace(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Expected text not found in ${path}: ${oldText.slice(0, 140)}`);
  writeFileSync(path, source.replace(oldText, newText));
}

// Owned date/select overlays use the same Escape/focus/scroll contract.
replace('src/components/AppDateInput.tsx',
  "const ref=useModalFocus<HTMLElement>(open,value?`[data-date=\"${value}\"]`:'[data-today=\"true\"]');",
  "const ref=useModalFocus<HTMLElement>(open,value?`[data-date=\"${value}\"]`:'[data-today=\"true\"]',()=>setOpen(false));",
);
replace('src/components/AppDateInput.tsx', " onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close()}}}", '');
replace('src/components/AppDateInput.tsx', 'aria-label="Προηγούμενος μήνας" onClick', 'aria-label="Προηγούμενος μήνας" title="Προηγούμενος μήνας" onClick');
replace('src/components/AppDateInput.tsx', 'aria-label="Επόμενος μήνας" onClick', 'aria-label="Επόμενος μήνας" title="Επόμενος μήνας" onClick');
replace('src/components/AppDateInput.tsx', 'aria-label="Κλείσιμο ημερολογίου" onClick', 'aria-label="Κλείσιμο ημερολογίου" title="Κλείσιμο ημερολογίου" onClick');

replace('src/components/AppSelectInput.tsx',
  "const ref=useModalFocus<HTMLElement>(open,'[aria-selected=\"true\"]');",
  "const ref=useModalFocus<HTMLElement>(open,'[aria-selected=\"true\"]',()=>setOpen(false));",
);
replace('src/components/AppSelectInput.tsx',
  "const move=(event:KeyboardEvent<HTMLElement>)=>{if(event.key==='Escape'){event.preventDefault();close();return}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;",
  "const move=(event:KeyboardEvent<HTMLElement>)=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;",
);
replace('src/components/AppSelectInput.tsx', 'aria-label="Κλείσιμο επιλογών" onClick', 'aria-label="Κλείσιμο επιλογών" title="Κλείσιμο επιλογών" onClick');

// Keep top-right tooltips inside the viewport by opening them toward the workspace.
for (const label of ['Αναίρεση τελευταίας αλλαγής','Επαναφορά τελευταίας αναιρεμένης αλλαγής','Ανανέωση δεδομένων','Αποσύνδεση']) {
  replace('src/components/AppShell.tsx', `<Tooltip label="${label}">`, `<Tooltip label="${label}" side="left">`);
}

// QA-only data hooks for deterministic sort assertions.
replace('src/pages/TransactionsPage.tsx', '<tr key={r.id} className={`transaction-row kind-${r.kind}`}', '<tr key={r.id} data-sort-date={r.date} className={`transaction-row kind-${r.kind}`}');
replace('src/pages/TransactionsPage.tsx', '<article key={r.id} role="listitem" className={`mobile-transaction-row kind-${r.kind}`}', '<article key={r.id} data-sort-date={r.date} role="listitem" className={`mobile-transaction-row kind-${r.kind}`}');
replace('src/pages/LoansPage.tsx', '<article className={`panel neo-raised loan-list-row ${self?\'self-loan\':\'\'}`} key={loan.id}>', '<article className={`panel neo-raised loan-list-row ${self?\'self-loan\':\'\'}`} data-loan-remaining={remaining} key={loan.id}>');
replace('src/pages/CreditCardPage.tsx', '<tr key={event.id}><td>{shortDate(event.date)}</td><td><b>{event.note}</b></td>', '<tr key={event.id} data-sort-date={event.date}><td>{shortDate(event.date)}</td><td><b>{event.note}</b></td>');
replace('src/pages/CreditCardPage.tsx', '<tr key={event.id}><td>{shortDate(event.date)}</td><td>{event.fromAccountId?', '<tr key={event.id} data-sort-date={event.date}><td>{shortDate(event.date)}</td><td>{event.fromAccountId?');

// Broader typography/readability without touching the locked payment-card geometry.
const cssPath='src/styles/part30.css';
let css=readFileSync(cssPath,'utf8');
css=css.replace('@media(max-width:720px){\n  .text-size-picker{grid-template-columns:1fr}\n  .app-tooltip-bubble{display:none}\n}', '@media(max-width:720px){\n  .text-size-picker{grid-template-columns:1fr}\n}');
css += `\n.workspace,.modal-backdrop,.editor-backdrop,.picker-backdrop,.owned-popover-backdrop{font-size:var(--ux-body-size)}\n.panel,.semantic-table,.settings-form,.filterbar,.loan-toolbar,.action-status,.form-error,.empty-state,.empty-inline,.logic-note{line-height:1.45}\n.semantic-table{font-size:var(--ux-small-size)}\n.semantic-table th{font-size:var(--ux-tiny-size);line-height:1.35}\n.semantic-table td small,.panel small,.empty-state,.empty-inline,.logic-note,.action-status,.form-error{font-size:var(--ux-small-size)}\n.settings-form label>span,.filter-label>span{font-size:var(--ux-small-size)}\n.settings-form input,.settings-form textarea,.owned-input,.filterbar input{font-size:var(--ux-body-size);min-height:38px}\n@media(max-width:720px){.workspace{font-size:var(--ux-body-size)}.mobile-row-actions button,.mobile-recurring-actions button,.mobile-nav button{min-height:40px}.app-tooltip-bubble{max-width:min(220px,80vw)}}\n`;
writeFileSync(cssPath,css);

// Capture browser screenshots and assert the new interaction contracts.
replace('scripts/frontend-redesign-qa.mjs',
  "import { spawn, execFileSync } from 'node:child_process';\n",
  "import { spawn, execFileSync } from 'node:child_process';\nimport { mkdirSync, writeFileSync } from 'node:fs';\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');\n",
  "  const c=new Cdp(target.webSocketDebuggerUrl);await c.open();await c.send('Page.enable');await c.send('Runtime.enable');mkdirSync('qa-artifacts',{recursive:true});const screenshot=async name=>{const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`qa-artifacts/${name}.png`,Buffer.from(shot.data,'base64'))};const pressEscape=async()=>{await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'})};\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  assert(await c.eval(\"getComputedStyle(document.querySelector('.sidebar')).display!=='none'\"),'desktop sidebar remains visible');assert(await c.eval(\"getComputedStyle(document.querySelector('.mobile-nav')).display==='none'\"),'mobile dock hidden on desktop');\n",
  "  assert(await c.eval(\"getComputedStyle(document.querySelector('.sidebar')).display!=='none'\"),'desktop sidebar remains visible');assert(await c.eval(\"getComputedStyle(document.querySelector('.mobile-nav')).display==='none'\"),'mobile dock hidden on desktop');await screenshot('desktop-dashboard.png');const tooltipFocused=await c.eval(\"(()=>{const b=document.querySelector('button[aria-label=\\\"Ανανέωση δεδομένων\\\"]');if(!b)return false;b.focus();return true})()\");assert(tooltipFocused,'refresh tooltip target exists');await sleep(80);assert(await c.eval(\"(()=>{const t=document.querySelector('.app-tooltip:focus-within .app-tooltip-bubble');if(!t)return false;const r=t.getBoundingClientRect();return getComputedStyle(t).visibility==='visible'&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()\"),'focused icon tooltip is visible and inside viewport');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  await clickText('.sidebar nav button','Κάρτες');await waitHeading('Κάρτες');assert(await c.eval(\"getComputedStyle(document.querySelector('.cards-prototype-workspace')).display!=='none'&&document.querySelectorAll('.cards-bank-column').length>=5\"),'desktop Cards prototype workspace remains active');assert(await c.eval(\"Boolean(document.querySelector('.cards-prototype-workspace .r-payment-card'))\"),'desktop interactive card surface is rendered');\n",
  "  await clickText('.sidebar nav button','Κάρτες');await waitHeading('Κάρτες');assert(await c.eval(\"getComputedStyle(document.querySelector('.cards-prototype-workspace')).display!=='none'&&document.querySelectorAll('.cards-bank-column').length>=5\"),'desktop Cards prototype workspace remains active');assert(await c.eval(\"Boolean(document.querySelector('.cards-prototype-workspace .r-payment-card'))\"),'desktop interactive card surface is rendered');await screenshot('desktop-cards.png');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  await clickText('.sidebar nav button','Δόσεις & Δάνεια');await waitHeading('Δόσεις & Δάνεια');assert(await c.eval(\"document.querySelectorAll('.loan-list-row').length>=2\"),'desktop loan list remains operational');\n",
  "  await clickText('.sidebar nav button','Δόσεις & Δάνεια');await waitHeading('Δόσεις & Δάνεια');assert(await c.eval(\"document.querySelectorAll('.loan-list-row').length>=2\"),'desktop loan list remains operational');assert(await c.eval(\"document.querySelectorAll('.loan-toolbar .sort-direction-control button').length===2\"),'loans expose explicit ASC/DESC');await clickText('.loan-toolbar .sort-direction-control button','ASC');assert(await c.eval(\"(()=>{const v=[...document.querySelectorAll('.loan-list-row')].map(n=>Number(n.dataset.loanRemaining));return v.length>=2&&v[0]<=v[v.length-1]})()\"),'loan ASC order follows remaining installments');await clickText('.loan-toolbar .sort-direction-control button','DESC');assert(await c.eval(\"(()=>{const v=[...document.querySelectorAll('.loan-list-row')].map(n=>Number(n.dataset.loanRemaining));return v.length>=2&&v[0]>=v[v.length-1]})()\"),'loan DESC order follows remaining installments');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');assert(await c.eval(\"getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden=\\\"true\\\"]')).display!=='none'\"),'desktop report chart remains visible');\n",
  "  await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');assert(await c.eval(\"getComputedStyle(document.querySelector('.panel:has(.category-icon-list)>div[aria-hidden=\\\"true\\\"]')).display!=='none'\"),'desktop report chart remains visible');await screenshot('desktop-reports.png');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  assert(await c.call(\"function(){const input=document.querySelector('.account-name-grid input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'QA AUTOSAVE');input.dispatchEvent(new Event('input',{bubbles:true}));return true}\"),'settings autosave input can be edited');await sleep(100);await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');assert(await c.eval(\"document.querySelector('.account-name-grid input')?.value==='QA AUTOSAVE'\"),'settings edit persisted without Apply');\n",
  "  assert(await c.call(\"function(){const input=document.querySelector('.account-name-grid input');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'QA AUTOSAVE');input.dispatchEvent(new Event('input',{bubbles:true}));return true}\"),'settings autosave input can be edited');await sleep(100);await clickText('.sidebar nav button','Αναφορές');await waitHeading('Αναφορές');await clickText('.sidebar nav button','Ρυθμίσεις');await waitHeading('Ρυθμίσεις');assert(await c.eval(\"document.querySelector('.account-name-grid input')?.value==='QA AUTOSAVE'\"),'settings edit persisted without Apply');const normalHeading=Number(await c.eval(\"parseFloat(getComputedStyle(document.querySelector('.page-heading h1')).fontSize)\"));await clickText('.text-size-picker button','Μεγάλο');await waitFor(\"function(){return document.documentElement.dataset.textSize==='large'}\",'large text mode');const largeHeading=Number(await c.eval(\"parseFloat(getComputedStyle(document.querySelector('.page-heading h1')).fontSize)\"));assert(largeHeading>normalHeading,'large text mode increases heading size');await noOverflow('Settings large text');await screenshot('desktop-settings-large.png');await clickText('.text-size-picker button','Κανονικό');await waitFor(\"function(){return document.documentElement.dataset.textSize==='normal'}\",'normal text mode restored');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  await clickText('.mobile-nav button','Συναλλαγές');await waitHeading('Συναλλαγές');await noOverflow('Transactions 375');assert(await c.eval(\"getComputedStyle(document.querySelector('.mobile-transaction-list')).display!=='none'&&getComputedStyle(document.querySelector('.desktop-finance-table')).display==='none'\"),'mobile transactions feed active');\n",
  "  await clickText('.mobile-nav button','Συναλλαγές');await waitHeading('Συναλλαγές');await noOverflow('Transactions 375');assert(await c.eval(\"getComputedStyle(document.querySelector('.mobile-transaction-list')).display!=='none'&&getComputedStyle(document.querySelector('.desktop-finance-table')).display==='none'\"),'mobile transactions feed active');await clickText('.sort-direction-control button','ASC');assert(await c.eval(\"(()=>{const v=[...document.querySelectorAll('.mobile-transaction-row')].map(n=>n.dataset.sortDate);return v.length>=2&&v[0]<=v[v.length-1]})()\"),'transaction ASC order is explicit');await clickText('.sort-direction-control button','DESC');assert(await c.eval(\"(()=>{const v=[...document.querySelectorAll('.mobile-transaction-row')].map(n=>n.dataset.sortDate);return v.length>=2&&v[0]>=v[v.length-1]})()\"),'transaction DESC order is explicit');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  await clickText('.mobile-nav button','Αποταμίευση');await waitHeading('Αποταμίευση');await noOverflow('Savings 375');assert(await fullWidthStack('.savings-action-grid','.savings-action-grid>.savings-action',2),'Savings actions stack');\n",
  "  await clickText('.mobile-nav button','Αποταμίευση');await waitHeading('Αποταμίευση');await noOverflow('Savings 375');assert(await fullWidthStack('.savings-action-grid','.savings-action-grid>.savings-action',2),'Savings actions stack');await clickText('.savings-action','Μεταφορά στην άκρη');await waitFor(\"function(){return Boolean(document.querySelector('.savings-dialog'))}\",'Savings dialog');await pressEscape();await waitFor(\"function(){return !document.querySelector('.savings-dialog')}\",'Savings dialog Escape close');await clickText('.savings-action','Μεταφορά στην άκρη');await waitFor(\"function(){return Boolean(document.querySelector('.savings-dialog'))}\",'Savings dialog reopen');assert(await c.eval(\"(()=>{const b=document.querySelector('.editor-backdrop');if(!b)return false;b.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));return true})()\"),'Savings backdrop can be activated');await waitFor(\"function(){return !document.querySelector('.savings-dialog')}\",'Savings dialog backdrop close');\n",
);
replace('scripts/frontend-redesign-qa.mjs',
  "  await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες');await noOverflow('Cards 375');assert(await c.eval(\"['auto','scroll'].includes(getComputedStyle(document.querySelector('.cards-prototype-workspace')).overflowX)\"),'Cards banks stay in contained horizontal rail');assert(await c.eval(\"document.querySelector('.r-payment-card').getBoundingClientRect().width<=window.innerWidth-24\"),'interactive payment card fits phone viewport');\n",
  "  await clickText('.mobile-nav button','Κάρτες');await waitHeading('Κάρτες');await noOverflow('Cards 375');assert(await c.eval(\"['auto','scroll'].includes(getComputedStyle(document.querySelector('.cards-prototype-workspace')).overflowX)\"),'Cards banks stay in contained horizontal rail');assert(await c.eval(\"document.querySelector('.r-payment-card').getBoundingClientRect().width<=window.innerWidth-24\"),'interactive payment card fits phone viewport');await screenshot('mobile-cards-375.png');\n",
);

// CI publishes the screenshots from the real rendered-browser pass.
replace('.github/workflows/ci.yml',
  "          npm run qa:frontend\n",
  "          npm run qa:frontend\n      - name: Upload rendered browser QA evidence\n        if: always()\n        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0 # v7.0.1\n        with:\n          name: myfinhub-browser-qa-${{ github.sha }}\n          path: qa-artifacts/\n          if-no-files-found: ignore\n          retention-days: 14\n",
);

console.log('Browser visual QA and owned-overlay hardening applied.');
