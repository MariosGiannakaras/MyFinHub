const { app, BrowserWindow, Menu, dialog, safeStorage, session, shell, ipcMain, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const {
  StartupError,
  appendDiagnostic,
  publicStartupFailure,
  startupDiagnosticText,
} = require('./startup-diagnostics.cjs');

const PRODUCT_NAME = 'MyFinHub';
const APP_ID = 'app.myfinhub.desktop';
const LOOPBACK = '127.0.0.1';
// Compatibility contract with the existing local Express backend. Do not rename without a coordinated migration.
const READY_PREFIX = 'RHEOMIQ_DESKTOP_READY=';
const STARTUP_TIMEOUT_MS = 20_000;
const PREFLIGHT_TIMEOUT_MS = 10_000;
const SETUP_PROGRESS_CHANNEL = 'myfinhub:setup-progress';
const UPDATE_OWNER = 'MariosGiannakaras';
const UPDATE_REPOSITORIES = ['MyFinHub', 'RheomIQ'];
const UPDATE_TAG = /^myfinhub-v(\d+\.\d+\.\d+)$/i;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_INSTALLER_BYTES = 50 * 1024 * 1024;
const MAX_INSTALLER_BYTES = 350 * 1024 * 1024;
const UPDATE_HOSTS = new Set(['github.com', 'api.github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);

let mainWindow = null;
let setupWindow = null;
let backend = null;
let quitting = false;
let updateTimer = null;
let updatePromptActive = false;
let pendingRelease = null;
let downloadedInstaller = null;
let startingConfiguredApp = false;
let lastStartupFailure = null;
let updateState = { supported: process.platform === 'win32', currentVersion: app.getVersion(), status: 'idle', availableVersion: null, progress: 0, message: '' };

app.setName(PRODUCT_NAME);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else app.on('second-instance', () => {
  const target = mainWindow || setupWindow;
  if (!target) return;
  if (target.isMinimized()) target.restore();
  target.show();
  target.focus();
});

const userDataPath = name => path.join(app.getPath('userData'), name);
const legacyUserDataPath = name => path.join(app.getPath('appData'), 'RheomIQ', name);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function secureDelete(file) {
  try {
    const size = fs.statSync(file).size;
    if (size > 0 && size <= 1024 * 1024) fs.writeFileSync(file, Buffer.alloc(size));
  } catch { /* best effort */ }
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}

function normalizePublicConfig(value) {
  const rawUrl = String(value?.supabaseUrl || value?.SUPABASE_URL || '').trim();
  const publishable = String(value?.supabasePublishableKey || value?.SUPABASE_PUBLISHABLE_KEY || '').trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid Supabase URL.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) throw new Error('Supabase URL must be HTTPS.');
  if (!publishable || publishable.length > 4096 || /\s/.test(publishable)) throw new Error('Invalid Supabase publishable key.');
  if (/^sb_secret_/i.test(publishable)) {
    throw new Error('Use the Supabase publishable/anon key, never a secret/service-role key.');
  }
  if (/^eyJ/.test(publishable)) {
    try {
      const payload = JSON.parse(Buffer.from(publishable.split('.')[1] || '', 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') throw new Error('Use the Supabase publishable/anon key, never a service-role key.');
    } catch (error) {
      if (error instanceof Error && /service-role/.test(error.message)) throw error;
    }
  }
  return { supabaseUrl: parsed.toString().replace(/\/$/, ''), supabasePublishableKey: publishable };
}

function normalizeCardVaultKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (/^[0-9a-f]{64}$/i.test(key)) return key;
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) throw new Error('Invalid card-vault key.');
  return key;
}

function normalizeKeyVersion(raw) {
  const value = raw === undefined || raw === null || raw === '' ? 1 : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid card-vault key version.');
  return value;
}

function setupProgress(progress, step, message, failure = null) {
  if (!setupWindow || setupWindow.isDestroyed()) return;
  setupWindow.webContents.send(SETUP_PROGRESS_CHANNEL, {
    progress: Math.max(0, Math.min(100, Number(progress) || 0)),
    step: Math.max(1, Math.min(4, Number(step) || 1)),
    message: String(message || ''),
    error: Boolean(failure),
    failure: failure || null,
  });
}

function recordStartupFailure(error, explicitSecrets = []) {
  lastStartupFailure = publicStartupFailure(error, explicitSecrets);
  return lastStartupFailure;
}

function migrateLegacyDesktopConfig() {
  for (const name of ['runtime-config.json', 'runtime-secrets.json']) {
    const current = userDataPath(name);
    const legacy = legacyUserDataPath(name);
    if (fs.existsSync(current) || !fs.existsSync(legacy)) continue;
    try {
      fs.mkdirSync(path.dirname(current), { recursive: true });
      fs.copyFileSync(legacy, current, fs.constants.COPYFILE_EXCL);
    } catch { /* first-run UI can recover */ }
  }
}

function storeRuntimeSecrets(cardVaultKey, cardVaultKeyVersion) {
  if (!cardVaultKey) return;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new StartupError('SECURE_STORAGE_UNAVAILABLE', 'secure-storage', 'Το Windows secure storage δεν είναι διαθέσιμο.', 'Electron safeStorage/DPAPI is unavailable.');
  }
  try {
    writePrivateJson(userDataPath('runtime-secrets.json'), {
      cardVaultKey: safeStorage.encryptString(cardVaultKey).toString('base64'),
      cardVaultKeyVersion,
    });
  } catch (error) {
    if (error instanceof StartupError) throw error;
    throw new StartupError('SECURE_STORAGE_WRITE_FAILED', 'secure-storage', 'Δεν ήταν δυνατή η ασφαλής αποθήκευση του card-vault key.', error instanceof Error ? error.message : String(error), error);
  }
}

function applyPendingProvision() {
  const pending = userDataPath('pending-provision.json');
  if (!fs.existsSync(pending)) return;
  let value;
  try {
    value = readJson(pending);
    writePrivateJson(userDataPath('runtime-config.json'), normalizePublicConfig(value));
    const key = normalizeCardVaultKey(value.cardVaultKey || value.CARD_VAULT_KEY);
    if (key) storeRuntimeSecrets(key, normalizeKeyVersion(value.cardVaultKeyVersion || value.CARD_VAULT_KEY_VERSION));
  } catch (error) {
    throw new StartupError('PENDING_PROVISION_FAILED', 'configuration', 'Η αποθηκευμένη αρχική ρύθμιση δεν μπόρεσε να εφαρμοστεί.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
  } finally {
    secureDelete(pending);
    value = null;
  }
}

function runtimeConfigExists() {
  return Boolean((process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) || fs.existsSync(userDataPath('runtime-config.json')));
}

function loadRuntimeConfig() {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) return normalizePublicConfig(process.env);
    const file = userDataPath('runtime-config.json');
    if (!fs.existsSync(file)) throw new Error('Desktop runtime is not configured.');
    return normalizePublicConfig(readJson(file));
  } catch (error) {
    throw new StartupError('CONFIG_LOAD_FAILED', 'configuration', 'Οι αποθηκευμένες ρυθμίσεις σύνδεσης δεν είναι έγκυρες.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
  }
}

function storedKeyVersion() {
  if (process.env.CARD_VAULT_KEY_VERSION) {
    try { return normalizeKeyVersion(process.env.CARD_VAULT_KEY_VERSION); } catch { return 1; }
  }
  try {
    const file = userDataPath('runtime-secrets.json');
    if (!fs.existsSync(file)) return 1;
    return normalizeKeyVersion(readJson(file).cardVaultKeyVersion);
  } catch { return 1; }
}

function loadRuntimeSecrets() {
  try {
    const envKey = normalizeCardVaultKey(process.env.CARD_VAULT_KEY);
    if (envKey) return { cardVaultKey: envKey, cardVaultKeyVersion: normalizeKeyVersion(process.env.CARD_VAULT_KEY_VERSION) };
    const file = userDataPath('runtime-secrets.json');
    if (!fs.existsSync(file)) return { cardVaultKey: '', cardVaultKeyVersion: 1 };
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable.');
    const value = readJson(file);
    const encrypted = Buffer.from(String(value.cardVaultKey || ''), 'base64');
    return {
      cardVaultKey: normalizeCardVaultKey(safeStorage.decryptString(encrypted)),
      cardVaultKeyVersion: normalizeKeyVersion(value.cardVaultKeyVersion),
    };
  } catch (error) {
    throw new StartupError('SECURE_STORAGE_READ_FAILED', 'secure-storage', 'Δεν ήταν δυνατή η ανάγνωση των προστατευμένων desktop ρυθμίσεων.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
  }
}

async function preflightSupabase(config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: config.supabasePublishableKey,
        accept: 'application/json',
      },
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new StartupError('SUPABASE_PREFLIGHT_REJECTED', 'connection', 'Το Supabase URL ή το publishable key απορρίφθηκε.', `Supabase preflight returned HTTP ${response.status}.`);
    }
    if (!response.ok) {
      throw new StartupError('SUPABASE_PREFLIGHT_UNAVAILABLE', 'connection', 'Το Supabase project δεν απάντησε κανονικά.', `Supabase preflight returned HTTP ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof StartupError) throw error;
    if (controller.signal.aborted) {
      throw new StartupError('SUPABASE_PREFLIGHT_TIMEOUT', 'connection', 'Ο έλεγχος σύνδεσης με το Supabase έληξε λόγω timeout.', `No response within ${PREFLIGHT_TIMEOUT_MS / 1000} seconds.`, error instanceof Error ? error : null);
    }
    throw new StartupError('SUPABASE_PREFLIGHT_FAILED', 'connection', 'Δεν ήταν δυνατή η σύνδεση με το Supabase project.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
  } finally {
    clearTimeout(timeout);
  }
}

function runtimePaths() {
  if (app.isPackaged) {
    const root = path.join(process.resourcesPath, 'app');
    return {
      node: path.join(root, 'runtime', 'node.exe'),
      server: path.join(root, 'server', 'server.mjs'),
      dist: path.join(root, 'dist'),
      icon: path.join(root, 'icon.png'),
    };
  }
  const root = path.resolve(__dirname, '..');
  return {
    node: process.env.RHEOMIQ_DESKTOP_NODE || '',
    server: process.env.RHEOMIQ_DESKTOP_SERVER || path.join(__dirname, '.build', 'server', 'server.mjs'),
    dist: path.join(root, 'dist'),
    icon: path.join(root, 'public', 'brand', 'icon-512.png'),
  };
}

function childEnvironment(config, secrets, dist) {
  const env = { ...process.env };
  delete env.SUPABASE_SECRET_KEY;
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  delete env.VERCEL;
  env.NODE_ENV = 'production';
  // Legacy env names are the compatibility boundary with server/index.ts.
  env.RHEOMIQ_HOST = LOOPBACK;
  env.RHEOMIQ_PORT = '0';
  env.RHEOMIQ_DIST_DIR = dist;
  env.RHEOMIQ_DESKTOP = '1';
  env.SUPABASE_URL = config.supabaseUrl;
  env.SUPABASE_PUBLISHABLE_KEY = config.supabasePublishableKey;
  if (secrets.cardVaultKey) {
    env.CARD_VAULT_KEY = secrets.cardVaultKey;
    env.CARD_VAULT_KEY_VERSION = String(secrets.cardVaultKeyVersion);
  } else {
    delete env.CARD_VAULT_KEY;
    delete env.CARD_VAULT_KEY_VERSION;
  }
  return env;
}

async function startBackend(config, secrets) {
  const runtime = runtimePaths();
  if (!runtime.node || !fs.existsSync(runtime.node)) {
    throw new StartupError('DESKTOP_RUNTIME_MISSING', 'runtime', 'Λείπει το ενσωματωμένο Node.js runtime του MyFinHub.', 'Expected bundled runtime/node.exe is missing. Reinstall the verified MyFinHub package.');
  }
  if (!fs.existsSync(runtime.server) || !fs.existsSync(runtime.dist)) {
    throw new StartupError('DESKTOP_BUNDLE_INCOMPLETE', 'runtime', 'Η εγκατάσταση του MyFinHub δεν είναι πλήρης.', 'Expected packaged server or frontend bundle is missing. Reinstall the verified MyFinHub package.');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let diagnostic = '';
    const explicitSecrets = [config.supabasePublishableKey, secrets.cardVaultKey];
    const child = spawn(runtime.node, [runtime.server, '--serve-dist'], {
      env: childEnvironment(config, secrets, runtime.dist), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    backend = child;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* no-op */ }
      reject(new StartupError('BACKEND_STARTUP_TIMEOUT', 'backend', 'Η τοπική υπηρεσία δεν ξεκίνησε εγκαίρως.', diagnostic || `No readiness signal within ${STARTUP_TIMEOUT_MS / 1000} seconds.`));
    }, STARTUP_TIMEOUT_MS);
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => {
      if (!line.startsWith(READY_PREFIX)) {
        diagnostic = appendDiagnostic(diagnostic, line, explicitSecrets);
        return;
      }
      if (settled) return;
      const origin = line.slice(READY_PREFIX.length).trim();
      let parsed;
      try { parsed = new URL(origin); } catch {
        diagnostic = appendDiagnostic(diagnostic, 'Backend emitted an invalid readiness URL.', explicitSecrets);
        return;
      }
      if (parsed.protocol !== 'http:' || parsed.hostname !== LOOPBACK || !parsed.port) {
        diagnostic = appendDiagnostic(diagnostic, 'Backend readiness URL was not loopback-only.', explicitSecrets);
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({ origin, runtime });
    });
    child.stderr.on('data', chunk => {
      diagnostic = appendDiagnostic(diagnostic, chunk, explicitSecrets);
    });
    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new StartupError('BACKEND_SPAWN_FAILED', 'backend', 'Δεν ήταν δυνατή η εκκίνηση της τοπικής υπηρεσίας.', appendDiagnostic(diagnostic, error?.message || error, explicitSecrets), error));
    });
    child.on('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        const exitDetail = `Local backend exited during startup (code=${code ?? 'unknown'}, signal=${signal ?? 'none'}).`;
        reject(new StartupError('BACKEND_EXITED_DURING_STARTUP', 'backend', 'Η τοπική υπηρεσία τερματίστηκε κατά την εκκίνηση.', appendDiagnostic(exitDetail, diagnostic, explicitSecrets)));
      } else if (!quitting) {
        const exitDetail = `Local backend stopped after readiness (code=${code ?? 'unknown'}, signal=${signal ?? 'none'}).`;
        const failure = recordStartupFailure(new StartupError('BACKEND_STOPPED', 'backend', 'Η τοπική υπηρεσία σταμάτησε απροσδόκητα.', appendDiagnostic(exitDetail, diagnostic, explicitSecrets)), explicitSecrets);
        void recoverToSetup(failure);
      }
    });
  });
}

function configureSessionPermissions() {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
}

function hardenWindow(window, allowedOrigin = null) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' && (!allowedOrigin || target.origin !== allowedOrigin)) void shell.openExternal(target.toString());
    } catch { /* invalid URL */ }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => {
    if (allowedOrigin) {
      try { if (new URL(event.url).origin === allowedOrigin) return; } catch { /* block */ }
    }
    event.preventDefault();
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
}

function stopBackend() {
  const child = backend;
  backend = null;
  if (!child || child.killed) return;
  try { child.kill(); } catch { /* already stopped */ }
}

async function createWindow(origin, runtime) {
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({
    title: PRODUCT_NAME, width: 1440, height: 930, minWidth: 960, minHeight: 650, show: false,
    backgroundColor: '#0f1720', icon: runtime.icon, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false, devTools: !app.isPackaged,
    },
  });
  mainWindow = window;
  hardenWindow(window, origin);
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  try {
    await window.loadURL(origin);
    if (!window.isDestroyed()) window.show();
    scheduleAutomaticUpdateChecks();
  } catch (error) {
    if (!window.isDestroyed()) window.destroy();
    if (mainWindow === window) mainWindow = null;
    throw new StartupError('WINDOW_LOAD_FAILED', 'window', 'Το desktop παράθυρο δεν μπόρεσε να φορτώσει την τοπική εφαρμογή.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
  }
}

function createSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) { setupWindow.show(); setupWindow.focus(); return; }
  Menu.setApplicationMenu(null);
  const runtime = runtimePaths();
  setupWindow = new BrowserWindow({
    title: `${PRODUCT_NAME} — Αρχική ρύθμιση`, width: 760, height: 820, minWidth: 620, minHeight: 650,
    show: false, backgroundColor: '#0f1720', icon: runtime.icon, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, devTools: !app.isPackaged,
    },
  });
  hardenWindow(setupWindow);
  setupWindow.once('ready-to-show', () => setupWindow?.show());
  setupWindow.on('closed', () => { setupWindow = null; });
  void setupWindow.loadFile(path.join(__dirname, 'setup.html'));
}

async function recoverToSetup(failure) {
  stopBackend();
  lastStartupFailure = failure || lastStartupFailure;
  createSetupWindow();
  setupProgress(8, 1, `${lastStartupFailure?.code || 'DESKTOP_STARTUP_FAILED'} — ${lastStartupFailure?.message || 'Η εκκίνηση απέτυχε.'}`, lastStartupFailure);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
}

function sanitizedUpdateState() {
  return { ...updateState, supported: Boolean(updateState.supported && app.isPackaged) };
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('myfinhub:update-state', sanitizedUpdateState());
}

function compareVersions(a, b) {
  const parse = value => /^\d+\.\d+\.\d+$/.test(String(value)) ? String(value).split('.').map(Number) : null;
  const left = parse(a); const right = parse(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

function validateUpdateUrl(raw, repository) {
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' || !UPDATE_HOSTS.has(parsed.hostname)) throw new Error('Untrusted update URL.');
  if (parsed.hostname === 'github.com' && !parsed.pathname.startsWith(`/${UPDATE_OWNER}/${repository}/releases/download/`)) throw new Error('Unexpected GitHub update path.');
  return parsed.toString();
}

async function fetchLatestRelease() {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': `${PRODUCT_NAME}/${app.getVersion()}` };
  for (const repository of UPDATE_REPOSITORIES) {
    const response = await fetch(`https://api.github.com/repos/${UPDATE_OWNER}/${repository}/releases/latest`, { headers, redirect: 'follow' });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Update service returned ${response.status}.`);
    return { release: await response.json(), repository };
  }
  return null;
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged || process.platform !== 'win32') {
    setUpdateState({ status: 'unsupported', message: 'Οι ενημερώσεις είναι διαθέσιμες μόνο στην εγκατεστημένη έκδοση Windows.' });
    return sanitizedUpdateState();
  }
  if (['checking', 'downloading', 'installing'].includes(updateState.status)) return sanitizedUpdateState();
  setUpdateState({ status: 'checking', progress: 0, message: manual ? 'Έλεγχος για νέα έκδοση…' : '' });
  try {
    const found = await fetchLatestRelease();
    if (!found) {
      pendingRelease = null;
      setUpdateState({ status: 'up-to-date', availableVersion: null, message: 'Δεν υπάρχει δημοσιευμένη desktop έκδοση ακόμη.' });
      if (manual && mainWindow) void dialog.showMessageBox(mainWindow, { type: 'info', title: `${PRODUCT_NAME} — Ενημερώσεις`, message: 'Δεν υπάρχει δημοσιευμένη νεότερη έκδοση.' });
      return sanitizedUpdateState();
    }
    const { release, repository } = found;
    if (release.draft || release.prerelease) throw new Error('Unstable release.');
    const tag = UPDATE_TAG.exec(String(release.tag_name || ''));
    if (!tag) throw new Error('Unexpected desktop release tag.');
    const version = tag[1];
    if (compareVersions(version, app.getVersion()) <= 0) {
      pendingRelease = null;
      downloadedInstaller = null;
      setUpdateState({ status: 'up-to-date', availableVersion: null, progress: 0, message: `Έχεις ήδη την τελευταία έκδοση (${app.getVersion()}).` });
      if (manual && mainWindow) void dialog.showMessageBox(mainWindow, { type: 'info', title: `${PRODUCT_NAME} — Ενημερώσεις`, message: `Έχεις ήδη την τελευταία έκδοση (${app.getVersion()}).` });
      return sanitizedUpdateState();
    }
    const installerName = `MyFinHub-Setup-${version}-x64.exe`;
    const checksumName = `${installerName}.sha256`;
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const installer = assets.find(asset => asset?.name === installerName);
    const checksum = assets.find(asset => asset?.name === checksumName);
    if (!installer || !checksum) throw new Error('Missing installer/checksum assets.');
    if (Number(installer.size || 0) < MIN_INSTALLER_BYTES || Number(installer.size || 0) > MAX_INSTALLER_BYTES) throw new Error('Unexpected installer size.');
    pendingRelease = {
      version, repository, installerName,
      installerUrl: validateUpdateUrl(installer.browser_download_url, repository),
      checksumUrl: validateUpdateUrl(checksum.browser_download_url, repository),
    };
    downloadedInstaller = null;
    setUpdateState({ status: 'available', availableVersion: version, progress: 0, message: `Η έκδοση ${version} είναι διαθέσιμη.` });
    setImmediate(() => void promptForAvailableUpdate());
  } catch {
    pendingRelease = null;
    setUpdateState({ status: 'error', progress: 0, message: 'Δεν ήταν δυνατός ο ασφαλής έλεγχος ενημερώσεων.' });
  }
  return sanitizedUpdateState();
}

