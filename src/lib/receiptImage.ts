import type { NormalizedReceiptImage } from './receiptDrafts.js';

const INPUT_MAX_BYTES = 12 * 1024 * 1024;
const STORED_MAX_DIMENSION = 2400;
const OCR_MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.86;

const isJpegSignature = (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const isPngSignature = (bytes: Uint8Array) => bytes.length >= 8
  && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Δεν δημιουργήθηκε επεξεργασμένη εικόνα απόδειξης.')), type, quality);
});

const scaledSize = (width: number, height: number, maxDimension: number) => {
  const largest = Math.max(width, height);
  if (largest <= maxDimension) return { width, height };
  const scale = maxDimension / largest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

async function decodeReceiptImage(blob: Blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new Error('Η εικόνα δεν μπορεί να διαβαστεί. Δοκίμασε νέα φωτογραφία ή αρχείο JPG/PNG.');
  }
}

export async function validateReceiptFile(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Υποστηρίζονται μόνο εικόνες JPG/JPEG και PNG.');
  if (!file.size || file.size > INPUT_MAX_BYTES) throw new Error('Η εικόνα απόδειξης πρέπει να είναι μικρότερη από 12 MB.');
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg' && !isJpegSignature(signature)) throw new Error('Το αρχείο δηλώνεται ως JPG αλλά δεν έχει έγκυρη υπογραφή εικόνας.');
  if (file.type === 'image/png' && !isPngSignature(signature)) throw new Error('Το αρχείο δηλώνεται ως PNG αλλά δεν έχει έγκυρη υπογραφή εικόνας.');
}

export async function normalizeReceiptFile(file: File): Promise<NormalizedReceiptImage> {
  await validateReceiptFile(file);
  const bitmap = await decodeReceiptImage(file);
  try {
    const size = scaledSize(bitmap.width, bitmap.height, STORED_MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Δεν είναι διαθέσιμη η τοπική επεξεργασία εικόνας.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const image = await canvasBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    return { image, mimeType: 'image/jpeg', bytes: image.size, width: size.width, height: size.height };
  } finally {
    bitmap.close();
  }
}

export async function preprocessReceiptForOcr(blob: Blob): Promise<Blob> {
  const bitmap = await decodeReceiptImage(blob);
  try {
    const size = scaledSize(bitmap.width, bitmap.height, OCR_MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Δεν είναι διαθέσιμη η τοπική προεπεξεργασία OCR.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter = 'grayscale(1) contrast(1.35)';
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    context.filter = 'none';
    return await canvasBlob(canvas, 'image/png');
  } finally {
    bitmap.close();
  }
}
