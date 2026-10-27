import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CardDetailsInputError,
  formatCardExpiryInput,
  formatCardNumberInput,
  formatStoredCardNumberInput,
  normalizeCardDetailsInput,
  saveCardDetails,
  type CardDetailsPersistence,
} from '../src/lib/cardDetails.js';
import type { PaymentCard } from '../src/types.js';

const card:PaymentCard={id:'card-test',bankId:'piraeus',nickname:'Test Debit',kind:'debit',network:'visa',active:true,createdAt:'2026-09-25T00:00:00.000Z',updatedAt:'2026-09-25T00:00:00.000Z'};

describe('card secure details',()=>{
  it('automatically separates typed or pasted PAN into four groups of four',()=>{
    expect(formatCardNumberInput('12345-67890')).toBe('1234 5678 90');
    expect(formatCardNumberInput('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumberInput('4242-4242-4242-4242-999')).toBe('4242 4242 4242 4242');
    const old='12345678901234567890123456789012';
    expect(formatStoredCardNumberInput(old).replace(/\\D/g,'')).toBe(old);
    expect(()=>normalizeCardDetailsInput({pan:old,expiry:'12/31'})).toThrow(CardDetailsInputError);
    expect(formatCardExpiryInput('1231')).toBe('12/31');
  });

  it('requires 16 digits, an unexpired real MM/YY and exactly 3 CVV digits when supplied',()=>{
    const pan='1234567890123456';
    expect(normalizeCardDetailsInput({pan,expiry:'09/31'})).toEqual({pan,expiry:'09/31',cvv:undefined});
    expect(normalizeCardDetailsInput({pan:'1234 5678 9012 3456',expiry:'12/31',cvv:'123'},{requireCvv:true}).cvv).toBe('123');
    expect(()=>normalizeCardDetailsInput({pan:'1'.repeat(15),expiry:'12/31'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan:'1'.repeat(17),expiry:'12/31'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'13/31'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'00/31'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'01/20'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'12/3'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'12/31',cvv:'12'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'12/31',cvv:'1234'})).toThrow(CardDetailsInputError);
    expect(()=>normalizeCardDetailsInput({pan,expiry:'12/31'},{requireCvv:true})).toThrow('Γράψε το CVV');
    const now=new Date();
    const thisMonth=`${String(now.getUTCMonth()+1).padStart(2,'0')}/${String(now.getUTCFullYear()%100).padStart(2,'0')}`;
    expect(normalizeCardDetailsInput({pan,expiry:thisMonth}).expiry).toBe(thisMonth);
  });

  it('stores PAN/expiry/CVV together through the shared server vault',async()=>{
    const calls:string[]=[];
    const persistence:CardDetailsPersistence={
      saveSecret:async(_id,secret)=>{calls.push(`server:${JSON.stringify(secret)}`);return {saved:true,last4:'2345'}},
      now:()=> '2026-09-25T10:00:00.000Z',
    };
    const updated=await saveCardDetails(card,{pan:'1234567890122345',expiry:'12/31',cvv:'123'},{requireCvv:true},persistence);
    expect(calls).toEqual(['server:{"pan":"1234567890122345","expiry":"12/31","cvv":"123"}']);
    expect(updated.last4).toBe('2345');
    expect(updated.vaultRef).toBe(card.id);
  });

  it('cleans a legacy local CVV only after an explicit successful server save',async()=>{
    const calls:string[]=[];
    const persistence:CardDetailsPersistence={
      saveSecret:async()=>{calls.push('server');return {saved:true,last4:'2345'}},
      cleanupLocalCvv:async()=>{calls.push('cleanup')},
      now:()=> '2026-09-25T10:00:00.000Z',
    };
    await saveCardDetails(card,{pan:'1234567890122345',expiry:'12/31',cvv:'123'},{requireCvv:true},persistence);
    expect(calls).toEqual(['server','cleanup']);
  });

  it('surfaces a server-vault save failure without a second local persistence step',async()=>{
    const calls:string[]=[];
    const persistence:CardDetailsPersistence={
      saveSecret:async()=>{calls.push('server');throw new Error('server failed')},
      now:()=> 'never',
    };
    await expect(saveCardDetails(card,{pan:'1234567890122345',expiry:'12/31',cvv:'123'},{requireCvv:true},persistence)).rejects.toThrow('server failed');
    expect(calls).toEqual(['server']);
  });

  it('initializes card profile editing by stable dialog identity instead of parent object identity',()=>{
    const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
    expect(createDialog).toContain("const initializationKey=open?");
    expect(createDialog).toContain("},[initializationKey]);");
    expect(createDialog).not.toContain("[open,initialBankId,initialCard,kindLock,banks,allowedKindsKey]");
  });

  it('separates card profile editing from secure PAN/expiry/CVV editing',()=>{
    const cards=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
    const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
    const interactive=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
    expect(cards).toContain('<CardDetailsDialog');
    expect(credit).toContain('<CardDetailsDialog');
    const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
    expect(cards).toContain('initialCard={profileCard}');
    expect(credit).toContain('initialCard={profileCard}');
    expect(interactive).toContain('onEditCard');
    expect(interactive).toContain('onEditDetails');
    expect(cards).toContain('detailsEditor={detailsCard?.id===card.id?<CardDetailsDialog inline');
    expect(interactive).toContain('detailsEditor ? detailsEditor');
    expect(interactive).toContain('Επεξεργασία στοιχείων');
    expect(interactive).not.toContain('KeyRound');
    expect(createDialog).toContain('if(initialCard)');
    expect(createDialog).toContain('onSave({...initialCard');
    expect(createDialog).toContain('Τα κρυπτογραφημένα PAN, λήξη και CVV παραμένουν ανέπαφα');
    expect(interactive).not.toContain('card-edit-input');
    expect(interactive).not.toContain('saveCardSecret');
  });
  it('separates card profile editing from encrypted secret editing on both card surfaces',()=>{
    const cards=readFileSync(new URL('../src/pages/CardsPage.tsx',import.meta.url),'utf8');
    const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
    const canonical=readFileSync(new URL('../src/components/CanonicalCreditCardStack.tsx',import.meta.url),'utf8');
    const interactive=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
    const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
    expect(interactive).toContain('onEditCard');
    expect(interactive).toContain('onEditDetails');
    expect(interactive).toContain('onEditDetails||onEditCard');
    expect(interactive).not.toContain('KeyRound');
    expect(cards).toContain('initialCard={profileCard}');
    expect(credit).toContain('initialCard={profileCard}');
    expect(credit).toContain('onEditCard={openCardProfile}');
    expect(credit).toContain('onEditDetails={openCardDetails}');
    expect(canonical).toContain('Επεξεργασία κάρτας');
    expect(canonical).toContain('Ασφαλή στοιχεία');
    expect(createDialog).toContain('if(initialCard)');
    expect(createDialog).toContain('...initialCard');
    expect(createDialog).toContain('updatedAt:now');
  });

  it('keeps explicit card network authoritative over visual design presets',()=>{
    const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
    expect(createDialog).toContain('const [networkTouched,setNetworkTouched]=useState(false)');
    expect(createDialog).toContain('if(!networkTouched)setNetwork(item.network)');
    expect(createDialog).toContain('setNetworkTouched(true)');
    expect(createDialog).toContain("const changeBank=(next:string)=>{setBankId(next);setDesignId('');setNetworkTouched(false)");
    expect(createDialog).toContain("const changeKind=(next:CardKind)=>{setKind(next);setDesignId('');setNetworkTouched(false)");
    expect(createDialog).toContain("onChange={event=>changeKind(event.target.value as CardKind)}");
    expect(createDialog).not.toContain('setDesignId(item.id);setNetwork(item.network)');
  });

  it('keeps card profile and interactive card layouts owned by their actual component selectors',()=>{
    const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
    const createCss=readFileSync(new URL('../src/components/CardCreateDialog.css',import.meta.url),'utf8');
    const interactive=readFileSync(new URL('../src/components/InteractivePaymentCard.tsx',import.meta.url),'utf8');
    const interactiveCss=readFileSync(new URL('../src/components/InteractivePaymentCard.css',import.meta.url),'utf8');
    expect(createDialog).toContain("import './CardCreateDialog.css'");
    expect(createCss).toContain('.card-create-modal');
    expect(createCss).toContain('.card-preview-stage');
    expect(createCss).toContain('.design-picker');
    expect(createCss).toContain('@media(max-width:360px)');
    expect(interactive).toContain("import './InteractivePaymentCard.css'");
    expect(interactiveCss).toContain('.prototype-payment-card .card-inner');
    expect(interactiveCss).toContain('.prototype-payment-card .card-toolbar');
    expect(interactiveCss).toContain('grid-template-columns:repeat(2,40px)');
    expect(interactiveCss).toContain('width:40px;height:40px;min-width:40px');
    expect(interactiveCss).not.toContain('#myfinhub-card-stack');
  });

});
