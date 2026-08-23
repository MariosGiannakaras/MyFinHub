import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/ConfirmDialog.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/confirm-dialog.css',import.meta.url),'utf8');

describe('ConfirmDialog source contract',()=>{
  it('uses an app-owned accessible modal confirmation surface with instance-safe relationships',()=>{
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('useId');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain('aria-describedby={descriptionId}');
    expect(source).toContain('useModalFocus');
    expect(source).toContain('data-autofocus="true"');
  });

  it('keeps destructive tone explicit and prevents duplicate busy actions',()=>{
    expect(source).toContain("tone==='destructive'");
    expect(source).toContain('data-action-tone={tone}');
    expect(source).toContain('aria-busy={busy||undefined}');
    expect(source).toContain('disabled={busy}');
    expect(styles).toContain('[data-tone="destructive"]');
    expect(styles).toContain('.destructive-action');
    expect(styles).toContain('background:var(--red)');
  });

  it('keeps narrow-screen confirmation actions touch safe',()=>{
    expect(styles).toContain('min-height:44px');
    expect(styles).toContain('@media(max-width:680px)');
  });
});
