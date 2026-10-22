import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('receipt purchase match review UX contract (#588 C/#3)',()=>{
  it('shows bounded existing-purchase candidates for the live reviewed EUR total without auto-association',()=>{
    const inbox=readFileSync('src/components/ReceiptInbox.tsx','utf8');
    const helper=readFileSync('src/lib/receiptPurchaseMatches.ts','utf8');
    const css=readFileSync('src/styles/receipt-inbox.css','utf8');
    expect(inbox).toContain("import { findReceiptPurchaseCandidates } from '../lib/receiptPurchaseMatches'");
    expect(inbox).toContain('const purchaseMatches=useMemo(');
    expect(inbox).toContain('reviewTotalEdited&&parsedTotal!==undefined');
    expect(inbox).toContain('return findReceiptPurchaseCandidates(data,{merchant:reviewProposal.merchant,date:reviewProposal.date,total:parsedTotal,currency})');
    expect(inbox).toContain('purchaseMatches.map(row=>');
    expect(inbox).toContain('Η απόδειξη δεν συσχετίζεται αυτόματα');
    expect(inbox).toContain('matchedPurchase:link');
    expect(inbox).toContain('onClick={()=>void setPurchaseAssociation({source:row.source,sourceId:row.sourceId})}');
    expect(inbox).toContain('Κατάργηση συσχέτισης');
    expect(helper).toContain('Math.min(12,');
    expect(helper).toContain('if(distance>3||cents(amount)!==targetAmount)return');
    expect(css).toContain('.receipt-existing-matches');
  });
});
