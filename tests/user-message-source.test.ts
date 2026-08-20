import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS=['src/pages','src/components'];
const FORBIDDEN=[
  /Σφάλμα:/i,
  /accounting mode/i,
  /encrypted vault/i,
  /card identity/i,
  /\bliability\b/i,
  /pre-import backup/i,
  /same-device CVV/i,
  /πραγματικό event/i,
  /RheomIQ κρατά/i,
];

function files(path:string):string[]{
  return readdirSync(path).flatMap(name=>{
    const full=join(path,name);
    return statSync(full).isDirectory()?files(full):/\.(?:ts|tsx)$/.test(name)?[full]:[];
  });
}

describe('user-facing copy guard',()=>{
  it('keeps known internal implementation language out of UI source',()=>{
    const offenders:string[]=[];
    for(const root of ROOTS)for(const file of files(root)){
      const source=readFileSync(file,'utf8');
      for(const pattern of FORBIDDEN)if(pattern.test(source))offenders.push(`${file}: ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });

  it('does not render raw Error.message directly from pages/components',()=>{
    const offenders:string[]=[];
    for(const root of ROOTS)for(const file of files(root)){
      const source=readFileSync(file,'utf8');
      if(/\b(?:error|err|e)\s*\.\s*message\b/.test(source)&&!file.endsWith('PageErrorBoundary.tsx'))offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
