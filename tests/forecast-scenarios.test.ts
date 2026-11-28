import {describe,expect,it} from 'vitest';
import {cashFlowScenario} from '../src/lib/forecastScenarios.js';
import {cashFlowForecast} from '../src/lib/forecast.js';
import {upcomingPaymentGroup} from '../src/lib/forecastPresentation.js';
import {accountBalances, createEvent, monthlyFlow, netWorth} from '../src/lib/domain.js';
import {creditDebtForCard} from '../src/lib/cards.js';
import {lendingOutstandingFor} from '../src/lib/lending.js';
import {operationalReportSnapshot} from '../src/lib/reports.js';
import type {FinanceData} from '../src/types.js';

function fixture():FinanceData{
  return {
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-17T00:00:00.000Z',
    seed:{accounts:[{id:'bank',name:'Bank',kind:'bank'},{id:'cash',name:'Cash',kind:'cash'}],
      months:[],transactions:[],snapshots:[{date:'2026-08-17',balances:{bank:1000,cash:100}}],
      recurring:[],subscriptions:[],loans:[],lending:[],stats:{}},
    state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},
      loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],
      settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],
        customPresets:[],pinnedPresets:[],defaultExpenseAccount:'bank',defaultIncomeAccount:'bank',defaultLoanAccount:'bank'},
      events:[],scheduled:[{
        id:'known-1',kind:'expense',status:'pending',dueDate:'2026-08-18',accountId:'bank',
        amount:60,note:'Planned bill',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'
      }]
    }
  } as FinanceData;
}
describe('isolated 30/60/90-day what-if scenarios (#588 #7)',()=>{
  it('includes declared obligations and additive hypothetical expenses without creating events',()=>{
    const d=fixture(),dataBefore=JSON.stringify(d),baseline=cashFlowForecast(d,'2026-08-17',30);
    const result=cashFlowScenario(d,'2026-08-17',30,[
      {id:'extra-1',date:'2026-08-19',accountId:'bank',kind:'extra_expense',amount:990},
      {id:'extra-2',date:'2026-08-20',accountId:'bank',kind:'extra_income',amount:1000},
    ]);
    expect(baseline.projectedPortfolio).toBe(1040);
    expect(result.baseline.projectedPortfolio).toBe(1040);
    expect(result.projectedPortfolio).toBe(1050);
    expect(result.minimumPortfolio).toBe(50);
    expect(result.minimumPortfolioDate).toBe('2026-08-19');
    expect(result.firstPortfolioShortfallDate).toBeNull();
    expect(result.accounts.find(x=>x.accountId==='bank')).toMatchObject({
      projected:950,minimum:-50,firstNegativeDate:'2026-08-19'
    });
    expect(result.evidence).toMatchObject({declared:1,estimated:0,hypothetical:2,omitted:0});
    expect(result.points[0]).toMatchObject({date:'2026-08-17',portfolio:1100,scenarioDelta:0});
    expect(result.points.at(-1)?.date).toBe('2026-09-16');
    expect(JSON.stringify(d)).toBe(dataBefore);
    expect(d.state.events).toEqual([]);
  });
  it('marks the first true portfolio shortfall rather than only low balances',()=>{
    const d=fixture();
    const result=cashFlowScenario(d,'2026-08-17',60,[
      {id:'hypo',date:'2026-08-19',accountId:'cash',kind:'extra_expense',amount:1200}
    ]);
    expect(result.firstPortfolioShortfallDate).toBe('2026-08-19');
    expect(result.minimumPortfolio).toBe(-160);
    expect(result.accounts.find(x=>x.accountId==='cash')?.firstNegativeDate).toBe('2026-08-19');
    expect(result.baseline.points.at(-1)?.date).toBe('2026-10-16');
  });
  it('keeps same-day real planned and scenario movements independently (no amount heuristic)',()=>{
    const d=fixture();
    const actual=cashFlowScenario(d,'2026-08-17',30,[
      {id:'same-day',date:'2026-08-18',accountId:'bank',kind:'extra_expense',amount:60}
    ]);
    expect(actual.points.find(point=>point.date==='2026-08-18')?.portfolio).toBe(980);
    expect(actual.evidence).toMatchObject({declared:1,hypothetical:1});
  });
  it('inherits approved #8 variable recurrence as an estimate, never a real posting',()=>{
    const d=fixture();
    d.seed.recurring=[{
      id:'variable-bill',name:'Power estimate',amount:80,amountMode:'variable',
      estimateMin:60,estimateMax:100,firstExpectedDate:'2026-08-21',
      recurrenceUnit:'month',recurrenceInterval:1,
      accountId:'bank',category:'Άλλο',active:true
    }];
    const snapshot=JSON.stringify(d);
    const result=cashFlowScenario(d,'2026-08-17',30,[
      {id:'hypo',date:'2026-08-24',accountId:'bank',kind:'extra_expense',amount:25.50}
    ]);
    const recurring=result.baseline.movements.filter(move=>move.source==='recurring');
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({date:'2026-08-21',label:'Εκτίμηση: Power estimate',portfolioDelta:-80});
    expect(result.evidence).toMatchObject({declared:1,estimated:1,hypothetical:1});
    expect(result.baseline.projectedPortfolio).toBe(960);
    expect(result.projectedPortfolio).toBe(934.50);
    expect(JSON.stringify(d)).toBe(snapshot);
    expect(d.state.events).toEqual([]);
  });
  it('classifies upcoming payments by originating category and source, not their display names',()=>{
    const data=fixture(),asOf='2026-08-17';
    data.seed.recurring=[
      {id:'subscription',name:'Same name',amount:20,amountMode:'variable',firstExpectedDate:'2026-08-20',recurrenceUnit:'month',recurrenceInterval:1,accountId:'bank',category:'Συνδρομές',active:true},
      {id:'utility',name:'Same name',amount:30,firstExpectedDate:'2026-08-21',recurrenceUnit:'month',recurrenceInterval:1,accountId:'bank',category:'Σταθερά έξοδα',active:true},
    ];
    data.state.scheduled![0].note='Same name';
    data.state.scheduled![0].category='Άλλο';
    data.state.events=[createEvent({kind:'expense',date:'2026-08-19',amount:10,note:'Same name',accountId:'bank',category:'Φαγητό'})];
    const before=JSON.stringify(data),forecast=cashFlowForecast(data,asOf,30);
    expect(forecast.movements.map(row=>({source:row.source,group:upcomingPaymentGroup(row),label:row.label,category:row.category}))).toEqual([
      {source:'scheduled',group:'Προγραμματισμένα',label:'Same name',category:'Άλλο'},
      {source:'dated_event',group:'Καταχωρισμένα',label:'Same name',category:'Φαγητό'},
      {source:'recurring',group:'Συνδρομές',label:'Εκτίμηση: Same name',category:'Συνδρομές'},
      {source:'recurring',group:'Πάγια',label:'Same name',category:'Σταθερά έξοδα'},
    ]);
    expect(forecast.projectedPortfolio).toBe(980);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('keeps booked cash/receivables/credit separate from future due and estimates (#649 I22.06)',()=>{
    const data=fixture(),asOf='2026-08-17';
    const stamp='2026-08-01T00:00:00.000Z';
    data.state.cards=[{
      id:'qa-credit',bankId:'qa',nickname:'Test credit',kind:'credit',network:'visa',
      creditLimit:200,active:true,createdAt:stamp,updatedAt:stamp,
    }];
    data.seed.recurring=[{
      id:'variable-power',name:'Metered power',amount:80,amountMode:'variable',
      estimateMin:60,estimateMax:100,firstExpectedDate:'2026-08-21',
      recurrenceUnit:'month',recurrenceInterval:1,accountId:'bank',category:'Άλλο',active:true,
    }];
    data.state.events=[
      createEvent({kind:'expense',date:'2026-08-16',amount:10,note:'Actually paid',accountId:'bank'}),
      createEvent({kind:'card_purchase',date:'2026-08-16',amount:40,note:'Credit purchase',cardId:'qa-credit'}),
      createEvent({kind:'lending',date:'2026-08-17',amount:100,note:'Receivable created',person:'Alex',accountId:'bank'}),
      createEvent({kind:'repayment',date:'2026-08-17',amount:20,note:'Receivable repaid',person:'Alex',accountId:'bank'}),
      createEvent({kind:'card_payment',date:'2026-08-17',amount:15,note:'Liability settlement',cardId:'qa-credit',fromAccountId:'bank'}),
      createEvent({kind:'expense',date:'2026-08-19',amount:30,note:'Future dated real booking',accountId:'bank'}),
    ];
    const immutable=JSON.stringify(data);

    // Booked totals use actual events, not scheduled obligations or variable estimates.
    expect(monthlyFlow(data,'2026-08',asOf)).toMatchObject({income:0,expense:50,net:-50});
    expect(monthlyFlow(data,'2026-08').expense).toBe(80);
    expect(accountBalances(data,asOf)).toMatchObject({bank:895,cash:100,'credit-card':-25});
    expect(lendingOutstandingFor(data,'Alex',asOf)).toBe(80);
    expect(creditDebtForCard(data,'qa-credit',asOf)).toBe(25);
    expect(netWorth(data,asOf)).toBe(1050);
    const reports=operationalReportSnapshot(data,'2026-08',asOf);
    expect(reports.flow.expense).toBe(50);
    expect(reports.receivables).toBe(80);
    expect(reports.creditDebt).toBe(25);

    // Reports' positive-only noncredit account composition is NOT net worth:
    // the receivable is an asset, while the card debt is a liability.
    const balances=accountBalances(data,asOf);
    const positiveAccountTotal=[balances.bank,balances.cash].filter(value=>value>0).reduce((sum,value)=>sum+value,0);
    expect(positiveAccountTotal).toBe(995);
    expect(netWorth(data,asOf)-positiveAccountTotal).toBe(55);

    // A due €60 bill and estimated €80 recurring charge affect only the
    // forward-looking cash projection, alongside a separate dated real event.
    const projected=cashFlowForecast(data,asOf,30);
    expect(projected.currentPortfolio).toBe(995);
    expect(projected.projectedPortfolio).toBe(825);
    expect(projected.sourceCounts).toEqual({scheduled:1,recurring:1,loan:0,dated_event:1});
    expect(projected.movements).toEqual(expect.arrayContaining([
      expect.objectContaining({date:'2026-08-18',source:'scheduled',portfolioDelta:-60}),
      expect.objectContaining({date:'2026-08-19',source:'dated_event',portfolioDelta:-30}),
      expect.objectContaining({date:'2026-08-21',source:'recurring',label:'Εκτίμηση: Metered power',portfolioDelta:-80}),
    ]));
    expect(projected.points.find(point=>point.date==='2026-08-18')?.portfolio).toBe(935);
    expect(projected.points.find(point=>point.date==='2026-08-21')?.portfolio).toBe(825);
    const hypothetical=cashFlowScenario(data,asOf,30,[
      {id:'what-if',date:'2026-08-22',accountId:'bank',kind:'extra_expense',amount:25},
    ]);
    expect(hypothetical.evidence).toMatchObject({declared:2,estimated:1,hypothetical:1,omitted:0});
    expect(hypothetical.projectedPortfolio).toBe(800);
    expect(monthlyFlow(data,'2026-08',asOf).expense).toBe(50);
    expect(accountBalances(data,'2026-08-21').bank).toBe(865);
    expect(JSON.stringify(data)).toBe(immutable);
  });

  it('projects large inter-account transfers only once across all horizons without altering booked history',()=>{
    const data=fixture(),asOf='2026-08-17';
    data.seed.snapshots[0].balances={bank:1000000,cash:100};
    const transfer=createEvent({kind:'transfer',date:'2026-08-19',amount:1100000,note:'Completed planned transfer',fromAccountId:'bank',toAccountId:'cash'});
    const income=createEvent({kind:'income',date:'2026-09-17',amount:75,note:'Future income',accountId:'bank'});
    data.state.events=[transfer,income];
    data.state.scheduled!.push({id:'completed-transfer',kind:'transfer',status:'completed',dueDate:transfer.date,amount:1100000,note:'Completed planned transfer',fromAccountId:'bank',toAccountId:'cash',completedEventId:transfer.id,createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'});
    const before=JSON.stringify(data);
    for(const horizon of [30,60,90] as const){
      const forecast=cashFlowForecast(data,asOf,horizon);
      expect(forecast.currentPortfolio).toBe(1000100);
      expect(forecast.projectedPortfolio).toBe(horizon===30?1000040:1000115);
      expect(forecast.accounts.find(row=>row.accountId==='bank')).toMatchObject({minimum:-100060,firstNegativeDate:'2026-08-19',projected:horizon===30?-100060:-99985});
      expect(forecast.accounts.find(row=>row.accountId==='cash')?.projected).toBe(1100100);
      expect(forecast.sourceCounts).toEqual({scheduled:1,recurring:0,loan:0,dated_event:horizon===30?1:2});
      expect(forecast.movements.filter(row=>row.date==='2026-08-19')).toEqual([expect.objectContaining({source:'dated_event',portfolioDelta:0})]);
      expect(new Set(forecast.movements.map(row=>row.id)).size).toBe(forecast.movements.length);
      expect(forecast.points.every(point=>Object.values(point.balances).reduce((sum,value)=>sum+value,0)===point.portfolio)).toBe(true);
    }
    expect(accountBalances(data,asOf)).toMatchObject({bank:1000000,cash:100});
    expect(accountBalances(data,'2026-08-19')).toMatchObject({bank:-100000,cash:1100100});
    expect(monthlyFlow(data,'2026-08',asOf).expense).toBe(0);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('supports an empty scenario as unchanged read-only forecast across all horizons',()=>{
    const d=fixture();
    for(const horizon of [30,60,90] as const){
      const result=cashFlowScenario(d,'2026-08-17',horizon,[]);
      expect(result.projectedPortfolio).toBe(result.baseline.projectedPortfolio);
      expect(result.minimumPortfolio).toBe(result.baseline.minimumPortfolio);
      expect(result.evidence.hypothetical).toBe(0);
    }
  });
  it('rejects fabricated account/date, wrong sign, unsafe cents and duplicate assumptions',()=>{
    const d=fixture();
    const example={id:'hypo',date:'2026-08-19',accountId:'bank',kind:'extra_expense' as const,amount:20};
    const check=(override:Partial<typeof example>)=>()=>cashFlowScenario(d,'2026-08-17',30,[{...example,...override}]);
    expect(check({amount:20.001})).toThrow(/λεπτά/);
    expect(check({amount:0})).toThrow(/θετικό/);
    expect(check({date:'2026-08-17'})).toThrow(/μέλλον/);
    expect(check({date:'2026-11-01'})).toThrow(/μέλλον/);
    expect(check({date:'2026-02-30'})).toThrow(/ημερομηνία/);
    expect(check({accountId:'ghost'})).toThrow(/πραγματικό/);
    expect(()=>cashFlowScenario(d,'2026-08-17',30,[example,example])).toThrow(/μοναδική/);
    expect(()=>cashFlowScenario(d,'2026-08-17',15 as 30,[])).toThrow(/ορίζοντα/);
    expect(()=>cashFlowScenario(d,'2026-08-17',30,Array.from({length:17},(_,index)=>({...example,id:String(index)})))).toThrow(/16/);
  });
});
