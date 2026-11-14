import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeReceiptFile } from '../src/lib/receiptImage.js';

const drafts=readFileSync(new URL('../src/lib/receiptDrafts.ts',import.meta.url),'utf8');
const ocr=readFileSync(new URL('../src/lib/receiptOcr.ts',import.meta.url),'utf8');
const inbox=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const assetSync=readFileSync(new URL('../scripts/sync-ocr-assets.mjs',import.meta.url),'utf8');

describe('local-only receipt privacy boundary',()=>{
  it('rejects non-image and empty receipt uploads before any decoder or local store write (#649 I19.03)',async()=>{
    await expect(normalizeReceiptFile(new File(['<svg><script>no</script></svg>'],'receipt.svg',{type:'image/svg+xml'}))).rejects.toThrow('μόνο εικόνες JPG/JPEG και PNG');
    await expect(normalizeReceiptFile(new File([],'empty.png',{type:'image/png'}))).rejects.toThrow('μικρότερη από 12 MB');
  });
  it('rejects forged MIME signatures even when the filename looks like a receipt image (#649 I19.03)',async()=>{
    await expect(normalizeReceiptFile(new File(['%PDF-1.7'],'taxi.jpg',{type:'image/jpeg'}))).rejects.toThrow('δεν έχει έγκυρη υπογραφή εικόνας');
    await expect(normalizeReceiptFile(new File(['NOT A REAL PNG'],'market.png',{type:'image/png'}))).rejects.toThrow('δεν έχει έγκυρη υπογραφή εικόνας');
    await expect(normalizeReceiptFile(new File(['%PDF-1.7'],'market.png',{type:'image/jpeg'}))).rejects.toThrow('δεν έχει έγκυρη υπογραφή εικόνας');
  });
  it('rejects a receipt that exceeds the strict 12 MiB input limit without allocating a decoder canvas (#649 I19.03)',async()=>{
    const oversized=new File([new ArrayBuffer(12*1024*1024+1)],'huge.jpg',{type:'image/jpeg'});
    await expect(normalizeReceiptFile(oversized)).rejects.toThrow('μικρότερη από 12 MB');
  });

  it('stores pending receipt blobs only through application-local IndexedDB',()=>{
    expect(drafts).toContain('indexedDbFactory');
    expect(drafts).toMatch(/\.open\(DB_NAME, DB_VERSION\)/);
    expect(drafts).toContain("const STORE = 'receipts'");
    expect(drafts).not.toMatch(/supabase|FinanceData|fetch\(|XMLHttpRequest|https?:\/\//i);
  });

  it('uses only same-origin self-hosted OCR paths and no receipt API request',()=>{
    expect(ocr).toContain("workerPath: '/ocr/worker.min.js'");
    expect(ocr).toContain("corePath: '/ocr/core'");
    expect(ocr).toContain("langPath: '/ocr/lang'");
    expect(ocr).not.toMatch(/https?:\/\/|axios|XMLHttpRequest/i);
    expect(ocr).toContain("fetch('/ocr/asset-manifest.json'");
    expect(ocr).toContain("fetch(path,{method:'HEAD'");
    expect(ocr).not.toMatch(/fetch\([^\n]*(image|blob|prepared|result\.data)/i);
  });

  it('clears a failed worker bootstrap so OCR can retry after local assets recover',()=>{
    expect(ocr).toContain('workerPromise = buildWorker().catch((error) => {');
    expect(ocr).toContain('workerPromise = null;');
  });

  it('never persists raw OCR text in the local draft schema',()=>{
    expect(drafts).not.toMatch(/rawOcr|ocrText|rawText/i);
    expect(ocr).toContain("parseReceiptText(result.data.text");
    expect(inbox).not.toMatch(/rawOcr|ocrText|rawText/i);
  });

  it('self-hosts Greek and English language data from pinned npm dependencies',()=>{
    expect(assetSync).toContain("'ell.traineddata.gz'");
    expect(assetSync).toContain("'eng.traineddata.gz'");
    expect(assetSync).toContain("'4.0.0_best_int'");
    expect(assetSync).toContain("receiptContentNetworkUse: false");
  });

  it('keeps explicit local count and storage budgets',()=>{
    expect(drafts).toContain('RECEIPT_DRAFT_LIMIT = 30');
    expect(drafts).toContain('RECEIPT_STORAGE_BUDGET_BYTES = 60 * 1024 * 1024');
    expect(inbox).toContain('Αποθηκεύτηκε για αργότερα');
  });
});
