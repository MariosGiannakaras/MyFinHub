import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source=fs.readFileSync(path.join(process.cwd(),'src/pages/CreditCardPage.tsx'),'utf8');

describe('Credit Card shared Button ownership',()=>{
  it('moves the canonical generic action hooks to shared Button and IconButton',()=>{
    expect(source).toContain("from '../components/Button'");
    expect(source).toContain("from '../components/IconButton'");
    expect(source.match(/<Button\b/g)).toHaveLength(14);
    expect(source.match(/<IconButton\b/g)).toHaveLength(2);
    expect(source.match(/<Button[^>]+variant=\"primary\"/g)).toHaveLength(6);
    expect(source.match(/<Button[^>]+variant=\"secondary\"/g)).toHaveLength(8);
    expect(source).not.toContain('className="save-button"');
    expect(source).not.toContain('className="secondary"');
    expect(source).not.toContain('className="icon-button"');
  });

  it('preserves the two dialog close contracts and explicit button types',()=>{
    expect(source).toContain('<IconButton type="button" aria-label="Κλείσιμο ρύθμισης κύκλου"');
    expect(source).toContain('<IconButton type="button" aria-label="Κλείσιμο αγοράς πιστωτικής"');
    expect(source).toContain('<Button type="button" variant="primary" disabled={!card} onClick={openPurchase}');
    expect(source).toContain('<Button type="button" variant="secondary" disabled={!card||debt<=0||eligibleAccounts.length===0} onClick={openRepay}');
    expect(source).toContain('<Button data-autofocus={index===0?\'true\':undefined} type="button" variant="primary" onClick={()=>restoreArchived(archived)}');
  });

  it('keeps finance, statement, archive and modal-focus behavior unchanged',()=>{
    expect(source).toContain('const openRepay=()=>{if(!card)return;onPayCard(card.id,payableStatement?.id)}');
    expect(source).toContain('const saveStatementSetup=()=>{');
    expect(source).toContain('const submitPurchase=()=>{');
    expect(source).toContain("createEvent({kind:'card_purchase'");
    expect(source).toContain('restoreCard(target)');
    expect(source).toContain('canPermanentlyDeleteCreditCard(data,deleteCardTarget.id,asOf)');
    expect(source).toContain('useModalFocus<HTMLElement>(purchaseOpen');
    expect(source).toContain('useModalFocus<HTMLElement>(archiveOpen');
    expect(source).toContain('useModalFocus<HTMLElement>(statementSetupOpen');
  });

  it('retains Credit Card domain and composite controls as raw buttons',()=>{
    expect(source).toContain('className={cardDeckMode===\'horizontal\'?\'active\':\'\'}');
    expect(source).toContain('aria-label="Προηγούμενη πιστωτική κάρτα"');
    expect(source).toContain('aria-label="Επόμενη πιστωτική κάρτα"');
    expect(source).toContain('className="inline-icon-action"');
    expect(source).toContain('className="credit-cycle-link"');
    expect(source).toContain('className="close-picker"');
    expect(source).toContain('className="danger"');
    expect(source).toContain('className="row-actions"');
  });
});
