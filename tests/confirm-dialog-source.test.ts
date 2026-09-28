import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/ConfirmDialog.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/components/DialogShell.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/confirm-dialog.css',import.meta.url),'utf8');

describe('ConfirmDialog source contract',()=>{
  it('uses the shared accessible dialog shell with instance-safe relationships',()=>{
    expect(source).toContain("from './DialogShell'");
    expect(source).toContain('<DialogShell');
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain('useId');
    expect(source).toContain('ariaLabelledBy={titleId}');
    expect(source).toContain('ariaDescribedBy={descriptionId}');
    expect(source).toContain('data-autofocus="true"');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain('useModalFocus');
  });

  it('keeps destructive tone explicit and prevents duplicate busy actions',()=>{
    expect(source).toContain("tone==='destructive'");
    expect(source).toContain("dataAttributes={{'data-tone':tone}}");
    expect(source).toContain('data-action-tone={tone}');
    expect(source).toContain('busy={busy}');
    expect(shell).toContain('aria-busy={busy||undefined}');
    expect(source).toContain('disabled={busy}');
    expect(source).toContain('onRequestClose={cancel}');
    expect(styles).toContain('[data-tone="destructive"]');
    expect(styles).toContain('.destructive-action');
    expect(styles).toContain('background:var(--red)');
  });

  it('keeps narrow-screen confirmation actions touch safe',()=>{
    expect(styles).toContain('min-height:44px');
    expect(styles).toContain('@media(max-width:680px)');
  });
});
