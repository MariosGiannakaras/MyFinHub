import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const drafts=readFileSync(new URL('../src/lib/receiptDrafts.ts',import.meta.url),'utf8');
const ocr=readFileSync(new URL('../src/lib/receiptOcr.ts',import.meta.url),'utf8');
const inbox=readFileSync(new URL('../src/components/ReceiptInbox.tsx',import.meta.url),'utf8');
const assetSync=readFileSync(new URL('../scripts/sync-ocr-assets.mjs',import.meta.url),'utf8');

describe('local-only receipt privacy boundary',()=>{
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
    expect(ocr).not.toMatch(/https?:\/\/|fetch\(|axios|XMLHttpRequest/i);
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
