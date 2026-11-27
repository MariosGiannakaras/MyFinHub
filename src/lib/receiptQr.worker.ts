import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import readerWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { classifyReceiptCodes, MAX_RECEIPT_CODES } from './receiptQr';

// Override the dependency's default CDN resolver before any decode. Only the
// build-emitted same-origin reader asset can be loaded. No URL from a QR is used.
prepareZXingModule({overrides:{locateFile:()=>readerWasmUrl}});
globalThis.onmessage=async(event:MessageEvent<{pixels:ImageData}>)=>{
  try{
    const {pixels}=event.data;
    const results=await readBarcodes(pixels,{formats:['QRCode','EAN13','EAN8','UPCA','UPCE'],maxNumberOfSymbols:MAX_RECEIPT_CODES,returnErrors:true,textMode:'Plain'});
    globalThis.postMessage(classifyReceiptCodes(results.map(result=>({format:result.format,text:result.text,valid:result.isValid,sequenceSize:result.sequenceSize}))));
  }catch{globalThis.postMessage({kind:'unavailable'})}
};
