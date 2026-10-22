import {describe,expect,it} from 'vitest';
import {suggestReceiptCategory} from '../src/lib/reviewedMerchantSignals.js';
import type {FinanceData,FinanceEvent,FinanceSettings} from '../src/types.js';
const event=(id:string,note:string,category:string,kind:FinanceEvent['kind']='expense'):FinanceEvent=>
 ({id,date:'2026-10-20',kind,amount:10,note,category,legs:[],createdAt:'2026-10-20T11:00:00Z',updatedAt:'2026-10-20T11:00:00Z'});
const settings={expenseCategories:['Τρόφιμα','Μεταφορές'],expenseCategoryTree:[{name:'Τρόφιμα',subcategories:[]},{name:'Μεταφορές',subcategories:[]}]} as unknown as FinanceSettings;
const finance=(events:FinanceEvent[])=>({state:{events,settings}} as unknown as FinanceData);
describe('C2 private reviewed merchant category signals',()=>{
 it('recommends only from repeated exact Greek/English merchant names with deterministic majority',()=>{
  const data=finance([event('a','ΚΑΦΕ ΑΘΗΝΑ','Τρόφιμα'),event('b','Καφέ Αθήνα','Τρόφιμα','card_purchase'),event('c','ΚΑΦΕ ΑΘΗΝΑ','Μεταφορές')]);
  expect(suggestReceiptCategory(data,'καφε αθηνα')).toBe('Τρόφιμα');
 });
 it('never mistakes substring neighbors or financial non-purchases as this merchant',()=>{
  const data=finance([event('a','SUPER MARKET','Τρόφιμα'),event('b','SUPER MARKET','Τρόφιμα'),event('c','MARKET','Μεταφορές','transfer'),event('d','MARKET','Μεταφορές','refund')]);
  expect(suggestReceiptCategory(data,'MARKET')).toBeUndefined();
  expect(suggestReceiptCategory(data,'SUPER-MARKET')).toBe('Τρόφιμα');
 });
 it('deduplicates IDs and refuses unknown, retired, short or split-vs-nonsplit merchants',()=>{
  const data=finance([event('same','STORE','Τρόφιμα'),event('same','STORE','Τρόφιμα'),event('unique','STORE','Τρόφιμα','split')]);
  expect(suggestReceiptCategory(data,'STORE')).toBeUndefined();
  expect(suggestReceiptCategory(finance([event('a','RETIRED STORE','Παλιά'),event('b','RETIRED STORE','Παλιά')]),'RETIRED STORE')).toBeUndefined();
  expect(suggestReceiptCategory(data,'s')).toBeUndefined();
 });
 it('leaves finance history unchanged and refuses a tied category distribution',()=>{
  const data=finance([event('1','CAFE K','Τρόφιμα'),event('2','CAFE K','Μεταφορές')]);
  const snapshot=JSON.stringify(data);
  expect(suggestReceiptCategory(data,'CAFE K')).toBeUndefined();
  expect(JSON.stringify(data)).toBe(snapshot);
 });
});
