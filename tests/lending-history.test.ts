import { describe, expect, it } from 'vitest';
import { createEvent } from '../src/lib/domain.js';
import { lendingHistory, lendingRows } from '../src/lib/lending.js';
import type { FinanceData } from '../src/types.js';

function fixture():FinanceData{return {app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-17T00:00:00.000Z',seed:{accounts:[{id:'cash',name:'Cash',kind:'cash'}],months:[],transactions:[],snapshots:[],recurring:[],subscriptions:[],loans:[],lending:[{person:'Alex',entries:[{date:'2026-01-01',lent:50,repaid:0},{date:'2026-02-01',lent:0,repaid:20}],outstanding:30}],stats:{}},state:{customTransactions:[],overrides:{},deleted:[],recurringCustom:[],recurringOverrides:{},loanExtra:{},loanOverrides:{},customLoans:[],lendingCustom:[],events:[],reviewDecisions:{},settings:{excludedFromAvailable:[],accountNames:{},expenseCategories:['Άλλο'],incomeCategories:['Μισθός'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'cash',defaultIncomeAccount:'cash',defaultLoanAccount:'cash',motion:'full'}}} as FinanceData}

describe('receivables history',()=>{
 it('combines legacy history with new events and running outstanding',()=>{const data=fixture();const event=createEvent({kind:'lending',date:'2026-03-01',amount:10,note:'Lunch',accountId:'cash',person:'Alex'});data.state.events=[event];expect(lendingRows(data)[0]?.outstanding).toBe(40);const rows=lendingHistory(data).filter(row=>row.person==='Alex');expect(rows.map(row=>row.action)).toEqual(['lent','repaid','lent']);expect(rows[0]?.runningOutstanding).toBe(40);expect(rows[1]?.runningOutstanding).toBe(30);expect(rows[2]?.runningOutstanding).toBe(50)});
});
