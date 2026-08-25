import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot=fileURLToPath(new URL('../src/',import.meta.url));

function sourceFiles(dir:string):string[]{
  return readdirSync(dir).flatMap((name)=>{
    const path=join(dir,name);
    if(statSync(path).isDirectory())return sourceFiles(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(name)?[path]:[];
  });
}

describe('app-owned dialog policy',()=>{
  it('does not use browser-native prompt or confirm anywhere in application source',()=>{
    const offenders=sourceFiles(srcRoot).flatMap((path)=>{
      const source=readFileSync(path,'utf8');
      return /window\.(?:confirm|prompt)\s*\(/.test(source)?[path.replace(srcRoot,'src/')]:[];
    });
    expect(offenders).toEqual([]);
  });
});
