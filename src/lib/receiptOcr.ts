import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { ReceiptProposal } from './receiptDrafts.js';
import { preprocessReceiptForOcr } from './receiptImage.js';
import { parseReceiptText } from './receiptParser.js';

export type ReceiptOcrProgress = { status: string; progress: number };

const LOCAL_OCR = {
  workerPath: '/ocr/worker.min.js',
  corePath: '/ocr/core',
  langPath: '/ocr/lang',
} as const;

let workerPromise: Promise<Worker> | null = null;
let activeProgress: ((progress: ReceiptOcrProgress) => void) | null = null;
let generation = 0;

async function buildWorker() {
  const ownGeneration = generation;
  const worker = await createWorker(['ell', 'eng'], OEM.LSTM_ONLY, {
    ...LOCAL_OCR,
    logger: (message) => {
      if (ownGeneration !== generation || !activeProgress) return;
      activeProgress({ status: String(message.status ?? 'recognizing text'), progress: Number(message.progress ?? 0) });
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1',
  });
  return worker;
}

async function getWorker() {
  if (!workerPromise) workerPromise = buildWorker();
  return workerPromise;
}

async function resetWorker() {
  generation += 1;
  activeProgress = null;
  const current = workerPromise;
  workerPromise = null;
  if (!current) return;
  try {
    const worker = await current;
    await worker.terminate();
  } catch {
    // Worker initialization/termination failures are intentionally discarded.
  }
}

export async function cancelReceiptOcr() {
  await resetWorker();
}

export async function scanReceiptLocally(
  image: Blob,
  onProgress?: (progress: ReceiptOcrProgress) => void,
  timeoutMs = 45_000,
): Promise<ReceiptProposal> {
  const scanGeneration = generation;
  activeProgress = onProgress ?? null;
  const prepared = await preprocessReceiptForOcr(image);
  const worker = await getWorker();
  if (scanGeneration !== generation) throw new Error('OCR_CANCELLED');

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), timeoutMs);
    });
    const recognition = worker.recognize(prepared);
    const result = await Promise.race([recognition, timeout]);
    if (scanGeneration !== generation) throw new Error('OCR_CANCELLED');
    const proposal = parseReceiptText(result.data.text ?? '', Number(result.data.confidence ?? 0));
    if (!proposal.merchant && !proposal.date && !proposal.total) throw new Error('OCR_NO_USEFUL_FIELDS');
    return proposal;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'OCR_FAILED';
    if (code === 'OCR_TIMEOUT' || code === 'OCR_CANCELLED') await resetWorker();
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (scanGeneration === generation) activeProgress = null;
  }
}

export async function disposeReceiptOcr() {
  await resetWorker();
}
