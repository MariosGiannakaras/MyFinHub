import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const settings=read('src/pages/SettingsPage.tsx');
const css=read('src/pages/SettingsData.css');

describe('Settings Data source contract',()=>{
  it('preserves the canonical backup and import safety semantics',()=>{
    expect(settings).toContain('MAX_FINANCE_DOCUMENT_BYTES');
    expect(settings).toContain('await onBackup()');
    expect(settings).toContain('downloadJson(data)');
    expect(settings).toContain('await onImport(JSON.parse(await file.text()))');
    expect(settings).toContain('tone="destructive"');
    expect(settings).toContain('δημιουργηθεί αυτόματο αντίγραφο ασφαλείας');
    expect(settings).toContain('type="file" accept="application/json,.json" hidden');
  });

  it('renders a structured data-status and action workspace instead of one generic action row',()=>{
    expect(settings).toContain('settings-data-overview');
    expect(settings).toContain('settings-data-status-grid');
    expect(settings).toContain('settings-data-action-grid');
    expect(settings).toContain('Δημιουργία αντιγράφου ασφαλείας');
    expect(settings).toContain('Επαναφορά από JSON');
    expect(settings).toContain('Έως 4 MB');
    expect(settings).toContain('Προέλευση & τεχνικές πληροφορίες');
    expect(settings).not.toContain('<div className="settings-actions">');
  });

  it('keeps Data CSS composition-only and touch-safe while leaving reusable control paint to shared styles',()=>{
    expect(settings.match(/className="secondary settings-data-action-button"/g)).toHaveLength(2);
    expect(css).toContain('.settings-data-action-grid');
    expect(css).toContain('.settings-data-status-grid');
    expect(css).toContain('@media(max-width:720px)');
    expect(css).toContain('.settings-data-action-button{width:100%;min-height:44px;justify-content:center}');
    expect(css).not.toMatch(/\.settings-data[^\{]*button\s*\{[^}]*border:/s);
    expect(css).not.toMatch(/\.settings-data[^\{]*button\s*\{[^}]*background:/s);
    expect(css).not.toMatch(/\.settings-data[^\{]*input\s*\{/s);
  });
});
