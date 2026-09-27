import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot=fileURLToPath(new URL('../src/',import.meta.url));
const read=(path:string)=>readFileSync(path,'utf8');

function tsxFiles(dir:string):string[]{
  return readdirSync(dir).flatMap((name)=>{
    const path=join(dir,name);
    if(statSync(path).isDirectory())return tsxFiles(path);
    return path.endsWith('.tsx')?[path]:[];
  });
}

describe('post-redesign dialog and popover focus ownership',()=>{
  it('keeps every direct aria-modal surface on a dedicated useModalFocus owner',()=>{
    const offenders=tsxFiles(srcRoot).flatMap((path)=>{
      if(path.endsWith('DialogShell.tsx'))return [];
      const source=read(path);
      const modalCount=(source.match(/aria-modal="true"/g)??[]).length;
      if(!modalCount)return [];
      const focusOwnerCount=(source.match(/useModalFocus(?:<[^>]+>)?\s*\(/g)??[]).length;
      return focusOwnerCount>=modalCount?[]:[{path:relative(srcRoot,path),modalCount,focusOwnerCount}];
    });
    expect(offenders).toEqual([]);
  });

  it('keeps every dialog or alertdialog on DialogShell or useModalFocus ownership',()=>{
    const offenders=tsxFiles(srcRoot).flatMap((path)=>{
      const source=read(path);
      if(!/role="(?:dialog|alertdialog)"/.test(source))return [];
      return source.includes('useModalFocus')||source.includes('<DialogShell')?[]:[relative(srcRoot,path)];
    });
    expect(offenders).toEqual([]);
  });

  it('preserves topmost Escape, focus trap and opener restoration in the shared hook',()=>{
    const source=read(join(srcRoot,'hooks','useModalFocus.ts'));
    expect(source).toContain('isTopmostModal(root)');
    expect(source).toContain("shortcutMatches(event, 'dismiss')");
    expect(source).toContain("event.key !== 'Tab'");
    expect(source).toContain("document.addEventListener('keydown', trap)");
    expect(source).toContain("document.removeEventListener('keydown', trap)");
    expect(source).toContain("opener.current?.focus({ preventScroll: true })");
  });

  it('keeps owned select/date popovers inside the same modal focus contract',()=>{
    for(const name of ['AppSelectInput.tsx','AppDateInput.tsx']){
      const source=read(join(srcRoot,'components',name));
      expect(source).toContain('createPortal');
      expect(source).toContain('useModalFocus<HTMLElement>');
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
    }
  });
});
