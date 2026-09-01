import type { FinanceData, FinanceEvent, LegacyTransaction } from './types.js';

const expense=(id:string,date:string,accountId:string,amount:number,note:string,category:string,subcategory?:string):LegacyTransaction=>({id,date,type:'expense',accountId,amount,note,category,subcategory});
const income=(id:string,date:string,accountId:string,amount:number,note:string,category:string):LegacyTransaction=>({id,date,type:'income',accountId,amount,note,category});
const transfer=(id:string,date:string,fromAccountId:string,toAccountId:string,amount:number,note='Μεταφορά'):LegacyTransaction=>({id,date,type:'transfer',fromAccountId,toAccountId,amount,note,category:'Μεταφορά'});

const approvedVisibleAugust:LegacyTransaction[]=[
  expense('approved-26-supermarket','2026-08-26','piraeus-payroll',62.40,'Σούπερ Μάρκετ','Σούπερ Μάρκετ'),
  income('approved-25-salary','2026-08-25','piraeus-payroll',1850,'Μισθοδοσία Αυγούστου','Μισθοδοσία'),
  expense('approved-24-dei','2026-08-24','alpha-main',62.40,'ΔΕΗ','Λογαριασμοί'),
  expense('approved-22-cosmote','2026-08-22','alpha-main',29.90,'Cosmote','Τηλεπικοινωνίες'),
  expense('approved-20-mortgage','2026-08-20','national-main',620.30,'Στεγαστικό δάνειο','Δάνεια'),
  expense('approved-19-shell','2026-08-19','alpha-main',48.28,'Shell','Καύσιμα'),
  expense('approved-18-coffee','2026-08-18','alpha-main',3.80,'Coffee Island','Καφέ / Εστίαση'),
  expense('approved-16-transport','2026-08-16','piraeus-payroll',200,'Εισιτήριο/','Μεταφορές'),
  expense('approved-14-public','2026-08-14','alpha-main',89.90,'Public','Αγορές'),
  expense('approved-12-b-pharmacy','2026-08-12','alpha-main',12.40,'Φαρμακείο','Υγεία'),
  expense('approved-12-a-restaurant','2026-08-12','alpha-main',35.60,'Εστιατόριο','Διασκέδαση'),
  expense('approved-05-internet','2026-08-05','alpha-main',32,'Internet','Λογαριασμοί'),
  expense('approved-03-gym','2026-08-03','alpha-main',42,'Γυμναστήριο','Υγεία'),
];

const fillerExpenseAmounts=[85,72,60,58,95,110,77,66,120,45,89,101,83,74,92,68,595.90];
const approvedAugustFiller:LegacyTransaction[]=[
  expense('legacy-1','2026-08-02','piraeus-payroll',24.5,'Supermarket','Σούπερ Μάρκετ'),
  income('legacy-2','2026-08-01','piraeus-payroll',1200,'Μισθός','Μισθός'),
  expense('legacy-3','2026-08-01','piraeus-payroll',42,'Βενζίνη Shell','Μεταφορές','Βενζίνη'),
  expense('legacy-4','2026-08-01','piraeus-payroll',12.4,'Φαρμακείο','Υγεία'),
  income('approved-fill-income-2','2026-08-01','piraeus-payroll',700,'Έσοδο έργου','Άλλο'),
  income('approved-fill-income-3','2026-08-01','piraeus-payroll',500,'Bonus','Μισθός'),
  income('approved-fill-income-4','2026-08-01','piraeus-payroll',394.01,'Επιστροφή εξόδων','Άλλο'),
  ...fillerExpenseAmounts.map((amount,index)=>expense(`approved-fill-expense-${String(index+1).padStart(2,'0')}`,'2026-08-01',index%3===0?'alpha-main':'piraeus-payroll',amount,`Δοκιμαστική δαπάνη ${index+1}`,index%4===0?'Σούπερ Μάρκετ':index%4===1?'Μεταφορές':index%4===2?'Διασκέδαση':'Άλλα')),
  ...Array.from({length:28},(_,index)=>transfer(`approved-fill-transfer-${String(index+1).padStart(2,'0')}`,'2026-08-01','piraeus-payroll',index%2===0?'cash':'piraeus-savings',10+index,`Μεταφορά QA ${index+1}`)),
];

