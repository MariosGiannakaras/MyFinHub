import { describe, expect, it } from 'vitest';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';
import { parseMutableWrite, validateFinanceState } from '../server/stateValidation.js';
import { validateFinanceData } from '../server/validation.js';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';

function validState(): any {
  return {
    app: 'RheomIQ',
    schemaVersion: 3,
    updatedAt: '2026-08-17T00:00:00.000Z',
    seed: {
      accounts: [],
      months: [],
      transactions: [],
      snapshots: [],
      recurring: [],
      subscriptions: [],
      loans: [],
      lending: [],
      stats: {},
    },
    state: {
      customTransactions: [],
      overrides: {},
      deleted: [],
      recurringCustom: [],
      recurringOverrides: {},
      loanExtra: {},
      loanOverrides: {},
      customLoans: [],
      lendingCustom: [],
      settings: {
        excludedFromAvailable: [],
        accountNames: {},
        expenseCategories: [],
        incomeCategories: [],
        customPresets: [],
        pinnedPresets: [],
        defaultExpenseAccount: '',
        defaultIncomeAccount: '',
        defaultLoanAccount: '',
        monthlyBudget: 0,
        savingsTargetRate: 0,
        motion: 'system',
      },
      cardBanks: [],
      cards: [],
      events: [],
      reviewDecisions: {},
    },
  };
}

