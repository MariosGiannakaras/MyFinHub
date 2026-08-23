import { describe, expect, it } from 'vitest';
import { groupCardPurchasesByStatement, statementCloseDateForPurchase, statementDueDateForClose, statementOpenDateForClose } from '../src/lib/creditStatements.js';
import type { FinanceEvent } from '../src/types.js';

const purchase=(id:string,date:string,amount:number):FinanceEvent=>({id,date,kind:'card_purchase',amount,note:id,cardId:'card-1',legs:[{accountId:'credit-card',amount:-amount}],createdAt:`${date}T12:00:00.000Z`,updatedAt:`${date}T12:00:00.000Z`});

describe('credit-card statement cycles',()=>{
  it('clamps closing days safely for short months',()=>{
    expect(statementCloseDateForPurchase('2026-02-20',31,'include-closing-day')).toBe('2026-02-28');
    expect(statementOpenDateForClose('2026-02-28',31)).toBe('2026-02-01');
  });

  it('keeps the closing-day boundary explicit instead of silently choosing a product rule',()=>{
    expect(statementCloseDateForPurchase('2026-08-25',25,'include-closing-day')).toBe('2026-08-25');
    expect(statementCloseDateForPurchase('2026-08-25',25,'next-cycle')).toBe('2026-09-25');
  });

  it('resolves the first configured due day strictly after statement close',()=>{
    expect(statementDueDateForClose('2026-08-25',28)).toBe('2026-08-28');
    expect(statementDueDateForClose('2026-08-28',28)).toBe('2026-09-28');
    expect(statementDueDateForClose('2026-01-31',31)).toBe('2026-02-28');
  });

  it('groups purchases exactly once into deterministic card statement cycles',()=>{
    const cycles=groupCardPurchasesByStatement([
      purchase('a','2026-08-10',20),
      purchase('b','2026-08-25',30),
      purchase('c','2026-08-26',40),
      {...purchase('other','2026-08-12',99),cardId:'card-2'},
    ],'card-1',25,'include-closing-day');

    expect(cycles).toEqual([
      {id:'card-1:2026-09-25',cardId:'card-1',openDate:'2026-08-26',closeDate:'2026-09-25',purchaseIds:['c'],purchaseTotal:40},
      {id:'card-1:2026-08-25',cardId:'card-1',openDate:'2026-07-26',closeDate:'2026-08-25',purchaseIds:['a','b'],purchaseTotal:50},
    ]);
  });
});