const julyTransactions:LegacyTransaction[]=[
  income('approved-july-income-1','2026-07-05','piraeus-payroll',2073.22,'Μισθοδοσία Ιουλίου A','Μισθοδοσία'),
  income('approved-july-income-2','2026-07-20','piraeus-payroll',2073.22,'Μισθοδοσία Ιουλίου B','Μισθοδοσία'),
  ...Array.from({length:20},(_,index)=>expense(`approved-july-expense-${String(index+1).padStart(2,'0')}`,`2026-07-${String((index%28)+1).padStart(2,'0')}`,'piraeus-payroll',index===19?250.74:170,`Δαπάνη Ιουλίου ${index+1}`,'Άλλα')),
  ...Array.from({length:51},(_,index)=>transfer(`approved-july-transfer-${String(index+1).padStart(2,'0')}`,`2026-07-${String((index%28)+1).padStart(2,'0')}`,'piraeus-payroll',index%2===0?'cash':'piraeus-savings',12+index,`Μεταφορά Ιουλίου ${index+1}`)),
];

const stamp=(date:string)=>`${date}T08:00:00.000Z`;
const approvedRefund:FinanceEvent={id:'approved-refund',date:'2026-08-08',kind:'refund',amount:24.5,note:'Επιστροφή χρημάτων',category:'Άλλα',accountId:'alpha-main',legs:[{accountId:'alpha-main',amount:24.5}],source:'user',createdAt:stamp('2026-08-08'),updatedAt:stamp('2026-08-08')};
const hiddenCardPayment=(id:string,date:string,fromAccountId:string,amount:number):FinanceEvent=>({id,date,kind:'card_payment',amount,note:'QA balance-affecting settlement',fromAccountId,legs:[{accountId:fromAccountId,amount:-amount}],source:'user',createdAt:stamp(date),updatedAt:stamp(date)});