describe('finance document validation', () => {
  it('accepts a structurally valid finance state', () => {
    expect(() => validateFinanceData(validState())).not.toThrow();
  });

  it('rejects non-canonical recurring service asset keys in saved finance data',()=>{
    const valid=validState();
    const entry={id:'rec-service',name:'Streaming',amount:12,day:10,accountId:'',category:'',active:true,logoAssetKey:'service-asset-1234567890abcdef12345678'};
    valid.state.recurringCustom=[entry];
    expect(()=>validateFinanceData(valid)).not.toThrow();
    for(const invalidKey of ['provider-logo','service-asset-1234','service-asset-1234567890ABCDEF12345678','../../escape']){
      const bad=validState();
      bad.state.recurringCustom=[{...entry,logoAssetKey:invalidKey}];
      expect(()=>validateFinanceData(bad)).toThrow(/logoAssetKey/);
    }
  });



  it.each([1, 2, 3])('accepts supported finance schema version %s', (schemaVersion) => {
    const state = validState();
    state.schemaVersion = schemaVersion;
    expect(() => validateFinanceData(state)).not.toThrow();
  });

  it('rejects unsupported future finance schema versions before migration can normalize them', () => {
    const state = validState();
    state.schemaVersion = 4;
    expect(() => validateFinanceData(state)).toThrowError(/unsupported schema version/i);
    expect(() => validateCompleteFinanceData(state)).toThrowError(/unsupported schema version/i);
  });

  it('accepts the mutable subtree through the canonical validator', () => {
    expect(() => validateFinanceState(validState().state)).not.toThrow();
  });

  it('accepts a bounded stable category identity graph on mutable writes', () => {
    const state = validState().state;
    state.settings.categoryIdentities = {
      'cat-expense-food': { id: 'cat-expense-food', kind: 'expense', label: 'Φαγητό', aliases: ['Τρόφιμα'] },
      'sub-expense-market': { id: 'sub-expense-market', kind: 'expense', label: 'Σούπερ μάρκετ', aliases: ['Supermarket'], parentId: 'cat-expense-food', parentAliases: [] },
    };
    expect(() => validateFinanceState(state)).not.toThrow();
    expect(() => parseMutableWrite({ state, updatedAt: '2026-08-17T00:00:00.000Z' })).not.toThrow();
  });

  it('rejects category identity key/id mismatches', () => {
    const state = validState().state;
    state.settings.categoryIdentities = {
      'cat-expense-food': { id: 'cat-expense-other', kind: 'expense', label: 'Φαγητό', aliases: [] },
    };
    expect(() => validateFinanceState(state)).toThrowError(/key\/id mismatch/i);
  });

  it('rejects missing, non-root and wrong-kind category identity parents', () => {
    const missing = validState().state;
    missing.settings.categoryIdentities = {
      child: { id: 'child', kind: 'expense', label: 'Supermarket', aliases: [], parentId: 'missing-parent' },
    };
    expect(() => validateFinanceState(missing)).toThrowError(/parent identity/i);

    const nonRoot = validState().state;
    nonRoot.settings.categoryIdentities = {
      root: { id: 'root', kind: 'expense', label: 'Φαγητό', aliases: [] },
      child: { id: 'child', kind: 'expense', label: 'Supermarket', aliases: [], parentId: 'root' },
      grandchild: { id: 'grandchild', kind: 'expense', label: 'Nested', aliases: [], parentId: 'child' },
    };
    expect(() => validateFinanceState(nonRoot)).toThrowError(/parent identity/i);

    const wrongKind = validState().state;
    wrongKind.settings.categoryIdentities = {
      root: { id: 'root', kind: 'income', label: 'Μισθός', aliases: [] },
      child: { id: 'child', kind: 'expense', label: 'Supermarket', aliases: [], parentId: 'root' },
    };
    expect(() => validateFinanceState(wrongKind)).toThrowError(/parent identity/i);
  });

  it('rejects self-parenting and malformed category identity alias arrays', () => {
    const selfParent = validState().state;
    selfParent.settings.categoryIdentities = {
      self: { id: 'self', kind: 'expense', label: 'Invalid', aliases: [], parentId: 'self' },
    };
    expect(() => validateFinanceState(selfParent)).toThrowError(/parent itself/i);

    const badAliases = validState().state;
    badAliases.settings.categoryIdentities = {
      root: { id: 'root', kind: 'expense', label: 'Φαγητό', aliases: 'old-name' },
    };
    expect(() => validateFinanceState(badAliases)).toThrowError(/aliases/i);
  });

  it('accepts canonical provider account metadata and rejects unsupported categories', () => {
    const full = validState();
    full.state.settings.customAccounts=[{
      id:'account-alpha-current',
      name:'Alpha Current',
      kind:'bank',
      provider:'Alpha Bank',
      providerId:'alpha',
      bankAccountCategory:'current',
      showInQuickChoices:true,
      custom:true,
    }];
    expect(()=>validateFinanceData(full)).not.toThrow();

    full.state.settings.customAccounts[0].bankAccountCategory='invalid';
    expect(()=>validateFinanceData(full)).toThrowError(/bankAccountCategory/i);
  });

  it('accepts cards and extended loan metadata used by current workspaces', () => {
    const full = validState();
    full.state.cardBanks.push({ id: 'bank-1', name: 'BANK', order: 10, custom: true });
    full.state.cards.push({ id: 'card-1', bankId: 'bank-1', nickname: 'Visa', kind: 'credit', network: 'visa', last4: '4242', active: true, createdAt: full.updatedAt, updatedAt: full.updatedAt });
    full.state.customLoans.push({ id: 'loan-1', name: 'Loan', total: 1200, installment: 100, installments: 12, paidCount: 0, kind: 'loan', firstExpectedDate: '2026-09-01', defaultAccountId: 'bank', forgivenAmount: 0, longTermRecurring: true });
    expect(() => validateFinanceData(full)).not.toThrow();
  });

  it('accepts canonical recurring end dates, savings goals and explicit credit statement rules', () => {
    const full = validState();
    full.state.recurringCustom.push({ id:'rec-1',name:'Plan',amount:10,day:5,endDate:'2027-01-31',accountId:'bank',category:'Συνδρομές',active:true });
    full.state.savingsGoals=[{id:'goal-1',name:'Ταξίδι',targetAmount:2500,targetDate:'2027-06-30',createdAt:full.updatedAt,updatedAt:full.updatedAt}];
    full.state.cards.push({ id:'card-1',bankId:'bank',nickname:'Visa',kind:'credit',network:'visa',active:true,creditLimit:3000,statementClosingDay:12,statementDueDay:20,statementBoundaryRule:'include-closing-day',createdAt:full.updatedAt,updatedAt:full.updatedAt });
    expect(() => validateFinanceData(full)).not.toThrow();
    expect(() => validateFinanceState(full.state)).not.toThrow();
  });

  it('rejects malformed recurring end dates, savings goals and credit statement rules', () => {
    const badRecurring=validState();badRecurring.state.recurringCustom.push({id:'rec-1',name:'Plan',amount:10,day:5,endDate:'31/01/2027',accountId:'bank',category:'Συνδρομές',active:true});
    expect(()=>validateFinanceData(badRecurring)).toThrowError(/endDate/i);
    const badGoal=validState();badGoal.state.savingsGoals=[{id:'goal-1',name:'Goal',targetAmount:0,targetDate:'2027-01-01',createdAt:badGoal.updatedAt,updatedAt:badGoal.updatedAt}];
    expect(()=>validateFinanceData(badGoal)).toThrowError(/targetAmount/i);
    const badCard=validState();badCard.state.cards.push({id:'card-1',bankId:'bank',nickname:'Visa',kind:'credit',network:'visa',active:true,statementClosingDay:12,statementDueDay:20,statementBoundaryRule:'guessed',createdAt:badCard.updatedAt,updatedAt:badCard.updatedAt});
    expect(()=>validateFinanceData(badCard)).toThrowError(/statementBoundaryRule/i);
  });

  it('accepts positive integer installment coverage on canonical finance events and mutable writes', () => {
    const full = validState();
    full.state.events.push({
      id: 'loan-payment-1',
      date: '2026-08-17',
      kind: 'expense',
      amount: 75,
      note: 'Loan installments',
      accountId: 'bank',
      legs: [{ accountId: 'bank', amount: -75 }],
      loanId: 'loan-1',
      installmentCount: 3,
      createdAt: full.updatedAt,
      updatedAt: full.updatedAt,
    });
    expect(() => validateFinanceData(full)).not.toThrow();
    expect(() => validateFinanceState(full.state)).not.toThrow();
  });

  it.each([0, -1, 1.5, 100_001, '2'])('rejects malformed installment coverage value %s', (installmentCount) => {
    const full = validState();
    full.state.events.push({
      id: 'loan-payment-invalid',
      date: '2026-08-17',
      kind: 'expense',
      amount: 25,
      note: 'Loan installment',
      accountId: 'bank',
      legs: [{ accountId: 'bank', amount: -25 }],
      loanId: 'loan-1',
      installmentCount,
      createdAt: full.updatedAt,
      updatedAt: full.updatedAt,
    });
    expect(() => validateFinanceData(full)).toThrowError(/installmentCount/i);
    expect(() => validateFinanceState(full.state)).toThrowError(/installmentCount/i);
  });

  it('accepts only the compact mutable write envelope', () => {
    const full = validState();
    expect(parseMutableWrite({ state: full.state, updatedAt: full.updatedAt })).toEqual({
      state: full.state,
      updatedAt: full.updatedAt,
    });
  });

  it('rejects full-document fields on the normal write path', () => {
    const full = validState();
    expect(() => parseMutableWrite({ state: full.state, updatedAt: full.updatedAt, seed: full.seed })).toThrowError(/invalid/i);
  });

  it('rejects malformed mutable state independently of seed data', () => {
    const state = validState().state;
    state.settings.savingsTargetRate = 2;
    expect(() => validateFinanceState(state)).toThrowError(/savingsTargetRate/i);
  });

  it('rejects mismatched override identities', () => {
    const full=validState();
    full.state.overrides={row:{id:'other',date:'2026-10-01',type:'expense',amount:10,note:'Mismatch',accountId:'bank'}};
    expect(()=>validateFinanceData(full)).toThrowError(/state\.overrides\.row\.id/i);
    expect(()=>validateFinanceState(full.state)).toThrowError(/state\.overrides\.row\.id/i);

    const recurring=validState();
    recurring.state.recurringOverrides={row:{id:'other',name:'Recurring',amount:10,day:1,accountId:'bank',category:'Άλλο',active:true}};
    expect(()=>validateFinanceState(recurring.state)).toThrowError(/state\.recurringOverrides\.row\.id/i);

    const loan=validState();
    loan.state.loanOverrides={row:{id:'other',name:'Loan',total:100,installment:10,installments:10,defaultAccountId:'bank'}};
    expect(()=>validateFinanceState(loan.state)).toThrowError(/state\.loanOverrides\.row\.id/i);
  });
  it('rejects malformed nested transaction fields', () => {
    const state = validState();
    state.seed.transactions.push({
      id: 'tx-1',
      date: '2026-08-17',
      type: 'expense',
      amount: '12.50',
      note: 'invalid numeric type',
    });
    expect(() => validateFinanceData(state)).toThrowError(/amount/i);
  });

  it('rejects malformed snapshot balances', () => {
    const state = validState();
    state.seed.snapshots.push({ date: '2026-08-17', balances: { bank: '100' } });
    expect(() => validateFinanceData(state)).toThrowError(/balances/i);
  });

  it('accepts bounded icon family memory and category colors',()=>{
    const full=validState();
    full.state.settings.categoryIconPack='tabler';
    full.state.settings.categoryIcons={'expense:Τρόφιμα':'tabler:shopping'};
    full.state.settings.categoryIconPackSelections={'expense:Τρόφιμα':{lucide:'dining',tabler:'shopping'}};
    full.state.settings.subcategoryIconPackSelections={'expense:Τρόφιμα:Καφές':{lucide:'coffee',phosphor:'coffee'}};
    full.state.settings.categoryIconColors={'expense:Τρόφιμα':'#D14C5A'};
    full.state.settings.subcategoryIconColors={'expense:Τρόφιμα:Καφές':'#2F6FED'};
    expect(()=>validateFinanceData(full)).not.toThrow();
    expect(()=>validateFinanceState(full.state)).not.toThrow();
  });

  it('rejects unknown icon families and malformed icon colors',()=>{
    const badPack=validState();
    badPack.state.settings.categoryIconPack='material';
    expect(()=>validateFinanceData(badPack)).toThrowError(/categoryIconPack/i);

    const badNested=validState();
    badNested.state.settings.categoryIconPackSelections={'expense:Τρόφιμα':{material:'dining'}};
    expect(()=>validateFinanceData(badNested)).toThrowError(/categoryIconPackSelections/i);

    const badColor=validState();
    badColor.state.settings.categoryIconColors={'expense:Τρόφιμα':'red'};
    expect(()=>validateFinanceData(badColor)).toThrowError(/categoryIconColors/i);
  });

  it('rejects unsupported settings values', () => {
    const state = validState();
    state.state.settings.motion = 'turbo';
    expect(() => validateFinanceData(state)).toThrowError(/motion/i);
  });

  it('rejects malformed card and loan extension values', () => {
    const badCard = validState();
    badCard.state.cards.push({ id: 'card-1', bankId: 'bank', nickname: 'Card', kind: 'credit', network: 'visa', last4: '42', active: true, createdAt: badCard.updatedAt, updatedAt: badCard.updatedAt });
    expect(() => validateFinanceData(badCard)).toThrowError(/last4/i);

    const badLoan = validState();
    badLoan.state.customLoans.push({ id: 'loan-1', name: 'Loan', total: 100, installment: 10, installments: 10, kind: 'unknown' });
    expect(() => validateFinanceData(badLoan)).toThrowError(/kind/i);
  });

  it.each(['pan','cardNumber','full_card_number','expiry','expirationDate','cvv','cvc','securityCode'])('rejects payment-card secret field %s from ordinary finance state', (secretField) => {
    const state = validState();
    state.state.cards.push({ id: 'card-1', bankId: 'bank', nickname: 'Card', kind: 'credit', network: 'visa', last4: '4242', active: true, createdAt: state.updatedAt, updatedAt: state.updatedAt, [secretField]: 'secret' });
    expect(() => validateFinanceData(state)).toThrowError(/secret field/i);
    expect(() => validateFinanceState(state.state)).toThrowError(/secret field/i);
  });

  it('rejects duplicate persistent ids', () => {
    const state = validState();
    state.seed.accounts.push(
      { id: 'bank', name: 'Bank', kind: 'bank' },
      { id: 'bank', name: 'Duplicate', kind: 'bank' },
    );
    expect(() => validateFinanceData(state)).toThrowError(/Duplicate id/i);
  });

  it('preserves bounded Unicode finance text exactly and rejects overlong notes', () => {
    const full=validState();
    full.seed.accounts=[{id:'bank',name:'Τράπεζα 👩🏽‍💻',kind:'bank'}];
    const note=`Cafe\u0301 · «ειδικά» / σύμβολα — ${'Α'.repeat(180)} 👩🏽‍💻`;
    full.state.events=[{
      id:'unicode-event',date:'2026-10-01',kind:'expense',amount:10,note,category:'Άλλο',
      accountId:'bank',legs:[{accountId:'bank',amount:-10}],createdAt:full.updatedAt,updatedAt:full.updatedAt,
    }];
    const before=JSON.stringify(full);
    expect(()=>validateCompleteFinanceData(full)).not.toThrow();
    expect(JSON.stringify(full)).toBe(before);
    expect(full.state.events[0].note).toBe(note);

    const max=validState();
    max.seed.transactions=[{id:'max-note',date:'2026-10-01',type:'expense',amount:1,note:'x'.repeat(20_000)}];
    expect(()=>validateFinanceData(max)).not.toThrow();
    max.seed.transactions[0].note='x'.repeat(20_001);
    expect(()=>validateFinanceData(max)).toThrowError(/note/i);
  });

  it('rejects finance documents beyond the production-safe size budget', () => {
    const state = { ...validState(), source: { padding: 'x'.repeat(MAX_FINANCE_DOCUMENT_BYTES) } };
    try {
      validateFinanceData(state);
      throw new Error('expected validation to fail');
    } catch (error: any) {
      expect(error).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
    }
  });

  it('validates additive planning, attention, budget and rule state on mutable and full-document boundaries', () => {
    const full = validState();
    full.seed.accounts=[{id:'bank',name:'Bank',kind:'bank'}];
    full.state.scheduled=[{
      id:'scheduled-1',dueDate:'2028-02-29',kind:'expense',amount:25,note:'Insurance',accountId:'bank',
      status:'pending',createdAt:full.updatedAt,updatedAt:full.updatedAt,
    }];
    full.state.attentionDecisions={
      'scheduled:scheduled-1':{status:'snoozed',fingerprint:'scheduled|scheduled-1',decidedAt:full.updatedAt,snoozedUntil:'2026-08-20'},
    };
    full.state.budgets=[{
      id:'budget:2026-08:overall',month:'2026-08',scope:'overall',amount:500,alertThreshold:.8,
      createdAt:full.updatedAt,updatedAt:full.updatedAt,
    }];
    full.state.transactionRules=[{
      id:'rule-1',name:'Market',enabled:true,priority:10,scopes:['manual'],
      match:{description:'market',mode:'contains'},action:{category:'Τρόφιμα'},
      createdAt:full.updatedAt,updatedAt:full.updatedAt,
    }];
    expect(()=>validateFinanceState(full.state)).not.toThrow();
    expect(()=>validateCompleteFinanceData(full)).not.toThrow();
  });

  it.each([
    ['legacy transaction', (full:any)=>full.seed.transactions.push({id:'bad-date',date:'2026-02-31',type:'expense',amount:1,note:'bad'})],
    ['snapshot', (full:any)=>full.seed.snapshots.push({date:'2026-04-31',balances:{}})],
    ['event', (full:any)=>full.state.events.push({id:'bad-event',date:'2026-13-01',kind:'expense',amount:1,note:'bad',accountId:'bank',legs:[{accountId:'bank',amount:-1}],createdAt:full.updatedAt,updatedAt:full.updatedAt})],
    ['expected return date', (full:any)=>full.state.events.push({id:'bad-return',date:'2026-08-17',kind:'lending',amount:1,note:'bad',accountId:'bank',person:'Alex',expectedReturnDate:'2026-02-30',legs:[{accountId:'bank',amount:-1}],createdAt:full.updatedAt,updatedAt:full.updatedAt})],
    ['scheduled due date', (full:any)=>{full.state.scheduled=[{id:'bad-scheduled',dueDate:'2026-02-30',kind:'expense',amount:1,note:'bad',accountId:'bank',status:'pending',createdAt:full.updatedAt,updatedAt:full.updatedAt}]}],
    ['savings target date', (full:any)=>{full.state.savingsGoals=[{id:'goal-bad',name:'Goal',targetAmount:10,targetDate:'2027-02-29',createdAt:full.updatedAt,updatedAt:full.updatedAt}]}],
  ])('rejects impossible calendar date in %s', (_label, mutate) => {
    const full=validState();
    mutate(full);
    expect(()=>validateCompleteFinanceData(full)).toThrowError(/date|invalid/i);
  });

  it('rejects malformed scheduled account semantics and duplicate scheduled ids', () => {
    const full=validState();
    full.state.scheduled=[
      {id:'scheduled-1',dueDate:'2026-08-20',kind:'transfer',amount:10,note:'Move',fromAccountId:'bank',toAccountId:'bank',status:'pending',createdAt:full.updatedAt,updatedAt:full.updatedAt},
    ];
    expect(()=>validateFinanceState(full.state)).toThrowError(/transfer accounts/i);

    const duplicate=validState();
    duplicate.state.scheduled=[
      {id:'same',dueDate:'2026-08-20',kind:'expense',amount:10,note:'One',accountId:'bank',status:'pending',createdAt:duplicate.updatedAt,updatedAt:duplicate.updatedAt},
      {id:'same',dueDate:'2026-08-21',kind:'income',amount:20,note:'Two',accountId:'bank',status:'pending',createdAt:duplicate.updatedAt,updatedAt:duplicate.updatedAt},
    ];
    expect(()=>validateFinanceState(duplicate.state)).toThrowError(/duplicate id/i);
  });

  it('rejects malformed budget, attention and transaction-rule state', () => {
    const badMonth=validState();
    badMonth.state.budgets=[{id:'budget-bad',month:'2026-13',scope:'overall',amount:100,createdAt:badMonth.updatedAt,updatedAt:badMonth.updatedAt}];
    expect(()=>validateFinanceState(badMonth.state)).toThrowError(/month/i);

    const badAttention=validState();
    badAttention.state.attentionDecisions={x:{status:'snoozed',fingerprint:'x',decidedAt:badAttention.updatedAt,snoozedUntil:'2026-02-31'}};
    expect(()=>validateFinanceState(badAttention.state)).toThrowError(/snoozedUntil/i);

    const badRule=validState();
    badRule.state.transactionRules=[{
      id:'rule-bad',name:'No condition',enabled:true,priority:0,scopes:['manual'],
      match:{},action:{category:'Τρόφιμα'},createdAt:badRule.updatedAt,updatedAt:badRule.updatedAt,
    }];
    expect(()=>validateFinanceState(badRule.state)).toThrowError(/match/i);
  });

  it('applies relational extension validation to full imports, not only mutable saves', () => {
    const full=validState();
    full.state.cards=[{
      id:'credit-1',bankId:'bank',nickname:'Credit',kind:'credit',network:'visa',active:true,
      createdAt:full.updatedAt,updatedAt:full.updatedAt,
    }];
    full.state.creditStatements=[{
      id:'statement-1',cardId:'credit-1',openDate:'2026-02-01',closeDate:'2026-02-30',dueDate:'2026-03-10',
      boundaryRule:'include-closing-day',createdAt:full.updatedAt,updatedAt:full.updatedAt,
    }];
    expect(()=>validateFinanceData(full)).not.toThrow();
    expect(()=>validateCompleteFinanceData(full)).toThrowError();
  });


  it('accepts compatible date-only and RFC3339 persistence audit stamps',()=>{
    const full=validState();
    full.updatedAt='2026-10-01T22:15:59.123456789+03:00';
    full.state.budgets=[{
      id:'budget:2026-10:overall',month:'2026-10',scope:'overall',amount:100,
      createdAt:'2026-10-01',updatedAt:'2026-10-01',
    }];
    full.state.events=[{
      id:'event-1',date:'2026-10-01',kind:'expense',amount:10,note:'Valid',
      accountId:'bank',legs:[{accountId:'bank',amount:-10}],
      createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-01T10:05:00+03:00',
    }];
    expect(()=>validateFinanceData(full)).not.toThrow();
  });

  it.each([
    ['document updatedAt',(full:any)=>{full.updatedAt='2026-02-31T10:00:00Z'}],
    ['event createdAt',(full:any)=>{full.state.events=[{id:'event-bad-stamp',date:'2026-10-01',kind:'expense',amount:10,note:'Bad',accountId:'bank',legs:[{accountId:'bank',amount:-10}],createdAt:'not-a-date',updatedAt:full.updatedAt}]}],
    ['scheduled completedAt',(full:any)=>{full.state.scheduled=[{id:'scheduled-bad-stamp',dueDate:'2026-10-01',kind:'expense',amount:10,note:'Bad',accountId:'bank',status:'completed',completedAt:'2026-13-01',createdAt:full.updatedAt,updatedAt:full.updatedAt}]}],
    ['review decidedAt',(full:any)=>{full.state.reviewDecisions={bad:{status:'kept',decidedAt:'2026-10-01T25:00:00Z'}}}],
    ['migration migratedAt',(full:any)=>{full.state.migration={fromSchema:2,migratedAt:'yesterday'}}],
  ])('rejects invalid persistence timestamp in %s',(_label,mutate)=>{
    const full=validState();
    mutate(full);
    expect(()=>validateFinanceData(full)).toThrowError(/invalid/i);
  });

  it('rejects invalid card lifecycle and statement audit stamps at the complete boundary',()=>{
    const archived=validState();
    archived.state.cards=[{
      id:'card-archived',bankId:'bank',nickname:'Archived',kind:'credit',network:'visa',active:false,
      archivedAt:'2026-02-30T00:00:00Z',createdAt:archived.updatedAt,updatedAt:archived.updatedAt,
    }];
    expect(()=>validateCompleteFinanceData(archived)).toThrowError();

    const statement=validState();
    statement.state.cards=[{
      id:'card-1',bankId:'bank',nickname:'Credit',kind:'credit',network:'visa',active:true,
      createdAt:statement.updatedAt,updatedAt:statement.updatedAt,
    }];
    statement.state.creditStatements=[{
      id:'statement-1',cardId:'card-1',openDate:'2026-09-01',closeDate:'2026-09-30',dueDate:'2026-10-10',
      boundaryRule:'include-closing-day',createdAt:'bad-stamp',updatedAt:statement.updatedAt,
    }];
    expect(()=>validateCompleteFinanceData(statement)).toThrowError();
  });

});