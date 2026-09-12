import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/MoneyEditDialog.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/DialogShell.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/money-edit-dialog.css',import.meta.url),'utf8');

describe('MoneyEditDialog source contract',()=>{
  it('uses the shared accessible dialog shell with the MoneyInput primitive',()=>{
    expect(source).toContain("from './DialogShell'");
    expect(source).toContain('<DialogShell');
    expect(source).toContain('role="dialog"');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain('useModalFocus');
    expect(source).toContain('<MoneyInput');
    expect(source).toContain('data-autofocus="true"');
    expect(source).toContain('ariaDescribedBy={describedBy}');
  });

  it('supports validation, busy state and reduced motion',()=>{
    expect(source).toContain('role="alert"');
    expect(source).toContain('busy={busy}');
    expect(shell).toContain('aria-busy={busy||undefined}');
    expect(source).toContain('disabled={busy}');
    expect(source).toContain('motionMode={motionMode}');
    expect(shell).toContain("motionMode==='reduced'");
    expect(source).toContain('onRequestClose={cancel}');
  });

  it('stays inside narrow viewports with touch-safe actions',()=>{
    expect(styles).toContain('calc(100vw - 36px)');
    expect(styles).toContain('@media(max-width:680px)');
    expect(styles).toContain('min-height:44px');
  });
});
