import {describe,expect,it} from 'vitest';
import {classifyReceiptCodes,mergeReceiptQrOcr,parseAadeReceiptQr,MAX_RECEIPT_CODES} from '../src/lib/receiptQr.js';
const prefix='https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=';
const synthetic='TST00000001000000420123456789ABCDEF0123456789ABCD';
const qr=(tail='260822103718.35')=>prefix+synthetic+tail;
const code=(text:string,format='QRCode')=>({format,text,valid:true,sequenceSize:-1});
describe('#666 local AADE receipt QR',()=>{
  it('parses the official fixed-width fields and exact integer cents',()=>{
    expect(parseAadeReceiptQr(qr())).toEqual({kind:'aade',identifier:'TST00000001:00000042',date:'2026-08-22',time:'10:37',totalCents:1835});
    expect(parseAadeReceiptQr(qr('24022923590.01'))?.totalCents).toBe(1);
    expect(parseAadeReceiptQr(qr('260822103718.3'))?.totalCents).toBe(1830);
    expect(parseAadeReceiptQr(qr('260822103718'))?.totalCents).toBe(1800);
  });
  it('rejects malformed or ambiguous URL, dates, time, amount, grammar and extra fields',()=>{
    for(const value of [qr().replace('https:','http:'),qr().replace('www1.aade.gr','www1.aade.gr.evil.invalid'),qr().replace('www1.aade.gr','user@www1.aade.gr'),qr().replace('www1.aade.gr','www1.aade.gr:443'),qr()+'&x=1',qr()+'#fragment',qr().replace('SIG=','SIG=%'),qr().replace('TST','T-T'),qr('230229103718.35'),qr('261322103718.35'),qr('260822243718.35'),qr('260822106018.35'),qr('26082210370'),qr('2608221037-1.00'),qr('26082210371.001'),qr('26082210371e2'),qr('26082210371,20'),qr('260822103718.35USD'),qr('2608221037999999999999999999')])expect(parseAadeReceiptQr(value)).toBeNull();
  });
  it('distinguishes products, untrusted links and conflicts without exposing raw content',()=>{
    expect(classifyReceiptCodes([])).toEqual({kind:'none'});
    expect(classifyReceiptCodes([code('5201234567890','EAN13')])).toEqual({kind:'product'});
    expect(classifyReceiptCodes([code('https://provider.invalid/receipt/secret')])).toEqual({kind:'external-link'});
    expect(classifyReceiptCodes([code(qr()+'&extra=x')])).toEqual({kind:'malformed'});
    expect(classifyReceiptCodes([code('unrelated QR')])).toEqual({kind:'unsupported'});
    expect(classifyReceiptCodes([code(qr()),code(qr('260822103718.36'))])).toEqual({kind:'multiple'});
    expect(classifyReceiptCodes([code(qr()),code('https://provider.invalid/receipt')])).toEqual({kind:'multiple'});
    expect(classifyReceiptCodes([code(qr()),code(qr()),code('5201234567890','EAN13')])).toEqual(parseAadeReceiptQr(qr()));
    expect(classifyReceiptCodes(Array.from({length:MAX_RECEIPT_CODES},()=>code(qr())))).toEqual({kind:'multiple'});
    expect(classifyReceiptCodes([{...code(qr()),valid:false}])).toEqual({kind:'malformed'});
  });
  it('retains disagreement, source currency, merchant and lines without treating QR as authentication',()=>{
    const fiscal=parseAadeReceiptQr(qr())!;
    const agreed=mergeReceiptQrOcr(fiscal,{merchant:'Synthetic market',date:fiscal.date,total:18.35,currency:'EUR'});
    expect(agreed).toMatchObject({total:18.35,date:fiscal.date,currency:'EUR',merchant:'Synthetic market',qr:{conflicts:[]}});
    const mismatch=mergeReceiptQrOcr(fiscal,{date:'2026-08-21',total:12.4,currency:'USD',items:[{id:'1',description:'Item',amount:12.4,confidence:.9}]});
    expect(mismatch).toMatchObject({total:12.4,date:'2026-08-21',currency:'USD',itemsCurrency:'USD',qr:{totalCents:1835,ocrTotal:12.4,ocrCurrency:'USD',ocrDate:'2026-08-21',conflicts:['date','amount','currency']}});
    expect(mergeReceiptQrOcr(fiscal)).toMatchObject({total:18.35,date:fiscal.date,currency:'EUR'});
    expect(mergeReceiptQrOcr({kind:'multiple'},{})).toEqual({qr:{kind:'multiple'}});
    expect(mergeReceiptQrOcr({kind:'unavailable'},{total:12})).toEqual({total:12});
  });
});
