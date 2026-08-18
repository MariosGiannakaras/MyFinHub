import { describe, expect, it } from 'vitest';
import { flowImpactEvent } from '../src/lib/domain.js';
import { createPersonEvent, personBalanceDelta } from '../src/lib/personSettlements.js';

const base={person:'Άτομο',date:'2026-08-18'} as const;

describe('person settlement semantics',()=>{
  it('records an expense paid by another person without a bank leg',()=>{
    const event=createPersonEvent({...base,action:'paid_by_other',amount:30,category:'Φαγητό'});
    expect(event.kind).toBe('expense');
    expect(event.legs).toEqual([]);
    expect(personBalanceDelta(event)).toBe(-30);
    expect(flowImpactEvent(event)).toMatchObject({expense:30,income:0});
  });

  it('records money paid for another as a receivable, not spending',()=>{
    const event=createPersonEvent({...base,action:'paid_for_other',amount:20,accountId:'payroll'});
    expect(event.legs).toEqual([{accountId:'payroll',amount:-20}]);
    expect(personBalanceDelta(event)).toBe(20);
    expect(flowImpactEvent(event).expense).toBe(0);
  });

  it('splits a shared purchase into own expense and the other share',()=>{
    const event=createPersonEvent({...base,action:'shared_purchase',amount:50,personShare:20,accountId:'payroll',category:'Φαγητό'});
    expect(event.amount).toBe(30);
    expect(event.paymentTotal).toBe(50);
    expect(event.legs).toEqual([{accountId:'payroll',amount:-50}]);
    expect(personBalanceDelta(event)).toBe(20);
    expect(flowImpactEvent(event).expense).toBe(30);
  });

  it('settles a positive balance by incoming cash/IRIS without income',()=>{
    const event=createPersonEvent({...base,action:'settlement_received',amount:20,currentBalance:20,accountId:'cash',settlementMethod:'cash'});
    expect(event.kind).toBe('transfer');
    expect(event.legs).toEqual([{accountId:'cash',amount:20}]);
    expect(personBalanceDelta(event)).toBe(-20);
    expect(flowImpactEvent(event)).toMatchObject({income:0,expense:0});
  });

  it('settles a negative balance by outgoing IRIS without spending',()=>{
    const event=createPersonEvent({...base,action:'settlement_sent',amount:30,currentBalance:-30,accountId:'payroll',settlementMethod:'iris'});
    expect(event.kind).toBe('transfer');
    expect(event.legs).toEqual([{accountId:'payroll',amount:-30}]);
    expect(personBalanceDelta(event)).toBe(30);
    expect(flowImpactEvent(event)).toMatchObject({income:0,expense:0});
  });

  it('forgives either direction without moving money',()=>{
    const receivable=createPersonEvent({...base,action:'forgiven',amount:10,currentBalance:25});
    expect(receivable.legs).toEqual([]);
    expect(personBalanceDelta(receivable)).toBe(-10);
    const payable=createPersonEvent({...base,action:'forgiven',amount:10,currentBalance:-25});
    expect(payable.legs).toEqual([]);
    expect(personBalanceDelta(payable)).toBe(10);
  });
});
