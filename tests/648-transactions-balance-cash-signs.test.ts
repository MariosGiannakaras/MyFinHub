import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createEvent,flowImpactEvent} from '../src/lib/domain.js';
import {receivableCashDirection} from '../src/lib/receivableCashDirection.js';

const page=readFileSync(new URL('../src/pages/TransactionsPage.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');

describe('end-of-day balances and lending cash signs (#648)',()=>{
  it('labels the as-of selector as end-of-day, not a per-event running balance',()=>{
    expect(page).toContain("selectAccountBalances(data,row.date)[accountId]??null");
    expect(page).toContain('Υπόλ. ημέρας');
    expect(page).toContain('aria-label="Υπόλοιπο στο τέλος της ημέρας για τον πρώτο λογαριασμό"');
    expect(page).toContain('Υπόλοιπο τέλους ημέρας</span>');
  });
  it('uses signed account cash direction in desktop and mobile without changing operational flow',()=>{
    expect(page).toContain("receivableCashDirection(row.kind)<0?'−':receivableCashDirection(row.kind)>0?'+':row.kind==='transfer'?'↔ '");
    expect(page).toContain("receivableCashDirection(row.kind)<0?'negative':receivableCashDirection(row.kind)>0?'positive'");
    expect(receivableCashDirection('lending')).toBe(-1);
    expect(receivableCashDirection('repayment')).toBe(1);
    expect(receivableCashDirection('lending_writeoff')).toBe(0);
    expect(receivableCashDirection('transfer')).toBe(0);
    expect(receivableCashDirection('card_payment')).toBe(0);
    expect(page.match(/amountPrefix\(r\)/g)?.length).toBeGreaterThanOrEqual(3);
    for(const [kind,sign,receivableDelta] of [
      ['lending',-1,1],['repayment',1,-1],
    ] as const){
      const event=createEvent({kind,date:'2026-08-17',amount:37.25,note:'Test cash movement',accountId:'cash',person:'QA'});
      expect(event.legs).toEqual([{accountId:'cash',amount:sign*37.25}]);
      expect(event.receivableDelta).toBe(receivableDelta*37.25);
      expect(flowImpactEvent(event)).toEqual({income:0,expense:0,saving:0,refund:0});
    }
  });
  it('uses the same cash-direction owner in Dashboard, preserving neutral noncash movements and privacy',()=>{
    expect(dashboard).toContain("const cashDirection=receivableCashDirection(item.kind)");
    expect(dashboard).toContain("if(cashDirection)return");
    expect(dashboard).toContain("cashDirection<0?'−':'+'");
    expect(dashboard).toContain("receivableCashDirection(item.kind)<0?'negative':receivableCashDirection(item.kind)>0?'positive'");
    expect(dashboard).toContain("privacyVisible?movementAmountLabel(item):'•••••• €'");
    expect(dashboard).toContain("if(item.neutral)return");
    expect(dashboard).toContain("money.format(Math.abs(item.amount))");
  });
});
