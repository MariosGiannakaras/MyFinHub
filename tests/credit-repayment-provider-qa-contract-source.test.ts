import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('credit repayment provider-match QA contract',()=>{
  const qa=read('src/qa.tsx');
  const payment=read('scripts/payment-flow-normalization-qa.mjs');
  const providers=read('src/lib/financialProviders.ts');
  const credit=read('src/pages/CreditCardPage.tsx');
  const quick=read('src/components/ContextualQuickAdd.tsx');

  it('keeps a Settings-style account id whose provider identity cannot be inferred from the id prefix',()=>{
    expect(qa).toContain("state')==='provider-account'");
    expect(qa).toContain("id:'account-piraeus-qa-provider'");
    expect(qa).toContain("providerId:'piraeus'");
    expect(qa).toContain("name:'QA Settings Piraeus'");
  });

  it('matches accounts by canonical provider identity in both credit entry points',()=>{
    expect(providers).toContain('accountFinancialProviderId(account)');
    expect(providers).toContain('account.providerId?.trim()');
    expect(credit).toContain('accountMatchesFinancialProvider(account,cardProviderId)');
    expect(quick).toContain('accountMatchesFinancialProvider(account,card.bankId)');
    expect(credit).not.toContain('account.id.startsWith(card.bankId)');
    expect(quick).not.toContain('account.id.startsWith(card.bankId)');
  });

  it('proves the Settings-style account is visible in the rendered repayment selector',()=>{
    expect(payment).toContain("state:'provider-account'");
    expect(payment).toContain('QA Settings Piraeus');
    expect(payment).toContain('Settings-created account with providerId=piraeus is eligible');
  });
});
