import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const require = createRequire(import.meta.url);
const diagnostics = require('../desktop/startup-diagnostics.cjs') as {
  StartupError: new (code:string, stage:string, message:string, detail?:string) => Error;
  sanitizeDiagnosticText: (value:unknown, secrets?:unknown[]) => string;
  appendDiagnostic: (current:string, value:unknown, secrets?:unknown[]) => string;
  publicStartupFailure: (error:Error, secrets?:unknown[]) => {code:string;stage:string;message:string;detail:string};
  startupDiagnosticText: (failure:unknown, version?:string) => string;
  MAX_DIAGNOSTIC_CHARS: number;
};

const main = read('desktop/main.cjs');
const preload = read('desktop/preload.cjs');
const renderer = read('desktop/setup-renderer.js');
const setup = read('desktop/setup.html');
const desktopPackage = JSON.parse(read('desktop/package.json'));

describe('Windows first-run startup diagnostics', () => {
  it('redacts credentials, JWTs and card-vault key material from diagnostics', () => {
    const publishable = 'sb_publishable_example_123456789';
    const vault = 'a'.repeat(64);
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signaturepart';
    const safe = diagnostics.sanitizeDiagnosticText(
      `apikey=${publishable} Authorization: Bearer ${jwt} vault=${vault}`,
      [publishable, vault],
    );
    expect(safe).not.toContain(publishable);
    expect(safe).not.toContain(vault);
    expect(safe).not.toContain(jwt);
    expect(safe).toContain('[redacted]');
  });

  it('bounds backend diagnostic capture', () => {
    let detail = '';
    for (let i = 0; i < 40; i += 1) detail = diagnostics.appendDiagnostic(detail, 'x'.repeat(500));
    expect(detail.length).toBeLessThanOrEqual(diagnostics.MAX_DIAGNOSTIC_CHARS);
  });

  it('returns structured copyable failures without secret material', () => {
    const secret = 'b'.repeat(64);
    const error = new diagnostics.StartupError('BACKEND_EXITED_DURING_STARTUP', 'backend', 'Backend failed.', `stderr ${secret}`);
    const failure = diagnostics.publicStartupFailure(error, [secret]);
    expect(failure).toMatchObject({ code: 'BACKEND_EXITED_DURING_STARTUP', stage: 'backend', message: 'Backend failed.' });
    expect(failure.detail).not.toContain(secret);
    const copied = diagnostics.startupDiagnosticText(failure, '1.2.1');
    expect(copied).toContain('Code: BACKEND_EXITED_DURING_STARTUP');
    expect(copied).toContain('Secrets, tokens and card-vault key material are intentionally redacted.');
    expect(copied).not.toContain(secret);
  });

  it('omits runtime output for failures that happen after backend readiness', () => {
    const runtimeOutput = 'transaction payload must never be copied';
    const error = new diagnostics.StartupError('BACKEND_STOPPED', 'backend', 'Backend stopped.', runtimeOutput);
    const failure = diagnostics.publicStartupFailure(error);
    expect(failure.detail).not.toContain(runtimeOutput);
    expect(failure.detail).toContain('runtime output');
    expect(diagnostics.startupDiagnosticText(failure, '1.2.1')).not.toContain(runtimeOutput);
  });

  it('preserves backend stderr and classifies startup stages instead of discarding the cause', () => {
    expect(main).not.toContain("child.stderr.on('data', () => {})");
    expect(main).toContain("child.stderr.on('data', chunk =>");
    expect(main).toContain("'DESKTOP_RUNTIME_MISSING'");
    expect(main).toContain("'DESKTOP_BUNDLE_INCOMPLETE'");
    expect(main).toContain("'BACKEND_SPAWN_FAILED'");
    expect(main).toContain("'BACKEND_STARTUP_TIMEOUT'");
    expect(main).toContain("'BACKEND_EXITED_DURING_STARTUP'");
    expect(main).toContain("'WINDOW_LOAD_FAILED'");
    expect(main).toContain('recordStartupFailure(error');
  });

  it('performs a real Supabase preflight before persisting first-run config', () => {
    const preflightIndex = main.indexOf('await preflightSupabase(config)');
    const persistIndex = main.indexOf("writePrivateJson(userDataPath('runtime-config.json'), config)");
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(persistIndex).toBeGreaterThan(preflightIndex);
    expect(main).toContain("/auth/v1/settings");
    expect(main).toContain('apikey: config.supabasePublishableKey');
    expect(main).toContain("'SUPABASE_PREFLIGHT_REJECTED'");
    expect(main).toContain("'SUPABASE_PREFLIGHT_TIMEOUT'");
  });

  it('keeps setup open and returns safe error state for correction/retry', () => {
    expect(main).toContain("ipcMain.handle('myfinhub:save-setup', async");
    expect(main).toContain('return { ok: false, error: failure }');
    expect(main).toContain('await recoverToSetup(failure)');
    expect(main).not.toContain('δεν μπόρεσε να ξεκινήσει την τοπική υπηρεσία. Άνοιξε ξανά την εφαρμογή ή κάνε επανεγκατάσταση');
    expect(renderer).toContain('if (!result?.ok)');
    expect(renderer).toContain('renderFailure(result?.error)');
    expect(renderer).toContain('save.disabled = false');
  });

  it('uses real main-process setup progress and exposes only a narrow diagnostic copy action', () => {
    expect(main).toContain("const SETUP_PROGRESS_CHANNEL = 'myfinhub:setup-progress'");
    expect(main).toContain('setupWindow.webContents.send(SETUP_PROGRESS_CHANNEL');
    expect(main).toContain("ipcMain.handle('myfinhub:copy-setup-diagnostics'");
    expect(preload).toContain("copySetupDiagnostics: () => ipcRenderer.invoke('myfinhub:copy-setup-diagnostics')");
    expect(renderer).toContain('bridge.copySetupDiagnostics');
    expect(setup).toContain('Αντιγραφή ασφαλών διαγνωστικών');
  });

  it('ships and syntax-checks the diagnostics helper in the packaged desktop app', () => {
    expect(desktopPackage.build.files).toContain('startup-diagnostics.cjs');
    expect(desktopPackage.scripts.check).toContain('node --check startup-diagnostics.cjs');
  });
});
