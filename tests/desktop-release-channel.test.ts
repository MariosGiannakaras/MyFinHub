import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const desktopPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'desktop/package.json'), 'utf8'));

describe('MyFinHub desktop release channel', () => {
  it('builds installers without implicit tag publishing', () => {
    expect(desktopPackage.scripts.dist).toContain('electron-builder --win nsis --x64');
    expect(desktopPackage.scripts.dist).toContain('--publish never');
  });

  it('points update metadata at the renamed MyFinHub repository', () => {
    expect(desktopPackage.build.publish).toEqual([
      {
        provider: 'github',
        owner: 'MariosGiannakaras',
        repo: 'MyFinHub',
        releaseType: 'release',
      },
    ]);
  });
});
