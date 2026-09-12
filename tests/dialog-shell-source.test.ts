import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell=read('src/components/DialogShell.tsx');
const confirm=read('src/components/ConfirmDialog.tsx');
const money=read('src/components/MoneyEditDialog.tsx');

describe('DialogShell source contract',()=>{
  it('owns shared modal focus, aria, dismissal and reduced-motion infrastructure',()=>{
    expect(shell).toContain("from 'framer-motion'");
    expect(shell).toContain('useReducedMotion');
    expect(shell).toContain('useModalFocus<HTMLElement>(open,preferredFocus,onRequestClose)');
    expect(shell).toContain('className="modal-backdrop"');
    expect(shell).toContain('onMouseDown={onRequestClose}');
    expect(shell).toContain('role={role}');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain('aria-labelledby={ariaLabelledBy}');
    expect(shell).toContain('aria-describedby={ariaDescribedBy}');
    expect(shell).toContain('aria-busy={busy||undefined}');
    expect(shell).toContain('tabIndex={-1}');
    expect(shell).toContain('onMouseDown={event=>event.stopPropagation()}');
    expect(shell).toContain("motionMode==='reduced'");
    expect(shell).toContain('transition={{duration:reduce?0:.18}}');
  });

  it('keeps product semantics outside the shell while allowing data metadata only',()=>{
    expect(shell).toContain('dataAttributes?:DialogDataAttributes');
    expect(shell).toContain('{...dataAttributes}');
    expect(shell).not.toContain("from './Button'");
    expect(shell).not.toContain("from './IconButton'");
    expect(shell).not.toContain("from './MoneyInput'");
    expect(shell).not.toContain('destructive');
  });

  it('has ConfirmDialog and MoneyEditDialog as the bounded first adopters',()=>{
    for(const source of [confirm,money]){
      expect(source).toContain("from './DialogShell'");
      expect(source).toContain('<DialogShell');
      expect(source).not.toContain("from 'framer-motion'");
      expect(source).not.toContain('useModalFocus');
      expect(source).toContain('motionMode={motionMode}');
      expect(source).toContain('busy={busy}');
      expect(source).toContain('onRequestClose={cancel}');
    }
    expect(confirm).toContain('role="alertdialog"');
    expect(confirm).toContain('ariaLabelledBy={titleId}');
    expect(confirm).toContain('ariaDescribedBy={descriptionId}');
    expect(confirm).toContain("dataAttributes={{'data-tone':tone}}");
    expect(money).toContain('role="dialog"');
    expect(money).toContain('ariaLabelledBy={titleId}');
    expect(money).toContain('ariaDescribedBy={describedBy}');
    expect(money).toContain('<MoneyInput');
  });
});
