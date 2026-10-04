import { describe, expect, it } from 'vitest';
import { migrateProductData } from '../src/lib/productMigration.js';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';
import { realStackFinanceData } from '../scripts/real-stack-fixture.js';

describe('real-stack synthetic finance fixture',()=>{
  it('passes the same complete validation boundary before and after product migration',()=>{
    const fixture=realStackFinanceData();
    expect(()=>validateCompleteFinanceData(fixture)).not.toThrow();
    const migrated=migrateProductData(structuredClone(fixture));
    expect(()=>validateCompleteFinanceData(migrated)).not.toThrow();
  });

  it('contains only deterministic synthetic finance content',()=>{
    const fixture=realStackFinanceData();
    expect(fixture.seed.accounts.map(item=>item.id)).toEqual(['qa-cash','qa-bank-account','qa-savings']);
    expect(fixture.seed.accounts.find(item=>item.id==='qa-savings')).toMatchObject({kind:'savings',providerId:'qa-bank',bankAccountCategory:'savings'});
    expect(fixture.state.cards?.find(item=>item.id==='qa-credit-card')).toMatchObject({
      bankId:'qa-bank',
      kind:'credit',
      creditLimit:300,
      statementClosingDay:12,
      statementDueDay:20,
      statementBoundaryRule:'next-cycle',
    });
    expect(fixture.seed.transactions).toHaveLength(1);
    expect(JSON.stringify(fixture)).not.toMatch(/piraeus|alpha|eurobank|revolut|national|viva|payzy/i);
  });
});
