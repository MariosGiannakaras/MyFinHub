import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopBackupBridge, type LocalBackupStatus } from '../src/lib/desktopBackups';
import { clearAppUnlockToken, setAppUnlockToken } from '../src/lib/appUnlockToken';
import type { FinanceData } from '../src/types';

afterEach(() => {
  clearAppUnlockToken();
  vi.unstubAllGlobals();
});

describe('Desktop finance backup PIN capability transport', () => {
  it('uses the live ephemeral ticket on every native operation and revokes it on lock', async () => {
    const observed: Array<{operation:string;ticket:string}> = [];
    const capture=(operation:string,ticket:string) => { observed.push({operation,ticket}); };
    const status:LocalBackupStatus={
      folder:'C:\\MyFinHub\\Backups',intervalHours:24,retentionDays:30,
      lastValidBackupAt:null,lastFailureAt:null,backups:[],
    };
    const raw={
      getBackupStatus:async (ticket:string) => {capture('status',ticket);return status;},
      reportBackupFailure:async (ticket:string) => {capture('failure',ticket);return true;},
      saveLocalBackup:async (ticket:string) => {
        capture('save',ticket);
        return {name:'qa.json',revision:'1',createdAt:'2026-10-24T12:00:00Z',verified:true};
      },
      getRestoreCandidate:async (_name:string,ticket:string) => {
        capture('restore',ticket);
        return {} as FinanceData;
      },
      chooseBackupFolder:async (ticket:string) => {capture('folder',ticket);return status;},
      openBackupFolder:async (ticket:string) => {capture('open',ticket);return true;},
    };
    vi.stubGlobal('window',{myFinHubDesktop:raw});
    const bridge=desktopBackupBridge();
    expect(bridge).toBeDefined();
    expect(desktopBackupBridge()).toBe(bridge); // stable React useEffect dependency
    const fakeVerifiedTicket='t'.repeat(43);
    setAppUnlockToken(fakeVerifiedTicket);
    await bridge!.getBackupStatus();
    await bridge!.saveLocalBackup();
    await bridge!.getRestoreCandidate('qa.json');
    await bridge!.chooseBackupFolder();
    await bridge!.openBackupFolder();
    await bridge!.reportBackupFailure?.();
    expect(observed).toHaveLength(6);
    expect(observed.every(item=>item.ticket===fakeVerifiedTicket)).toBe(true);
    clearAppUnlockToken();
    await bridge!.getBackupStatus();
    expect(observed.at(-1)).toEqual({operation:'status',ticket:''});
    // Missing ticket is NOT authorization; protected /api/data denies it
    // when PIN is enabled. The adapter cannot retain an older capability.
  });
});
