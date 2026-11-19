import type { NormalizedReceiptImage } from './receiptDrafts.js';

const INPUT_MAX_BYTES = 12 * 1024 * 1024;
// A small compressed image can still expand into hundreds of MiB of pixels.
// Retain typical high-resolution phone photos while refusing pathological input.
const INPUT_MAX_SIDE = 16_384;
const INPUT_MAX_PIXELS = 64 * 1024 * 1024;
const STORED_MAX_DIMENSION = 2400;
const OCR_MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.86;

const isJpegSignature = (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const isPngSignature = (bytes: Uint8Array) => bytes.length >= 8
  && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;

const requireReceiptDimensions = (width: number, height: number) => {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 1 || height < 1 || width > INPUT_MAX_SIDE || height > INPUT_MAX_SIDE
      || width * height > INPUT_MAX_PIXELS)
    throw new Error('Η εικόνα απόδειξης έχει υπερβολικά μεγάλες ή μη έγκυρες διαστάσεις.');
};

const pngDimensions = (header: Uint8Array) => {
  // PNG requires the first chunk to be a 13-byte IHDR with big-endian dimensions.
  if (header.length < 24 || header[8] !== 0 || header[9] !== 0
      || header[10] !== 0 || header[11] !== 13
      || header[12] !== 0x49 || header[13] !== 0x48
      || header[14] !== 0x44 || header[15] !== 0x52)
    throw new Error('Το PNG δεν έχει έγκυρη κεφαλίδα εικόνας.');
  const read = (offset: number) => (
    (header[offset]! * 0x1000000)
    + (header[offset + 1]! << 16)
    + (header[offset + 2]! << 8)
    + header[offset + 3]!
  );
  requireReceiptDimensions(read(16), read(20));
};

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

async function validateReceiptFile(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Υποστηρίζονται μόνο εικόνες JPG/JPEG και PNG.');
  if (!file.size || file.size > INPUT_MAX_BYTES) throw new Error('Η εικόνα απόδειξης πρέπει να είναι μικρότερη από 12 MB.');
  const signature = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  if (file.type === 'image/jpeg' && !isJpegSignature(signature)) throw new Error('Το αρχείο δηλώνεται ως JPG αλλά δεν έχει έγκυρη υπογραφή εικόνας.');
  if (file.type === 'image/png' && !isPngSignature(signature)) throw new Error('Το αρχείο δηλώνεται ως PNG αλλά δεν έχει έγκυρη υπογραφή εικόνας.');
  if (file.type === 'image/png') pngDimensions(signature);
}

export async function normalizeReceiptFile(file: File): Promise<NormalizedReceiptImage> {
  await validateReceiptFile(file);
  const bitmap = await decodeReceiptImage(file);
  try {
    requireReceiptDimensions(bitmap.width, bitmap.height);
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
    requireReceiptDimensions(bitmap.width, bitmap.height);
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
