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
    expect(editor).toContain("placeholder={requireCvv?'CVV':'Προαιρετικό'}");
    expect(editor).toContain('{!requireCvv?<small className="card-cvv-preserve-hint">');
    expect(editor).toContain('Κενό = διατήρηση υπάρχοντος CVV');
    const inlineCss=file('../src/styles/card-details-dialog.css');
    // Owner requested the original card/button visual language, not a new boxed editor.
    expect(inlineCss).toContain('color:var(--card-text,#fff);background:transparent;border:0;border-radius:0;box-shadow:none');
    expect(inlineCss).toContain('.app-card-details-inline footer{display:flex;');
    expect(inlineCss).toContain('min-height:38px');
    expect(inlineCss).not.toContain('.app-card-details-inline footer button:first-child:nth-last-child(3)');
    expect(inlineCss).not.toContain('.app-card-details-inline{display:grid;grid-template-rows:auto auto auto;min-width:0;min-height:0;margin:8px');
    const cardCss=file('../src/components/InteractivePaymentCard.css');
    expect(cardCss).toContain('.prototype-payment-card .card-icon-btn.card-icon-reveal,');
    expect(cardCss).toContain('background:transparent;box-shadow:none;opacity:.96');
    expect(cardCss).toContain('stroke-width:2.4;');
    expect(interactive).toContain('A missing server vault entry is not a successful reveal');
    expect(interactive).toContain('role="alert" aria-live="assertive"');
    expect(interactive).toContain("visible&&revealed.pan?'revealed':'masked'");
    expect(cardCss).toContain('.prototype-payment-card:has(.card-number.revealed) .card-inner{');
    expect(cardCss).toContain('white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;');
    expect(file('../scripts/frontend-qa.mjs')).toContain('eye displays full 32-digit PAN without clipping');
    const qa=file('../scripts/frontend-qa.mjs');
    expect(qa).toContain("'eye reveals server PAN and CVV'");
    expect(qa).toContain("'eye reports server vault configuration error'");
    expect(cardCss).toContain('.prototype-payment-card:has(.app-card-details-inline) .card-inner{position:relative;inset:auto');
    const frontendQa=file('../scripts/frontend-qa.mjs');
    expect(frontendQa).toContain('on-card secure editor and every save/cancel action must remain inside expanded card');
    const geomQa=file('../scripts/completion-dialog-geometry-qa.mjs');
    expect(geomQa).toContain('save/cancel buttons and complete editor must fit expanded card');
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