export function qaFinanceData(): FinanceData {
  return {
    app:'RheomIQ',schemaVersion:3,updatedAt:'2026-08-26T10:24:00.000Z',
    seed:{
      accounts:[
        {id:'piraeus-payroll',name:'Μισθοδοσία',short:'ΜΙΣ',kind:'bank'},
        {id:'piraeus-savings',name:'Ταμιευτηρίου',short:'ΤΑΜ',kind:'savings',excludeFromAvailable:true},
        {id:'cash',name:'Μετρητά',short:'CASH',kind:'cash'},
        {id:'alpha-main',name:'Alpha Bank',short:'ALPHA',kind:'bank'},
        {id:'revolut-main',name:'Revolut',short:'REV',kind:'bank'},
        {id:'national-main',name:'Εθνική Τράπεζα',short:'ΕΤΕ',kind:'bank'},
        {id:'eurobank-main',name:'Eurobank',short:'EURO',kind:'bank'},
        {id:'viva-main',name:'Viva Wallet',short:'VIVA',kind:'bank'},
        {id:'payzy-main',name:'payzy',short:'PAYZY',kind:'bank'},
        {id:'emergency-savings',name:'Αποθεματικό',short:'SAFE',kind:'savings',excludeFromAvailable:true},
        {id:'holiday-savings',name:'Ταξίδια',short:'TRIP',kind:'savings',excludeFromAvailable:true},
      ],
      months:['2026-07','2026-08'],
      transactions:[approvedAugustFiller[0]!,...julyTransactions,...approvedAugustFiller.slice(1),...approvedVisibleAugust],
      snapshots:[{date:'2026-08-01',balances:{'piraeus-payroll':1602.88,'piraeus-savings':2875,cash:235,'alpha-main':1592.28,'revolut-main':810.20,'national-main':87.80,'eurobank-main':1450,'viva-main':510,'payzy-main':280,'emergency-savings':950,'holiday-savings':575}}],
      recurring:[{id:'rec-1',name:'Internet',amount:32,day:12,accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,source:'qa'}],
      subscriptions:[],
      loans:[{id:'loan-1',name:'Laptop',total:600,installment:100,installments:6,paidCount:2,provider:'QA Store',schedule:[],source:'qa',accountingMode:'expense-per-installment'}],
      lending:[{person:'Νίκος',entries:[{date:'2026-08-04',lent:50,repaid:0}],outstanding:50}],
      stats:{transactions:68},
    },
    state:{
      customTransactions:[],overrides:{},deleted:[],
      recurringCustom:[{id:'rec-2',name:'Cloud',amount:8,day:20,accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,status:'active',source:'qa'}],recurringOverrides:{},loanExtra:{},loanOverrides:{},
      customLoans:[{id:'loan-long',name:'QA Long Loan',total:1200,installment:100,installments:12,paidCount:1,provider:'QA Bank',schedule:[],source:'user',accountingMode:'expense-per-installment',kind:'loan',firstExpectedDate:'2026-08-15',defaultAccountId:'piraeus-payroll',forgivenAmount:0,longTermRecurring:true}],
      lendingCustom:[],
      settings:{excludedFromAvailable:['piraeus-savings','emergency-savings','holiday-savings'],accountNames:{'piraeus-payroll':'Μισθοδοσία'},expenseCategories:['Τρόφιμα','Όχημα','Υγεία','Μετακινήσεις','Σταθερά έξοδα','Άλλο','Σούπερ Μάρκετ','Στέγαση','Μεταφορές','Διασκέδαση','Άλλα','Αγορές','Λογαριασμοί','Τηλεπικοινωνίες','Δάνεια','Καύσιμα','Καφέ / Εστίαση'],incomeCategories:['Μισθοδοσία','Μισθός','Άλλο'],customPresets:[],pinnedPresets:[],defaultExpenseAccount:'piraeus-payroll',defaultIncomeAccount:'piraeus-payroll',defaultLoanAccount:'piraeus-payroll',monthlyBudget:1000,savingsTargetRate:.2,creditLimit:2000,motion:'system',textSize:'normal',categoryIcons:{'expense:Τρόφιμα':'dining','expense:Όχημα':'car','expense:Σταθερά έξοδα':'subscription','expense:Σούπερ Μάρκετ':'groceries','expense:Στέγαση':'home','expense:Μεταφορές':'transport','expense:Διασκέδαση':'entertainment','income:Μισθός':'salary','income:Μισθοδοσία':'salary'}},
      cardBanks:[],
      cards:[
        {id:'qa-debit-card',bankId:'piraeus',nickname:'QA Debit',kind:'debit',network:'visa',holderName:'QA OWNER',last4:'1111',active:true,createdAt:'2026-08-01T07:00:00.000Z',updatedAt:'2026-08-01T07:00:00.000Z'},
        {id:'qa-card',bankId:'piraeus',nickname:'QA Visa',kind:'credit',network:'visa',holderName:'QA OWNER',last4:'4242',creditLimit:2000,statementClosingDay:12,statementDueDay:20,statementBoundaryRule:'include-closing-day',active:true,createdAt:'2026-08-01T08:00:00.000Z',updatedAt:'2026-08-01T08:00:00.000Z'},
        {id:'qa-settled-card',bankId:'piraeus',nickname:'QA Settled',kind:'credit',network:'mastercard',last4:'2222',creditLimit:1000,statementClosingDay:10,statementDueDay:15,statementBoundaryRule:'include-closing-day',active:false,archivedAt:'2026-08-12T12:00:00.000Z',createdAt:'2026-08-02T08:00:00.000Z',updatedAt:'2026-08-12T12:00:00.000Z'},
      ],
      deletedCards:[],
      creditStatements:[
        {id:'qa-card:2026-08-12',cardId:'qa-card',openDate:'2026-07-13',closeDate:'2026-08-12',dueDate:'2026-08-20',boundaryRule:'include-closing-day',createdAt:'2026-08-12T18:00:00.000Z',updatedAt:'2026-08-12T18:00:00.000Z'},
        {id:'qa-card:2026-09-12',cardId:'qa-card',openDate:'2026-08-13',closeDate:'2026-09-12',dueDate:'2026-09-20',boundaryRule:'include-closing-day',createdAt:'2026-08-14T08:00:00.000Z',updatedAt:'2026-08-14T08:00:00.000Z'},
        {id:'qa-settled-card:2026-08-10',cardId:'qa-settled-card',openDate:'2026-07-11',closeDate:'2026-08-10',dueDate:'2026-08-15',boundaryRule:'include-closing-day',createdAt:'2026-08-10T18:00:00.000Z',updatedAt:'2026-08-11T08:00:00.000Z'},
      ],
      events:[
        {id:'evt-expense',date:'2026-08-02',kind:'expense',amount:18,note:'Freddo espresso\nΠλήρωσα εγώ· θα μου τα στείλει με IRIS.',category:'Τρόφιμα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-18}],source:'user',createdAt:'2026-08-02T08:00:00.000Z',updatedAt:'2026-08-02T08:00:00.000Z'},
        {id:'evt-card',date:'2026-08-06',kind:'card_purchase',amount:120,note:'Ακουστικά',category:'Σούπερ Μάρκετ',cardId:'qa-card',statementId:'qa-card:2026-08-12',legs:[{accountId:'credit-card',amount:-120}],creditDelta:-120,source:'user',createdAt:'2026-08-06T08:00:00.000Z',updatedAt:'2026-08-06T08:00:00.000Z'},
        {id:'evt-card-later',date:'2026-08-14',kind:'card_purchase',amount:45,note:'Βιβλία',category:'Διασκέδαση',cardId:'qa-card',statementId:'qa-card:2026-09-12',legs:[{accountId:'credit-card',amount:-45}],creditDelta:-45,source:'user',createdAt:'2026-08-14T08:00:00.000Z',updatedAt:'2026-08-14T08:00:00.000Z'},
        {id:'evt-settled-purchase',date:'2026-08-08',kind:'card_purchase',amount:50,note:'QA Settled Purchase',category:'Μεταφορές',cardId:'qa-settled-card',statementId:'qa-settled-card:2026-08-10',legs:[{accountId:'credit-card',amount:-50}],creditDelta:-50,source:'user',createdAt:'2026-08-08T08:00:00.000Z',updatedAt:'2026-08-08T08:00:00.000Z'},
        {id:'evt-settled-payment',date:'2026-08-11',kind:'card_payment',amount:50,note:'QA Settled Payment',fromAccountId:'piraeus-payroll',cardId:'qa-settled-card',statementId:'qa-settled-card:2026-08-10',legs:[{accountId:'piraeus-payroll',amount:-50},{accountId:'credit-card',amount:50}],creditDelta:50,source:'user',createdAt:'2026-08-11T08:00:00.000Z',updatedAt:'2026-08-11T08:00:00.000Z'},
        {id:'evt-saving',date:'2026-08-01',kind:'saving_cash_offset',amount:100,note:'Αποταμίευση',fromAccountId:'piraeus-payroll',toAccountId:'piraeus-savings',legs:[{accountId:'piraeus-payroll',amount:-100},{accountId:'piraeus-savings',amount:100}],savingAmount:100,source:'user',createdAt:'2026-08-01T08:00:00.000Z',updatedAt:'2026-08-01T08:00:00.000Z'},
        {id:'evt-card-payment',date:'2026-08-10',kind:'card_payment',amount:20,note:'Αποπληρωμή πιστωτικής',fromAccountId:'piraeus-payroll',cardId:'qa-card',statementId:'qa-card:2026-08-12',legs:[{accountId:'piraeus-payroll',amount:-20},{accountId:'credit-card',amount:20}],creditDelta:20,source:'user',createdAt:'2026-08-10T08:00:00.000Z',updatedAt:'2026-08-10T08:00:00.000Z'},
        {id:'evt-card-payment-later',date:'2026-08-16',kind:'card_payment',amount:10,note:'Δεύτερη αποπληρωμή πιστωτικής',fromAccountId:'piraeus-payroll',cardId:'qa-card',statementId:'qa-card:2026-08-12',legs:[{accountId:'piraeus-payroll',amount:-10},{accountId:'credit-card',amount:10}],creditDelta:10,source:'user',createdAt:'2026-08-16T08:00:00.000Z',updatedAt:'2026-08-16T08:00:00.000Z'},
        approvedRefund,
        hiddenCardPayment('approved-alpha-payment-13','2026-08-13','alpha-main',200),
        hiddenCardPayment('approved-alpha-payment-21','2026-08-21','alpha-main',1135.30),
        hiddenCardPayment('approved-payroll-payment-24','2026-08-24','piraeus-payroll',1279.68),
      ],
      scheduled:[
        {id:'qa-scheduled-expense',dueDate:'2026-08-25',kind:'expense',amount:75,note:'Ετήσια ασφάλεια',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',status:'pending',createdAt:'2026-08-10T10:00:00.000Z',updatedAt:'2026-08-10T10:00:00.000Z'},
        {id:'qa-scheduled-transfer',dueDate:'2026-08-22',kind:'transfer',amount:60,note:'Μεταφορά στον στόχο',fromAccountId:'piraeus-payroll',toAccountId:'piraeus-savings',status:'pending',createdAt:'2026-08-10T11:00:00.000Z',updatedAt:'2026-08-10T11:00:00.000Z'},
      ],
      reviewDecisions:{},
    },
  };
}