async function downloadText(url, maxBytes = 16 * 1024) {
  const response = await fetch(url, { headers: { 'User-Agent': `${PRODUCT_NAME}/${app.getVersion()}` }, redirect: 'follow' });
  if (!response.ok) throw new Error('Metadata download failed.');
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !UPDATE_HOSTS.has(finalUrl.hostname)) throw new Error('Untrusted redirect.');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('Metadata too large.');
  return text;
}

async function downloadBinary(url, destination, expectedHash) {
  const response = await fetch(url, { headers: { 'User-Agent': `${PRODUCT_NAME}/${app.getVersion()}` }, redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error('Installer download failed.');
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !UPDATE_HOSTS.has(finalUrl.hostname)) throw new Error('Untrusted redirect.');
  const total = Number(response.headers.get('content-length') || 0);
  if (total && (total < MIN_INSTALLER_BYTES || total > MAX_INSTALLER_BYTES)) throw new Error('Unexpected installer size.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.part`;
  try { fs.unlinkSync(temporary); } catch { /* no stale partial */ }
  const handle = await fs.promises.open(temporary, 'w', 0o600);
  const hash = crypto.createHash('sha256');
  const reader = response.body.getReader();
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      received += chunk.length;
      if (received > MAX_INSTALLER_BYTES) throw new Error('Installer exceeds size limit.');
      hash.update(chunk);
      await handle.write(chunk);
      const progress = Math.max(1, Math.min(99, Math.round((received / (total || received)) * 100)));
      setUpdateState({ progress });
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(progress / 100);
    }
  } catch (error) {
    try { await fs.promises.unlink(temporary); } catch { /* no partial */ }
    throw error;
  } finally {
    await handle.close();
  }
  if (received < MIN_INSTALLER_BYTES) throw new Error('Installer is unexpectedly small.');
  if (hash.digest('hex').toLowerCase() !== expectedHash.toLowerCase()) {
    try { await fs.promises.unlink(temporary); } catch { /* no partial */ }
    throw new Error('Checksum verification failed.');
  }
  try { fs.unlinkSync(destination); } catch { /* first download */ }
  await fs.promises.rename(temporary, destination);
  return destination;
}

