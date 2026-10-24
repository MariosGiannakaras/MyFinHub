import type { FinanceData } from '../types';

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
export function desktopBackupBridge():DesktopBackupBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  const bridge = window.myFinHubDesktop;
  if (!bridge || typeof bridge.getBackupStatus !== 'function' || typeof bridge.saveLocalBackup !== 'function') return undefined;
  return bridge;
}
