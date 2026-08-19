import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const bytes = (relative: string) => fs.readFileSync(path.join(root, relative));

function pngSize(relative: string): [number, number] {
  const image = bytes(relative);
  expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return [image.readUInt32BE(16), image.readUInt32BE(20)];
}

describe('MyFinHub native brand assets', () => {
  it('keeps real native dimensions for browser, PWA, setup and Windows artwork', () => {
    expect(pngSize('public/favicon.png')).toEqual([32, 32]);
    expect(pngSize('public/brand/icon-192.png')).toEqual([192, 192]);
    expect(pngSize('public/brand/icon-512.png')).toEqual([512, 512]);
    expect(pngSize('desktop/setup-brand.png')).toEqual([192, 192]);
    expect(pngSize('assets/branding/myfinhub/icon-32.png')).toEqual([32, 32]);
    expect(pngSize('assets/branding/myfinhub/icon-192.png')).toEqual([192, 192]);
    expect(pngSize('assets/branding/myfinhub/icon-512.png')).toEqual([512, 512]);
  });

  it('does not reuse one copied PNG for all advertised sizes', () => {
    expect(bytes('public/favicon.png').equals(bytes('public/brand/icon-192.png'))).toBe(false);
    expect(bytes('public/brand/icon-192.png').equals(bytes('public/brand/icon-512.png'))).toBe(false);
    expect(bytes('public/favicon.png').equals(bytes('public/brand/icon-512.png'))).toBe(false);
  });
});
