import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const finance=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
const notice=readFileSync(new URL('../src/components/PersistenceNotice.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

describe('persistence failure user guidance',()=>{
  it('maps client network failures to safe actionable messages without auto-retrying writes',()=>{
    expect(finance).toContain("error.code==='NETWORK_TIMEOUT'||error.code==='NETWORK_ERROR'||error.code==='REQUEST_ABORTED'");
    expect(finance).toContain("Η υπηρεσία αποθήκευσης δεν είναι διαθέσιμη αυτή τη στιγμή.");
    expect(finance).toContain('setSaveErrorMessage(saveFailureMessage(error))');
  });

  it('shows the safe failure detail in the assertive persistence notice',()=>{
    expect(notice).toContain('errorMessage?:string|null');
    expect(notice).toContain("errorMessage||'Η τελευταία αλλαγή δεν έχει επιβεβαιωθεί ως αποθηκευμένη.");
    expect(notice).toContain('role="alert" aria-live="assertive"');
    expect(notice).toContain('Φόρτωση τελευταίας έκδοσης');
  });

  it('wires the finance failure detail into the recovery surface',()=>{
    expect(app).toContain('errorMessage={finance.saveErrorMessage}');
    expect(app).toContain("finance.saveState === 'error' || finance.saveState === 'conflict'");
  });
});
