import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCardNumberInput, normalizeCardDetailsInput } from '../src/lib/cardDetails.js';
import { normalizeCardSecrets } from '../server/cardVaultCrypto.js';
import { inferredCategoryIcon } from '../src/lib/categoryIconInference.js';

const file=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

describe('owner #567 screenshot-driven corrections',()=>{
  it('bounds PAN without issuer-length, Luhn, or numeric value checks on either side',()=>{
    const pan='1'.repeat(32);
    expect(formatCardNumberInput(pan).replace(/\D/g,'')).toBe(pan);
    expect(normalizeCardDetailsInput({pan,expiry:'99/99',cvv:'1'}).pan).toBe(pan);
    expect(normalizeCardSecrets({pan,expiry:'99/99',cvv:'1'})).toEqual({pan,expiry:'99/99',cvv:'1'});
    expect(()=>normalizeCardDetailsInput({pan:pan+'1',expiry:'12/31'})).toThrow();
    expect(()=>normalizeCardSecrets({pan:pan+'1'})).toThrow();
    expect(()=>normalizeCardSecrets({cvv:'12345'})).toThrow();
  });
  it('retains one on-card edit action, with inline create/edit and no card-details modal on the debit route',()=>{
    const interactive=file('../src/components/InteractivePaymentCard.tsx');
    const route=file('../src/pages/CardsPage.tsx');
    const editor=file('../src/components/CardDetailsDialog.tsx');
    expect(interactive).toContain('detailsEditor ? detailsEditor');
    expect(interactive).toContain('onEditDetails||onEditCard');
    expect(interactive).not.toContain('KeyRound');
    expect(route).toContain('<CardDetailsDialog inline open');
    expect(route).toContain('const visibleWorkspaceBanks=');
    expect(route).not.toContain('<CardDetailsDialog open={Boolean(detailsCard)}');
    expect(editor).toContain('if(inline)return <section');
    expect(editor).toContain('await onBeforeSave?.(card)');
    expect(editor).toContain('await onSaved(updated)');
  });
  it('shows semantic finance icons first and preserves explicit opt-in to the whole catalog',()=>{
    const picker=file('../src/components/CategoryIconPicker.tsx');
    const workspace=file('../src/components/CategoryIconAssignmentWorkspace.tsx');
    expect(picker).toContain('FINANCE_ICON_CHOICES');
    expect(picker).toContain('CATEGORY_SEMANTIC_CATALOG_DEFAULTS[pack]');
    expect(picker).toContain('showAll||query.trim()?catalog.names');
    expect(picker).toContain('].slice(0,48)');
    expect(picker).toContain('catalog.names.filter(name=>defaults.has(name))');
    expect(picker).toContain('Όλα τα εικονίδια');
    expect(workspace).toContain('resettableBasicRows.reduce');
    expect(workspace).toContain('withCategoryIcon(next,row.kind,row.name,null)');
    expect(inferredCategoryIcon('expense','Φαγητό')).toBe('dining');
    expect(inferredCategoryIcon('expense','Καφές')).toBe('coffee');
    expect(inferredCategoryIcon('expense','Ψιλικά')).toBe('kiosk');
  });
  it('exercises the real two-stage on-card edit to profile/design path in rendered phone QA',()=>{
    const geometry=file('../scripts/completion-dialog-geometry-qa.mjs');
    expect(geometry).toContain("'on-card secure details visible'");
    expect(geometry).toContain("await clickText('.app-card-details-inline button','Όνομα / σχέδιο')");
    expect(geometry).toContain("await inspect('.card-create-modal'");
    expect(geometry).toContain("await inspect('.app-card-details-inline'");
  });
  it('limits viewport geometry inside the supplied phone routes instead of hiding off-screen data',()=>{
    const settings=file('../src/pages/SettingsPage.css');
    const period=file('../src/styles/reporting-period-controls.css');
    const accounts=file('../src/styles/dashboard-approved-target.css');
    const pickerCss=file('../src/components/CategoryIconAssignmentWorkspace.css');
    expect(settings).toContain('grid-template-columns:minmax(0,1fr)');
    expect(period).toContain('.period-control>span{min-width:0');
    expect(accounts).toContain('.approved-account-chart{left:min(48%,170px)');
    expect(pickerCss).toContain('.category-icon-assignment-workspace,.category-icon-library');
  });
});
