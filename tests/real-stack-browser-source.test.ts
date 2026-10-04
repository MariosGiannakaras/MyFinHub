import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync('scripts/real-stack-browser-e2e.ts','utf8');

describe('actual-browser real-stack source contract',()=>{
  it('uses the real app UI and same-origin API without fetch interception',()=>{
    expect(source).toContain("origin+'/#/transactions'");
    expect(source).toContain("document.querySelector('#login-title')");
    expect(source).toContain("document.querySelector('#mfa-title')");
    expect(source).toContain('[data-global-quick-entry]');
    expect(source).toContain("querySelectorAll('label')");
    expect(source).toContain("wrapper?.querySelector('input,textarea,select')");
    expect(source).toContain("getAttribute('aria-label')===label");
    expect(source).toContain("fetch('/api/data'");
    expect(source).toContain('Page.reload');
    expect(source).not.toContain('globalThis.fetch=');
    expect(source).not.toContain('SUPABASE_ACCESS_TOKEN');
  });
  it('covers modern and legacy durable mutation lifecycles across hard reload',()=>{
    expect(source).toContain('stage modern-create-reload');
    expect(source).toContain('stage modern-edit-delete-undo');
    expect(source).toContain('stage legacy-edit-delete-undo');
    expect(source).toContain('Durable modern undo is unavailable after reload.');
    expect(source).toContain('Durable legacy undo is unavailable after reload.');
    expect(source).toContain('actual browser auth + modern/legacy mutation persistence across hard reload');
  });
});
