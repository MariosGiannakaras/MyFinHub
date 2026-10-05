import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative:string) => fs.readFileSync(path.join(root, relative), 'utf8');
const bytes = (relative:string) => fs.readFileSync(path.join(root, relative));
const exists = (relative:string) => fs.existsSync(path.join(root, relative));

const desktopPackage = JSON.parse(read('desktop/package.json'));
const bootstrap = read('desktop/bootstrap.cjs');
const defaults = read('desktop/runtime-defaults.cjs');
const main = read('desktop/main.cjs');
const rendererMain = read('src/main.tsx');
const qaRenderer = read('src/qa.tsx');
const desktopTitlebar = read('src/styles/desktop-titlebar.css');
const desktopTitlebarQa = read('scripts/desktop-titlebar-qa.mjs');
const renderedRunner = read('scripts/run-rendered-qa.mjs');
const preload = read('desktop/preload.cjs');
const recovery = read('desktop/setup.html');
const recoveryRenderer = read('desktop/setup-renderer.js');
const settings = read('src/pages/SettingsPage.tsx');
const updatePanel = read('src/components/DesktopUpdatePanel.tsx');
const workflow = read('.github/workflows/desktop-windows.yml');
const firstRunWorkflow = read('.github/workflows/desktop-first-run.yml');
const cleanLaunchWorkflow = read('.github/workflows/desktop-clean-launch.yml');
const prepareBuild = read('desktop/prepare-build.mjs');
const vaultHandler = read('server/cardVaultHandler.ts');
const vaultProxy = read('server/desktopCardVaultProxy.ts');

function mainBlock(start:string,end:string){const from=main.indexOf(start);const to=main.indexOf(end,from+start.length);expect(from).toBeGreaterThanOrEqual(0);expect(to).toBeGreaterThan(from);return main.slice(from,to);}

