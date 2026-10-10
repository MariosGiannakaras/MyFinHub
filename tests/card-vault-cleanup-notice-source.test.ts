import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const app=readFileSync('src/App.tsx','utf8');
const notice=readFileSync('src/components/PersistenceNotice.tsx','utf8');
describe('recoverable card vault cleanup after new session',()=>{
  it('deduplicates protected deletion between initial, reload and retry flows',()=>{
    expect(app).toContain('cleanupInFlight=useRef(new Map<string,Promise<void>>())');
    expect(app).toContain('const inFlight=cleanupInFlight.current.get(id)');
    expect(app).toContain('cleanupInFlight.current.set(id,task)');
    expect(app).toContain('await runCardCleanup(card.id)');
    expect(app).toContain('!cleanupAttempted.current.has(key)');
  });
  it('never swallows an automatic cleanup failure without visible recovery',()=>{
    expect(app).toContain('setCleanupFailure(');
    expect(app).toContain('cleanupPending={pendingCleanup.length}');
    expect(app).toContain('onRetryCleanup={retryCardCleanup}');
    expect(notice).toContain('card-cleanup-notice');
    expect(notice).toContain('Εκκρεμεί καθαρισμός ασφαλών στοιχείων κάρτας');
    expect(notice).toContain('Επανάληψη καθαρισμού');
    expect(notice).toContain("role={cleanupError?'alert':'status'}");
  });
});
