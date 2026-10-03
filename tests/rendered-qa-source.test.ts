import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coordinator = readFileSync('scripts/run-rendered-qa.mjs', 'utf8');
const hardening = readFileSync('scripts/ui-ux-hardening-qa.mjs', 'utf8');
const recovered = readFileSync('scripts/recovered-surface-qa.mjs', 'utf8');
const completionFunctional = readFileSync('scripts/completion-functional-crud-qa.mjs', 'utf8');
const largeData = readFileSync('scripts/large-data-boundaries-qa.mjs', 'utf8');
const notFoundAccessibility = readFileSync('scripts/not-found-accessibility-qa.mjs', 'utf8');
const cardVaultRuntime = readFileSync('scripts/card-vault-runtime-qa.mjs', 'utf8');
const qaWorkspace = readFileSync('src/qa.tsx', 'utf8');
const qaRunner = readFileSync('scripts/qa-script-runner.mjs', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
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