import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const file = (relative: string) => path.join(root, relative);
const bytes = (relative: string) => fs.readFileSync(file(relative));
const text = (relative: string) => fs.readFileSync(file(relative), 'utf8');

function pngSize(relative: string): [number, number] {
  const image = bytes(relative);
  expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return [image.readUInt32BE(16), image.readUInt32BE(20)];
}

describe('MyFinHub light/dark brand assets', () => {
  it('keeps native light/dark browser, auth and setup derivatives', () => {
    expect(pngSize('public/favicon.png')).toEqual([32, 32]);
    expect(pngSize('public/brand/icon-light-32.png')).toEqual([32, 32]);
    expect(pngSize('public/brand/icon-dark-32.png')).toEqual([32, 32]);
    expect(pngSize('public/brand/icon-light-192.png')).toEqual([192, 192]);
    expect(pngSize('public/brand/icon-dark-192.png')).toEqual([192, 192]);
    expect(pngSize('public/brand/icon-192.png')).toEqual([192, 192]);
    expect(pngSize('desktop/setup-brand.png')).toEqual([192, 192]);
    expect(bytes('public/favicon.png').equals(bytes('public/brand/icon-light-32.png'))).toBe(true);
    expect(bytes('public/brand/icon-192.png').equals(bytes('public/brand/icon-light-192.png'))).toBe(true);
    expect(bytes('desktop/setup-brand.png').equals(bytes('public/brand/icon-dark-192.png'))).toBe(true);
  });

  it('removes the legacy RheomIQ 512 PNG and uses the new scalable wrappers', () => {
    expect(fs.existsSync(file('public/brand/icon-512.png'))).toBe(false);
    expect(fs.existsSync(file('assets/branding/myfinhub/icon-512.png'))).toBe(false);
    expect(text('public/brand/icon-512.svg')).toContain('icon-light-192.png');
    expect(text('public/brand/icon-dark-512.svg')).toContain('icon-dark-192.png');
    expect(text('assets/branding/myfinhub/icon-512.svg')).toContain('icon-light-192.png');
    expect(text('assets/branding/myfinhub/icon-dark-512.svg')).toContain('icon-dark-192.png');
    const manifest=text('public/manifest.webmanifest');
    expect(manifest).toContain('/brand/icon-light-192.png');
    expect(manifest).toContain('/brand/icon-512.svg');
    expect(manifest).not.toContain('icon-512.png');
  });

  it('keeps one theme-ready component contract and generates Windows artwork from the new source', () => {
    const component=text('src/components/BrandMark.tsx');
    const styles=text('src/styles/part35.css');
    const desktop=text('desktop/prepare-build.mjs');
    expect(component).toContain('/brand/icon-light-192.png');
    expect(component).toContain('/brand/icon-dark-192.png');
    expect(styles).toContain('html[data-theme="dark"]');
    expect(desktop).toContain("'public','brand','icon-light-192.png'");
    expect(desktop).not.toContain('nativeAppIcon');
    expect(desktop).not.toContain("'public','brand','icon-512.png'");
  });
});