async function downloadUpdate() {
  if (!pendingRelease || updateState.status !== 'available') return sanitizedUpdateState();
  setUpdateState({ status: 'downloading', progress: 1, message: `Λήψη έκδοσης ${pendingRelease.version}…` });
  try {
    const line = (await downloadText(pendingRelease.checksumUrl)).trim().split(/\r?\n/).find(Boolean) || '';
    const match = /^([a-f0-9]{64})\s+\*?(.+?)\s*$/i.exec(line);
    if (!match || match[2] !== pendingRelease.installerName) throw new Error('Invalid checksum metadata.');
    downloadedInstaller = await downloadBinary(pendingRelease.installerUrl, path.join(userDataPath('updates'), pendingRelease.installerName), match[1]);
    setUpdateState({ status: 'ready', progress: 100, message: `Η έκδοση ${pendingRelease.version} είναι έτοιμη.` });
  } catch {
    downloadedInstaller = null;
    setUpdateState({ status: 'error', progress: 0, message: 'Η λήψη ή επαλήθευση απέτυχε. Δεν εγκαταστάθηκε τίποτα.' });
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(-1);
  }
  return sanitizedUpdateState();
}

function powershellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function installDownloadedUpdate() {
  if (!downloadedInstaller || updateState.status !== 'ready' || !fs.existsSync(downloadedInstaller)) throw new Error('No verified update is ready.');
  const currentExe = process.execPath;
  const command = [
    'Start-Sleep -Milliseconds 1500',
    `$setup = Start-Process -FilePath ${powershellLiteral(downloadedInstaller)} -ArgumentList '/S' -PassThru -Wait`,
    `if ($setup.ExitCode -eq 0) { Start-Process -FilePath ${powershellLiteral(currentExe)} }`,
  ].join('; ');
  const helper = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', command], { detached: true, stdio: 'ignore', windowsHide: true });
  helper.unref();
  setUpdateState({ status: 'installing', message: 'Εγκατάσταση ενημέρωσης και επανεκκίνηση…' });
  quitting = true;
  stopBackend();
  setTimeout(() => app.quit(), 100);
  return sanitizedUpdateState();
}

