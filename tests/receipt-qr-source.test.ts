import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(path,'utf8');
describe('#666 receipt QR safety boundary',()=>{
  it('keeps decoder local, lazy and bounded, before OCR',()=>{
    const inbox=read('src/components/ReceiptInbox.tsx'),worker=read('src/lib/receiptQr.worker.ts'),decoder=read('src/lib/receiptQrImage.ts');
    expect(inbox.indexOf('module.scanReceiptQr(draft.image,controller.signal)')).toBeLessThan(inbox.indexOf('extracted=await scanReceiptLocally'));
    expect(worker).toContain("zxing-wasm/reader/zxing_reader.wasm?url");
    expect(worker).toContain('locateFile:()=>readerWasmUrl');
    expect(worker).toContain('maxNumberOfSymbols:MAX_RECEIPT_CODES');
    expect(decoder).toContain('worker.terminate()');
    expect(decoder).toContain('DECODE_TIMEOUT');
    expect(inbox).toContain('scanAbort.current?.abort()');
    expect(worker).not.toMatch(/fetch\(|XMLHttpRequest|https?:\/\//);
    expect(inbox).not.toContain('createEvent(');
  });
  it('requires review and retains the existing receipt finance boundary',()=>{
    const inbox=read('src/components/ReceiptInbox.tsx'),camera=read('src/components/ReceiptQrCamera.tsx'),qa=read('scripts/receipt-local-ocr-qa.mjs');
    expect(inbox).toContain('if(apply&&needsQrReview)');
    expect(inbox).toContain('if(apply&&needsDuplicateReview)');
    expect(inbox).toContain('duplicateQrDraft');
    expect(inbox).toContain('setQrReviewConfirmed(false)');
    expect(camera).toContain("video:{facingMode:{ideal:'environment'}},audio:false");
    expect(camera).toContain('track.stop()');
    expect(read('vercel.json')).toContain('camera=(self), microphone=()');
    expect(read('server/index.ts')).toContain('camera=(self), microphone=()');
    expect(qa).toContain('actual OCR/QR disagreement survives independently');
    expect(qa).toContain('QR handoff leaves draft and finance unchanged before explicit save');
    expect(qa).toContain('QR/OCR scan never contacts a provider, AADE or external decoder');
  });
});
