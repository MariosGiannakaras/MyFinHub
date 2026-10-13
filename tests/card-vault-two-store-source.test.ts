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
  it('requires durable card-profile deletion before remote vault cleanup and supports persisted retry',()=>{
    expect(app.indexOf('await finance.updateDurably(current=>withCardSecretCleanupPending')).toBeLessThan(app.indexOf('await runCardCleanup(card.id)'));
    expect(app).toContain('cleanupInFlight.current.set(id,task)');
    expect(app).toContain('cleanupAttempted.current.add(id)');
    expect(app).toContain('pendingCardSecretDeletes??[]');
    expect(read('server/cardVaultStore.ts')).toContain("throw new ApiError(409,'CARD_SECRET_DELETE_NOT_COMMITTED'");
    expect(read('server/cardStateValidation.ts')).toContain('state.pendingCardSecretDeletes??[]');
    expect(read('src/types.ts')).toContain('pendingCardSecretDeletes?: string[]');
    expect(read('src/lib/cardSecretDeletion.ts')).toContain('await deleteCardSecret(cardId,true)');
    expect(read('src/lib/cardSecretDeletion.ts')).toContain('await updateDurably(current=>withCardSecretCleanupComplete');
  });
  it('waits for the final exact profile receipt and retains the modal on failed profile save',()=>{
    expect(cards).toContain('await onUpsertCardDurably(card);setDetailsCard(null)');
    expect(credit).toContain('await onUpsertCardDurably(updated);if(wasNew)');
    expect(dlg).toContain('await onSaved(updated)');
    expect(dlg).toContain('else if(vaultSaved)setError(');
    expect(dlg).toContain('else if(requireCvv&&!profileStaged)setError(');
    expect(dlg).toContain('else if(requireCvv)setError(');
    expect(cards).toContain('Τα ασφαλή στοιχεία δεν αφαιρέθηκαν.');
    expect(credit).toContain('Τα ασφαλή στοιχεία δεν αφαιρέθηκαν.');
    expect(qa).toContain("get('card-profile-save-failure')==='1'");
    expect(read('scripts/card-vault-runtime-qa.mjs')).toContain('card-vault-finance-profile-failure');
  });
});
