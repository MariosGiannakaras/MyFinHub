import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

// The former frontend-redesign suite is intentionally superseded by the full
// route/state UI/UX matrix in ui-ux-hardening-qa.mjs. Keeping both active would
// duplicate coverage and pin CI to stale selectors from the pre-analytics DOM.
const scripts = [
  { path: 'scripts/frontend-qa.mjs', profiles: ['/tmp/rheomiq-qa-chrome'] },
  { path: 'scripts/owned-controls-qa.mjs', profiles: ['/tmp/rheomiq-owned-controls-qa'] },
  { path: 'scripts/ui-ux-hardening-qa.mjs', profiles: ['/tmp/myfinhub-ui-ux-qa-chrome'] },
  { path: 'scripts/ui-ux-completion-qa.mjs', profiles: ['/tmp/myfinhub-ui-completion-qa-chrome'] },
  { path: 'scripts/ui-ux-runtime-qa.mjs', profiles: ['/tmp/myfinhub-ui-runtime-qa-chrome'] },
  { path: 'scripts/ui-ux-credit-overlimit-qa.mjs', profiles: ['/tmp/myfinhub-credit-overlimit-qa-chrome'] },
  { path: 'scripts/refresh-route-qa.mjs', profiles: ['/tmp/myfinhub-refresh-route-qa-chrome'] },
  { path: 'scripts/recovered-surface-qa.mjs', profiles: ['/tmp/myfinhub-recovered-surface-qa-chrome'] },
  { path: 'scripts/reports-visual-qa.mjs', profiles: ['/tmp/myfinhub-reports-visual-qa-chrome'] },
  { path: 'scripts/brand-visual-qa.mjs', profiles: ['/tmp/myfinhub-brand-visual-qa-chrome'] },
  { path: 'scripts/planning-forecast-qa.mjs', profiles: ['/tmp/myfinhub-planning-forecast-qa-chrome'] },
  { path: 'scripts/ui-ux-visual-evidence-qa.mjs', profiles: ['/tmp/myfinhub-ui-visual-evidence-chrome'] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanProfiles(profiles) {
  for (const profile of profiles) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); }
    catch (error) {
      console.warn(`Rendered QA profile cleanup skipped for ${profile}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function trimDiagnostics(text) {
  const normalized = text.trim();
  if (!normalized) return '(no browser stderr/stdout captured)';
  return normalized.length > 6000 ? normalized.slice(-6000) : normalized;
}

function resolvePrimaryBrowser() {
  if (process.env.MYFINHUB_QA_PRIMARY_BROWSER) return process.env.MYFINHUB_QA_PRIMARY_BROWSER;
  try {
    return execFileSync('bash', ['-lc', 'command -v chromium || command -v chromium-browser || command -v google-chrome'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function stopBrowser(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function preflightBrowser(browser, attempt) {
  const profile = `/tmp/myfinhub-primary-browser-preflight-${process.pid}`;
  cleanProfiles([profile]);
  let diagnostics = '';
  let spawnError = '';
  const child = spawn(browser, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const capture = (stream) => stream?.on('data', (chunk) => {
    diagnostics += chunk.toString();
    if (diagnostics.length > 12000) diagnostics = diagnostics.slice(-12000);
  });
  capture(child.stdout);
  capture(child.stderr);
  child.on('error', (error) => { spawnError = error.stack || error.message; });

  try {
    const activePortFile = `${profile}/DevToolsActivePort`;
    for (let index = 0; index < 100; index += 1) {
      if (spawnError) throw new Error(`Primary browser spawn failed: ${spawnError}`);
      if (child.exitCode !== null) {
        throw new Error(`Primary browser exited before CDP became ready (exit ${child.exitCode}).\n${trimDiagnostics(diagnostics)}`);
      }
      if (existsSync(activePortFile)) {
        const [portLine] = readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
        const port = Number(portLine);
        if (Number.isInteger(port) && port > 0) {
          try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) {
              const version = await response.json();
              console.log(`Primary Chromium preflight passed on attempt ${attempt} via dynamic CDP port ${port}: ${version.Browser || 'browser ready'}`);
              return;
            }
          } catch {
            // DevToolsActivePort can appear just before the HTTP endpoint accepts connections.
          }
        }
      }
      await sleep(200);
    }
    throw new Error(`Primary browser did not expose a dynamic CDP endpoint within 20s.\n${trimDiagnostics(diagnostics)}`);
  } finally {
    await stopBrowser(child);
    await sleep(250);
    cleanProfiles([profile]);
  }
}

function runScript(path, useFallback = false) {
  return new Promise((resolve) => {
    let output = '';
    const env = { ...process.env, MYFINHUB_QA_USE_FALLBACK: useFallback ? '1' : '0' };
    const child = spawn(process.execPath, [path], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const forward = (stream, target) => stream.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      target.write(text);
    });
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    child.on('error', (error) => resolve({ code: 1, output: `${output}\n${error.stack || error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function isBrowserBootstrapFailure(output) {
  return /Timed out waiting for http:\/\/127\.0\.0\.1:92\d{2}\/json\/version/.test(output)
    || /Chrome\/Chromium is required/.test(output)
    || /ECONNREFUSED.*92\d{2}/i.test(output);
}

const primaryBrowser = resolvePrimaryBrowser();
const fallbackBrowser = process.env.MYFINHUB_QA_FALLBACK_BROWSER || '';
const hasDistinctFallback = Boolean(fallbackBrowser && fallbackBrowser !== primaryBrowser);
const requirePrimary = process.env.MYFINHUB_QA_REQUIRE_PRIMARY === '1';
if (!primaryBrowser) throw new Error('Chrome/Chromium is required for rendered frontend QA.');

let preflightError = null;
for (let attempt = 1; attempt <= 2; attempt += 1) {
  try {
    await preflightBrowser(primaryBrowser, attempt);
    preflightError = null;
    break;
  } catch (error) {
    preflightError = error;
    console.warn(`Primary Chromium preflight attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
    if (attempt < 2) await sleep(750);
  }
}
if (preflightError) throw preflightError;

let primaryBootstrapRetries = 0;
let fallbackActivations = 0;
for (const item of scripts) {
  cleanProfiles(item.profiles);
  let result = await runScript(item.path, false);

  if (result.code !== 0 && isBrowserBootstrapFailure(result.output)) {
    primaryBootstrapRetries += 1;
    console.warn(`Rendered QA browser bootstrap failed for ${item.path}; cleaning the isolated profile and retrying once with primary Chromium.`);
    await sleep(750);
    cleanProfiles(item.profiles);
    result = await runScript(item.path, false);
  }

  if (result.code !== 0 && isBrowserBootstrapFailure(result.output) && !requirePrimary && hasDistinctFallback) {
    fallbackActivations += 1;
    console.warn(`FALLBACK ACTIVATED for ${item.path}: primary Chromium failed twice to expose CDP; retrying once with ${fallbackBrowser}.`);
    await sleep(750);
    cleanProfiles(item.profiles);
    result = await runScript(item.path, true);
  }

  await sleep(350);
  cleanProfiles(item.profiles);
  if (result.code !== 0) process.exit(result.code);
}

if (requirePrimary && fallbackActivations !== 0) {
  throw new Error(`Primary-browser enforcement violated: ${fallbackActivations} fallback activation(s).`);
}
console.log(`All rendered browser QA suites passed on primary Chromium. Primary bootstrap retries: ${primaryBootstrapRetries}; fallback activations: ${fallbackActivations}.`);
