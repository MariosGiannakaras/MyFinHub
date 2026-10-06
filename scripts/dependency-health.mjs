import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, '.dependency-health');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const scopes = [
  { name: 'root', label: 'Root web/server', cwd: root, packagePath: path.join(root, 'package.json') },
  { name: 'api', label: 'Vercel API', cwd: path.join(root, 'api'), packagePath: path.join(root, 'api', 'package.json') },
  { name: 'desktop', label: 'Windows desktop', cwd: path.join(root, 'desktop'), packagePath: path.join(root, 'desktop', 'package.json') },
];

function runNpm(args, cwd) {
  return spawnSync(npmCommand, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_UPDATE_NOTIFIER: '1',
      npm_config_update_notifier: 'false',
      npm_config_fund: 'false',
    },
    maxBuffer: 10 * 1024 * 1024,
  });
}

function parseJson(text, fallback = {}) {
  const value = String(text ?? '').trim();
  if (!value) return fallback;
  return JSON.parse(value);
}

function semverParts(value) {
  const match = String(value ?? '').match(/v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function updateKind(current, latest) {
  const a = semverParts(current);
  const b = semverParts(latest);
  if (!a || !b) return 'unknown';
  if (b[0] !== a[0]) return 'major';
  if (b[1] !== a[1]) return 'minor';
  if (b[2] !== a[2]) return 'patch';
  return 'current';
}

function escapeCell(value) {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function getLatestNodeStatus(expectedMajor) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://nodejs.org/dist/index.json', {
      headers: { 'User-Agent': 'MyFinHub-dependency-health' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Node release index returned HTTP ' + response.status);
    const releases = await response.json();
    const expected = releases.find((entry) => semverParts(entry.version)?.[0] === expectedMajor);
    const latestLts = releases.find((entry) => Boolean(entry.lts));
    return {
      latestExpectedMajor: expected?.version ?? null,
      latestLts: latestLts?.version ?? null,
      latestLtsName: latestLts?.lts ?? null,
      latestLtsMajor: semverParts(latestLts?.version)?.[0] ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

await mkdir(outputDir, { recursive: true });

const generatedAt = new Date().toISOString();
const nvmrc = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim();
const expectedMajor = Number.parseInt(nvmrc, 10);
const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const apiPackage = JSON.parse(await readFile(path.join(root, 'api', 'package.json'), 'utf8'));

const report = {
  generatedAt,
  attentionRequired: false,
  errors: [],
  node: {
    nvmrc,
    processVersion: process.version,
    rootEngine: rootPackage.engines?.node ?? null,
    apiEngine: apiPackage.engines?.node ?? null,
    latestExpectedMajor: null,
    latestLts: null,
    latestLtsName: null,
    latestLtsMajor: null,
  },
  scopes: [],
};

const runtimeMajor = semverParts(process.version)?.[0] ?? null;
if (!Number.isInteger(expectedMajor)) {
  report.errors.push('Invalid .nvmrc value: ' + nvmrc);
  report.attentionRequired = true;
}
if (runtimeMajor !== expectedMajor) {
  report.errors.push('Workflow runtime ' + process.version + ' does not match .nvmrc major ' + expectedMajor + '.');
  report.attentionRequired = true;
}
if (rootPackage.engines?.node !== expectedMajor + '.x') {
  report.errors.push('Root package engine ' + (rootPackage.engines?.node ?? 'missing') + ' does not match ' + expectedMajor + '.x.');
  report.attentionRequired = true;
}
if (apiPackage.engines?.node !== expectedMajor + '.x') {
  report.errors.push('API package engine ' + (apiPackage.engines?.node ?? 'missing') + ' does not match ' + expectedMajor + '.x.');
  report.attentionRequired = true;
}

try {
  Object.assign(report.node, await getLatestNodeStatus(expectedMajor));
  if (report.node.latestLtsMajor && report.node.latestLtsMajor > expectedMajor) {
    report.attentionRequired = true;
  }
} catch (error) {
  report.errors.push('Unable to query Node.js releases: ' + (error instanceof Error ? error.message : String(error)));
  report.attentionRequired = true;
}

for (const scope of scopes) {
  const pkg = JSON.parse(await readFile(scope.packagePath, 'utf8'));
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);

  const outdatedRun = runNpm(['outdated', '--json', '--long'], scope.cwd);
  if (![0, 1].includes(outdatedRun.status ?? -1)) {
    report.errors.push(scope.label + ': npm outdated failed with exit ' + (outdatedRun.status ?? 'unknown') + ': ' + outdatedRun.stderr.trim());
  }

  let outdatedRaw = {};
  try {
    outdatedRaw = parseJson(outdatedRun.stdout, {});
  } catch (error) {
    report.errors.push(scope.label + ': could not parse npm outdated JSON: ' + (error instanceof Error ? error.message : String(error)));
  }

  const updates = Object.entries(outdatedRaw)
    .filter(([name, info]) => declared.has(name) && info && typeof info === 'object')
    .map(([name, info]) => ({
      name,
      current: info.current ?? null,
      wanted: info.wanted ?? null,
      latest: info.latest ?? null,
      kind: updateKind(info.current, info.latest),
      packageType: info.packageType ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const auditRun = runNpm(['audit', '--json', '--audit-level=high'], scope.cwd);
  if (![0, 1].includes(auditRun.status ?? -1)) {
    report.errors.push(scope.label + ': npm audit failed with exit ' + (auditRun.status ?? 'unknown') + ': ' + auditRun.stderr.trim());
  }

  let audit = {};
  try {
    audit = parseJson(auditRun.stdout, {});
  } catch (error) {
    report.errors.push(scope.label + ': could not parse npm audit JSON: ' + (error instanceof Error ? error.message : String(error)));
  }

  const vulnerabilities = {
    info: Number(audit.metadata?.vulnerabilities?.info ?? 0),
    low: Number(audit.metadata?.vulnerabilities?.low ?? 0),
    moderate: Number(audit.metadata?.vulnerabilities?.moderate ?? 0),
    high: Number(audit.metadata?.vulnerabilities?.high ?? 0),
    critical: Number(audit.metadata?.vulnerabilities?.critical ?? 0),
    total: Number(audit.metadata?.vulnerabilities?.total ?? 0),
  };

  if (updates.length > 0 || vulnerabilities.high > 0 || vulnerabilities.critical > 0) {
    report.attentionRequired = true;
  }

  report.scopes.push({
    name: scope.name,
    label: scope.label,
    updates,
    vulnerabilities,
  });
}

if (report.errors.length > 0) report.attentionRequired = true;

const lines = [
  '# MyFinHub dependency/runtime health',
  '',
  'Generated: ' + generatedAt,
  '',
  '> Informational, read-only check. No dependency manifests, lockfiles, source files, releases, deployments, or databases were modified.',
  '',
  '**Result:** ' + (report.attentionRequired ? 'ATTENTION REQUIRED' : 'CLEAN'),
  '',
  '## Node.js runtime',
  '',
  '| Check | Value |',
  '| --- | --- |',
  '| Repository baseline | ' + escapeCell(expectedMajor + '.x') + ' |',
  '| Workflow runtime | ' + escapeCell(process.version) + ' |',
  '| Root engine | ' + escapeCell(report.node.rootEngine) + ' |',
  '| API engine | ' + escapeCell(report.node.apiEngine) + ' |',
  '| Latest ' + expectedMajor + '.x release | ' + escapeCell(report.node.latestExpectedMajor) + ' |',
  '| Latest LTS | ' + escapeCell(report.node.latestLts ? report.node.latestLts + ' (' + (report.node.latestLtsName ?? 'LTS') + ')' : null) + ' |',
  '',
];

if (report.node.latestLtsMajor && report.node.latestLtsMajor > expectedMajor) {
  lines.push('A newer Node.js LTS major (' + report.node.latestLtsMajor + ') is available and requires an explicit compatibility review.');
  lines.push('');
}

for (const scope of report.scopes) {
  lines.push('## ' + scope.label);
  lines.push('');
  if (scope.updates.length === 0) {
    lines.push('No direct dependency updates detected.');
  } else {
    lines.push('| Package | Current | Wanted | Latest | Change |');
    lines.push('| --- | ---: | ---: | ---: | --- |');
    for (const item of scope.updates) {
      lines.push('| ' + escapeCell(item.name) + ' | ' + escapeCell(item.current) + ' | ' + escapeCell(item.wanted) + ' | ' + escapeCell(item.latest) + ' | ' + escapeCell(item.kind) + ' |');
    }
  }
  lines.push('');
  lines.push('Security audit: ' + scope.vulnerabilities.critical + ' critical · ' + scope.vulnerabilities.high + ' high · ' + scope.vulnerabilities.moderate + ' moderate · ' + scope.vulnerabilities.low + ' low.');
  lines.push('');
}

if (report.errors.length > 0) {
  lines.push('## Check errors');
  lines.push('');
  for (const error of report.errors) lines.push('- ' + error);
  lines.push('');
}

lines.push('Major-version updates are review candidates only; this workflow never applies them.');
lines.push('');

await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
await writeFile(path.join(outputDir, 'report.md'), lines.join('\n') + '\n', 'utf8');

console.log(lines.join('\n'));
process.exitCode = report.errors.length > 0 ? 2 : report.attentionRequired ? 1 : 0;
