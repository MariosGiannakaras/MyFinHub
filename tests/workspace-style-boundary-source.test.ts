import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const entry='src/styles/workspace-compat.css';

function collectWorkspaceCss(file:string,seen=new Set<string>()):Array<{file:string;source:string}>{
  const normalized=file.replaceAll('\\','/');
  if(seen.has(normalized))return [];
  seen.add(normalized);
  const absolute=path.join(root,normalized);
  const source=fs.readFileSync(absolute,'utf8');
  const collected=[{file:normalized,source}];
  const dir=path.posix.dirname(normalized);
  for(const match of source.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)){
    const imported=match[1];
    if(!imported.startsWith('.'))continue;
    const resolved=path.posix.normalize(path.posix.join(dir,imported));
    collected.push(...collectWorkspaceCss(resolved,seen));
  }
  return collected;
}

describe('lazy workspace CSS boundary',()=>{
  it('never owns global AppShell/navigation chrome',()=>{
    const files=collectWorkspaceCss(entry);
    expect(files.length).toBeGreaterThan(1);
    const forbidden=/\.(?:app-shell|sidebar|topbar|mobile-nav|command-search-action|top-actions|file-panel|sidebar-foot|brand-block|brand-home-button)\b/;
    for(const {file,source} of files){
      expect(source,`${file} must not style global AppShell chrome from the lazy workspace layer`).not.toMatch(forbidden);
    }
  });

  it('keeps the explicitly ordered compatibility entry lists unique and disjoint',()=>{
    const imports=(file:string)=>[...fs.readFileSync(path.join(root,file),'utf8').matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)].map(match=>match[1]);
    const eager=imports('src/styles/root-compat.css');
    const lazy=imports(entry);
    const targets=imports('src/styles/approved-workspace-targets.css');
    const all=[...eager,...lazy,...targets];
    expect(all.length).toBeGreaterThanOrEqual(80);
    expect(new Set(all).size).toBe(all.length);
    expect(eager.indexOf('./theme-surface-foundations.css')).toBe(0);
    expect(eager.indexOf('./ui-hardening-foundations.css')).toBeLessThan(eager.indexOf('./app-controls.css'));
    expect(lazy[0]).toBe('./approved-workspace-targets.css');
    expect(lazy.at(-1)).toBe('./dark-theme-surfaces.css');
  });

  it('keeps global shell styling in the eagerly loaded root layer',()=>{
    const rootCompat=fs.readFileSync(path.join(root,'src/styles/root-compat.css'),'utf8');
    expect(rootCompat).toContain("@import './shell-navigation-foundations.css';");
    expect(rootCompat).toContain("@import './root-responsive-coordination.css';");
    expect(rootCompat).toContain("@import './mobile-app-shell.css';");
  });
});
