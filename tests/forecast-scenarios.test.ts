import {describe,expect,it} from 'vitest';
import {cashFlowScenario} from '../src/lib/forecastScenarios.js';
import {cashFlowForecast} from '../src/lib/forecast.js';
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
