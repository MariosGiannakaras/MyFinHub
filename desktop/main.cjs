const { app, BrowserWindow, Menu, dialog, safeStorage, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const LOOPBACK = '127.0.0.1';
const READY_PREFIX = 'RHEOMIQ_DESKTOP_READY=';
const STARTUP_TIMEOUT_MS = 20_000;
const APP_ID = 'app.rheomiq.desktop';

let mainWindow = null;
let backend = null;
let quitting = false;

app.setName('RheomIQ');

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function userDataPath(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function secureDelete(file) {
  try {
    const size = fs.statSync(file).size;
    if (size > 0 && size <= 1024 * 1024) fs.writeFileSync(file, Buffer.alloc(size));
  } catch {
    // Best effort only. The file is removed below even if overwrite is unavailable.
  }
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}

function normalizePublicConfig(value) {
  const rawUrl = String(value?.supabaseUrl || value?.SUPABASE_URL || '').trim();
  const publishable = String(value?.supabasePublishableKey || value?.SUPABASE_PUBLISHABLE_KEY || '').trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid Supabase URL.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Supabase URL must be HTTPS.');
  }
  if (!publishable || publishable.length > 4096 || /\s/.test(publishable)) {
    throw new Error('Invalid Supabase publishable key.');
  }
  return {
    supabaseUrl: parsed.toString().replace(/\/$/, ''),
    supabasePublishableKey: publishable,
  };
}

function normalizeCardVaultKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return '';
  if (/^[0-9a-f]{64}$/i.test(key)) return key;
  let decoded;
  try { decoded = Buffer.from(key, 'base64'); } catch { throw new Error('Invalid card-vault key.'); }
  if (decoded.length !== 32) throw new Error('Invalid card-vault key.');
  return key;
}

function normalizeKeyVersion(raw) {
  const value = raw === undefined || raw === null || raw === '' ? 1 : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid card-vault key version.');
  return value;
}

function applyPendingProvision() {
  const pending = userDataPath('pending-provision.json');
  if (!fs.existsSync(pending)) return;

  let value;
  try {
    value = readJson(pending);
    const publicConfig = normalizePublicConfig(value);
    writePrivateJson(userDataPath('runtime-config.json'), publicConfig);

    const cardVaultKey = normalizeCardVaultKey(value.cardVaultKey || value.CARD_VAULT_KEY);
    if (cardVaultKey) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Windows secure storage is not available.');
      }
      const encrypted = safeStorage.encryptString(cardVaultKey).toString('base64');
      writePrivateJson(userDataPath('runtime-secrets.json'), {
        cardVaultKey: encrypted,
        cardVaultKeyVersion: normalizeKeyVersion(value.cardVaultKeyVersion || value.CARD_VAULT_KEY_VERSION),
      });
    }
  } finally {
    // Never leave the one-time plaintext provisioning payload behind.
    secureDelete(pending);
    value = null;
  }
}

function loadRuntimeConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
    return normalizePublicConfig(process.env);
  }
  const file = userDataPath('runtime-config.json');
  if (!fs.existsSync(file)) {
    throw new Error('Desktop runtime is not configured. Run INSTALL_RHEOMIQ_WINDOWS.bat.');
  }
  return normalizePublicConfig(readJson(file));
}

function loadRuntimeSecrets() {
  const envKey = normalizeCardVaultKey(process.env.CARD_VAULT_KEY);
  if (envKey) {
    return { cardVaultKey: envKey, cardVaultKeyVersion: normalizeKeyVersion(process.env.CARD_VAULT_KEY_VERSION) };
  }

  const file = userDataPath('runtime-secrets.json');
  if (!fs.existsSync(file)) return { cardVaultKey: '', cardVaultKeyVersion: 1 };
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable.');
  const value = readJson(file);
  const encrypted = Buffer.from(String(value.cardVaultKey || ''), 'base64');
  const cardVaultKey = normalizeCardVaultKey(safeStorage.decryptString(encrypted));
  return { cardVaultKey, cardVaultKeyVersion: normalizeKeyVersion(value.cardVaultKeyVersion) };
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
  if (!runtime.node || !fs.existsSync(runtime.node)) throw new Error('Bundled Node.js runtime is missing.');
  if (!fs.existsSync(runtime.server) || !fs.existsSync(runtime.dist)) throw new Error('Desktop application bundle is incomplete.');

  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(runtime.node, [runtime.server, '--serve-dist'], {
      env: childEnvironment(config, secrets, runtime.dist),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    backend = child;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* no-op */ }
      reject(new Error('Local backend startup timed out.'));
    }, STARTUP_TIMEOUT_MS);

    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => {
      if (settled || !line.startsWith(READY_PREFIX)) return;
      const origin = line.slice(READY_PREFIX.length).trim();
      let parsed;
      try { parsed = new URL(origin); } catch { return; }
      if (parsed.protocol !== 'http:' || parsed.hostname !== LOOPBACK || !parsed.port) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ origin, runtime });
    });

    // Consume stderr so the hidden child cannot block on a full pipe. Errors are
    // intentionally not surfaced verbatim because upstream/database messages may
    // contain implementation details.
    child.stderr.on('data', () => {});
    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', code => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Local backend exited during startup (${code ?? 'unknown'}).`));
        return;
      }
      if (!quitting) {
        dialog.showErrorBox('RheomIQ', 'Η τοπική υπηρεσία του RheomIQ σταμάτησε απροσδόκητα. Η εφαρμογή θα κλείσει.');
        app.quit();
      }
    });
  });
}

function configureSessionPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write');
  });
}

function createWindow(origin, runtime) {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    title: 'RheomIQ',
    width: 1440,
    height: 930,
    minWidth: 960,
    minHeight: 650,
    show: false,
    backgroundColor: '#0f1720',
    icon: runtime.icon,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.origin !== origin && target.protocol === 'https:') void shell.openExternal(target.toString());
    } catch { /* invalid external URL */ }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', event => {
    try {
      if (new URL(event.url).origin === origin) return;
    } catch { /* block invalid navigation */ }
    event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(origin);
}

function stopBackend() {
  const child = backend;
  backend = null;
  if (!child || child.killed) return;
  try { child.kill(); } catch { /* already stopped */ }
}

async function launch() {
  try {
    app.setAppUserModelId(APP_ID);
    configureSessionPermissions();
    applyPendingProvision();
    const config = loadRuntimeConfig();
    const secrets = loadRuntimeSecrets();
    const { origin, runtime } = await startBackend(config, secrets);
    createWindow(origin, runtime);
  } catch {
    dialog.showErrorBox(
      'RheomIQ',
      'Το RheomIQ δεν μπόρεσε να ξεκινήσει την τοπική υπηρεσία. Τρέξε ξανά το INSTALL_RHEOMIQ_WINDOWS.bat για έλεγχο/επανεγκατάσταση της desktop ρύθμισης.',
    );
    app.quit();
  }
}

if (singleInstance) {
  app.whenReady().then(launch);
  app.on('before-quit', () => {
    quitting = true;
    stopBackend();
  });
  app.on('window-all-closed', () => app.quit());
}
