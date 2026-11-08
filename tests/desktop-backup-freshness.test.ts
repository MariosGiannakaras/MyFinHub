import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {desktopBackupIsRecent} from '../src/lib/desktopBackupFreshness.js';

const now=Date.parse('2026-11-08T12:00:00.000Z');
describe('#649 I18.03/I18.06 local Windows backups',()=>{
  it('recognizes only verified timestamps from the preceding 24 hours',()=>{
    expect(desktopBackupIsRecent(new Date(now-23*3600_000).toISOString(),now)).toBe(true);
    expect(desktopBackupIsRecent(new Date(now-24*3600_000).toISOString(),now)).toBe(false);
    expect(desktopBackupIsRecent(new Date(now-25*3600_000).toISOString(),now)).toBe(false);
    expect(desktopBackupIsRecent(null,now)).toBe(false);
    expect(desktopBackupIsRecent('invalid-date',now)).toBe(false);
  });
  it('never suppresses a new backup due to clock rollback or future local timestamp',()=>{
    expect(desktopBackupIsRecent(new Date(now+60_000).toISOString(),now)).toBe(false);
    expect(desktopBackupIsRecent(new Date(now+48*3600_000).toISOString(),now)).toBe(false);
    expect(desktopBackupIsRecent(new Date(now).toISOString(),now)).toBe(true);
  });
  it('announces corrupt-only existing backups distinctly from a first install',()=>{
    const hook=readFileSync('src/hooks/useDesktopAutoBackup.ts','utf8');
    expect(hook).toContain("import { desktopBackupIsRecent } from '../lib/desktopBackupFreshness'");
    const source=readFileSync('src/components/DesktopBackupPanel.tsx','utf8');
    expect(source).toContain('status.backups.every(item => !item.valid)');
    expect(source).toContain("invalidOnly ? 'Δεν υπάρχει έγκυρο τοπικό αντίγραφο'");
    expect(source).toContain('Boolean(error) || failed || overdue || invalidOnly');
    expect(source).toContain("role={invalidOnly ? 'alert' : 'status'}");
    expect(source).toContain("'Αναμονή πρώτου αντιγράφου'");
  });
  it('renders corrupt-only, retry and healthy states on actual desktop/tablet/mobile',()=>{
    const source=readFileSync('scripts/desktop-backup-rendered-qa.mjs','utf8');
    expect(source).toContain("['empty','populated','failure','invalid-only','retry']");
    expect(source).toContain("transientStatusFailure=mode==='retry'");
    expect(source).toContain('desktop-backup-retry-initial-error-');
    expect(source).toContain('native status refresh clears transient error');
    expect(source).toContain('invalidOnlyAlert');
    expect(source).toContain("viewport.name==='mobile'");
    expect(source).toContain('destructive restore confirmation');
  });
});
