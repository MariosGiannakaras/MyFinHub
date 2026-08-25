import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const desktopPackage=JSON.parse(readFileSync('desktop/package.json','utf8')) as {
  dependencies?:Record<string,string>;
  devDependencies?:Record<string,string>;
  build?:{files?:string[];extraResources?:Array<{from:string;to:string}>};
};
const bootstrap=readFileSync('desktop/bootstrap.cjs','utf8');
const main=readFileSync('desktop/main.cjs','utf8');

describe('desktop packaging dependency boundary',()=>{
  it('keeps the root application link development-only so electron-builder cannot recursively ship the repository',()=>{
    expect(desktopPackage.dependencies?.rheomiq).toBeUndefined();
    expect(desktopPackage.devDependencies?.rheomiq).toBe('file:..');
  });

  it('ships runtime inputs explicitly instead of importing the root package at runtime',()=>{
    expect(desktopPackage.build?.files).toEqual(expect.arrayContaining([
      'bootstrap.cjs','main.cjs','preload.cjs','runtime-defaults.cjs','package.json',
    ]));
    expect(desktopPackage.build?.extraResources).toEqual(expect.arrayContaining([
      expect.objectContaining({from:'../dist',to:'app/dist'}),
      expect.objectContaining({from:'.build/server/server.mjs',to:'app/server/server.mjs'}),
      expect.objectContaining({from:'.build/runtime/node.exe',to:'app/runtime/node.exe'}),
    ]));
    expect(bootstrap).not.toMatch(/require\(['"]rheomiq/);
    expect(main).not.toMatch(/require\(['"]rheomiq/);
  });
});
