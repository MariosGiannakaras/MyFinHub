import {describe,expect,it} from 'vitest';
import {findReceiptPurchaseCandidates} from '../src/lib/receiptPurchaseMatches.js';
import type {FinanceData,FinanceEvent,LegacyTransaction} from '../src/types.js';

const timestamp='2026-08-20T12:00:00.000Z';
function purchase(id:string,date:string,amount:number,note:string,kind:FinanceEvent['kind']='expense'):FinanceEvent{
  return {id,date,amount,note,kind,legs:[],createdAt:timestamp,updatedAt:timestamp};
}
function legacy(id:string,date:string,amount:number,note:string,type:LegacyTransaction['type']='expense'):LegacyTransaction{
  return {id,date,amount,note,type,accountId:'payroll'};
}
function fixture(events:FinanceEvent[]=[],transactions:LegacyTransaction[]=[]):FinanceData{
  return {seed:{transactions},state:{events,overrides:{},deleted:[],customTransactions:[],reviewDecisions:{}}} as unknown as FinanceData;
}
describe('local-only receipt-to-existing-purchase review candidates (#588 C/#3)',()=>{
  it('requires valid EUR calendar date and exact positive cents, without mutating finance state',()=>{
    const data=fixture([purchase('one','2026-08-21',4,'ΚΑΦΕ ΑΘΗΝΑ')]);
    const original=JSON.stringify(data);
    expect(findReceiptPurchaseCandidates(data,{merchant:'καφε αθηνα',date:'2026-08-22',total:4,currency:'EUR'}))
      .toEqual([expect.objectContaining({id:'event:one',daysApart:1,merchantMatches:true,amount:4})]);
    for(const proposal of [
      {date:'2026-02-30',total:4},{date:'2026-08-22',total:4.001},
      {date:'2026-08-22',total:0},{date:'2026-08-22',total:4,currency:'USD'},
      {date:undefined,total:4},{date:'2026-08-22',total:undefined},
    ]){
      expect(findReceiptPurchaseCandidates(data,proposal)).toEqual([]);
    }
    expect(JSON.stringify(data)).toBe(original);
  });
  it('shows nearby exact-value purchases but excludes transfer, repayment, refund, and distant or different amount',()=>{
    const data=fixture([
      purchase('e1','2026-08-20',12.5,'GROCERY STORE'),
      purchase('e2','2026-08-22',12.5,'Unrelated store','card_purchase'),
      purchase('transfer','2026-08-21',12.5,'GROCERY STORE','transfer'),
      purchase('refund','2026-08-21',12.5,'GROCERY STORE','refund'),
      purchase('late','2026-08-30',12.5,'GROCERY STORE'),
      purchase('wrong','2026-08-21',12.51,'GROCERY STORE'),
    ]);
    const result=findReceiptPurchaseCandidates(data,{merchant:'grocery store',date:'2026-08-21',total:12.5});
    expect(result.map(row=>row.id)).toEqual(['event:e1','event:e2']);
    expect(result[0].merchantMatches).toBe(true);
    expect(result[1].merchantMatches).toBe(false);
  });
  it('honors legacy overrides, tombstones, reviewed semantic changes and source-scoped IDs',()=>{
    const data=fixture([purchase('same','2026-08-21',10,'MY CAFE')],
      [legacy('same','2026-08-21',10,'MY CAFE'),legacy('deleted','2026-08-21',10,'MY CAFE'),
       legacy('repurposed','2026-08-21',10,'MY CAFE'),legacy('override','2026-08-21',9,'Other')]);
    data.state.deleted=['deleted'];
    data.state.overrides={override:legacy('override','2026-08-20',10,'MY CAFE')};
    data.state.reviewDecisions={repurposed:{status:'confirmed',semanticKind:'transfer',decidedAt:timestamp}};
    expect(findReceiptPurchaseCandidates(data,{date:'2026-08-21',total:10,merchant:'my cafe'})
      .map(row=>row.id)).toEqual(['event:same','legacy:same','legacy:override']);
  });
  it('matches only purchase-only split parts and uses their exact total, never an implicit adjustment',()=>{
    const yes={...purchase('split','2026-08-21',10,'Shop','split'),parts:[
      {id:'a',label:'A',category:'Groceries',amount:7,kind:'expense' as const},
      {id:'b',label:'B',category:'Groceries',amount:3,kind:'expense' as const},
    ]};
    const no={...purchase('not-purchase','2026-08-21',10,'Shop','split'),parts:[
      {id:'a',label:'A',category:'Other',amount:7,kind:'expense' as const},
      {id:'b',label:'B',category:'Other',amount:3,kind:'saving' as const},
    ]};
    expect(findReceiptPurchaseCandidates(fixture([yes,no]),{date:'2026-08-21',total:10}).map(row=>row.id)).toEqual(['event:split']);
  });
  it('bounds displayed hints and sorts deterministically without associating or creating events',()=>{
    const many=Array.from({length:20},(_,i)=>purchase('p'+i,'2026-08-21',2.5,'SHOP'));
    const data=fixture(many);
    expect(findReceiptPurchaseCandidates(data,{date:'2026-08-21',total:2.5},3).map(row=>row.id)).toEqual(['event:p0','event:p1','event:p10']);
    expect(findReceiptPurchaseCandidates(data,{date:'2026-08-21',total:2.5},100)).toHaveLength(12);
    expect(data.state.events).toHaveLength(20);
  });
});
