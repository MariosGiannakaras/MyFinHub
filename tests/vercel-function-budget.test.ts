import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function apiFunctions(dir:string):string[]{
  return readdirSync(dir).flatMap(name=>{
    const full=join(dir,name);
    return statSync(full).isDirectory()?apiFunctions(full):name.endsWith('.ts')?[full.replaceAll('\\','/')]:[];
  });
}

describe('Vercel serverless function budget',()=>{
  it('keeps production API entrypoints inside the 12-function deployment limit',()=>{
    const functions=apiFunctions('api').sort();
    expect(functions).toHaveLength(12);
    expect(functions).not.toContain('api/android-update.ts');
    expect(functions).not.toContain('api/auth/account.ts');
    expect(functions).not.toContain('api/auth/devices.ts');
  });

  it('preserves public compatibility paths through rewrites into existing functions',()=>{
    const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')) as {rewrites?:Array<{source:string;destination:string}>};
    expect(config.rewrites).toEqual(expect.arrayContaining([
      {source:'/api/android-update',destination:'/api/data?__myfinhub_route=android-update'},
      {source:'/api/auth/account',destination:'/api/auth/session?__myfinhub_route=account'},
      {source:'/api/auth/devices',destination:'/api/auth/session?__myfinhub_route=devices'},
    ]));
  });
});
