import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const selectSource=readFileSync(new URL('../src/components/AppSelectInput.tsx',import.meta.url),'utf8');
const dateSource=readFileSync(new URL('../src/components/AppDateInput.tsx',import.meta.url),'utf8');
const modalFocusSource=readFileSync(new URL('../src/hooks/useModalFocus.ts',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/part25.css',import.meta.url),'utf8');
function files(path:string):string[]{return readdirSync(path).flatMap(name=>{const full=join(path,name);return statSync(full).isDirectory()?files(full):/\.tsx$/.test(name)?[full]:[]})}

describe('app-owned entry controls',()=>{
  it('keeps centralized Escape dismissal, portal rendering and focus restoration infrastructure',()=>{
    for(const source of [selectSource,dateSource]){
      expect(source).toContain('createPortal');
      expect(source).toContain('useModalFocus');
      expect(source).toContain('()=>setOpen(false)');
    }
    expect(modalFocusSource).toContain("event.key === 'Escape'");
    expect(modalFocusSource).toContain('onCloseRef.current()');
    expect(modalFocusSource).toContain('opener.current?.focus');
    expect(modalFocusSource).toContain("event.key !== 'Tab'");
    expect(modalFocusSource).toContain('canReceiveFocus(preferredTarget)');
    expect(modalFocusSource).toContain('!root.contains(document.activeElement)');
  });
  it('keeps accessible listbox and calendar roles',()=>{
    expect(selectSource).toContain('role="listbox"');
    expect(selectSource).toContain('role="option"');
    expect(selectSource).toContain('aria-controls={listboxId}');
    expect(selectSource).toContain('[aria-selected="true"]:not(:disabled), [role="option"]:not(:disabled)');
    expect(dateSource).toContain('role="grid"');
    expect(dateSource).toContain('role="gridcell"');
  });
  it('uses local today and refuses keyboard focus outside date bounds',()=>{
    expect(dateSource).toContain("import { localDateString } from '../lib/localDate'");
    expect(dateSource).toContain('const today=localDateString()');
    expect(dateSource).toContain("if((min&&next<min)||(max&&next>max))return");
    expect(dateSource).toContain('[data-date=\\"${next}\\"]:not(:disabled)');
  });
  it('keeps owned popovers viewport-contained and mobile-safe',()=>{
    expect(styles).toContain('.owned-popover-backdrop{position:fixed;inset:0');
    expect(styles).toContain('max-height:min(72dvh,620px)');
    expect(styles).toContain('.owned-option-list{overflow:auto');
    expect(styles).toContain('.owned-input-shell>.owned-input{font-size:16px}');
  });
  it('keeps native select controls out of application pages and components',()=>{
    const offenders=[...files('src/pages'),...files('src/components')].filter(file=>/<select\b/.test(readFileSync(file,'utf8')));
    expect(offenders).toEqual([]);
  });
});
