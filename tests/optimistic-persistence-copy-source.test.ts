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
    expect(credit).toContain('Τα ασφαλή στοιχεία αποθηκεύτηκαν· το προφίλ της πιστωτικής αποθηκεύεται');
    expect(cards).toContain('Τα ασφαλή στοιχεία της «');
    expect(cards).toContain('η διαγραφή προφίλ αποθηκεύεται.');
    expect(credit).toContain('η οριστική διαγραφή προφίλ αποθηκεύεται.');
    expect(app).toContain('finance.update(current=>withCardProfileDeleted');
  });
});
