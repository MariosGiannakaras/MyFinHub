import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quickAdd=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const receiptAware=readFileSync(new URL('../src/components/ReceiptAwareQuickAdd.tsx',import.meta.url),'utf8');
const approvedCss=readFileSync(new URL('../src/styles/quick-entry-desktop-composition.css',import.meta.url),'utf8');
const approvedChain=readFileSync(new URL('../src/styles/approved-workspace-targets.css',import.meta.url),'utf8');
const baseStyles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const normalizedBaseStyles=baseStyles.replace(/\r\n/g,'\n');
const rootCompat=readFileSync(new URL('../src/styles/root-compat.css',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const workspaceLayer=readFileSync(new URL('../src/components/WorkspaceStyleLayer.tsx',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const workspaceCompat=readFileSync(new URL('../src/styles/workspace-compat.css',import.meta.url),'utf8').replace(/\r\n/g,'\n');

describe('approved Quick Entry desktop target source contract',()=>{
  it('keeps the real eight-intent QuickAdd engine and canonical entry controls',()=>{
    expect(quickAdd).toContain('ENTRY_INTENTS.map');
    expect(quickAdd).toContain('generic-kind-grid');
    expect(quickAdd).toContain('structuredPresetFromFrequent(f)');
    expect(quickAdd).toContain('<MoneyInput');
    expect(quickAdd).toContain('<AppDateInput');
    expect(quickAdd).toContain('<AppSelectInput');
    expect(quickAdd).toContain('createTransferEvent');
    expect(quickAdd).toContain('createExpenseSplitEvent');
  });

  it('places the existing real receipt flow inside the Quick Entry footer without duplicating persistence',()=>{
    expect(receiptAware).toContain("createPortal(<button type=\"button\" className=\"receipt-quick-launch neo-raised\"");
    expect(receiptAware).toContain("document.querySelector<HTMLElement>('[aria-labelledby=\"quick-add-title\"] > footer')");
    expect(receiptAware).toContain('setReceiptOpen(true)');
    expect(receiptAware).toContain('deleteReceiptDraft(handledId)');
  });

  it('preserves the approved Quick Entry chain behind the named root and lazy workspace style owners',()=>{
    expect(normalizedBaseStyles.trim()).toBe("@import './styles/root-compat.css';");
    expect(rootCompat).toContain("@import './part46.css';\n@import './app-controls.css';");
    expect(rootCompat.trimEnd()).toMatch(/app-controls\.css';$/);
    expect(workspaceLayer).toContain("import '../styles/workspace-compat.css';");
    expect(workspaceCompat).toContain("@import './approved-workspace-targets.css';\n@import './account-metadata-surfaces.css';\n@import './dashboard-command-search-geometry.css';\n@import './dashboard-desktop-fidelity.css';\n@import './dashboard-bankmark-chart-attention.css';");
    expect(approvedChain).toContain("@import './dashboard-approved-target.css';");
    expect(approvedChain).toContain("@import './dashboard-route-shell-continuity.css';");
    expect(approvedChain).toContain("@import './dashboard-command-search-geometry.css';");
    expect(approvedChain).toContain("@import './dashboard-desktop-alignment.css';");
    expect(approvedChain).toContain("@import './transactions-desktop-shell.css';");
    expect(approvedChain).toContain("@import './quick-entry-desktop-composition.css';");
    expect(approvedCss).toContain('@media (min-width:1100px)');
    expect(approvedCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))');
    expect(approvedCss).toContain('.form-grid .wide{grid-column:span 2}');
    expect(approvedCss).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(approvedCss).toContain("content:'Σάρωση & αυτόματη συμπλήρωση'");
  });
});
