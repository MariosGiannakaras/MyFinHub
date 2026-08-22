import { describe, expect, it } from 'vitest';
import { parseReceiptText, suggestReceiptCategory } from '../src/lib/receiptParser.js';
import type { FinanceData, FinanceEvent } from '../src/types.js';

const event = (note:string,category:string):FinanceEvent => ({
  id:`e-${note}-${category}`,kind:'expense',date:'2026-08-01',amount:10,note,category,legs:[],createdAt:'2026-08-01T10:00:00.000Z',updatedAt:'2026-08-01T10:00:00.000Z',
} as FinanceEvent);

describe('local receipt parser',()=>{
  it('extracts Greek merchant, date and keyword total with decimal comma',()=>{
    const proposal=parseReceiptText(`ΚΑΦΕ ΑΘΗΝΑ\nΟΔΟΣ ΔΟΚΙΜΗΣ 10\nΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ\n22/08/2026 11:34\nΚΑΦΕ 3,50\nΝΕΡΟ 0,50\nΣΥΝΟΛΟ 4,00 €\nΜΕΤΡΗΤΑ 10,00\nΡΕΣΤΑ 6,00`,91);
    expect(proposal.merchant).toBe('ΚΑΦΕ ΑΘΗΝΑ');
    expect(proposal.date).toBe('2026-08-22');
    expect(proposal.total).toBe(4);
    expect(proposal.currency).toBe('EUR');
    expect(proposal.confidence?.total).toBeGreaterThan(.8);
  });

  it('prefers TOTAL over cash and change amounts',()=>{
    const proposal=parseReceiptText(`DEMO MARKET\nDATE 21-08-2026\nSUBTOTAL 18.00\nVAT 4.32\nTOTAL 22.32 EUR\nCASH 50.00\nCHANGE 27.68`,88);
    expect(proposal.total).toBe(22.32);
    expect(proposal.date).toBe('2026-08-21');
  });

  it('detects explicit non-EUR currency as a guard',()=>{
    const proposal=parseReceiptText(`TEST SHOP\n20.08.2026\nTOTAL 12.40 USD`,86);
    expect(proposal.currency).toBe('USD');
    expect(proposal.total).toBe(12.4);
  });

  it('suggests a category only after a clear repeated merchant pattern',()=>{
    const data={state:{events:[event('ΚΑΦΕ ΑΘΗΝΑ','Φαγητό'),event('Καφέ Αθήνα','Φαγητό'),event('ΚΑΦΕ ΑΘΗΝΑ','Άλλο')]}} as unknown as FinanceData;
    expect(suggestReceiptCategory(data,'καφε αθηνα')).toBe('Φαγητό');
    const sparse={state:{events:[event('ΜΟΝΑΔΙΚΟ','Άλλο')]}} as unknown as FinanceData;
    expect(suggestReceiptCategory(sparse,'ΜΟΝΑΔΙΚΟ')).toBeUndefined();
  });
});
