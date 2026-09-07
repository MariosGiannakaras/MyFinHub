import type { FinanceData, LegacyTransaction } from './types';
// Vite treats the query suffix as a distinct module so the import-map wrapper can
// reuse the canonical QA fixture without recursively resolving back to itself.
// TypeScript does not model arbitrary Vite query suffixes, so keep the boundary
// explicitly typed here rather than weakening the production fixture types.
// @ts-expect-error Vite runtime module query; the imported function is typed below.
import { qaFinanceData as untypedBaseQaFinanceData } from './qaFixture.ts?base';

const baseQaFinanceData=untypedBaseQaFinanceData as ()=>FinanceData;
type QaSnapshot=FinanceData['seed']['snapshots'][number];

const stamp='2026-08-01T08:00:00.000Z';
const transaction=(id:string,date:string,type:Exclude<LegacyTransaction['type'],'transfer'>,amount:number,note:string,category?:string,accountId='piraeus-payroll'):LegacyTransaction=>({
  id,date,type,amount,note,category,accountId,source:'approved-dashboard-qa',
});
const transfer=(id:string,date:string,amount:number,note:string,fromAccountId:string,toAccountId:string):LegacyTransaction=>({
  id,date,type:'transfer',amount,note,fromAccountId,toAccountId,source:'approved-dashboard-qa',
});
const splitAmounts=(total:number,count:number)=>{const cents=Math.round(total*100);const base=Math.floor(cents/count);const remainder=cents-base*count;return Array.from({length:count},(_,index)=>(base+(index<remainder?1:0))/100)};
const spreadExpenses=(prefix:string,category:string,total:number,count:number,days:number[])=>splitAmounts(total,count).map((amount,index)=>transaction(`${prefix}-${index+1}`,`2026-08-${String(days[index%days.length]).padStart(2,'0')}`,'expense',amount,`${category} ${index+1}`,category));

/**
 * Presentation-only refinement for deterministic owner-approval QA routes.
 * Production finance semantics stay in the canonical selectors/domain layer.
 */
