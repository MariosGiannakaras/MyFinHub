import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const formError=read('src/components/FormError.tsx');
const persistence=read('src/components/PersistenceNotice.tsx');

const canonicalConsumers=[
  'src/components/MoneyEditDialog.tsx',
  'src/components/QuickAdd.tsx',
  'src/components/ReceiptInbox.tsx',
  'src/pages/PlanningPage.tsx',
  'src/pages/CreditCardPage.tsx',
  'src/pages/RecurringPage.tsx',
  'src/pages/CardsPage.tsx',
  'src/pages/SavingsPage.tsx',
  'src/pages/LoansPage.tsx',
  'src/pages/LendingPage.tsx',
];

describe('post-redesign form feedback ownership',()=>{
  it('keeps the shared FormError assertive and class-compatible',()=>{
    expect(formError).toContain('className="form-error"');
    expect(formError).toContain('role="alert"');
    expect(formError).toContain('aria-live="assertive"');
  });

  it('keeps generic finance editor errors on FormError instead of hand-built form-error markup',()=>{
    for(const path of canonicalConsumers){
      const source=read(path);
      expect(source, path).toContain('FormError');
      expect(source, path).not.toContain('className="form-error"');
    }
  });

  it('keeps loading, saving, saved and persistence failures announced with the right urgency',()=>{
    expect(persistence).toContain("saveState==='loading'");
    expect(persistence).toContain("saveState==='saving'");
    expect(persistence).toContain('role="status"');
    expect(persistence).toContain('aria-live="polite"');
    expect(persistence).toContain('Αποθηκεύτηκε');
    expect(persistence).toContain("saveState==='error'||saveState==='conflict'");
    expect(persistence).toContain('role="alert"');
    expect(persistence).toContain('aria-live="assertive"');
  });

  it('preserves polite page-level action acknowledgements on representative finance flows',()=>{
    for(const path of [
      'src/pages/CardsPage.tsx',
      'src/pages/PlanningPage.tsx',
      'src/pages/CreditCardPage.tsx',
      'src/pages/RecurringPage.tsx',
      'src/pages/TransactionsPage.tsx',
    ]){
      const source=read(path);
      expect(source, path).toContain('className="action-status"');
      expect(source, path).toContain('role="status"');
      expect(source, path).toContain('aria-live="polite"');
    }
  });
});
