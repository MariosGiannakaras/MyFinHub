// Immutable timestamp policy shared by the Windows auto-backup hook and
// narrow unit tests. Do not treat a future timestamp as a valid recent backup.
const DAILY_MS=24*60*60*1000;

export function desktopBackupIsRecent(lastValidBackupAt:string|null,now=Date.now()):boolean {
  const last=lastValidBackupAt?Date.parse(lastValidBackupAt):NaN;
  const age=now-last;
  return Number.isFinite(last)&&age>=0&&age<DAILY_MS;
}
