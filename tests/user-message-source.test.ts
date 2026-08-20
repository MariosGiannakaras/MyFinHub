import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS=['src/pages','src/components'];
const FORBIDDEN_VISIBLE_COPY=[
  /Σφάλμα:/i,
  /accounting mode/i,
  /encrypted vault/i,
  /card identity/i,
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
  it('keeps known implementation jargon out of UI source copy',()=>{
    const offenders:string[]=[];
    for(const root of ROOTS)for(const file of files(root)){
      const source=readFileSync(file,'utf8');
      for(const pattern of FORBIDDEN_VISIBLE_COPY)if(pattern.test(source))offenders.push(`${file}: ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });

  it('does not pass raw Error.message directly to visible error/message state or JSX',()=>{
    const offenders:string[]=[];
    const directRawMessage=/(?:set(?:Error|Message)\s*\(\s*|\{\s*)(?:error|err|e)\s*\.\s*message\b/;
    for(const root of ROOTS)for(const file of files(root)){
      const source=readFileSync(file,'utf8');
      if(directRawMessage.test(source))offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
