import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const planning=readFileSync('src/pages/PlanningPage.tsx','utf8');
const attention=readFileSync('src/pages/AttentionPage.tsx','utf8');
const credit=readFileSync('src/pages/CreditCardPage.tsx','utf8');
const cards=readFileSync('src/pages/CardsPage.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');

describe('optimistic finance edit feedback parity with durable save state (DV-FB07)',()=>{
  it('does not claim successful persistence before queued Planning or Attention writes',()=>{
    expect(planning).toContain('Η ενημέρωση της προγραμματισμένης κίνησης αποθηκεύεται.');
    expect(planning).toContain('Η ακύρωση αποθηκεύεται.');
    expect(planning).not.toContain('Η προγραμματισμένη κίνηση ενημερώθηκε.');
    expect(attention).toContain('Η αναβολή της υπενθύμισης');
    expect(attention).toContain('αποθηκεύεται.');
  });
  it('distinguishes confirmed vault writes from still queued card profile changes',()=>{
    expect(credit).toContain('Το προφίλ και τα ασφαλή στοιχεία της πιστωτικής αποθηκεύτηκαν.');
    expect(cards).toContain('επιβεβαιώθηκαν ως αποθηκευμένα.');
    expect(cards).toContain('καθαρισμός του ασφαλούς vault ολοκληρώθηκε.');
    expect(credit).toContain('τα ασφαλή στοιχεία καθαρίστηκαν.');
    expect(app).toContain('finance.updateDurably(current=>withCardSecretCleanupPending');
  });
});