async function promptForAvailableUpdate() {
  if (updatePromptActive || !mainWindow || mainWindow.isDestroyed() || !pendingRelease || updateState.status !== 'available') return;
  updatePromptActive = true;
  try {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'info', title: `${PRODUCT_NAME} — Ενημέρωση`, message: `Νέα έκδοση ${pendingRelease.version}`,
      detail: 'Θα ληφθεί από το επίσημο GitHub Release και θα επαληθευτεί με SHA-256 πριν γίνει διαθέσιμη για εγκατάσταση.',
      buttons: ['Λήψη ενημέρωσης', 'Αργότερα'], defaultId: 0, cancelId: 1, noLink: true,
    });
    if (choice.response !== 0) return;
    await downloadUpdate();
    if (updateState.status !== 'ready' || !downloadedInstaller || !mainWindow || mainWindow.isDestroyed()) return;
    const install = await dialog.showMessageBox(mainWindow, {
      type: 'info', title: `${PRODUCT_NAME} — Έτοιμη ενημέρωση`, message: `Η έκδοση ${pendingRelease.version} είναι έτοιμη`,
      detail: 'Το MyFinHub θα κλείσει, θα εγκαταστήσει την επαληθευμένη ενημέρωση και θα ανοίξει ξανά. Χωρίς πληρωμένο Windows certificate μπορεί να εμφανιστεί Unknown publisher / SmartScreen.',
      buttons: ['Εγκατάσταση & επανεκκίνηση', 'Αργότερα'], defaultId: 0, cancelId: 1, noLink: true,
    });
    if (install.response === 0) installDownloadedUpdate();
  } finally {
    updatePromptActive = false;
  }
}

