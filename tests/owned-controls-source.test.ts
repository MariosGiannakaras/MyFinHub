import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const selectSource=readFileSync(new URL('../src/components/AppSelectInput.tsx',import.meta.url),'utf8');
const dateSource=readFileSync(new URL('../src/components/AppDateInput.tsx',import.meta.url),'utf8');
const modalFocusSource=readFileSync(new URL('../src/hooks/useModalFocus.ts',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/part25.css',import.meta.url),'utf8');

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
  });
  it('keeps accessible listbox and calendar roles',()=>{
    expect(selectSource).toContain('role="listbox"');
    expect(selectSource).toContain('role="option"');
    expect(dateSource).toContain('role="grid"');
    expect(dateSource).toContain('role="gridcell"');
  });
  it('keeps owned popovers viewport-contained and mobile-safe',()=>{
    expect(styles).toContain('.owned-popover-backdrop{position:fixed;inset:0');
    expect(styles).toContain('max-height:min(72dvh,620px)');
    expect(styles).toContain('.owned-option-list{overflow:auto');
    expect(styles).toContain('.owned-input-shell>.owned-input{font-size:16px}');
  });
});
