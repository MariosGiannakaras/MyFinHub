import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeReceiptFile, preprocessReceiptForOcr } from '../src/lib/receiptImage.js';

const PNG_SIGNATURE = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
function pngHeader(width: number, height: number, validIhdr = true) {
  const bytes = new Uint8Array(24);
  bytes.set(PNG_SIGNATURE, 0);
  bytes.set([0, 0, 0, validIhdr ? 13 : 12, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], 'photo.png', { type: 'image/png' });
}

afterEach(() => vi.unstubAllGlobals());

describe('receipt image decode dimensions (#649 I19.03)', () => {
  it('rejects oversized, zero or malformed PNG IHDR before allocating a decoder bitmap', async () => {
    const decoder = vi.fn();
    vi.stubGlobal('createImageBitmap', decoder);
    for (const file of [
      pngHeader(16385, 1),
      pngHeader(8192, 8193),
      pngHeader(0, 500),
      pngHeader(1000, 1000, false),
    ]) {
      await expect(normalizeReceiptFile(file)).rejects.toThrow(/διαστάσεις|κεφαλίδα/);
    }
    expect(decoder).not.toHaveBeenCalled();
  });

  it('accepts genuine high-resolution PNG metadata through preflight and scales locally', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 8000, height: 6000, close }));
    const context = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillStyle: '',
    };
    const canvas = {
      width: 0, height: 0,
      getContext: () => context,
      toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['saved'], { type: 'image/jpeg' })),
    };
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(canvas) });
    const result = await normalizeReceiptFile(pngHeader(8000, 6000));
    expect(result).toMatchObject({ mimeType: 'image/jpeg', bytes: 5, width: 2400, height: 1800 });
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects oversized decoded JPEG/OCR dimensions before canvas allocation and closes the bitmap', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 32768, height: 4096, close }));
    const createElement = vi.fn();
    vi.stubGlobal('document', { createElement });
    const jpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], 'oversize.jpg', { type: 'image/jpeg' });
    await expect(normalizeReceiptFile(jpeg)).rejects.toThrow(/διαστάσεις/);
    await expect(preprocessReceiptForOcr(jpeg)).rejects.toThrow(/διαστάσεις/);
    expect(createElement).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
