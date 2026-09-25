import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CardDetailsInputError,
  formatCardExpiryInput,
  formatCardNumberInput,
  normalizeCardDetailsInput,
  saveCardDetails,
  type CardDetailsPersistence,
} from '../src/lib/cardDetails.js';
import type { PaymentCard } from '../src/types.js';

const card:PaymentCard={id:'card-test',bankId:'piraeus',nickname:'Test Debit',kind:'debit',network:'visa',active:true,createdAt:'2026-09-25T00:00:00.000Z',updatedAt:'2026-09-25T00:00:00.000Z'};

describe('card secure details',()=>{
  it('formats entry without imposing issuer length or Luhn validation',()=>{
    expect(formatCardNumberInput('12345-67890')).toBe('1234 5678 90');
    expect(normalizeCardDetailsInput({pan:'12345',expiry:'09/31'})).toEqual({pan:'12345',expiry:'09/31',cvv:undefined});
    expect(formatCardExpiryInput('1231')).toBe('12/31');
  });

  it('rejects invalid expiry months and requires CVV only for new-card completion',()=>{
    expect(()=>normalizeCardDetailsInput({pan:'12345',expiry:'13/31'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan:'12345',expiry:'12/31'},{requireCvv:true})).toThrow('Γράψε το CVV');
    expect(normalizeCardDetailsInput({pan:'12345',expiry:'12/31',cvv:'123'},{requireCvv:true}).cvv).toBe('123');
  });

  it('stores PAN/expiry/CVV together through the shared server vault',async()=>{
    const calls:string[]=[];
    const persistence:CardDetailsPersistence={
      saveSecret:async(_id,secret)=>{calls.push(`server:${JSON.stringify(secret)}`);return {saved:true,last4:'2345'}},
      now:()=> '2026-09-25T10:00:00.000Z',
    };
    const updated=await saveCardDetails(card,{pan:'12345',expiry:'12/31',cvv:'123'},{requireCvv:true},persistence);
    expect(calls).toEqual(['server:{"pan":"12345","expiry":"12/31","cvv":"123"}']);
    expect(updated.last4).toBe('2345');
    expect(updated.vaultRef).toBe(card.id);
  });

  it('surfaces a server-vault save failure without a second local persistence step',async()=>{
    const calls:string[]=[];
    const persistence:CardDetailsPersistence={
      saveSecret:async()=>{calls.push('server');throw new Error('server failed')},
      now:()=> 'never',
    };
    await expect(saveCardDetails(card,{pan:'12345',expiry:'12/31',cvv:'123'},{requireCvv:true},persistence)).rejects.toThrow('server failed');
    expect(calls).toEqual(['server']);
  });

  it('routes both card surfaces through the shared editor and removes raw inline secret inputs',()=>{
    const cards=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
    const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
    const interactive=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
    expect(cards).toContain('<CardDetailsDialog');
    expect(credit).toContain('<CardDetailsDialog');
    expect(interactive).toContain('onEditDetails');
    expect(interactive).not.toContain('card-edit-input');
    expect(interactive).not.toContain('saveCardSecret');
  });
});
