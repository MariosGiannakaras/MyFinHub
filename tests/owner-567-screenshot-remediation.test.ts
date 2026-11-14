import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCardNumberInput, normalizeCardDetailsInput } from '../src/lib/cardDetails.js';
import { normalizeCardSecrets } from '../server/cardVaultCrypto.js';
import { inferredCategoryIcon } from '../src/lib/categoryIconInference.js';

const file=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

describe('owner #567 screenshot-driven corrections',()=>{
  it('requires owner-approved four groups of four, real expiry month and 3-digit CVV',()=>{
    const pan='1234567890123456';
    expect(formatCardNumberInput(pan)).toBe('1234 5678 9012 3456');
    expect(normalizeCardDetailsInput({pan,expiry:'12/31',cvv:'123'},{requireCvv:true})).toEqual({pan,expiry:'12/31',cvv:'123'});
    expect(normalizeCardSecrets({pan,expiry:'12/31',cvv:'123'})).toEqual({pan,expiry:'12/31',cvv:'123'});
    expect(()=>normalizeCardDetailsInput({pan:pan+'1',expiry:'12/31'})).toThrow();
    expect(()=>normalizeCardSecrets({pan:pan+'1'})).toThrow();
    expect(()=>normalizeCardSecrets({expiry:'13/31'})).toThrow();
    expect(()=>normalizeCardSecrets({cvv:'12'})).toThrow();
    expect(()=>normalizeCardSecrets({cvv:'1234'})).toThrow();
  });
  it('retains one on-card edit action, with inline create/edit and no card-details modal on the debit route',()=>{
    const interactive=file('../src/components/InteractivePaymentCard.tsx');
    const route=file('../src/pages/CardsPage.tsx');
    const editor=file('../src/components/CardDetailsDialog.tsx');
    const inlineCss=file('../src/styles/card-details-dialog.css');
    expect(interactive).toContain('detailsEditor ? detailsEditor');
    // A previous Eye failure may have its own visible alert. It must clear
    // when the user enters the icon-only editor, without suppressing the
    // actual failed reveal state before that interaction.
    expect(interactive).toContain("if(detailsEditor)setMessage('')");
    expect(file('../scripts/frontend-qa.mjs')).toContain("'stale Eye failure status clears when icon-only editor opens'");
    expect(interactive).toContain('onEditDetails||onEditCard');
    expect(interactive).not.toContain('KeyRound');
    expect(route).toContain('<CardDetailsDialog inline open');
    expect(route).toContain('const visibleWorkspaceBanks=');
    expect(route).not.toContain('<CardDetailsDialog open={Boolean(detailsCard)}');
    expect(editor).toContain('if(inline){');
    expect(editor).toContain("card-number card-inline-edit-host");
    expect(editor).toContain('className="card-inline-value card-inline-pan"');
    expect(editor).toContain('card-inline-metric-only');
    expect(editor).toContain('aria-hidden="true"');
    // The ordinary card's perspective projects translateZ children. Removing it
    // during editing shrinks their rectangles ~4% and shifts fields/network.
    expect(inlineCss).not.toContain('.app-card-details-inline .prototype-payment-card{transform:none!important}');
    expect(file('../src/styles/cards-v15-presentation.css')).toContain('transform:perspective(1000px) rotateX(0) rotateY(0)');
    expect(inlineCss).toContain('.app-card-details-inline .card-inline-edit-host>.card-inline-value{');
    expect(inlineCss).toContain('position:absolute;inset:0;display:block;width:100%;height:100%');
    expect(editor).toContain('card-field-value card-inline-edit-host');
    expect(editor).toContain('card-inline-value card-inline-expiry');
    expect(editor).toContain('card-inline-value card-inline-cvv');
    expect(editor).toContain('card-inline-action-slot');
    // Global button min-height is 24px even though .copy-mini's own height
    // is 23px. Span placeholders shrink the PAN row by 1px (1.08px in 3D).
    expect(file('../src/styles/theme-surface-foundations.css')).toContain('button{min-width:24px;min-height:24px}');
    expect(editor).toContain('className="copy-mini card-inline-action-slot" disabled tabIndex={-1} aria-hidden="true"');
    expect(editor).not.toContain('<span className="copy-mini card-inline-action-slot"');
    expect(file('../scripts/frontend-qa.mjs')).toContain('near(cardFaceBeforeEdit.numberWrapHeight,cardFaceAfterEdit.numberWrapHeight,1)');
    expect(file('../scripts/frontend-qa.mjs')).toContain('near(cardFaceBeforeEdit.copySlotHeight,cardFaceAfterEdit.copySlotHeight,1)');
    expect(editor).toContain('<PrototypeBrand card={card} bank={bank}/>');
    expect(interactive).toContain('export function PrototypeBrand(');
    expect(editor).toContain('const panIsLong=pan.replace(/\\D/g,\'\').length>16');
    expect(editor).toContain('formatStoredCardNumberInput(nextPan)');
    expect(editor).toContain('maxLength={19} value={shownPan}');
    expect(editor).toContain('maxLength={3} value={cvv}');
    expect(editor).toContain('rows={panIsLong?2:1}');
    expect(editor).toContain('<AppTextarea data-autofocus');
    expect(file('../scripts/frontend-qa.mjs')).toContain('card-inline-edit-16-digits-');
    expect(file('../scripts/frontend-qa.mjs')).toContain('editing preserves original credit-compatible card ratio, PAN/CVV font sizes');
    expect(file('../scripts/card-vault-runtime-qa.mjs')).toContain('HTMLTextAreaElement.prototype');
    expect(editor).toContain('card-inline-value card-inline-expiry');
    expect(editor).toContain('card-inline-value card-inline-cvv');
    expect(editor).toContain('<CardNetworkMark network={card.network} detail={kind}/>');
    expect(editor).toContain('await onBeforeSave?.(card)');
    expect(editor).toContain('await onSaved(updated)');
    expect(editor).toContain("placeholder={requireCvv?'CVV':'Προαιρετικό'}");
    expect(editor).toContain('{!requireCvv?<small className="card-cvv-preserve-hint">');
    expect(editor).toContain('Κενό = διατήρηση υπάρχοντος CVV');
    expect(inlineCss).not.toContain('font-size:.84rem;letter-spacing:.02em');
    // Owner requested the original card/button visual language, not a new boxed editor.
    expect(inlineCss).toContain('.app-card-details-inline .card-inline-value{');
    expect(inlineCss).toContain('font:inherit;letter-spacing:inherit;line-height:inherit');
    expect(inlineCss).toContain('.app-card-details-inline .card-inline-pan{');
    expect(inlineCss).toContain('overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;');
    // The app's general 16px mobile form-input override must not inflate the
    // physical card's 16-digit PAN and force unseen wrapped textarea rows.
    expect(file('../src/styles/mobile-finance-presentations.css')).toContain('input,select,textarea{font-size:16px!important}');
    expect(inlineCss).toContain('.app-card-details-inline .card-inline-pan{font-size:inherit!important}');
    expect(inlineCss).toContain('.app-card-details-inline .card-inline-edit-host>.card-inline-pan{width:calc(100% + 24px);max-width:none}');
    expect(inlineCss).toContain('.app-card-details-inline .card-number.card-inline-edit-host{');
    expect(inlineCss).toContain('overflow:visible;text-overflow:clip;');
    expect(file('../scripts/frontend-qa.mjs')).toContain('liveEdit.inputFont===liveEdit.faceFont');
    expect(file('../scripts/frontend-qa.mjs')).toContain('liveEdit.scrollHeight<=liveEdit.clientHeight+2');
    expect(inlineCss).not.toContain('.app-card-details-inline .card-inline-pan.revealed{height:calc(2 * 1.28em)}');
    expect(inlineCss).not.toContain('height:1.1em;max-height:none;box-sizing:border-box;');
    expect(file('../scripts/frontend-qa.mjs')).toContain('near(cardFaceBeforeEdit.numberHeight,cardFaceAfterEdit.numberHeight,1)');
    expect(file('../scripts/frontend-qa.mjs')).toContain('near(cardFaceBeforeEdit.bodyHeight,cardFaceAfterEdit.bodyHeight,1)');
    expect(inlineCss).toContain('.app-card-details-inline .card-field-value{flex:1}');
    expect(inlineCss).not.toContain('width:100%;height:23px;max-height:23px;min-height:0;');
    expect(file('../scripts/frontend-qa.mjs')).toContain('cardFaceAfterEdit.editValue');
    expect(file('../scripts/frontend-qa.mjs')).toContain('cardFaceBeforeEdit.field');
    expect(file('../scripts/frontend-qa.mjs')).toContain('cardFaceAfterEdit.labelY');
    const inlineFace=editor.split('if(inline){')[1]?.split('const content=<>')[0]??'';
    expect(inlineFace).toContain('className="card-icon-btn card-icon-management card-inline-save"');
    expect(inlineFace).toContain('aria-label="Αποθήκευση στοιχείων κάρτας"');
    expect(inlineFace).toContain('onClick={()=>void submit()}');
    expect(inlineFace).toContain("event.key==='Escape'");
    expect(inlineFace).toContain('onKeyDownCapture=');
    expect(inlineFace).toContain('className="sr-only" role="alert"');
    expect(inlineFace).toContain('aria-label="Όνομα / σχέδιο"');
    expect(inlineFace).not.toContain('<footer');
    expect(inlineFace).not.toContain('<details className="app-card-details-help">');
    expect(inlineFace).not.toContain('className="card-cvv-preserve-hint"');
    expect(inlineFace).not.toContain('className="app-card-details-notice"');
    expect(inlineFace).not.toContain('card-inline-close');
    expect(inlineCss).toContain('.app-card-details-inline{display:block;');
    // The parent .card-slot owns perspective. An inserted flat wrapper would
    // shrink translateZ children without changing the physical card ratio.
    expect(file('../src/styles/cards-v15-presentation.css')).toContain('perspective:1000px;position:relative');
    expect(inlineCss).toContain('transform-style:preserve-3d');
    expect(file('../scripts/frontend-qa.mjs')).toContain('near(cardFaceBeforeEdit.fieldsHeight,cardFaceAfterEdit.fieldsHeight,1)');
    expect(file('../scripts/frontend-qa.mjs')).toContain('near(cardFaceBeforeEdit.brandY,cardFaceAfterEdit.brandY)');
    expect(inlineCss).not.toContain('.card-inline-save-actions{');
    expect(inlineCss).toContain('.app-card-details-inline .card-inline-save[data-save-error="true"]');
    expect(file('../scripts/frontend-qa.mjs')).toContain('Escape discards draft without secure vault writes');
    // A real CDP Escape must be delivered to the freshly focused editor.
    // Await React dismissal before trying the normal card's Eye button.
    expect(file('../scripts/frontend-qa.mjs')).toContain('"Escape restores persisted expiry and focuses the card editor"');
    expect(file('../scripts/frontend-qa.mjs')).toContain("'Escape restores keyboard focus to the original pencil'");
    expect(file('../scripts/frontend-qa.mjs')).toContain("'second Escape closes inline editor before revealing card'");
    expect(file('../scripts/card-vault-runtime-qa.mjs')).toContain('partial vault save must keep inline editor');
    expect(route).toContain("data-single-bank={visibleWorkspaceBanks.length===1?'true':undefined}");
    const collections=file('../src/styles/cards-v15-presentation.css');
    expect(collections).toContain('.cards-workspace[data-single-bank="true"] .cards-grid{');
    expect(collections).toContain('grid-template-columns:minmax(0,1fr);');
    expect(file('../scripts/cards-remediation-qa.mjs')).toContain('current.workspaceScroll<=current.workspaceClient+1');
    expect(inlineCss).not.toContain('.app-card-details-inline footer button:first-child:nth-last-child(3)');
    expect(inlineCss).not.toContain('.app-card-details-inline{display:grid;grid-template-rows:auto auto auto;min-width:0;min-height:0;margin:8px');
    const cardCss=file('../src/components/InteractivePaymentCard.css');
    expect(cardCss).toContain('.prototype-payment-card .card-icon-btn.card-icon-reveal,');
    expect(cardCss).toContain('background:transparent;box-shadow:none;opacity:.96');
    expect(cardCss).toContain('stroke-width:2.4;');
    expect(interactive).toContain('A missing server vault entry is not a successful reveal');
    // Shared OperationFeedback derives alert/status from the actual result
    // rather than announcing successful copy or archive as an urgent failure.
    expect(interactive).toContain('<OperationFeedback className="r-card-status" tone={messageTone}>');
    expect(interactive).toContain("setMessageTone('error');setMessage('Δεν ήταν δυνατή η αντιγραφή.')");
    expect(interactive).toContain("setMessageTone('success');setMessage(`${label} αντιγράφηκε.`)");
    const shared=file('../src/components/OperationFeedback.tsx');
    expect(shared).toContain("role={failure?'alert':'status'}");
    expect(shared).toContain("aria-live={failure?'assertive':'polite'}");
    expect(interactive).toContain("legacyLongPan?'revealed card-number-long':'revealed'");
    expect(cardCss).toContain('.prototype-payment-card .card-number.revealed.card-number-long{');
    expect(cardCss).toContain('.prototype-payment-card:has(.card-number.revealed) .card-inner{');
    expect(cardCss).toContain('white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;');
    expect(file('../scripts/frontend-qa.mjs')).toContain('eye displays full 16-digit PAN without clipping');
    const qa=file('../scripts/frontend-qa.mjs');
    expect(qa).toContain("'eye reveals server PAN and CVV'");
    expect(qa).toContain("'eye reports server vault configuration error'");
    expect(cardCss).not.toContain('.prototype-payment-card:has(.app-card-details-inline)');
    const frontendQa=file('../scripts/frontend-qa.mjs');
    expect(frontendQa).toContain('normal card face with only original slot save icon and no added UI');
    // getBoundingClientRect uses fractional CSS px; DOM clientHeight is integer-rounded.
    // Normalize measurement units while retaining strict no-clipping and in-card action assertions.
    expect(frontendQa).toContain('Math.abs(inlineContainment.physicalCardHeight-inlineContainment.expectedCardHeight)<=2');
    expect(editor).toContain('aria-label="Κλείσιμο στοιχείων κάρτας"');
    const geomQa=file('../scripts/completion-dialog-geometry-qa.mjs');
    expect(geomQa).toContain('editable values and save icon in original card; no new panels');
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
    expect(geometry).toContain('existing on-card profile slot');
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
