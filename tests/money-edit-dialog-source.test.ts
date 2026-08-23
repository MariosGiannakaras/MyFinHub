import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/MoneyEditDialog.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/money-edit-dialog.css',import.meta.url),'utf8');

describe('MoneyEditDialog source contract',()=>{
  it('uses an app-owned accessible modal with the shared MoneyInput primitive',()=>{
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('useModalFocus');
    expect(source).toContain('<MoneyInput');
    expect(source).toContain('data-autofocus="true"');
    expect(source).toContain('aria-describedby={describedBy}');
  });

  it('supports validation, busy state and reduced motion',()=>{
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-busy={busy||undefined}');
    expect(source).toContain('disabled={busy}');
    expect(source).toContain("motionMode==='reduced'");
  });

  it('stays inside narrow viewports with touch-safe actions',()=>{
    expect(styles).toContain('calc(100vw - 36px)');
    expect(styles).toContain('@media(max-width:680px)');
    expect(styles).toContain('min-height:44px');
  });
});
