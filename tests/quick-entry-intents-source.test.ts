import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const quickAdd=readFileSync(new URL('../src/components/QuickAdd.tsx',import.meta.url),'utf8');
const contextual=readFileSync(new URL('../src/components/ContextualQuickAdd.tsx',import.meta.url),'utf8');

describe('Quick Entry intent UI source contract',()=>{
  it('uses shared cent-exact validation in multi-source, commission and contextual owners',()=>{
    expect(quickAdd).toContain('const share=parseMoneyInputAmount(row.amountText)');
    expect(quickAdd).toContain('if(share===null||share<=0)throw');
    expect(quickAdd).toContain('parseMoneyInputAmount(feeAmount,true)');
    expect(contextual).toContain('const numeric=parseMoneyInputAmount(amount)');
    expect(contextual).toContain('parseMoneyInputAmount(paymentFee,true)');
    expect(contextual).not.toContain("const numeric=Number(amount.replace(',','.'))");
    expect(quickAdd).not.toContain("amount:Number(row.amountText.replace(',','.'))");
  });

  it('stages real-browser malformed notation guards without relying on unit assertions alone',()=>{
    const browser=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(browser).toContain('quick-entry-nondecimal-rejected-desktop');
    expect(browser).toContain('contextual-entry-hex-rejected-desktop');
    expect(browser).toContain('generic exponent notation never posts a finance event');
    expect(browser).toContain('contextual hex notation never posts a savings event');
  });

  it('keeps raw split-part values visible but maps only valid cents to finance state',()=>{
    expect(quickAdd).toContain('const [splitAmountText,setSplitAmountText]=useState<Record<string,string>>({})');
    expect(quickAdd).toContain("value={rawSplitAmount??String(p.amount||'')}");
    expect(quickAdd).toContain('<MoneyInput data-autofocus={i===0?true:undefined}');
    expect(quickAdd).toContain('<CategorySelectInput settings={data.state.settings} kind="expense" category={p.category}');
    expect(quickAdd).toContain('sumValidMoneyInputAmounts(parts.map(part=>splitAmountText[part.id]');
    expect(quickAdd).toContain("splitTotal===null?'—':money.format(splitTotal)");
    expect(quickAdd).toContain('setSplitAmountText(current=>({...current,[p.id]:text}))');
    expect(quickAdd).toContain('amount:parsed??0');
    expect(quickAdd).toContain('parseMoneyInputAmount(statementMovement,true)');
    expect(quickAdd).not.toContain("const parsed=Number(e.target.value.replace(',','.'))");
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('quick-entry-split-nondecimal-rejected-desktop');
    expect(qa).toContain('split malformed entry stays in draft without a posted event');
    expect(qa).toContain('invalid split subtotal is not presented as a confirmed amount');
    expect(qa).toContain('split shared control geometry at');
    expect(qa).toContain('comma decimal normalization retains exact split cents');
    expect(qa).toContain('corrected split no longer announces stale amount validation');
    expect(quickAdd).toContain("amount:parsed??0}:x));setError('');mark()");
    const taxonomy=readFileSync(new URL('../src/styles/taxonomy-filter-controls.css',import.meta.url),'utf8');
    const audit=readFileSync(new URL('../src/styles/frontend-audit-remediation.css',import.meta.url),'utf8');
    const owner=readFileSync(new URL('../src/styles/quick-entry-body-split.css',import.meta.url),'utf8');
    const responsive=readFileSync(new URL('../src/styles/root-responsive-coordination.css',import.meta.url),'utf8');
    expect(owner).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1fr) 110px 44px');
    expect(owner).toContain('.split-line button{min-height:44px;');
    expect(responsive).toContain('.split-line{grid-template-columns:repeat(2,minmax(0,1fr))}');
    expect(taxonomy).not.toContain('.split-line-taxonomy');
    expect(audit).not.toContain('.split-line button');
    expect(qa).toContain('split geometry diagnostic');
  });

  it('shows only actual funded accounts in multi-source expense mode and preserves ordinary account editing on exit',()=>{
    expect(quickAdd).toContain("!transferLike && kind!=='card_purchase'&&!(kind==='expense'&&multiFundingOpen)");
    expect(quickAdd).toContain("event=createMultiSourcePurchaseEvent(data");
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('multi-source entry hides the unrelated single-account selector');
    expect(qa).toContain('ordinary expense account selector returns when multi-source mode closes');
    expect(qa).toContain('quick-entry-multi-funding-real-sources-mobile-375');
  });

  it('guards all ordinary Quick Entry account legs and prevents coerced multi-funding previews',()=>{
    expect(quickAdd).toContain("const numeric=kind==='split'||kind==='reconciliation'?0:parseMoneyInputAmount(amount)");
    expect(quickAdd).toContain("const actual=kind==='reconciliation'?parseMoneyInputAmount(actualBalance,true):undefined");
    expect(quickAdd).toContain("if(e.target.checked&&reconciliation&&!manualReconciliationDraftError(reconciliation,true)&&error===manualReconciliationDraftError(reconciliation,false))setError('')");
    expect(quickAdd).toContain('const visibleError=receiptUnverified?FINANCE_RECEIPT_UNVERIFIED:error;');
    expect(quickAdd).toContain("if(kind==='withdrawal'){");
    expect(quickAdd).toContain("withdrawalDraftError(data,{fromAccountId:from,toAccountId:to,amount:numeric},initial)");
    expect(quickAdd).toContain("accountOptions(from,kind==='withdrawal'?withdrawal.sources");
    expect(quickAdd).toContain("accountOptions(to,kind==='withdrawal'?withdrawal.targets");
    expect(quickAdd).toContain("if(next==='withdrawal'){setFrom(withdrawal.from);setTo(withdrawal.to)}");
    expect(quickAdd).toContain("return [...(current&&!poolIds.has(current)?[<option");
    expect(quickAdd).not.toContain("return current&&!poolIds.has(current)?<>");
    expect(quickAdd).toContain('singleAccountDraftError(data,accountId)');
    expect(quickAdd).toContain('singleAccountDraftError(data,from)');
    expect(quickAdd).toContain('const fundingPreview=sumValidMoneyInputAmounts');
    expect(quickAdd).toContain("fundingPreview===null?'—':money.format(fundingPreview)");
    expect(quickAdd).not.toContain("money.format(fundingRows.reduce((sum,row)=>sum+(Number(");
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('quick-entry-multi-funding-invalid-subtotal-desktop');
    expect(qa).toContain('quick-entry-multi-funding-invalid-subtotal-preview-desktop');
    expect(qa).toContain('multi-source validation focus and alert are actually onscreen');
    expect(qa).toContain('invalid funding subtotal never posts a finance event');
  });


  it('allocates distinct draft row IDs outside state updaters, including two same-turn Add clicks and imported IDs',()=>{
    expect(quickAdd).toContain('const draftRowSerial=useRef(0)');
    expect(quickAdd).toContain("const nextDraftRowId=(scope:'funding'|'part',existing:readonly {id:string}[])=>");
    expect(quickAdd).toContain('while(occupied.has(id))');
    expect(quickAdd).toContain("const id=nextDraftRowId('funding',fundingRows)");
    expect(quickAdd).toContain("const id=nextDraftRowId('part',parts)");
    expect(quickAdd).not.toContain("id:'funding-'+Date.now()");
    expect(quickAdd).not.toContain("id:`p${Date.now()}`");
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('multi-source same-turn row additions retain independent controlled fields');
    expect(qa).toContain('split same-turn row additions retain independent raw amount fields');
    expect(qa).toContain('quick-entry-multi-funding-stable-rows-mobile-375');
    expect(qa).toContain('quick-entry-split-stable-rows-mobile-375');
    expect(qa).toContain('two rapid row additions never post any finance event');
  });

  it('enforces the 12-source bound inside the batched funding update, not only via disabled repaint',()=>{
    expect(quickAdd).toContain('disabled={fundingRows.length>=12}');
    expect(quickAdd).toContain('if(fundingRows.length>=12)return;const id=nextDraftRowId');
    expect(quickAdd).toContain('setFundingRows(rows=>rows.length>=12?rows:[...rows,{id,sourceKey:');
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('funding source limit survives two same-turn Add clicks at 11 rows');
    expect(qa).toContain('quick-entry-multi-funding-max12-mobile-375');
    expect(qa).toContain('cap remains exactly twelve before any finance receipt');
  });

  it('keeps split updates and both removal owners tied to stable row IDs and the two-row minimum',()=>{
    expect(quickAdd).not.toContain('setParts(ps=>ps.map((x,j)=>j===i?');
    expect(quickAdd).toContain('setParts(ps=>ps.map(x=>x.id===p.id?');
    expect(quickAdd).toContain('setParts(ps=>ps.length<=2?ps:ps.filter(item=>item.id!==p.id))');
    expect(quickAdd).toContain('setFundingRows(rows=>rows.length<=2?rows:rows.filter(item=>item.id!==row.id))');
    expect(quickAdd).toContain('disabled={fundingRows.length<=2}');
    expect(quickAdd).toContain('disabled={parts.length<=2}');
    const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain('same-turn funding removals never reduce below two independent source rows');
    expect(qa).toContain('same-turn split removals never reduce below two independently keyed parts');
    expect(qa).toContain('no finance write for rapid source or split draft removals');
  });

  it('does not erase lending due-date, saving source or original provenance during ordinary edits',()=>{
    expect(quickAdd).toContain("import { preserveEntryEditProvenance } from '../lib/eventEditProvenance'");
    expect(quickAdd).toContain('preserveEntryEditProvenance(event,initial)');
  });

  it('exercises real lending and savings metadata edits through the synthetic Transactions UI',()=>{
    const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
    const script=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');
    expect(qa).toContain("if(params.get('state')==='entry-edit-provenance')");
    expect(qa).toContain('controls.__myfinhubQaEntryEditProvenance=(id:string)=>');
    expect(script).toContain("await navigate('transactions','entry-edit-provenance')");
    expect(script).toContain("await chooseProvenanceDate('2026-08-27')");
    expect(script).toContain('rejected lending date must not even attempt a finance write');
    expect(script).toContain('confirmed same-ID lending edit preserves return date and original source');
    expect(script).toContain('confirmed saving edit preserves owner-confirmed saving origin and original audit source');
    expect(script).toContain('quick-entry-lending-return-conflict-desktop');
    expect(script).toContain('quick-entry-lending-return-conflict-tablet');
    expect(script).toContain('quick-entry-lending-return-conflict-mobile');
    expect(script).toContain("await navigate('credit','entry-edit-provenance')");
    expect(script).toContain('same-date credit edit preserves card, statement, origin and purchase debit');
    expect(script).toContain('date-moved credit purchase recalculates next billing cycle');
    expect(script).toContain('quick-entry-credit-same-statement-corrected-desktop');
    expect(script).toContain('quick-entry-credit-new-statement-corrected-desktop');
    expect(qa).toContain("purchase.statementId='qa-card:2026-08-12'");
  });

  it('renders the approved intent registry instead of maintaining a second label list',()=>{
    expect(quickAdd).toContain('ENTRY_INTENTS.map');
    expect(quickAdd).toContain('intentIcons');
    expect(quickAdd).toContain("saving:<PiggyBank/>");
    expect(quickAdd).not.toContain("label:'Πήρα χρήματα'");
    expect(quickAdd).not.toContain("label:'Πήρα μετρητά'");
  });

  it('applies frequent suggestions as structured presets without turning the suggestion label into the user comment',()=>{
    expect(quickAdd).toContain('structuredPresetFromFrequent(f)');
    expect(quickAdd).not.toContain('setNote(f.label)');
  });

  it('keeps the comment field explicitly user-owned and optional',()=>{
    expect(quickAdd).toContain('Σχόλιο <em>προαιρετικό</em>');
    expect(quickAdd).toContain('Σύντομη περιγραφή μόνο αν χρειάζεται');
  });
});
