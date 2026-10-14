import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const readJson=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const root=readJson('package.json');
const rootLock=readJson('package-lock.json');
const desktop=readJson('desktop/package.json');
const desktopLock=readJson('desktop/package-lock.json');

describe('Web/Windows release candidate version synchronization',()=>{
  it('uses the same valid semver for the app, desktop and lockfile roots',()=>{
    expect(root.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(desktop.version).toBe(root.version);
    expect(rootLock.version).toBe(root.version);
    expect(rootLock.packages[''].version).toBe(root.version);
    expect(desktopLock.version).toBe(desktop.version);
    expect(desktopLock.packages[''].version).toBe(desktop.version);
    expect(desktopLock.packages['..'].version).toBe(root.version);
    expect(desktopLock.packages['..'].name).toBe(root.name);
  });
  it('keeps the linked root dependency snapshot current and the Windows tag derived from the desktop package',()=>{
    expect(desktopLock.packages['..'].devDependencies.vitest).toBe(root.devDependencies.vitest);
    expect(desktop.devDependencies.rheomiq).toBe('file:..');
    expect(readFileSync('.github/workflows/desktop-windows.yml','utf8')).toContain('myfinhub-v$version');
  });
});
