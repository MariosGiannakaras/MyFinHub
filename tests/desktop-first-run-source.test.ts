import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative:string) => fs.readFileSync(path.join(root, relative), 'utf8');
const main = read('desktop/main.cjs');
const preload = read('desktop/preload.cjs');
const setup = read('desktop/setup.html');
const renderer = read('desktop/setup-renderer.js');
const workflow = read('.github/workflows/desktop-windows.yml');

describe('Windows first-run recovery contract', () => {
  it('captures backend diagnostics instead of discarding stderr', () => {
    expect(main).toContain("child.stderr.on('data', chunk =>");
    expect(main).toContain('appendDiagnostic(stderrDiagnostic');
    expect(main).not.toContain("child.stderr.on('data', () => {})");
    expect(main).toContain("startupError('BACKEND_EXITED_DURING_START'");
    expect(main).toContain("startupError('BACKEND_START_TIMEOUT'");
    expect(main).toContain("startupError('BACKEND_SPAWN_FAILED'");
  });

  it('keeps setup recoverable and reports real main-process progress', () => {
    expect(main).toContain('function sendSetupProgress');
    expect(main).toContain("setupWindow.webContents.send('myfinhub:setup-progress'");
    expect(main).toContain('await preflightSupabase(config');
    expect(main).toContain('return { ok: false, error: diagnostic }');
    expect(main).toContain('createWindow(origin, runtime);');
    expect(main).toContain('currentSetup.close()');
    expect(main).not.toContain('δεν μπόρεσε να ξεκινήσει την τοπική υπηρεσία. Άνοιξε ξανά την εφαρμογή');
    expect(renderer).toContain('renderDiagnostic');
    expect(renderer).toContain('result?.error');
    expect(renderer).toContain('save.disabled = false');
  });

  it('supports safe diagnostic copy without exposing Electron primitives to the renderer', () => {
    expect(main).toContain("ipcMain.handle('myfinhub:copy-setup-diagnostics'");
    expect(main).toContain('formatDiagnostic(lastSetupDiagnostic');
    expect(preload).toContain('copySetupDiagnostics: () => ipcRenderer.invoke');
    expect(setup).toContain('Αντιγραφή ασφαλών διαγνωστικών');
    expect(renderer).not.toContain("require('electron')");
  });

  it('requires the Windows package workflow to exercise persisted first-run configuration', () => {
    expect(workflow).toContain('pending-provision.json');
    expect(workflow).toContain('runtime-config.json');
    expect(workflow).toContain('runtime-secrets.json');
    expect(workflow).toContain('First-run persisted config and DPAPI smoke');
  });
});
