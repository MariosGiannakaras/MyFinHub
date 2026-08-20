import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const scripts = [
  { path: 'scripts/frontend-qa.mjs', profiles: ['/tmp/rheomiq-qa-chrome'] },
  { path: 'scripts/frontend-redesign-qa.mjs', profiles: ['/tmp/rheomiq-redesign-qa-chrome'] },
  { path: 'scripts/owned-controls-qa.mjs', profiles: ['/tmp/rheomiq-owned-controls-qa'] },
  { path: 'scripts/ui-ux-hardening-qa.mjs', profiles: ['/tmp/myfinhub-ui-ux-qa-chrome'] },
];

function cleanProfiles(profiles) {
  for (const profile of profiles) rmSync(profile, { recursive: true, force: true });
}

function runScript(path) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(process.execPath, [path], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
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
  return /Timed out waiting for http:\/\/127\.0\.0\.1:922\d\/json\/version/.test(output)
    || /Chrome\/Chromium is required/.test(output)
    || /ECONNREFUSED.*922\d/i.test(output);
}

for (const item of scripts) {
  cleanProfiles(item.profiles);
  let result = await runScript(item.path);
  if (result.code !== 0 && isBrowserBootstrapFailure(result.output)) {
    console.warn(`Rendered QA browser bootstrap failed for ${item.path}; cleaning the isolated profile and retrying once.`);
    cleanProfiles(item.profiles);
    result = await runScript(item.path);
  }
  cleanProfiles(item.profiles);
  if (result.code !== 0) process.exit(result.code);
}

console.log('All rendered browser QA suites passed.');
