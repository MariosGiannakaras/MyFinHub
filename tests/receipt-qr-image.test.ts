import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe,expect,it} from 'vitest';
import {prepareZXingModule,readBarcodes} from 'zxing-wasm/reader';
import {classifyReceiptCodes,MAX_RECEIPT_CODES} from '../src/lib/receiptQr.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/receipt-qr-images.json',import.meta.url),'utf8')) as Record<string,string>;
const require=createRequire(import.meta.url);
// The independent synthetic PNGs are decoded by the actual pinned WASM reader,
// using only bytes from its installed package (no CDN/network).
prepareZXingModule({overrides:{wasmBinary:new Uint8Array(readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')))}});
describe('#666 actual local receipt QR image decoding',()=>{
  for(const [name,kind] of [['aade','aade'],['multi','multiple'],['provider','external-link'],['malformed','malformed'],['product','product']] as const){
    it('decodes synthetic '+name+' PNG as '+kind,async()=>{
      const blob=new Blob([new Uint8Array(Buffer.from(fixture[name],'base64'))],{type:'image/png'});
      const codes=await readBarcodes(blob,{formats:['QRCode','EAN13','EAN8','UPCA','UPCE'],maxNumberOfSymbols:MAX_RECEIPT_CODES,returnErrors:true,textMode:'Plain'});
      const result=classifyReceiptCodes(codes.map(code=>({format:code.format,text:code.text,valid:code.isValid,sequenceSize:code.sequenceSize})));
      expect(result.kind).toBe(kind);
      if(result.kind==='aade')expect(result).toMatchObject({identifier:'TST00000001:00000042',date:'2026-08-22',time:'10:37',totalCents:1835});
    },15000);
  }
});
