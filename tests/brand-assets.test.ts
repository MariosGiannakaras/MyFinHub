import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const file=(relative:string)=>path.join(root,relative);
const bytes=(relative:string)=>fs.readFileSync(file(relative));
const text=(relative:string)=>fs.readFileSync(file(relative),'utf8');

function pngSize(relative:string):[number,number]{
  const image=bytes(relative);
  expect([...image.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  return [image.readUInt32BE(16),image.readUInt32BE(20)];
}

function expectTrueVector(relative:string){
  const svg=text(relative);
  expect(svg).toMatch(/<svg\b/);
  expect(svg).toContain('<path');
  expect(svg).not.toContain('<image');
  expect(svg).not.toMatch(/data:image/i);
  expect(svg).not.toContain('<script');
  expect(svg).not.toMatch(/@font-face|font-family/i);
}

describe('MyFinHub platform branding assets',()=>{
  it('keeps browser favicon assets at their platform sizes',()=>{
    expect(pngSize('public/brand/favicon-16.png')).toEqual([16,16]);
    expect(pngSize('public/brand/favicon-32.png')).toEqual([32,32]);
    expect(pngSize('public/favicon.png')).toEqual([32,32]);
    expect(bytes('public/favicon.png').equals(bytes('public/brand/favicon-32.png'))).toBe(true);
    expect(bytes('public/brand/favicon-32.png').equals(bytes('public/brand/icon-light-32.png'))).toBe(true);
    expectTrueVector('public/brand/favicon-light.svg');
    expectTrueVector('public/brand/favicon-dark.svg');
  });

  it('keeps installable PWA any and dedicated maskable raster sizes',()=>{
    for(const asset of [
      'public/brand/icon-light-192.png',
      'public/brand/icon-dark-192.png',
      'public/brand/icon-192.png',
      'public/brand/icon-maskable-192.png',
    ]) expect(pngSize(asset)).toEqual([192,192]);
    for(const asset of [
      'public/brand/icon-512.png',
      'public/brand/icon-light-512.png',
      'public/brand/icon-dark-512.png',
      'public/brand/icon-maskable-512.png',
    ]) expect(pngSize(asset)).toEqual([512,512]);
    expect(bytes('public/brand/icon-192.png').equals(bytes('public/brand/icon-light-192.png'))).toBe(true);
    expect(bytes('public/brand/icon-512.png').equals(bytes('public/brand/icon-light-512.png'))).toBe(true);
    const manifest=JSON.parse(text('public/manifest.webmanifest'));
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({src:'/brand/icon-light-192.png',sizes:'192x192',purpose:'any'}),
      expect.objectContaining({src:'/brand/icon-512.png',sizes:'512x512',purpose:'any'}),
      expect.objectContaining({src:'/brand/icon-512.svg',sizes:'any',purpose:'any'}),
      expect.objectContaining({src:'/brand/icon-maskable-192.png',sizes:'192x192',purpose:'maskable'}),
      expect.objectContaining({src:'/brand/icon-maskable-512.png',sizes:'512x512',purpose:'maskable'}),
    ]));
  });

  it('uses true vector masters rather than raster-in-SVG wrappers',()=>{
    for(const asset of [
      'public/brand/icon-512.svg',
      'public/brand/icon-dark-512.svg',
      'assets/branding/myfinhub/app-icon-light.svg',
      'assets/branding/myfinhub/app-icon-dark.svg',
      'assets/branding/myfinhub/icon-512.svg',
      'assets/branding/myfinhub/icon-dark-512.svg',
      'assets/branding/myfinhub/symbol.svg',
      'assets/branding/myfinhub/logo-light.svg',
      'assets/branding/myfinhub/logo-dark.svg',
      'assets/branding/myfinhub/logo-horizontal.svg',
      'assets/branding/myfinhub/favicon-light.svg',
      'assets/branding/myfinhub/favicon-dark.svg',
    ]) expectTrueVector(asset);
  });

  it('keeps the theme-aware app mark and native desktop PNG aliases',()=>{
    expect(pngSize('desktop/setup-brand.png')).toEqual([192,192]);
    expect(bytes('desktop/setup-brand.png').equals(bytes('public/brand/icon-dark-192.png'))).toBe(true);
    const component=text('src/components/BrandMark.tsx');
    const styles=text('src/styles/brand-mark-system.css');
    const desktop=text('desktop/prepare-build.mjs');
    const desktopMain=text('desktop/main.cjs');
    expect(component).toContain('/brand/icon-512.svg');
    expect(component).toContain('/brand/icon-dark-512.svg');
    expect(styles).toContain('html[data-theme="dark"]');
    expect(desktop).toContain("'public','brand','icon-512.png'");
    expect(desktop).not.toContain('resize-icon.ps1');
    expect(desktopMain).toContain("'public', 'brand', 'icon-512.png'");
  });
});
