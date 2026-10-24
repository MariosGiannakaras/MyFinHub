import {describe,expect,it} from 'vitest';
import {receiptSplitParts} from '../src/lib/receiptItemReview.js';
import type {ReceiptProposal} from '../src/lib/receiptDrafts.js';
import type {FinanceSettings} from '../src/types.js';
const settings={expenseCategoryTree:[{name:'Τρόφιμα',subcategories:['Καφές','Νερό']},{name:'Μεταφορές',subcategories:[]}],expenseCategories:['Τρόφιμα','Μεταφορές']} as unknown as FinanceSettings;
const base:ReceiptProposal={total:.3,currency:'EUR',itemsCurrency:'EUR',items:[
 {id:'ocr-1',description:'ΚΑΦΕΣ',amount:.1,confidence:.9,category:'Τρόφιμα',subcategory:'Καφές'},
 {id:'ocr-2',description:'ΝΕΡΟ',amount:.2,confidence:.9,category:'Τρόφιμα',subcategory:'Νερό'}]};
describe('owner-confirmed receipt split into canonical QuickAdd',()=>{
 it('prepares one EUR-cent balanced live-taxonomy proposal without changing OCR identities',()=>{
  expect(receiptSplitParts(base,settings)).toEqual([
   {id:'receipt-part-1',label:'ΚΑΦΕΣ',category:'Τρόφιμα',subcategory:'Καφές',amount:.1},
   {id:'receipt-part-2',label:'ΝΕΡΟ',category:'Τρόφιμα',subcategory:'Νερό',amount:.2}]);
  expect(base.items![0].id).toBe('ocr-1');
 });
 it('rejects mismatch, unknown or foreign currency and retired category/subcategory',()=>{
  for(const p of [{...base,total:.31},{...base,currency:'USD'},{...base,itemsCurrency:'USD'},{...base,itemsCurrency:undefined},{...base,currency:undefined},
   {...base,items:[{...base.items![0],category:'Άγνωστο'},base.items![1]]},
   {...base,items:[{...base.items![0],subcategory:'Άγνωστο'},base.items![1]]}])
    expect(receiptSplitParts(p,settings)).toBeNull();
 });
 it('rejects one part, repeated IDs, subcents, blank item and 41 lines',()=>{
  for(const p of [{...base,items:base.items!.slice(0,1)},{...base,items:[{...base.items![0],id:'ocr-2'},base.items![1]]},
   {...base,items:[{...base.items![0],amount:.101},base.items![1]]},
   {...base,items:[{...base.items![0],description:' '},base.items![1]]},
   {...base,total:4.1,items:Array.from({length:41},(_,i)=>({...base.items![0],id:'row'+i,amount:.1}))}])
    expect(receiptSplitParts(p,settings)).toBeNull();
 });
});
