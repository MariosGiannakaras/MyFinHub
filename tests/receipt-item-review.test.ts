import {describe,expect,it} from 'vitest';
import {normalizeReceiptLineReview} from '../src/lib/receiptItemReview.js';
import type {ReceiptProposal} from '../src/lib/receiptDrafts.js';
const draft:ReceiptProposal={currency:'EUR',total:.3,items:[
  {id:'a',description:'Καφές',amount:.1,confidence:.8,category:'Τρόφιμα',subcategory:'Καφές'},
  {id:'b',description:'Νερό',amount:.2,confidence:.75}
]};
describe('owner reviewed receipt line conservation (#588 C)',()=>{
  it('sums 0.10+0.20 in integer cents and preserves live taxonomy selection',()=>{
    const x=normalizeReceiptLineReview(draft,{a:'0.10',b:'0,20'},'0.30');
    expect(x).toMatchObject({valid:true,balanced:true,sumCents:30,totalCents:30});
    expect(x.items[0]).toMatchObject({amount:.1,category:'Τρόφιμα',subcategory:'Καφές'});
    expect(draft.items?.[0].amount).toBe(.1);
  });
  it('reports a genuine EUR-cent gap without inventing discounts or financial events',()=>{
    const x=normalizeReceiptLineReview(draft,{a:'0.10',b:'0.19'},'0.30');
    expect(x.valid).toBe(true);expect(x.balanced).toBe(false);
    expect(x.sumCents).toBe(29);expect(x.totalCents).toBe(30);
    expect(x.items).toHaveLength(2);
  });
  it('rejects partial, sub-cent, negative, zero, empty, duplicate, and non-cent items',()=>{
    for(const input of ['', '0', '-1', '1.001', 'oops']){
      expect(normalizeReceiptLineReview(draft,{a:input,b:'0.2'},'0.30').valid).toBe(false);
    }
    const repeated={...draft,items:[draft.items![0],{...draft.items![1],id:'a'}]};
    expect(normalizeReceiptLineReview(repeated,{a:'0.10'},'0.30').valid).toBe(false);
    expect(normalizeReceiptLineReview({...draft,items:[{...draft.items![0],description:'   '}]},{a:'0.1'},'0.1').valid).toBe(false);
  });
  it('rejects unsafe amounts and caps untrusted line count at 40',()=>{
    expect(normalizeReceiptLineReview(draft,{a:'999999999999999',b:'0.2'},'0.3').valid).toBe(false);
    const excessive={...draft,items:Array.from({length:41},(_,i)=>({...draft.items![0],id:'row'+i}))};
    expect(normalizeReceiptLineReview(excessive,{},'4.10').valid).toBe(false);
  });
});
