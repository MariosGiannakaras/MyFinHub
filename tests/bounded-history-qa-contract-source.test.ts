import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('bounded history QA contracts',()=>{
  const qa=read('src/qa.tsx');
  const transactions=read('src/pages/TransactionsPage.tsx');
  const lending=read('src/pages/LendingPage.tsx');
  const credit=read('src/pages/CreditCardPage.tsx');
  const rendered=read('scripts/bounded-history-qa.mjs');
  const runner=read('scripts/run-rendered-qa.mjs');

  it('keeps an oversized QA-only history state that actually crosses every product window',()=>{
    expect(qa).toContain("state')==='large-history'");
    expect(qa).toContain("Array.from({length:45}");
    expect(qa.match(/Array\.from\(\{length:30\}/g)?.length).toBe(2);
    expect(qa).toContain("kind:'lending'");
    expect(qa).toContain("kind:'card_purchase'");
    expect(qa).toContain("kind:'card_payment'");
  });

  it('keeps product histories bounded before explicit expansion',()=>{
    expect(transactions).toContain('const pageRows=rows.slice(pageStart,pageStart+pageSize)');
    expect(transactions).toContain('mobile-transaction-list');
    expect(transactions).toContain('{pageRows.map');
    expect(lending).toContain('const [mobileHistoryLimit,setMobileHistoryLimit]=useState(20)');
    expect(lending).toContain('history.slice(0,mobileHistoryLimit)');
    expect(lending).toContain('setMobileHistoryLimit(limit=>limit+20)');
    expect(credit).toContain('const [purchaseLimit,setPurchaseLimit]=useState(25)');
    expect(credit).toContain('const [paymentLimit,setPaymentLimit]=useState(25)');
    expect(credit).toContain('setPurchaseLimit(limit=>limit+25)');
    expect(credit).toContain('setPaymentLimit(limit=>limit+25)');
  });

  it('runs browser proof for bounded windows in the final rendered suite',()=>{
    expect(rendered).toContain("transactions.desktop===14");
    expect(rendered).toContain("lendingCount===20");
    expect(rendered).toContain("credit.purchases===25&&credit.payments===25");
    expect(rendered).toContain("document.querySelectorAll('.mobile-lending-history-row').length===40");
    expect(runner).toContain("scripts/bounded-history-qa.mjs");
  });
});
