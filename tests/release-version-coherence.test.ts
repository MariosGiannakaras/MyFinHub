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
  it('preserves the published Windows download identity until an actual new installer exists',()=>{
    const readme=readFileSync('README.md','utf8');
    const published=readme.match(/releases\/download\/myfinhub-v(\d+\.\d+\.\d+)\/MyFinHub-Setup-(\d+\.\d+\.\d+)-x64\.exe/);
    expect(published).not.toBeNull();
    expect(published?.[1]).toBe(published?.[2]);
    const current=root.version.split('.').map(Number);
    const lastPublished=(published?.[1]||'0.0.0').split('.').map(Number);
    const comparison=current[0]-lastPublished[0]||current[1]-lastPublished[1]||current[2]-lastPublished[2];
    expect(comparison).toBeGreaterThanOrEqual(0);
    expect(desktop.build.win.artifactName).toBe('MyFinHub-Setup-${version}-${arch}.${ext}');
    expect(readFileSync('CHANGELOG.md','utf8')).toContain('## [Unreleased]');
  });
  it('keeps the linked root dependency snapshot current and the Windows tag derived from the desktop package',()=>{
    // The Windows workspace links the root app as file:..; the linked
    // dependency metadata must track the complete root manifest, not only
    // one test dependency, or later npm updates silently leave stale locks.
    expect(desktopLock.packages['..'].dependencies).toEqual(root.dependencies);
    expect(desktopLock.packages['..'].devDependencies).toEqual(root.devDependencies);
    expect(desktopLock.packages[''].devDependencies['electron-builder']).toBe(desktop.devDependencies['electron-builder']);
    expect(desktop.devDependencies.rheomiq).toBe('file:..');
    expect(readFileSync('.github/workflows/desktop-publish-release.yml','utf8')).toContain('myfinhub-v$version');
  });
});
