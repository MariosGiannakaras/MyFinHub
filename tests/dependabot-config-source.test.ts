import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source=fs.readFileSync(path.join(process.cwd(),'.github/dependabot.yml'),'utf8');

describe('Dependabot maintenance routing',()=>{
  it('covers the independent Windows desktop npm graph on develop',()=>{
    expect(source).toContain('directory: /desktop');
    const desktop=source.slice(source.indexOf('directory: /desktop'),source.indexOf('package-ecosystem: github-actions'));
    expect(desktop).toContain('target-branch: develop');
    expect(desktop).toContain('desktop-toolchain-minor-patch');
    expect(desktop).toContain('dependency-name: electron');
    expect(desktop).toContain('version-update:semver-major');
  });
});