function scheduleAutomaticUpdateChecks() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  if (updateTimer) clearInterval(updateTimer);
  setTimeout(() => void checkForUpdates(false), 5_000);
  updateTimer = setInterval(() => void checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
  updateTimer.unref?.();
}

function isMainSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);
}

function isSetupSender(event) {
  if (!setupWindow || setupWindow.isDestroyed() || event.sender !== setupWindow.webContents) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return url.protocol === 'file:' && url.pathname.toLowerCase().endsWith('/setup.html');
  } catch { return false; }
}

function getSetupState() {
  let config = { supabaseUrl: '', supabasePublishableKey: '' };
  try {
    if (runtimeConfigExists()) config = loadRuntimeConfig();
  } catch { /* setup must remain usable even with corrupt config */ }
  return {
    supabaseUrl: config.supabaseUrl || '',
    supabasePublishableKey: config.supabasePublishableKey || '',
    cardVaultKeyVersion: storedKeyVersion(),
    hasStoredCardVaultKey: Boolean(process.env.CARD_VAULT_KEY || fs.existsSync(userDataPath('runtime-secrets.json'))),
    lastStartupFailure,
  };
}

function registerIpcHandlers() {
  ipcMain.handle('myfinhub:get-info', event => {
    if (!isMainSender(event) && !isSetupSender(event)) throw new Error('Unauthorized IPC sender.');
    return { productName: PRODUCT_NAME, version: app.getVersion(), packaged: app.isPackaged };
  });
  ipcMain.handle('myfinhub:get-update-state', event => { if (!isMainSender(event)) throw new Error('Unauthorized IPC sender.'); return sanitizedUpdateState(); });
  ipcMain.handle('myfinhub:check-updates', event => { if (!isMainSender(event)) throw new Error('Unauthorized IPC sender.'); return checkForUpdates(true); });
  ipcMain.handle('myfinhub:download-update', event => { if (!isMainSender(event)) throw new Error('Unauthorized IPC sender.'); return downloadUpdate(); });
  ipcMain.handle('myfinhub:install-update', event => { if (!isMainSender(event)) throw new Error('Unauthorized IPC sender.'); return installDownloadedUpdate(); });
  ipcMain.handle('myfinhub:get-setup-state', event => {
    if (!isSetupSender(event)) throw new Error('Unauthorized IPC sender.');
    return getSetupState();
  });
  ipcMain.handle('myfinhub:copy-setup-diagnostics', event => {
    if (!isSetupSender(event)) throw new Error('Unauthorized IPC sender.');
    if (!lastStartupFailure) return { ok: false };
    clipboard.writeText(startupDiagnosticText(lastStartupFailure, app.getVersion()));
    return { ok: true };
  });
  ipcMain.handle('myfinhub:save-setup', async (event, value) => {
    if (!isSetupSender(event)) throw new Error('Unauthorized IPC sender.');
    const explicitSecrets = [value?.supabasePublishableKey, value?.cardVaultKey].filter(Boolean);
    try {
      setupProgress(12, 1, 'Έλεγχος μορφής των ρυθμίσεων…');
      let config;
      let cardVaultKey;
      let keyVersion;
      try {
        config = normalizePublicConfig(value);
        cardVaultKey = normalizeCardVaultKey(value?.cardVaultKey);
        keyVersion = normalizeKeyVersion(value?.cardVaultKeyVersion);
      } catch (error) {
        throw new StartupError('CONFIG_INVALID', 'configuration', 'Οι ρυθμίσεις δεν είναι έγκυρες.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
      }

      setupProgress(25, 1, 'Επαλήθευση Supabase URL και publishable key…');
      await preflightSupabase(config);

      setupProgress(48, 2, 'Αποθήκευση public config στον Windows λογαριασμό…');
      try {
        writePrivateJson(userDataPath('runtime-config.json'), config);
      } catch (error) {
        throw new StartupError('CONFIG_WRITE_FAILED', 'configuration', 'Δεν ήταν δυνατή η αποθήκευση των desktop ρυθμίσεων.', error instanceof Error ? error.message : String(error), error instanceof Error ? error : null);
      }

      setupProgress(60, 2, cardVaultKey ? 'Κρυπτογράφηση card-vault key με Windows DPAPI…' : 'Δεν δόθηκε νέο card-vault key — διατηρείται η υπάρχουσα ρύθμιση.');
      if (cardVaultKey) storeRuntimeSecrets(cardVaultKey, keyVersion);
      const secrets = loadRuntimeSecrets();

      setupProgress(72, 3, 'Εκκίνηση του local backend στο 127.0.0.1…');
      await startConfiguredApplication(config, secrets);
      lastStartupFailure = null;
      setupProgress(100, 4, 'Ολοκληρώθηκε. Άνοιγμα MyFinHub…');
      const currentSetup = setupWindow;
      setTimeout(() => {
        if (currentSetup && !currentSetup.isDestroyed()) currentSetup.close();
      }, 150);
      return { ok: true };
    } catch (error) {
      stopBackend();
      const failure = recordStartupFailure(error, explicitSecrets);
      setupProgress(8, 1, `${failure.code} — ${failure.message}`, failure);
      return { ok: false, error: failure };
    }
  });
}

async function startConfiguredApplication(configOverride = null, secretsOverride = null) {
  if (startingConfiguredApp || mainWindow) return;
  startingConfiguredApp = true;
  try {
    const config = configOverride || loadRuntimeConfig();
    const secrets = secretsOverride || loadRuntimeSecrets();
    const { origin, runtime } = await startBackend(config, secrets);
    await createWindow(origin, runtime);
  } catch (error) {
    stopBackend();
    throw error;
  } finally {
    startingConfiguredApp = false;
  }
}

async function launch() {
  try {
    app.setAppUserModelId(APP_ID);
    configureSessionPermissions();
    registerIpcHandlers();
    migrateLegacyDesktopConfig();
    applyPendingProvision();
    if (!runtimeConfigExists()) { createSetupWindow(); return; }
    await startConfiguredApplication();
  } catch (error) {
    const failure = recordStartupFailure(error);
    await recoverToSetup(failure);
  }
}

if (singleInstance) {
  app.whenReady().then(launch);
  app.on('before-quit', () => { quitting = true; if (updateTimer) clearInterval(updateTimer); stopBackend(); });
  app.on('window-all-closed', () => app.quit());
}
