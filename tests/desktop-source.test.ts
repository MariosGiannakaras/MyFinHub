import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative:string) => fs.readFileSync(path.join(root, relative), 'utf8');
const bytes = (relative:string) => fs.readFileSync(path.join(root, relative));
const exists = (relative:string) => fs.existsSync(path.join(root, relative));

const desktopPackage = JSON.parse(read('desktop/package.json'));
const main = read('desktop/main.cjs');
const preload = read('desktop/preload.cjs');
const setup = read('desktop/setup.html');
const setupRenderer = read('desktop/setup-renderer.js');
const settings = read('src/pages/SettingsPage.tsx');
const updatePanel = read('src/components/DesktopUpdatePanel.tsx');
const workflow = read('.github/workflows/desktop-windows.yml');
const prepareBuild = read('desktop/prepare-build.mjs');

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
  });

  it('keeps the renderer sandboxed and exposes only narrow setup/update IPC', () => {
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain("preload: path.join(__dirname, 'preload.cjs')");
    expect(preload).toContain("contextBridge.exposeInMainWorld('myFinHubDesktop'");
    expect(preload).not.toContain("require('fs')");
    expect(preload).not.toContain('child_process');
    expect(main).toContain('isMainSender(event)');
    expect(main).toContain('isSetupSender(event)');
  });

  it('supports modern app-owned first-run setup without compiling secrets into the renderer', () => {
    expect(setup).toContain('MyFinHub');
    expect(setup).toContain('SUPABASE_URL');
    expect(setup).toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(setup).toContain('CARD_VAULT_KEY');
    expect(setup).toContain('progress-shell');
    expect(setup).toContain('Τι εκτελείται στο παρασκήνιο');
    expect(setup).toContain('@media(prefers-reduced-motion:reduce)');
    expect(setupRenderer).toContain('bridge.saveSetup');
    expect(setupRenderer).toContain('setProgress(');
    expect(preload).toContain('onSetupProgress');
    expect(main).toContain("safeStorage.encryptString(cardVaultKey)");
    expect(main).toContain("delete env.SUPABASE_SERVICE_ROLE_KEY");
    expect(main).toContain("delete env.SUPABASE_SECRET_KEY");
  });

  it('keeps the local backend loopback-only while preserving the legacy protocol contract', () => {
    expect(main).toContain("const LOOPBACK = '127.0.0.1'");
    expect(main).toContain("const READY_PREFIX = 'RHEOMIQ_DESKTOP_READY='");
    expect(main).toContain("env.RHEOMIQ_HOST = LOOPBACK");
    expect(main).toContain("env.RHEOMIQ_PORT = '0'");
    expect(main).toContain("env.RHEOMIQ_DESKTOP = '1'");
    expect(main).toContain('windowsHide: true');
  });

  it('surfaces explicit in-app update controls only through the Electron bridge', () => {
    expect(settings).toContain('<DesktopUpdatePanel/>');
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

  it('publishes unsigned personal releases safely and keeps signing optional', () => {
    expect(workflow).toContain("tags: ['myfinhub-v*']");
    expect(workflow).toContain('MyFinHub-Setup-*-x64.exe');
    expect(workflow).toContain('MYFINHUB_SIGNING_ENABLED=false');
    expect(workflow).toContain('Configure both Windows signing secrets or neither.');
    expect(workflow).toContain('Unknown publisher / SmartScreen');
    expect(workflow).toContain('Get-FileHash -Algorithm SHA256');
    expect(workflow).not.toContain('Signed desktop releases require');
  });

  it('installs, launches, verifies identity and uninstalls the real NSIS package in Windows CI', () => {
    expect(workflow).toContain('Install, launch and uninstall NSIS package');
    expect(workflow).toContain("-ArgumentList '/S'");
    expect(workflow).toContain("'MyFinHub.lnk'");
    expect(workflow).toContain('CreateShortcut($desktopShortcut)');
    expect(workflow).toContain("DisplayName -eq 'MyFinHub'");
    expect(workflow).toContain("MainWindowTitle -match 'MyFinHub'");
    expect(workflow).toContain('ExtractAssociatedIcon($exe)');
    expect(workflow).toContain("-Filter 'Uninstall*.exe'");
    expect(workflow).toContain('MyFinHub executable remains after silent uninstall.');
  });

  it('keeps the new light/dark MyFinHub artwork and generates the Windows 512 size at build time', () => {
    for (const asset of [
      'public/favicon.png',
      'public/brand/icon-light-32.png',
      'public/brand/icon-dark-32.png',
      'public/brand/icon-light-192.png',
      'public/brand/icon-dark-192.png',
      'public/brand/icon-512.svg',
      'desktop/setup-brand.png',
      'assets/branding/myfinhub/icon-light-32.png',
      'assets/branding/myfinhub/icon-dark-32.png',
      'assets/branding/myfinhub/icon-light-192.png',
      'assets/branding/myfinhub/icon-dark-192.png',
      'assets/branding/myfinhub/icon-512.svg',
      'assets/branding/myfinhub/README.md',
    ]) expect(exists(asset)).toBe(true);
    const favicon=bytes('public/favicon.png');
    expect([...favicon.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
    expect(favicon.readUInt32BE(16)).toBe(32);
    expect(favicon.readUInt32BE(20)).toBe(32);
    expect(bytes('desktop/setup-brand.png').equals(bytes('public/brand/icon-dark-192.png'))).toBe(true);
    expect(prepareBuild).toContain("const sourceIcon=path.join(root,'public','brand','icon-light-192.png')");
    expect(prepareBuild).toContain('[Drawing.Bitmap]::new(512,512)');
    expect(prepareBuild).not.toContain('nativeAppIcon');
    expect(workflow).toContain('assets/branding/myfinhub/**');
  });

  it('keeps CVV out of the server-side desktop boundary', () => {
    expect(main).not.toMatch(/CVV|CVC|securityCode/i);
    expect(setupRenderer).not.toMatch(/CVV|CVC|securityCode/i);
  });
});