export function qaFinanceData(){
  const next=baseQaFinanceData();
  const params=new URLSearchParams(globalThis.location?.search??'');
  const settingsApproval=params.get('page')==='settings'&&params.get('state')==='settings-tabs';
  if(settingsApproval){
    next.state.settings.accountOverrides={
      ...(next.state.settings.accountOverrides??{}),
      cash:{id:'cash',name:'Μετρητά',short:'CASH',kind:'cash',cashRole:'daily',showInQuickChoices:true},
    };
    next.state.settings.customAccounts=[
      ...(next.state.settings.customAccounts??[]).filter(account=>account.id!=='qa-cash-reserve'),
      {id:'qa-cash-reserve',name:'Καβάτζα',short:'SAFE',kind:'cash',cashRole:'reserve',showInQuickChoices:false,excludeFromAvailable:true,custom:true},
    ];
    next.state.settings.accountNames={...next.state.settings.accountNames,cash:'Μετρητά','qa-cash-reserve':'Καβάτζα'};
    next.state.settings.excludedFromAvailable=[...new Set([...(next.state.settings.excludedFromAvailable??[]),'qa-cash-reserve'])];
    return next;
  }

  const approvedEvidence=params.get('page')==='dashboard'&&params.get('motion')==='reduced'&&!params.get('state');
  if(!approvedEvidence)return next;

  next.state.settings.accountNames={
    ...next.state.settings.accountNames,
    'piraeus-payroll':'Μισθοδοσία - Πειραιώς',
    'piraeus-savings':'Αποταμίευση - Πειραιώς',
  };

  const augustSnapshot=next.seed.snapshots.find((snapshot:QaSnapshot)=>snapshot.date==='2026-08-01')??next.seed.snapshots[0];
  const commonBalances={...(augustSnapshot?.balances??{})};
  next.seed.snapshots=[
    {
      date:'2026-07-31',
      balances:{
        ...commonBalances,
        cash:1712.8/1.12,
        'piraeus-payroll':2856.4/1.08,
        'piraeus-savings':4100,
        'alpha-main':1181.43,
        'revolut-main':810.2,
        'national-main':2320.75,
        'eurobank-main':1450,
      },
    },
    {
      date:'2026-08-01',
      balances:{
        ...commonBalances,
        cash:1712.8,
        'piraeus-payroll':2856.4,
        'piraeus-savings':4644.01,
        'alpha-main':1181.43,
        'revolut-main':810.2,
        'national-main':2320.75,
        'eurobank-main':1450,
      },
    },
  ];

  const julyTransactions:LegacyTransaction[]=[
    transaction('approved-july-income','2026-07-10','income',4146.44,'Έσοδα Ιουλίου','Μισθός','viva-main'),
    transaction('approved-july-expense','2026-07-11','expense',3480.74,'Έξοδα Ιουλίου','Στέγαση','viva-main'),
    transaction('approved-july-saving','2026-07-12','expense',1298.86,'Pay & Save','Αποταμίευση','emergency-savings'),
    transfer('approved-july-savings-transfer-1','2026-07-04',125,'Μεταφορά αποταμίευσης','alpha-main','piraeus-savings'),
    transfer('approved-july-savings-transfer-2','2026-07-10',125,'Μεταφορά αποταμίευσης','alpha-main','piraeus-savings'),
    transfer('approved-july-savings-transfer-3','2026-07-18',125,'Μεταφορά αποταμίευσης','alpha-main','piraeus-savings'),
    transfer('approved-july-savings-transfer-4','2026-07-26',125,'Μεταφορά αποταμίευσης','alpha-main','piraeus-savings'),
  ];

  const headlineExpenses:LegacyTransaction[]=[
    transaction('approved-exp-supermarket','2026-08-20','expense',62.4,'Σούπερ Μάρκετ','Σούπερ Μάρκετ'),
    transaction('approved-exp-shell','2026-08-19','expense',48.28,'Shell','Καύσιμα'),
    transaction('approved-exp-coffee','2026-08-18','expense',3.8,'Coffee Island','Καφέ/ες'),
    transaction('approved-exp-vasilopoulos','2026-08-16','expense',41.15,'Βασιλόπουλος','Σούπερ Μάρκετ'),
    transaction('approved-exp-public','2026-08-14','expense',89.9,'Public','Αγορές'),
  ];
  const fillerExpenses:LegacyTransaction[]=[
    ...spreadExpenses('approved-super','Σούπερ Μάρκετ',920.95,7,[2,4,6,8,10,12,13]),
    ...spreadExpenses('approved-home','Στέγαση',962.3,6,[2,5,7,9,11,13]),
    ...spreadExpenses('approved-transport','Μεταφορές',464.12,5,[3,6,8,11,13]),
    ...spreadExpenses('approved-fun','Διασκέδαση',349.1,4,[4,7,10,13]),
    ...spreadExpenses('approved-health','Υγεία',190.8,3,[5,9,12]),
    ...spreadExpenses('approved-other','Άλλα',68.48,2,[6,12]),
    transaction('approved-tiny','2026-08-13','expense',1,'Μικροέξοδο','Μικροέξοδα'),
  ];
  const incomeAmounts=splitAmounts(4644.01,26);
  const incomes:LegacyTransaction[]=incomeAmounts.map((amount,index)=>transaction(`approved-income-${index+1}`,`2026-08-${String((index%13)+1).padStart(2,'0')}`,'income',amount,`Έσοδο ${index+1}`,'Μισθός'));
  const transfers:LegacyTransaction[]=[
    transfer('approved-cash-transfer-1','2026-08-02',150,'Μεταφορά σε μετρητά','piraeus-payroll','cash'),
    transfer('approved-cash-transfer-2','2026-08-05',160,'Μεταφορά σε μετρητά','piraeus-payroll','cash'),
    transfer('approved-cash-transfer-3','2026-08-08',140,'Μεταφορά σε μετρητά','piraeus-payroll','cash'),
    transfer('approved-cash-transfer-4','2026-08-12',162,'Μεταφορά σε μετρητά','piraeus-payroll','cash'),
    transfer('approved-savings-transfer-1','2026-08-03',150,'Μεταφορά στην αποταμίευση','alpha-main','piraeus-savings'),
    transfer('approved-savings-transfer-2','2026-08-06',150,'Μεταφορά στην αποταμίευση','alpha-main','piraeus-savings'),
    transfer('approved-savings-transfer-3','2026-08-09',150,'Μεταφορά στην αποταμίευση','alpha-main','piraeus-savings'),
    transfer('approved-savings-transfer-4','2026-08-13',150,'Μεταφορά στην αποταμίευση','alpha-main','piraeus-savings'),
  ];
  const saving=transaction('approved-saving','2026-08-01','expense',1441.73,'Pay & Save','Αποταμίευση','emergency-savings');

  // 68 August movements: 33 expenses + 26 incomes + 8 neutral transfers + 1 confirmed Pay & Save.
  // The six visible expense categories sum to €3,201.28; the €1 seventh category preserves the Approved total (€3,202.28) while remaining outside the top-six table.
  next.seed.transactions=[...julyTransactions,...headlineExpenses,...fillerExpenses,...incomes,...transfers,saving];
  next.seed.stats={...next.seed.stats,transactions:68};
  next.state.customTransactions=[];
  next.state.overrides={};
  next.state.deleted=[];
  next.state.events=[];
  next.state.reviewDecisions={
    'approved-july-saving':{status:'confirmed',semanticKind:'saving_cash_offset',decidedAt:stamp},
    'approved-saving':{status:'confirmed',semanticKind:'saving_cash_offset',decidedAt:stamp},
    'approved-exp-shell':{status:'kept',category:'Μεταφορές',decidedAt:stamp},
    'approved-exp-coffee':{status:'kept',category:'Διασκέδαση',decidedAt:stamp},
    'approved-exp-public':{status:'kept',category:'Άλλα',decidedAt:stamp},
  };

  next.seed.recurring=[
    {id:'approved-cosmote',name:'Cosmote',amount:29.9,day:18,accountId:'piraeus-payroll',category:'Συνδρομές',active:true,status:'active',source:'qa'},
    {id:'approved-eydap',name:'ΕΥΔΑΠ',amount:27.4,day:22,accountId:'piraeus-payroll',category:'Πάγια',active:true,status:'active',source:'qa'},
    {id:'approved-deh',name:'ΔΕΗ',amount:62.4,day:16,accountId:'piraeus-payroll',category:'Πάγια',active:true,status:'active',source:'qa'},
  ];
  next.state.recurringCustom=[];
  next.state.recurringOverrides={};
  next.state.scheduled=[];
  next.seed.loans=[];
  next.state.customLoans=[
    {id:'approved-mortgage',name:'Στεγαστικό δάνειο',total:19849.6,installment:620.3,installments:32,paidCount:10,provider:'Πειραιώς',schedule:[],source:'qa',accountingMode:'expense-per-installment',kind:'loan',firstExpectedDate:'2026-08-20',defaultAccountId:'piraeus-payroll',forgivenAmount:0,longTermRecurring:true},
  ];
  next.state.loanOverrides={};
  next.state.loanExtra={};

  return next;
}