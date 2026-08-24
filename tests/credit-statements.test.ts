import { describe, expect, it } from 'vitest';
import { creditStatementView, groupCardPurchasesByStatement, prepareCreditStatementEvent, recommendedPayableStatement, statementCloseDateForPurchase, statementDueDateForClose, statementOpenDateForClose } from '../src/lib/creditStatements.js';
import { qaFinanceData } from '../src/qaFixture.js';
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

  it('persists a statement snapshot for a new configured-card purchase without rewriting other events',()=>{
    const data=qaFinanceData();
    const event:FinanceEvent={id:'new-statement-purchase',date:'2026-08-18',kind:'card_purchase',amount:25,note:'QA new',cardId:'qa-card',legs:[{accountId:'credit-card',amount:-25}],createdAt:'2026-08-18T10:00:00.000Z',updatedAt:'2026-08-18T10:00:00.000Z'};
    const prepared=prepareCreditStatementEvent(data,event,'2026-08-18T10:00:00.000Z');
    expect(prepared.event.statementId).toBe('qa-card:2026-09-12');
    expect(prepared.statements.filter(item=>item.id==='qa-card:2026-09-12')).toHaveLength(1);
    expect(data.state.events?.some(item=>item.id==='new-statement-purchase')).toBe(false);
  });

  it('leaves a purchase unlinked when statement semantics are incomplete',()=>{
    const data=qaFinanceData();
    data.state.cards=(data.state.cards??[]).map(card=>card.id==='qa-card'?{...card,statementBoundaryRule:undefined}:card);
    const event:FinanceEvent={id:'unconfigured-purchase',date:'2026-08-18',kind:'card_purchase',amount:25,note:'QA unconfigured',cardId:'qa-card',legs:[{accountId:'credit-card',amount:-25}],createdAt:'2026-08-18T10:00:00.000Z',updatedAt:'2026-08-18T10:00:00.000Z'};
    expect(prepareCreditStatementEvent(data,event).event.statementId).toBeUndefined();
  });

  it('derives partial and full payment state from real linked events',()=>{
    const data=qaFinanceData();
    const record=(data.state.creditStatements??[]).find(item=>item.id==='qa-card:2026-08-12')!;
    const partial=creditStatementView(data,record,'2026-08-17');
    expect(partial.purchaseTotal).toBe(120);
    expect(partial.paymentTotal).toBe(30);
    expect(partial.remaining).toBe(90);
    expect(partial.status).toBe('closed');
    data.state.events=[...(data.state.events??[]),{id:'statement-final-payment',date:'2026-08-17',kind:'card_payment',amount:90,note:'Final',fromAccountId:'piraeus-payroll',cardId:'qa-card',statementId:record.id,legs:[{accountId:'piraeus-payroll',amount:-90},{accountId:'credit-card',amount:90}],createdAt:'2026-08-17T12:00:00.000Z',updatedAt:'2026-08-17T12:00:00.000Z'}];
    expect(creditStatementView(data,record,'2026-08-17').status).toBe('paid');
    expect(creditStatementView(data,record,'2026-08-17').remaining).toBe(0);
  });

  it('recomputes statement balances after payment deletion and recommends payable closed statements before open ones',()=>{
    const data=qaFinanceData();
    const selected=recommendedPayableStatement(data,'qa-card','2026-08-17');
    expect(selected?.id).toBe('qa-card:2026-08-12');
    data.state.events=(data.state.events??[]).filter(event=>event.id!=='evt-card-payment-later');
    const record=(data.state.creditStatements??[]).find(item=>item.id==='qa-card:2026-08-12')!;
    expect(creditStatementView(data,record,'2026-08-17').remaining).toBe(100);
  });
});
