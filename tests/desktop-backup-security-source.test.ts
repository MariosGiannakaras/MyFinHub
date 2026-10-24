import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const main=read('desktop/main.cjs');
const preload=read('desktop/preload.cjs');
const nativeBridge=read('src/lib/desktopBackups.ts');
const hook=read('src/hooks/useDesktopAutoBackup.ts');
const ui=read('src/pages/SettingsPage.tsx');

describe('Desktop backup auth and privilege separation',()=>{
  it('fetches finance only in the main process with live owner+AAL2 backend permission',()=>{
    expect(main).toContain("new URL('/api/data', origin)");
    expect(main).toContain("mainWindow.webContents.session.fetch");
    expect(main).toContain("credentials: 'include'");
    expect(main).toContain("if (!response.ok) throw new Error('Η πρόσβαση στο backup απαιτεί σύνδεση ιδιοκτήτη, TOTP και ξεκλείδωμα PIN όταν είναι ενεργό.')");
    expect(main).toContain('const snapshot = await requireBackupAccess(event, unlockToken)');
    expect(main).toContain('desktopBackupStore.save({ data: snapshot.data, revision: snapshot.revision })');
    expect(main).not.toContain('desktopBackupStore.save(snapshot)');
  });

  it('authorizes all IPC accesses including local finance restore and folder management',()=>{
    for(const channel of [
      'myfinhub:backup-status','myfinhub:backup-save',
      'myfinhub:backup-restore-candidate',
      'myfinhub:backup-choose-folder','myfinhub:backup-open-folder',
    ]) {
      const start=main.indexOf(`ipcMain.handle('${channel}'`);
      expect(start).toBeGreaterThan(-1);
      expect(main.slice(start,start+1700)).toContain('await requireBackupAccess(event, unlockToken)');
    }
    expect(main).toContain('event.senderFrame !== mainWindow.webContents.mainFrame');
    expect(main).toContain("origin.hostname !== LOOPBACK");
  });

  it('does not trust renderer-supplied finance state or expose database secrets',()=>{
    expect(preload).toContain("saveLocalBackup: (unlockToken) => ipcRenderer.invoke('myfinhub:backup-save', unlockToken)");
    expect(preload).not.toContain('saveLocalBackup: (snapshot)');
    expect(hook).toContain('await bridge.saveLocalBackup()');
    // A renderer cannot bypass an active PIN by calling a native IPC channel.
    // Every privileged backup action validates through the same /api/data
    // session+ticket boundary as ordinary browser finance reads.
    expect(main).toContain("'x-myfinhub-app-unlock': unlockToken");
    expect(main).toContain("readAuthorizedFinanceBackup(unlockToken)");
    expect(main).toContain("/^[a-zA-Z0-9_-]{43}$/");
    expect(nativeBridge).toContain("getAppUnlockToken");
    expect(nativeBridge).toContain("cachedAdapter");
    expect(nativeBridge).toContain("getRestoreCandidate(name,getAppUnlockToken())");
    expect(nativeBridge).not.toContain("localStorage");
    expect(preload).toContain("getBackupStatus: (unlockToken) => ipcRenderer.invoke('myfinhub:backup-status', unlockToken)");
    expect(preload).toContain("getRestoreCandidate: (name, unlockToken) => ipcRenderer.invoke('myfinhub:backup-restore-candidate', name, unlockToken)");

    expect(ui).toContain('const receipt = await bridge.saveLocalBackup()');
    // Desktop bootstrap has older explicit admin-key rejection guards; they
    // must remain. Constrain this regression to the new finance-backup IPC.
    const start=main.indexOf('const readAuthorizedFinanceBackup');
    const end=main.indexOf("ipcMain.handle('myfinhub:get-setup-state'", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const backupBoundary=main.slice(start,end);
    expect(backupBoundary).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(backupBoundary).not.toContain('SUPABASE_DB_PASSWORD');
  });
});
