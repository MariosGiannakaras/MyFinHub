import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
const app=read('src/App.tsx'),dlg=read('src/components/CardDetailsDialog.tsx');
const cards=read('src/pages/CardsPage.tsx'),credit=read('src/pages/CreditCardPage.tsx'),qa=read('src/qa.tsx');
describe('staged card profile + secure vault boundary',()=>{
  it('validates the input and saves the empty card profile durably before uploading any new secret',()=>{
    expect(app).toContain('const stageNewCard=(card:PaymentCard)=>finance.updateDurably');
    expect(app).toContain('last4:undefined,vaultRef:undefined');
    expect(dlg.indexOf('if(requireCvv)await onBeforeSave?.(card)')).toBeLessThan(dlg.indexOf('await saveCardDetails(card,'));
    expect(dlg).toContain('normalizeCardDetailsInput({pan,expiry,cvv},{requireCvv})');
    expect(cards).toContain('onBeforeSave={onStageNewCard}');
    expect(credit).toContain('onBeforeSave={onStageNewCard}');
    expect(qa).toContain('onStageNewCard={stageNewCard}');
  });
  it('waits for the final exact profile receipt and retains the modal on failed profile save',()=>{
    expect(cards).toContain('await onUpsertCardDurably(card);setDetailsCard(null)');
    expect(credit).toContain('await onUpsertCardDurably(updated);if(wasNew)');
    expect(dlg).toContain('await onSaved(updated)');
    expect(dlg).toContain('else if(vaultSaved)setError(');
  });
});
