import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createEvent,migrateData} from '../src/lib/domain.js';
import {lendingOutstandingFor} from '../src/lib/lending.js';
import {validateMutableReceivableChronology} from '../server/financeSemanticValidation.js';
import type {FinanceData} from '../src/types.js';

const fixture=():FinanceData=>migrateData({
  app:'MyFinHub',schemaVersion:3,updatedAt:'2026-08-17T00:00:00Z',
  seed:{accounts:[{id:'cash',kind:'cash',name:'Cash'}],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[{person:'Alex',outstanding:100,entries:[]}],stats:{}},
  state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash'},reviewDecisions:{}}
} as FinanceData);
const dated=(kind:'lending'|'repayment',date:string,amount:number,note:string)=>createEvent({kind,date,person:'Alex',amount,note,accountId:'cash'});
const withEvents=(prior:FinanceData,events:FinanceData['state']['events']):FinanceData=>({...prior,state:{...prior.state,events}});

describe('#649 I22.05 API mutation-side repayment chronology (DB/RPC guard remains open)',()=>{
  it('rejects an extra repayment cent after a later confirmed payoff',()=>{
    const prior=withEvents(fixture(),[dated('repayment','2026-08-29',100,'Payoff')]);
    const next=withEvents(prior,[...prior.state.events,dated('repayment','2026-08-16',0.01,'Backdated')]);
    expect(lendingOutstandingFor(next,'Alex')).toBeCloseTo(-0.01,2);
    expect(()=>validateMutableReceivableChronology(next,prior)).toThrow(/Dated receivable repayment exceeds/);
  });
  it('rejects intermediate overdraft masked by lending later in the month',()=>{
    const prior=withEvents(fixture(),[
      dated('repayment','2026-08-20',80,'Original repayment'),
      dated('lending','2026-08-30',100,'Later lending')
    ]);
    const next=withEvents(prior,[...prior.state.events,dated('repayment','2026-08-19',30,'Backdated')]);
    expect(lendingOutstandingFor(next,'Alex')).toBe(90);
    expect(lendingOutstandingFor(next,'Alex','2026-08-20')).toBe(-10);
    expect(()=>validateMutableReceivableChronology(next,prior)).toThrow(/Dated receivable repayment exceeds/);
    const accepted=withEvents(prior,[...prior.state.events,dated('repayment','2026-08-19',20,'Within balance')]);
    expect(()=>validateMutableReceivableChronology(accepted,prior)).not.toThrow();
  });
  it('does not depend on event-id sort order for same-day lending and repayment',()=>{
    const prior=fixture();
    const repaid=dated('repayment','2026-08-21',130,'Same-day repayment');
    const lent=dated('lending','2026-08-21',40,'Same-day lending');
    const next=withEvents(prior,[repaid,lent]);
    expect(()=>validateMutableReceivableChronology(next,prior)).not.toThrow();
  });
  it('checks reconstructed complete legacy decreases and preserves imported seed',()=>{
    const prior=fixture();
    prior.seed.lending[0].outstanding=20;
    prior.seed.lending[0].entries=[
      {date:'2026-07-01',lent:100,repaid:0},
      {date:'2026-08-20',lent:0,repaid:80}
    ];
    const seed=JSON.stringify(prior.seed);
    const next=withEvents(prior,[
      dated('repayment','2026-08-19',30,'Earlier repayment'),
      dated('lending','2026-08-30',100,'Later lending')
    ]);
    expect(lendingOutstandingFor(next,'Alex','2026-08-19')).toBe(70);
    expect(lendingOutstandingFor(next,'Alex','2026-08-20')).toBe(-10);
    expect(()=>validateMutableReceivableChronology(next,prior)).toThrow(/Dated receivable repayment exceeds/);
    expect(JSON.stringify(prior.seed)).toBe(seed);
  });
  it('does not rewrite or newly reject an unchanged imported anomalous history',()=>{
    const prior=withEvents(fixture(),[dated('repayment','2026-08-20',120,'Imported old entry')]);
    const unchanged=withEvents(prior,[...prior.state.events]);
    expect(()=>validateMutableReceivableChronology(unchanged,prior)).not.toThrow();
    const worsened=withEvents(prior,[...prior.state.events,dated('repayment','2026-08-19',0.01,'New excess')]);
    expect(()=>validateMutableReceivableChronology(worsened,prior)).toThrow(/Dated receivable repayment exceeds/);
  });
  it('preflights full seed/current revision and preserves the locked mutation RPC',()=>{
    const storage=readFileSync(new URL('../server/storage.ts',import.meta.url),'utf8');
    const write=storage.slice(storage.indexOf('export async function writeMutableState('),storage.indexOf('export async function moveHistory('));
    const snapshot=write.indexOf('await readStore(accessToken)');
    const revision=write.indexOf("snapshot.revision!==String(expectedRevisionNumber)");
    const full=write.indexOf('validateCompleteFinanceData(candidate)');
    const datedGuard=write.indexOf('validateMutableReceivableChronology(candidate,snapshot.data)');
    const rpc=write.indexOf("'rpc/rheomiq_save_mutable_state_history'");
    expect(snapshot).toBeGreaterThan(-1);
    expect(revision).toBeGreaterThan(snapshot);
    expect(full).toBeGreaterThan(revision);
    expect(datedGuard).toBeGreaterThan(full);
    expect(rpc).toBeGreaterThan(datedGuard);
    expect(write).toContain('p_expected_revision: expectedRevisionNumber');
    expect(write).toContain('p_expected_history_generation: expectedHistoryGenerationNumber');
    expect(write).not.toContain('SUPABASE_SECRET_KEY');
  });
});
