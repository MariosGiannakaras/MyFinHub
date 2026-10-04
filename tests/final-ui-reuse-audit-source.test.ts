import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const normalize=(value:string)=>value.replaceAll('\\','/');
const walk=(dir:string,pattern:RegExp):string[]=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  const relative=normalize(path.posix.join(dir,entry.name));
  return entry.isDirectory()?walk(relative,pattern):pattern.test(entry.name)?[relative]:[];
});
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

function resolveRelative(from:string,specifier:string,extensions:string[]){
  if(!specifier.startsWith('.'))return null;
  const base=normalize(path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier)));
  for(const candidate of [base,...extensions.map(ext=>base.endsWith(ext)?base:`${base}${ext}`)]){
    if(fs.existsSync(path.join(root,candidate))&&fs.statSync(path.join(root,candidate)).isFile())return candidate;
  }
  return null;
}

describe('final UI reuse and orphan audit',()=>{
  const productTsx=[...walk('src/components',/\.tsx$/),...walk('src/pages',/\.tsx$/)];

  it('keeps production JSX off legacy surface hooks and raw generic chrome',()=>{
    const rawGeneric=/<button\b[^>]*className="[^"]*\b(?:save-button|secondary|text-button|icon-button|ghost-button|inline-icon-action)\b[^"]*"/;
    for(const file of productTsx){
      const source=read(file);
      expect(source,`${file} should not use legacy neo surface hooks`).not.toMatch(/\bneo-(?:raised|flat|inset)\b/);
      expect(source,`${file} should not recreate shared generic button chrome`).not.toMatch(rawGeneric);
    }
  });

  it('routes the remaining generic action families through shared primitives',()=>{
    const shell=read('src/components/AppShell.tsx');
    const login=read('src/components/LoginScreen.tsx');
    const mfa=read('src/components/MfaScreen.tsx');
    const iban=read('src/components/AccountIban.tsx');
    const period=read('src/components/PeriodControl.tsx');
    const loans=read('src/components/LongTermLoanSummary.tsx');
    const icons=read('src/components/CategoryIconAssignmentWorkspace.tsx');
    const providers=read('src/components/FinancialProviderManagementSettings.tsx');

    expect(shell).toContain('<IconButton type="button" aria-label="Αναζήτηση και εντολές"');
    expect(shell).toContain('<IconButton type="button" aria-label="Ανανέωση δεδομένων"');
    expect(shell).toContain('<Button type="button" variant="secondary" disabled={!canUndo} onClick={onUndo}>Αναίρεση</Button>');
    expect(login).toContain('<IconButton type="button" className="login-password-toggle"');
    expect(mfa).toContain('<Button variant="ghost" className="ghost-button login-logout"');
    expect(iban).toContain('<IconButton type="button" className="inline-icon-action account-iban-copy"');
    expect(period.match(/<IconButton\b/g)).toHaveLength(2);
    expect(loans).toContain('<Button type="button" variant="primary" className="pay-action linked-loan-pay"');
    expect(icons).toContain('<IconButton type="button" className="category-icon-selection-close"');
    expect(providers).toContain('className="provider-management panel surface-raised"');
    expect(providers).toContain('<Button type="button" variant="secondary" className="provider-edit-action"');
  });

  it('has no orphaned production component modules',()=>{
    const allSource=walk('src',/\.(?:ts|tsx)$/);
    const referenced=new Set<string>();
    for(const file of allSource){
      const source=read(file);
      for(const match of source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)){
        const resolved=resolveRelative(file,match[1],['.tsx','.ts']);
        if(resolved)referenced.add(resolved);
      }
    }
    const components=walk('src/components',/\.tsx$/);
    const orphaned=components.filter(file=>!referenced.has(file));
    expect(orphaned).toEqual([]);
  });

  it('has no orphaned CSS files outside the explicit root/import graph',()=>{
    const allCss=walk('src',/\.css$/);
    const reached=new Set<string>();
    const queue=['src/styles.css'];
    for(const file of walk('src',/\.(?:ts|tsx)$/)){
      const source=read(file);
      for(const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+\.css)['"]/g)){
        const resolved=resolveRelative(file,match[1],['']);
        if(resolved)queue.push(resolved);
      }
    }
    while(queue.length){
      const file=queue.shift()!;
      if(reached.has(file))continue;
      reached.add(file);
      const source=read(file);
      for(const match of source.matchAll(/@import\s+['"]([^'"]+)['"]\s*;/g)){
        const resolved=resolveRelative(file,match[1],['','.css']);
        if(resolved)queue.push(resolved);
      }
    }
    expect(allCss.filter(file=>!reached.has(file))).toEqual([]);
  });
});
