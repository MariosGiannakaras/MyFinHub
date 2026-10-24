import type { FinanceData } from '../types';
import { getAppUnlockToken } from './appUnlockToken';

interface LocalBackupItem {
  name: string;
  createdAt: string;
  revision: string;
  bytes: number;
  valid: boolean;
}
export interface LocalBackupStatus {
  folder: string;
  intervalHours: number;
  retentionDays: number;
  lastValidBackupAt: string | null;
  lastFailureAt: string | null;
  backups: LocalBackupItem[];
}
export interface DesktopBackupBridge {
  getBackupStatus: () => Promise<LocalBackupStatus>;
  reportBackupFailure?: () => Promise<boolean>;
  saveLocalBackup: () => Promise<{ name:string; revision:string; createdAt:string; verified:boolean }>;
  getRestoreCandidate: (name:string) => Promise<FinanceData>;
  chooseBackupFolder: () => Promise<LocalBackupStatus>;
  openBackupFolder: () => Promise<boolean>;
}
// The Electron bridge is capability-transport only. Each call reads the
// *current* in-memory browser-tab PIN ticket; it is never stored or cached.
type NativeBackupBridge={
  getBackupStatus:(ticket:string)=>Promise<LocalBackupStatus>;
  reportBackupFailure?:(ticket:string)=>Promise<boolean>;
  saveLocalBackup:(ticket:string)=>ReturnType<DesktopBackupBridge['saveLocalBackup']>;
  getRestoreCandidate:(name:string,ticket:string)=>Promise<FinanceData>;
  chooseBackupFolder:(ticket:string)=>Promise<LocalBackupStatus>;
  openBackupFolder:(ticket:string)=>Promise<boolean>;
};
let cachedNative:NativeBackupBridge|undefined;
let cachedAdapter:DesktopBackupBridge|undefined;
export function desktopBackupBridge():DesktopBackupBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  const native = window.myFinHubDesktop as unknown as NativeBackupBridge | undefined;
  if (!native || typeof native.getBackupStatus !== 'function' || typeof native.saveLocalBackup !== 'function') return undefined;
  if (native !== cachedNative) {
    cachedNative = native;
    cachedAdapter = {
      getBackupStatus:()=>native.getBackupStatus(getAppUnlockToken()),
      reportBackupFailure:typeof native.reportBackupFailure==='function'
        ?()=>native.reportBackupFailure!(getAppUnlockToken()):undefined,
      saveLocalBackup:()=>native.saveLocalBackup(getAppUnlockToken()),
      getRestoreCandidate:name=>native.getRestoreCandidate(name,getAppUnlockToken()),
      chooseBackupFolder:()=>native.chooseBackupFolder(getAppUnlockToken()),
      openBackupFolder:()=>native.openBackupFolder(getAppUnlockToken()),
    };
  }
  // Stable reference prevents desktop Settings effects re-running on render.
  return cachedAdapter;
}
