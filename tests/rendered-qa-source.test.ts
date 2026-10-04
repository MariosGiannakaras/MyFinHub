import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coordinator = readFileSync('scripts/run-rendered-qa.mjs', 'utf8');
const hardening = readFileSync('scripts/ui-ux-hardening-qa.mjs', 'utf8');
const mobileAppShell = readFileSync('src/styles/mobile-app-shell.css', 'utf8');
const recovered = readFileSync('scripts/recovered-surface-qa.mjs', 'utf8');
const completionFunctional = readFileSync('scripts/completion-functional-crud-qa.mjs', 'utf8');
const largeData = readFileSync('scripts/large-data-boundaries-qa.mjs', 'utf8');
const notFoundAccessibility = readFileSync('scripts/not-found-accessibility-qa.mjs', 'utf8');
const cardVaultRuntime = readFileSync('scripts/card-vault-runtime-qa.mjs', 'utf8');
const desktopHostVisual = readFileSync('scripts/desktop-host-visual-qa.mjs', 'utf8');
const frontendQa = readFileSync('scripts/frontend-qa.mjs', 'utf8');
const planningQa = readFileSync('scripts/planning-forecast-qa.mjs', 'utf8');
const primitivesQa = readFileSync('scripts/primitives-adoption-qa.mjs', 'utf8');
const receiptQa = readFileSync('scripts/receipt-local-ocr-qa.mjs', 'utf8');
const settingsTabsQa = readFileSync('scripts/settings-tabs-qa.mjs', 'utf8');
const confirmDialogCss = readFileSync('src/styles/confirm-dialog.css', 'utf8');
const moneyEditDialogCss = readFileSync('src/styles/money-edit-dialog.css', 'utf8');
const receiptInboxCss = readFileSync('src/styles/receipt-inbox.css', 'utf8');
const qaWorkspace = readFileSync('src/qa.tsx', 'utf8');
const qaRunner = readFileSync('scripts/qa-script-runner.mjs', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const auditRenderedWorkflow = readFileSync('.github/workflows/audit-rendered-review.yml', 'utf8');
const finalVisualWorkflow = readFileSync('.github/workflows/final-visual-qa.yml', 'utf8');
const finalVisualTrigger = readFileSync('.audit/run-final-visual-review', 'utf8');
const finalScreenshots = readFileSync('scripts/final-screenshots-qa.mjs', 'utf8');
const refreshRouteQa = readFileSync('scripts/refresh-route-qa.mjs', 'utf8');
const qaHtml = readFileSync('qa.html', 'utf8');

describe('rendered browser QA reliability contract', () => {
  it('preflights primary Chromium through an isolated fixed headless CDP endpoint with diagnostics', () => {
    expect(coordinator).toContain("'--headless=new'");
    expect(coordinator).toContain('const port=9300+attempt');
    expect(coordinator).toContain('`--remote-debugging-port=${port}`');
    expect(coordinator).toContain("'--remote-debugging-address=127.0.0.1'");
    expect(coordinator).not.toContain('DevToolsActivePort');
    expect(coordinator).toContain('trimDiagnostics');
    expect(coordinator).toContain('Primary Chromium preflight passed');
  });

  it('retries only recognized bootstrap failures on primary before any fallback', () => {
    expect(coordinator).toContain('isBrowserBootstrapFailure(result.output)');
    expect(coordinator).toContain('retrying once with primary Chromium');
    expect(coordinator).toContain('FALLBACK ACTIVATED');
    expect(coordinator).toContain('127\\.0\\.0\\.1:9\\d{3}');
    expect(coordinator).toMatch(/process\.env\.MYFINHUB_QA_REQUIRE_PRIMARY\s*===\s*'1'/);
  });

  it('keeps the shared primitive adoption suite in the rendered merge gate',()=>{
    expect(coordinator).toContain("scripts/primitives-adoption-qa.mjs");
    expect(coordinator).toContain("/tmp/myfinhub-primitives-adoption-qa-chrome");
  });

  it('waits for the committed URL and mounted React root before rendered assertions',()=>{
    expect(hardening).toContain('location.href===target');
    expect(hardening).toContain("document.readyState!=='loading'");
    expect(hardening).toContain("Boolean(document.querySelector('#root>*'))");
    expect(qaHtml).toContain("document.querySelector('#root>*')");
    expect(qaHtml).toContain('QA React surface did not mount before document readiness.');
  });

  it('enforces primary Chromium in pull-request CI', () => {
    expect(ci).toContain('export MYFINHUB_QA_REQUIRE_PRIMARY=1');
    expect(ci).toContain('${MYFINHUB_QA_REQUIRE_PRIMARY:-0}');
  });

  it('builds and synchronizes OCR assets before starting the dedicated audit Vite server',()=>{
    const buildIndex=auditRenderedWorkflow.indexOf('- name: Build application');
    const viteIndex=auditRenderedWorkflow.indexOf('- name: Start Vite');
    expect(buildIndex).toBeGreaterThan(-1);
    expect(viteIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeLessThan(viteIndex);
    expect(auditRenderedWorkflow).toContain('run: npm run build');
    expect(auditRenderedWorkflow).toContain('npm run dev:web > /tmp/myfinhub-vite.log');
  });

  it('explicitly opts the dedicated audit workflow into persistent final screenshot capture while keeping the script fail-closed',()=>{
    const captureIndex=auditRenderedWorkflow.indexOf('- name: Capture final screenshot matrix');
    const uploadIndex=auditRenderedWorkflow.indexOf('- name: Upload assistant review evidence');
    expect(captureIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(captureIndex);
    const captureBlock=auditRenderedWorkflow.slice(captureIndex,uploadIndex);
    expect(captureBlock).toContain("MYFINHUB_FINAL_SCREENSHOTS: '1'");
    expect(captureBlock).toContain('run: npm run qa:final-screenshots');
    expect(finalScreenshots).toContain("process.env.MYFINHUB_FINAL_SCREENSHOTS!=='1'");
    expect(finalScreenshots).toContain('Final screenshot capture requires MYFINHUB_FINAL_SCREENSHOTS=1.');
  });
  it('runs persistent Final Visual QA once from the canonical develop squash-merge marker',()=>{
    expect(finalVisualWorkflow).toContain('push:');
    expect(finalVisualWorkflow).toContain('branches: [develop]');
    expect(finalVisualWorkflow).toContain("- '.audit/run-final-visual-review'");
    expect(finalVisualWorkflow).toContain("github.event_name == 'push'");
    expect(finalVisualWorkflow).toContain("TARGET_BRANCH: ${{ github.event.pull_request.head.ref || github.ref_name }}");
    expect(finalVisualWorkflow).toContain("EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}");
    expect(finalVisualTrigger).toContain('issue-476 post-squash canonical-develop final visual release inspection');
  });
  it('records the in-place refresh transition atomically before the transient skeleton can disappear',()=>{
    expect(refreshRouteQa).toContain("const key='__MYFINHUB_REFRESH_ROUTE_QA__'");
    expect(refreshRouteQa).toContain('const observer=new MutationObserver(sample)');
    expect(refreshRouteQa).toContain("snapshot.skeletonPage==='reports'");
    expect(refreshRouteQa).toContain("snapshot.refreshDisabled");
    expect(refreshRouteQa).toContain("globalThis.__MYFINHUB_REFRESH_ROUTE_QA__?.record?.observed");
    expect(refreshRouteQa).toContain("observer?.disconnect?.()");
    expect(refreshRouteQa).not.toContain("await waitFor(\"function(){return Boolean(document.querySelector('.page-skeleton[role=\\\"status\\\"][aria-label=\\\"Ανανέωση δεδομένων\\\"]'))}\",'in-place PageSkeleton')");
  });
  it('parallelizes independent rendered suites while serializing shared fixed CDP ports',()=>{
    expect(coordinator).toContain("MYFINHUB_QA_PARALLELISM||3");
    expect(coordinator).toContain('const activePorts=new Set()');
    expect(coordinator).toContain('await acquirePort(port)');
    expect(coordinator).toContain('releasePort(port)');
    expect(coordinator).toContain('Promise.all(Array.from({length:Math.min(parallelism,scripts.length)}');
  });

  it('waits for the lazy-resource error boundary to receive focus before checking redacted copy',()=>{
    expect(recovered).toContain("'lazy resource error focus'");
    expect(recovered).toContain('document.activeElement===error');
    expect(recovered).toContain("'lazy resource failure is redacted'");
    expect(recovered).not.toContain("'lazy resource failure is redacted and focusable'");
  });
  it('keeps focused 404 accessibility verification in the rendered gate',()=>{
    expect(coordinator).toContain("scripts/not-found-accessibility-qa.mjs");
    expect(coordinator).toContain("/tmp/myfinhub-not-found-accessibility-qa-chrome");
    expect(notFoundAccessibility).toContain("import('/src/lib/theme.ts')");
    expect(notFoundAccessibility).toContain("mod.applyThemePreference(pref)");
    expect(notFoundAccessibility).toContain("darkTheme.canvas!==lightTheme.canvas");
    expect(notFoundAccessibility).not.toContain("document.documentElement.dataset.theme='dark'");
  });

  it('keeps real Desktop lock, update and startup-recovery surfaces in focused rendered evidence',()=>{
    expect(coordinator).toContain("scripts/desktop-host-visual-qa.mjs");
    expect(coordinator).toContain("surface:'desktop-host'");
    expect(qaHtml).toContain("params.get('screen')==='desktop-lock'");
    expect(qaHtml).toContain("params.get('desktop-update')");
    expect(qaWorkspace).toContain("screen==='desktop-lock'");
    expect(desktopHostVisual).toContain("/desktop/setup.html");
    expect(desktopHostVisual).toContain('desktop-app-lock-invalid-pin-1440x930');
    expect(desktopHostVisual).toContain('desktop-update-downloading-1100x760');
    expect(desktopHostVisual).toContain('desktop-startup-recovery-min-620x650');
    expect(desktopHostVisual).toContain('BACKEND_STARTUP_TIMEOUT');
    expect(desktopHostVisual).toContain('desktop-update-up-to-date-1440x930');
    expect(hardening).toContain('desktop-persistence-saving');
    expect(hardening).toContain('desktop-refresh-hover-tooltip');
    expect(hardening).toContain("matches(':active')");
    expect(hardening).toContain('desktop-date-popover-open');
    expect(hardening).toContain('desktop-dialog-${page}');
    expect(hardening).toContain('desktop-validation-bank');
    expect(qaWorkspace).toContain("params.get('state')==='minimal'");
    expect(qaWorkspace).toContain('retainedCardIds.has(event.cardId)');
    expect(qaWorkspace).toContain('retainedStatementIds.has(event.statementId)');
    expect(qaWorkspace).toContain('onePerKind.slice(0,8)');
    expect(hardening).toContain("state:'minimal',shot:true");
    expect(hardening).toContain("state:'empty',shot:true");
    expect(hardening).toContain("state:'extreme',shot:true");
    expect(mobileAppShell).toContain('.mobile-brand .brand-mark-copy{display:none}');
    expect(hardening).toContain("document.querySelector('.mobile-brand .brand-mark')");
    expect(hardening).toContain('mobile header brand/action collision');
    expect(hardening).toContain('desktop-dialog-${page}-opening');
    expect(hardening).toContain('desktop-dialog-${page}-settled');
    expect(completionFunctional).toContain('confirm-transaction-delete');
    expect(completionFunctional).toContain('confirm-savings-goal-delete');
    expect(completionFunctional).toContain('confirm-self-loan-forgiveness');
    expect(completionFunctional).toContain('confirm-card-permanent-delete');
    expect(completionFunctional).toContain('confirm-account-delete');
    expect(planningQa).toContain('confirm-planning-skip');
    expect(planningQa).toContain('confirm-planning-cancel');
    expect(primitivesQa).toContain('confirm-quick-entry-discard');
    expect(primitivesQa).toContain('dialog-money-edit-validation-mobile');
    expect(primitivesQa).toContain('confirm-credit-event-delete-mobile');
    expect(frontendQa).toContain('confirm-credit-card-total-delete');
    expect(receiptQa).toContain('confirm-receipt-delete');
    expect(settingsTabsQa).toContain('settings-device-revoke-confirm-desktop');
    expect(settingsTabsQa).toContain('settings-device-revoke-busy-desktop');
    expect(settingsTabsQa).toContain('settings-device-revoke-failure-desktop');
    expect(qaHtml).toContain("QA_DEVICE_REVOKE_UNAVAILABLE");
    expect(settingsTabsQa).toContain('settings-json-import-confirm-desktop');
    expect(frontendQa).toContain('confirm-persistence-recovery-mobile');
    expect(qaWorkspace).toContain('title="Φόρτωση τελευταίας αποθηκευμένης έκδοσης;"');
    expect(qaWorkspace).toContain('onRecover={()=>setRecoverOpen(true)}');
    expect(confirmDialogCss).toContain('.quick-modal.app-confirm-dialog{background:var(--surface)!important');
    expect(moneyEditDialogCss).toContain('.quick-modal.app-money-edit-dialog{background:var(--surface)!important');
    expect(receiptInboxCss).toContain('.receipt-inbox-backdrop + .modal-backdrop{z-index:140}');
    expect(receiptQa).toContain('receipt delete confirmation renders above Receipt Inbox');
    expect(primitivesQa).toContain('dialog surface is not opaque');
    expect(settingsTabsQa).toContain("scrollIntoView({block:'center',inline:'nearest'})");
    expect(settingsTabsQa).toContain("screenshotCurrentViewport('settings-device-revoke-failure-desktop')");
  });

  it('keeps mutating validation failures in the rendered merge gate',()=>{
    expect(coordinator).toContain("scripts/mutation-validation-qa.mjs");
    expect(coordinator).toContain("key:'mutation-validation'");
    expect(coordinator).toContain("surface:'validation-errors'");
    expect(coordinator).toContain("/tmp/myfinhub-mutation-validation-qa-chrome");
  });

  it('runs every rendered module through an explicit completion wrapper with bounded child cleanup',()=>{
    expect(coordinator).toContain("['scripts/qa-script-runner.mjs',path]");
    const guard=readFileSync('scripts/qa-child-process-guard.mjs','utf8');
    expect(guard).toContain('ChildProcess.prototype.kill');
    expect(guard).toContain("originalKill.call(child,'SIGKILL')");
    expect(guard).toContain('child.unref()');
    expect(guard).toContain('drainGuardedChildren');
    expect(qaRunner).toContain('await import(pathToFileURL(resolve(target)).href)');
    expect(qaRunner).toContain('await drainGuardedChildren()');
    expect(qaRunner).toContain('process.exit(code)');
  });

  it('keeps server-vault save/reveal/update/reload/delete in rendered QA',()=>{
    expect(coordinator).toContain("scripts/card-vault-runtime-qa.mjs");
    expect(cardVaultRuntime).toContain('Card Vault runtime QA: invalid input stays local and does not write');
    expect(cardVaultRuntime).toContain("url.searchParams.set('card-vault','ready')");
    expect(qaWorkspace).toContain("params.get('card-vault')==='ready'");
    expect(qaWorkspace).toContain("vaultRef:'qa-debit-card'");
    expect(cardVaultRuntime).toContain("const giveUpTimer=setTimeout(finish,3500)");
    expect(cardVaultRuntime).toContain('Card Vault runtime QA profile cleanup deferred');
    expect(cardVaultRuntime).toContain('Page.addScriptToEvaluateOnNewDocument');
    expect(cardVaultRuntime).toContain('hard reload re-reveals server secret');
    expect(cardVaultRuntime).toContain("deleteCardSecret('qa-debit-card')");
    expect(cardVaultRuntime).toContain("calls.some(call=>call.method==='DELETE')");
  });

  it('forces final isolated Chromium suites to finish teardown instead of hanging CI after assertions pass',()=>{
    expect(largeData).toContain('async function stopBrowser(process)');
    expect(largeData).toContain('await stopBrowser(child)');
    expect(notFoundAccessibility).toContain('async function stopBrowser(process)');
    expect(notFoundAccessibility).toContain('await stopBrowser(child)');
    expect(largeData).toContain("process.kill('SIGKILL')");
    expect(notFoundAccessibility).toContain("process.kill('SIGKILL')");
  });

  it('keeps the complete Cards create/archive/restore/delete lifecycle in rendered functional QA',()=>{
    expect(completionFunctional).toContain('Completion functional QA: Cards create, archive, restore and permanent delete');
    expect(completionFunctional).toContain('__myfinhubCardLifecycleOriginalFetch');
    expect(completionFunctional).toContain("url.pathname==='/api/card-secrets'&&method==='PUT'");
    expect(completionFunctional).toContain('QA Audit Lifecycle Card');
    expect(completionFunctional).toContain('archiveLifecycleCard');
    expect(completionFunctional).toContain('Επαναφορά');
    expect(completionFunctional).toContain('Οριστική διαγραφή');
  });

});