import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const imports=(source:string)=>[...source.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(match=>match[1]);

const rootStyles=read('src/styles.css');
const accountIban=read('src/components/AccountIban.tsx');
const accountMetadata=read('src/components/AccountMetadataSettings.tsx');
const bankBrand=read('src/components/BankBrandMark.tsx');
const tailLoader=read('src/styles/part47.css');

describe('Stage 5 CSS ownership',()=>{
  it('makes the Phase-1 global tail explicit after the existing root compatibility stack',()=>{
    const expectedRoot=[...Array.from({length:46},(_,index)=>`./styles/part${index+1}.css`),'./styles/part57.css','./styles/part47.css','./styles/part50.css','./styles/part52.css','./styles/part53.css'];
    expect(imports(rootStyles)).toEqual(expectedRoot);
  });

  it('removes unrelated domain components as global stylesheet loaders',()=>{
    for(const source of [accountIban,accountMetadata,bankBrand]){
      expect(source).not.toMatch(/import\s+['"]\.\.\/styles\//);
    }
    expect(accountIban).toContain('export function AccountIban');
    expect(accountMetadata).toContain('export function AccountMetadataSettings');
    expect(bankBrand).toContain('export function BankBrandMark');
  });

  it('preserves the existing transitive approved-style tail while ownership moves to the root entry',()=>{
    expect(imports(tailLoader)).toEqual([
      './part48.css',
      './part49.css',
      './part50.css',
      './part51.css',
      './part54.css',
      './part55.css',
      './part56.css',
      './loans-approved-target.css',
      './credit-approved-target.css',
      './lending-approved-target.css',
      './recurring-approved-target.css',
      './planning-approved-target.css',
      './planning-approved-refinement.css',
      './attention-approved-target.css',
      './attention-approved-refinement.css',
    ]);
  });
});
