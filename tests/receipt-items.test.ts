import {describe,expect,it} from 'vitest';
import {parseReceiptText} from '../src/lib/receiptParser.js';

describe('offline receipt OCR line suggestions (#588 C/#3)',()=>{
 it('extracts itemized Greek OCR lines exactly and ignores cash/change/VAT/grand total',()=>{
  const result=parseReceiptText(`ΚΑΦΕ ΑΘΗΝΑ\n22/08/2026 11:34\nΚΑΦΕ 3,50\nΝΕΡΟ 0,50\nΦΠΑ 0,52\nΣΥΝΟΛΟ 4,00 €\nΜΕΤΡΗΤΑ 10,00\nΡΕΣΤΑ 6,00`,91);
  expect(result.total).toBe(4);
  expect(result.items).toEqual([
   expect.objectContaining({id:'ocr-line-3',description:'ΚΑΦΕ',amount:3.5}),
   expect.objectContaining({id:'ocr-line-4',description:'ΝΕΡΟ',amount:.5})
  ]);
  expect(result.itemsBalanced).toBe(true);
 });
 it('retains an explicitly unbalanced OCR item list as a proposal, without fabricating a purchase or discount',()=>{
  const result=parseReceiptText(`MARKET\nAPPLE 8.00\nMILK 5.00\nSUBTOTAL 13.00\nDISCOUNT 0.50\nTOTAL 12.50 EUR\nCARD 12.50`,80);
  expect(result.total).toBe(12.5);
  expect(result.items?.map(item=>item.amount)).toEqual([8,5]);
  expect(result.itemsBalanced).toBe(false);
 });
 it('never treats tender, printed date, phone, POS or standalone barcode amount as a purchased item',()=>{
  const result=parseReceiptText(`RECEIPT\nDATE 21-08-2026\nPOS CREDIT 33.00\nVAT 3.30\nTOTAL 33.00 EUR\nCASH 50.00\nCHANGE 17.00\n2101234567\n0000180000000 14.00`,85);
  expect(result.items).toBeUndefined();
  expect(result.itemsBalanced).toBeUndefined();
 });
 it('suggestions have stable line references and cannot exceed explicit grand total',()=>{
  const result=parseReceiptText(`LOCAL STORE\nMILK 1,01\nBREAD 0,29\nTOO EXPENSIVE 999,99\nTOTAL 1,30 €`,75);
  expect(result.items).toEqual([
   expect.objectContaining({id:'ocr-line-2',amount:1.01}),
   expect.objectContaining({id:'ocr-line-3',amount:.29})
  ]);
  expect(result.itemsBalanced).toBe(true);
 });
});