describe('MyFinHub Windows desktop boundary', () => {
  it('uses a native MyFinHub application identity and interactive per-user NSIS installer', () => {
    expect(desktopPackage.build.productName).toBe('MyFinHub');
    expect(desktopPackage.build.appId).toBe('app.myfinhub.desktop');
    expect(desktopPackage.build.win.executableName).toBe('MyFinHub');
    expect(desktopPackage.build.win.artifactName).toBe('MyFinHub-Setup-${version}-${arch}.${ext}');
    expect(desktopPackage.build.nsis.oneClick).toBe(false);
    expect(desktopPackage.build.nsis.perMachine).toBe(false);
    expect(desktopPackage.build.nsis.allowToChangeInstallationDirectory).toBe(true);
    expect(desktopPackage.build.nsis.createDesktopShortcut).toBe('always');
    expect(desktopPackage.build.nsis.createStartMenuShortcut).toBe(true);
    expect(desktopPackage.main).toBe('bootstrap.cjs');
    expect(main).toContain("const PRODUCT_NAME = 'MyFinHub'");
    expect(main).toContain('title: PRODUCT_NAME');
  });

  it('integrates the app topbar with native Windows caption controls without a frameless reimplementation', () => {
    const mainWindowBlock=mainBlock('function createWindow(origin, runtime)', 'function createSetupWindow()');
    const setupWindowBlock=mainBlock('function createSetupWindow()', 'function sanitizedUpdateState()');
    expect(mainWindowBlock).toContain("process.platform === 'win32'");
    expect(mainWindowBlock).toContain("titleBarStyle: 'hidden'");
    expect(mainWindowBlock).toContain('titleBarOverlay: true');
    expect(mainWindowBlock).not.toContain('frame: false');
    expect(setupWindowBlock).not.toContain("titleBarStyle: 'hidden'");
    expect(setupWindowBlock).not.toContain('titleBarOverlay');

    expect(rendererMain).toContain("document.documentElement.dataset.myfinhubDesktop='true'");
    expect(rendererMain).toContain("import('./styles/desktop-titlebar.css')");
    expect(read('src/styles.css')).not.toContain('desktop-titlebar.css');

    expect(desktopTitlebar).toContain('html[data-myfinhub-desktop="true"] .topbar');
    expect(desktopTitlebar).toContain('app-region:drag');
    expect(desktopTitlebar).toContain('-webkit-app-region:drag');
    expect(desktopTitlebar).toContain('app-region:no-drag');
    expect(desktopTitlebar).toContain('-webkit-app-region:no-drag');
    expect(desktopTitlebar).toContain('--desktop-shell-top-gutter:14px');
    expect(desktopTitlebar).toContain('--desktop-shell-right-gutter:14px');
    expect(desktopTitlebar).toContain('--desktop-window-controls-reserve:152px');
    expect(desktopTitlebar).toContain('top:0');
    expect(desktopTitlebar).toContain('height:calc(62px + var(--desktop-shell-top-gutter))');
    expect(desktopTitlebar).toContain('margin-top:calc(-1 * var(--desktop-shell-top-gutter))');
    expect(desktopTitlebar).toContain('margin-right:calc(-1 * var(--desktop-shell-right-gutter))');
    expect(desktopTitlebar).toContain('padding-top:var(--desktop-shell-top-gutter)');
    expect(desktopTitlebar).toContain('padding-right:calc(15px + var(--desktop-window-controls-reserve))');
    expect(desktopTitlebar).toContain('border-radius:0 0 16px 16px');
    expect(desktopTitlebar).toContain('.topbar button');
    expect(desktopTitlebar).toContain('.topbar input');
    expect(desktopTitlebar).toContain('.topbar [role="button"]');
  });

  it('renders desktop-only titlebar geometry and theme evidence in the isolated QA surface', () => {
    expect(qaRenderer).toContain("params.get('desktop-titlebar')==='1'");
    expect(qaRenderer).toContain("document.documentElement.dataset.myfinhubDesktop='true'");
    expect(qaRenderer).toContain("import('./styles/desktop-titlebar.css')");
    expect(desktopTitlebarQa).toContain("url.searchParams.set('desktop-titlebar','1')");
    expect(desktopTitlebarQa).toContain("applyTheme('light')");
    expect(desktopTitlebarQa).toContain("applyTheme('dark')");
    expect(desktopTitlebarQa).toContain('document.documentElement.clientWidth');
    expect(desktopTitlebarQa).toContain('scrollbarGutter');
    expect(desktopTitlebarQa).toContain('actionReserve');
    expect(desktopTitlebarQa).toContain('desktop-titlebar-light-1440');
    expect(desktopTitlebarQa).toContain('desktop-titlebar-dark-1440');
    expect(desktopTitlebarQa).toContain('desktop-titlebar-dark-960');
    expect(renderedRunner).toContain("path:'scripts/desktop-titlebar-qa.mjs'");
    expect(renderedRunner).toContain("key:'desktop-titlebar'");
  });

  it('keeps the renderer sandboxed and exposes only narrow recovery/update IPC', () => {
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain("preload: path.join(__dirname, 'preload.cjs')");
    expect(preload).toContain("contextBridge.exposeInMainWorld('myFinHubDesktop'");
    expect(preload).toContain('getRecoveryState: async () =>');
    expect(preload).toContain('retryStartup: async () =>');
    expect(preload).toContain('copyStartupDiagnostics: () =>');
    expect(preload).not.toContain('getSetupState:');
    expect(preload).not.toContain('saveSetup:');
    expect(preload).not.toContain("require('fs')");
    expect(preload).not.toContain('child_process');
    expect(main).toContain('isMainSender(event)');
    expect(main).toContain('isSetupSender(event)');
  });

  it('does not ask normal users for infrastructure configuration', () => {
    expect(desktopPackage.build.files).toContain('bootstrap.cjs');
    expect(desktopPackage.build.files).toContain('runtime-defaults.cjs');
    expect(bootstrap).toContain("require('./runtime-defaults.cjs')");
    expect(bootstrap).toContain('process.env.SUPABASE_URL');
    expect(bootstrap).toContain('process.env.SUPABASE_PUBLISHABLE_KEY');
    expect(bootstrap).toContain('delete process.env.CARD_VAULT_KEY');
    expect(defaults).toContain("productionOrigin: 'https://mgfinhub.vercel.app'");
    expect(defaults).not.toMatch(/CARD_VAULT_KEY\s*:/);
    expect(recovery).not.toContain('SUPABASE_URL');
    expect(recovery).not.toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(recovery).not.toContain('CARD_VAULT_KEY');
    expect(recoveryRenderer).not.toContain('supabaseUrl');
    expect(recoveryRenderer).not.toContain('supabasePublishableKey');
    expect(recovery).toContain('Νέα προσπάθεια');
    expect(recovery).toContain('Αντιγραφή διαγνωστικών');
  });

  it('keeps the local backend loopback-only while preserving the legacy protocol contract', () => {
    expect(main).toContain("const LOOPBACK = '127.0.0.1'");
    expect(main).toContain("const READY_PREFIX = 'RHEOMIQ_DESKTOP_READY='");
    expect(main).toContain("env.RHEOMIQ_HOST = LOOPBACK");
    expect(main).toContain("env.RHEOMIQ_PORT = '0'");
    expect(main).toContain("env.RHEOMIQ_DESKTOP = '1'");
    expect(main).toContain('windowsHide: true');
  });

  it('captures safe startup diagnostics instead of discarding backend stderr', () => {
    expect(main).toContain("child.stderr.on('data', chunk =>");
    expect(main).toContain('appendDiagnostic(stderrDiagnostic');
    expect(main).not.toContain("child.stderr.on('data', () => {})");
    expect(main).toContain("startupError('BACKEND_START_TIMEOUT'");
    expect(main).toContain("startupError('BACKEND_SPAWN_FAILED'");
    expect(recoveryRenderer).toContain('renderDiagnostic');
    expect(recoveryRenderer).toContain('bridge.copyStartupDiagnostics()');
  });

  it('keeps CARD_VAULT_KEY server-side for Windows PAN/expiry operations', () => {
    expect(bootstrap).toContain('delete process.env.CARD_VAULT_KEY');
    expect(vaultHandler).toContain("if(process.env.RHEOMIQ_DESKTOP==='1')");
    expect(vaultHandler).toContain('proxyDesktopCardVault');
    expect(vaultProxy).toContain("authorization:`Bearer ${accessToken}`");
    expect(vaultProxy).toContain('/api/card-secrets');
    expect(vaultProxy).toContain('mgfinhub.vercel.app');
  });

  it('surfaces explicit in-app update controls only through the Electron bridge', () => {
    expect(settings).toMatch(/<DesktopUpdatePanel\s*\/>/);
    expect(updatePanel).toContain('window.myFinHubDesktop');
    expect(updatePanel).toContain('Έλεγχος τώρα');
    expect(updatePanel).toContain('Λήψη ενημέρωσης');
    expect(updatePanel).toContain('Εγκατάσταση & επανεκκίνηση');
    expect(updatePanel).toContain('progressbar');
  });

  it('checks controlled MyFinHub releases and verifies exact SHA-256 metadata before installation', () => {
    expect(main).toContain("const UPDATE_TAG = /^myfinhub-v");
    expect(main).toContain('MyFinHub-Setup-${version}-x64.exe');
    expect(main).toContain("crypto.createHash('sha256')");
    expect(main).toContain('UPDATE_HOSTS');
    expect(main).toContain("match[2] !== pendingRelease.installerName");
    expect(main).toContain('MIN_INSTALLER_BYTES');
    expect(main).toContain('MAX_INSTALLER_BYTES');
    expect(main).not.toContain('autoUpdater');
    const automatic = mainBlock('function scheduleAutomaticUpdateChecks()', 'function isMainSender');
    expect(automatic).toContain('checkForUpdates(false)');
    expect(automatic).not.toContain('downloadUpdate()');
    expect(automatic).not.toContain('installDownloadedUpdate()');
    expect(main).toContain("buttons: ['Λήψη ενημέρωσης', 'Αργότερα']");
    expect(main).toContain("buttons: ['Εγκατάσταση & επανεκκίνηση', 'Αργότερα']");
  });

  it('reruns every Windows gate when the bundled Node runtime contract changes', () => {
    for (const source of [workflow, firstRunWorkflow, cleanLaunchWorkflow]) {
      expect(source).toContain('node-version-file: .nvmrc');
      const pathEntries=(source.match(/- \.nvmrc/g)??[]).length;
      expect(pathEntries).toBeGreaterThanOrEqual(2);
    }
    expect(prepareBuild).toContain('fs.copyFileSync(process.execPath,runtimeExe)');
  });

  it('publishes unsigned personal releases safely and keeps signing optional', () => {
    expect(workflow).toContain("tags: ['myfinhub-v*']");
    expect(workflow).toContain('MyFinHub-Setup-*-x64.exe');
    expect(workflow).toContain('MYFINHUB_SIGNING_ENABLED=false');
    expect(workflow).toContain('Configure both Windows signing secrets or neither.');
    expect(workflow).toContain('Unknown publisher / SmartScreen');
    expect(workflow).toContain('Get-FileHash -Algorithm SHA256');
    expect(workflow).not.toContain('Signed desktop releases require');
  });

  it('validates native title-bar maximize, restore and resize states from the packaged Electron BrowserWindow', () => {
    expect(main).toContain("const WINDOW_STATE_PROBE_PATH = String(process.env.MYFINHUB_WINDOW_STATE_PROBE_PATH || '').trim()");
    expect(main).toContain('async function runWindowStateProbe(window)');
    expect(main).toContain('window.maximize()');
    expect(main).toContain('window.isMaximized()');
    expect(main).toContain('window.unmaximize()');
    expect(main).toContain('window.setSize(1100, 760)');
    expect(main).toContain('result.size = window.getSize()');
    expect(main).toContain("fs.writeFileSync(WINDOW_STATE_PROBE_PATH, JSON.stringify(result, null, 2)");
    expect(workflow).toContain('$env:MYFINHUB_WINDOW_STATE_PROBE_PATH = $probePath');
    expect(workflow).toContain('titlebar-window-state.json');
    expect(workflow).toContain('Electron BrowserWindow title-bar states validated');
    expect(workflow).not.toContain('MyFinHubWindowProbe');
    expect(workflow).not.toContain('ShowWindowAsync');
  });

  it('installs, launches, verifies identity and uninstalls the real NSIS package in Windows CI', () => {
    expect(workflow).toContain('Install, launch and uninstall NSIS package');
    expect(workflow).toContain("-ArgumentList '/S'");
    expect(workflow).toContain("'MyFinHub.lnk'");
    expect(workflow).toContain('CreateShortcut($desktopShortcut)');
    expect(workflow).toContain("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*");
    expect(workflow).toContain("DisplayName -like 'MyFinHub*'");
    expect(workflow).toContain('UninstallString');
    expect(workflow).toContain('Installed MyFinHub process is not running from the installed executable path.');
    expect(workflow).toContain("Where-Object { $_.Path -eq $exe }");
    expect(workflow).toContain('ExtractAssociatedIcon($exe)');
    expect(workflow).toContain("-Filter 'Uninstall*.exe'");
    expect(workflow).toContain('MyFinHub executable remains after silent uninstall.');
  });

  it('keeps the pure-vector-backed MyFinHub artwork and packages Windows from the 512 export', () => {
    for (const asset of [
      'public/favicon.png',
      'public/brand/icon-light-32.png',
      'public/brand/icon-dark-32.png',
      'public/brand/icon-light-192.png',
      'public/brand/icon-dark-192.png',
      'public/brand/icon-512.svg',
      'public/brand/icon-512.png',
      'public/brand/icon-dark-512.svg',
      'public/brand/icon-light-512.png',
      'public/brand/icon-dark-512.png',
      'desktop/setup-brand.png',
      'assets/branding/myfinhub/icon-light-32.png',
      'assets/branding/myfinhub/icon-dark-32.png',
      'assets/branding/myfinhub/icon-light-192.png',
      'assets/branding/myfinhub/icon-dark-192.png',
      'assets/branding/myfinhub/icon-512.svg',
      'assets/branding/myfinhub/icon-dark-512.svg',
      'assets/branding/myfinhub/icon-light-512.png',
      'assets/branding/myfinhub/icon-dark-512.png',
      'assets/branding/myfinhub/symbol.svg',
      'assets/branding/myfinhub/logo-horizontal.svg',
      'assets/branding/myfinhub/README.md',
    ]) expect(exists(asset)).toBe(true);
    const favicon=bytes('public/favicon.png');
    expect([...favicon.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
    expect(favicon.readUInt32BE(16)).toBe(32);
    expect(favicon.readUInt32BE(20)).toBe(32);
    expect(bytes('desktop/setup-brand.png').equals(bytes('public/brand/icon-dark-192.png'))).toBe(true);
    expect(prepareBuild).toContain("const sourceIcon=path.join(root,'public','brand','icon-512.png')");
    expect(prepareBuild).not.toContain('resize-icon.ps1');
    expect(desktopPackage.build.win.icon).toBe('../public/brand/icon-512.svg');
    expect(desktopPackage.build.extraResources).toContainEqual(expect.objectContaining({from:'../public/brand/icon-512.png',to:'app/icon.png'}));
    expect(workflow).toContain('assets/branding/myfinhub/**');
  });

  it('keeps CVV out of the server-side desktop boundary', () => {
    expect(main).not.toMatch(/CVV|CVC|securityCode/i);
    expect(recoveryRenderer).not.toMatch(/CVV|CVC|securityCode/i);
  });
});