import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/ConfirmDialog.tsx',import.meta.url),'utf8');

describe('ConfirmDialog source contract',()=>{
  it('uses an app-owned accessible modal confirmation surface',()=>{
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby="app-confirm-title"');
    expect(source).toContain('aria-describedby="app-confirm-description"');
    expect(source).toContain('useModalFocus');
    expect(source).toContain('data-autofocus="true"');
  });

  it('keeps destructive tone explicit and prevents duplicate busy actions',()=>{
    expect(source).toContain("tone==='destructive'");
    expect(source).toContain('data-action-tone={tone}');
    expect(source).toContain('aria-busy={busy||undefined}');
    expect(source).toContain('disabled={busy}');
  });
});
