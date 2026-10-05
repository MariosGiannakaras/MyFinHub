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
let assetCheckPromise:Promise<void>|null=null;
let activeProgress: ((progress: ReceiptOcrProgress) => void) | null = null;
let generation = 0;

async function assertLocalOcrAssets(){
  assetCheckPromise??=(async()=>{
    let response:Response;
    try{response=await fetch('/ocr/asset-manifest.json',{credentials:'same-origin',cache:'no-store'})}
    catch{throw new Error('OCR_ASSETS_UNAVAILABLE')}
    if(!response.ok)throw new Error('OCR_ASSETS_UNAVAILABLE');
    const manifest=await response.json().catch(()=>null) as {tesseractJs?:string;languages?:unknown;coreFiles?:unknown}|null;
    const languages=Array.isArray(manifest?.languages)?manifest.languages.filter((value):value is string=>typeof value==='string'):[];
    const coreFiles=Array.isArray(manifest?.coreFiles)?manifest.coreFiles.filter((value):value is string=>typeof value==='string'):[];
    if(manifest?.tesseractJs!=='7.0.0'||!languages.includes('ell')||!languages.includes('eng')||!coreFiles.length)throw new Error('OCR_ASSETS_UNAVAILABLE');
    const required=['/ocr/worker.min.js','/ocr/lang/ell.traineddata.gz','/ocr/lang/eng.traineddata.gz',...coreFiles.map(name=>`/ocr/core/${name}`)];
    const probes=await Promise.all(required.map(async path=>{
      try{return (await fetch(path,{method:'HEAD',credentials:'same-origin',cache:'no-store'})).ok}catch{return false}
    }));
    if(probes.some(ok=>!ok))throw new Error('OCR_ASSETS_UNAVAILABLE');
  })().catch(error=>{assetCheckPromise=null;throw error});
  return assetCheckPromise;
}

async function buildWorker() {
  await assertLocalOcrAssets();
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
  if (!workerPromise) {
    workerPromise = buildWorker().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
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
