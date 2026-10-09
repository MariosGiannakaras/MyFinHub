import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell, type PageId } from './components/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { ContextualQuickAdd, type QuickActionContext } from './components/ContextualQuickAdd';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DesktopAppLockGate } from './components/DesktopAppLockGate';
import { PageSkeleton } from './components/AppSkeleton';
import { PeriodControl } from './components/PeriodControl';
import { LoginScreen } from './components/LoginScreen';
import { MfaScreen } from './components/MfaScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { PersistenceNotice } from './components/PersistenceNotice';
import type { QuickPrefill } from './components/QuickAdd';
import { financeChangeLabel, useFinance, type ChangeHistoryEntry, type SaveState } from './hooks/useFinance';
import { useSession } from './hooks/useSession';
import type { AttentionItem } from './lib/attention';
import { archiveCardRecord, withCardProfileDeleted } from './lib/cards';
import type { RankedCommandSearchItem } from './lib/commandSearch';
import { accountBalances, allAccounts, createEvent } from './lib/domain';
import { withLegacyOverride, withLegacyTombstone } from './lib/legacyTransactions';
import { applyTaxonomyOperation, type TaxonomyOperation } from './lib/taxonomyManagement';
import { applyTransactionRules } from './lib/transactionRules';
import { qaFinanceData } from './qaFixture';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SavingsPage } from './pages/SavingsPage';
import { CardsPage } from './pages/CardsPage';
import { CreditCardPage } from './pages/CreditCardPage';
import { LoansPage } from './pages/LoansPage';
import { LendingPage } from './pages/LendingPage';
import { RecurringPage } from './pages/RecurringPage';
import { PlanningPage } from './pages/PlanningPage';
import { AttentionPage } from './pages/AttentionPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import type { AttentionDecision, CardBank, EventKind, FinanceData, FinanceEvent, LegacyTransaction, Loan, MonthlyBudget, PaymentCard, RecurringItem, SavingsGoal, ScheduledTransaction, TextSizePreference, TransactionRule } from './types';
import './styles.css';

const QA_SESSION_SIGNAL_SCREEN=new URLSearchParams(location.search).get('screen')==='session-signal';
if(QA_SESSION_SIGNAL_SCREEN){
  const originalFetch=globalThis.fetch.bind(globalThis);
  let mode:'authenticated'|'mfa'='authenticated';
  (globalThis as typeof globalThis & {__myfinhubQaSessionMode?:(next:'authenticated'|'mfa')=>void}).__myfinhubQaSessionMode=(next)=>{mode=next};
  globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    const url=new URL(raw,location.href);
    if(url.pathname==='/api/auth/session'){
      const payload=mode==='mfa'
        ?{authenticated:false,email:'qa@example.invalid',mfaRequired:true,mfaEnrollmentRequired:false}
        :{authenticated:true,email:'qa@example.invalid',mfaRequired:false,mfaEnrollmentRequired:false};
      return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
    }
    return originalFetch(input,init);
  };
}

const QA_PERSISTENCE_PROBE_SCREEN=new URLSearchParams(location.search).get('screen')==='persistence-probe';
if(QA_PERSISTENCE_PROBE_SCREEN){
  const originalFetch=globalThis.fetch.bind(globalThis);
  const backend=qaFinanceData();
  let mode:'success'|'offline'|'pending'='success';
  let revision=1;
  let putCount=0;
  const control=globalThis as typeof globalThis & {
    __myfinhubQaPersistenceMode?:(next:'success'|'offline'|'pending')=>void;
    __myfinhubQaPersistencePutCount?:()=>number;
  };
  control.__myfinhubQaPersistenceMode=(next)=>{mode=next};
  control.__myfinhubQaPersistencePutCount=()=>putCount;
  const history=()=>({
    available:true,generation:String(revision),financeRevision:String(revision),currentPointId:String(revision),
    canUndo:false,canRedo:false,undoDepth:0,redoDepth:0,
    points:[{id:String(revision),parentId:null,label:'QA persistence baseline',createdAt:'2026-08-17T12:00:00.000Z',current:true}],
  });
  globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
    const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    const url=new URL(raw,location.href);
    if(url.pathname==='/api/data'&&(!init?.method||init.method==='GET')){
      return new Response(JSON.stringify({data:backend,revision:String(revision),filePath:'QA persistence backend',lastSavedAt:'2026-08-17T12:00:00.000Z'}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.pathname==='/api/history'&&(!init?.method||init.method==='GET')){
      return new Response(JSON.stringify(history()),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.pathname==='/api/data'&&init?.method==='PUT'){
      putCount+=1;
      if(mode==='offline')throw new TypeError('Synthetic offline finance save');
      if(mode==='pending')return await new Promise<Response>(()=>{});
      revision+=1;
      return new Response(JSON.stringify({revision:String(revision),filePath:'QA persistence backend',lastSavedAt:'2026-08-17T12:00:01.000Z',history:history()}),{status:200,headers:{'content-type':'application/json'}});
    }
    return originalFetch(input,init);
  };
}

const QA_PAGES:PageId[]=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings'];
const QA_PAGE_HEADINGS:Record<PageId,string>={dashboard:'Οι λογαριασμοί μου',transactions:'Συναλλαγές',savings:'Αποταμίευση',cards:'Κάρτες',credit:'Πιστωτική Κάρτα',loans:'Δόσεις & Δάνεια',lending:'Δανεικά & επιστροφές',recurring:'Πάγια & Συνδρομές',planning:'Προγραμματισμός & πρόβλεψη ρευστότητας',attention:'Έλεγχος',reports:'Αναφορές · Η οικονομική εικόνα του μήνα',settings:'Ρυθμίσεις'};
const quickToken=()=>`qa-quick-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
type DistributiveOmit<T,K extends PropertyKey>=T extends unknown?Omit<T,K>:never;
type SpecialQuickContext=DistributiveOmit<Exclude<QuickActionContext,{mode:'generic'}>,'token'>;

function Crash(): never { throw new Error('synthetic-render-failure'); }
const QA_MISSING_LAZY_RESOURCE='/__myfinhub_missing_lazy_resource__.js';
const LazyResourceFailure=lazy(async()=>{
  await import(/* @vite-ignore */ QA_MISSING_LAZY_RESOURCE);
  return {default:()=>null};
});
function initialSaveState(raw:string|null):SaveState{return raw==='error'||raw==='conflict'||raw==='saving'||raw==='loading'?raw:'saved'}
function initialPage(raw:string|null):PageId{if(raw==='review')return 'attention';return QA_PAGES.includes(raw as PageId)?raw as PageId:'dashboard'}
function initialTextSize(raw:string|null):TextSizePreference{return raw==='compact'||raw==='large'?raw:'normal'}
function buildQaData(params:URLSearchParams){
  const next=qaFinanceData();
  if(params.get('card-vault')==='ready')next.state.cards=(next.state.cards??[]).map(card=>card.id==='qa-debit-card'?{...card,last4:'4242',vaultRef:'qa-debit-card'}:card);
  if(params.get('motion')==='reduced')next.state.settings.motion='reduced';
  next.state.settings.textSize=initialTextSize(params.get('text'));
  next.state.budgets=next.state.budgets??[];next.state.transactionRules=next.state.transactionRules??[];next.state.deletedCards=next.state.deletedCards??[];
  if(params.get('state')==='minimal'){
    next.seed.transactions=next.seed.transactions.slice(0,1);next.seed.recurring=next.seed.recurring.slice(0,1);next.seed.loans=next.seed.loans.slice(0,1);next.seed.lending=next.seed.lending.slice(0,1);
    const debit=(next.state.cards??[]).find(card=>card.kind!=='credit');const credit=(next.state.cards??[]).find(card=>card.kind==='credit');next.state.cards=[debit,credit].filter((card):card is PaymentCard=>Boolean(card));
    const retainedCardIds=new Set((next.state.cards??[]).map(card=>card.id));
    next.state.creditStatements=(next.state.creditStatements??[]).filter(statement=>retainedCardIds.has(statement.cardId)).slice(0,1);
    const retainedStatementIds=new Set((next.state.creditStatements??[]).map(statement=>statement.id));
    const compatibleEvents=(next.state.events??[]).filter(event=>(!event.cardId||retainedCardIds.has(event.cardId))&&(!event.statementId||retainedStatementIds.has(event.statementId)));
    const onePerKind=compatibleEvents.filter((event,index,all)=>all.findIndex(item=>item.kind===event.kind)===index);
    next.state.events=onePerKind.slice(0,8);next.state.scheduled=(next.state.scheduled??[]).slice(0,1);next.state.recurringCustom=(next.state.recurringCustom??[]).slice(0,1);next.state.customLoans=(next.state.customLoans??[]).slice(0,1);next.state.lendingCustom=(next.state.lendingCustom??[]).slice(0,1);
    next.state.budgets=(next.state.budgets??[]).slice(0,1);next.state.savingsGoals=(next.state.savingsGoals??[]).slice(0,1);next.state.transactionRules=(next.state.transactionRules??[]).slice(0,1);
  }
  if(params.get('state')==='split-review'){
    next.seed.transactions=[...next.seed.transactions,{id:'qa-review-split',date:'2026-08-18',type:'expense',accountId:'piraeus-payroll',amount:20,note:'Επιστροφή: 5€\nΑγορά: 15€',category:'Άλλα',source:'qa'}];
  }
  if(params.get('state')==='empty'){
    next.seed.transactions=[];next.seed.recurring=[];next.seed.loans=[];next.seed.lending=[];next.seed.snapshots=next.seed.snapshots.map(snapshot=>({...snapshot,balances:{...snapshot.balances,'piraeus-payroll':1000,'piraeus-savings':1000,cash:1000}}));next.state.events=[];next.state.scheduled=[];next.state.recurringCustom=[];next.state.recurringOverrides={};next.state.customLoans=[];next.state.loanOverrides={};next.state.cards=[];next.state.deletedCards=[];next.state.cardBanks=[];next.state.reviewDecisions={};next.state.attentionDecisions={};next.state.budgets=[];next.state.savingsGoals=[];next.state.transactionRules=[];
  }
  if(params.get('state')==='extreme'){
    next.state.settings.accountNames={...next.state.settings.accountNames,'piraeus-payroll':'Κύριος λογαριασμός μισθοδοσίας με εξαιρετικά μεγάλο όνομα για έλεγχο διάταξης'};
    next.state.events=[...(next.state.events??[]),...Array.from({length:36},(_,index)=>({id:`extreme-${index}`,date:`2026-08-${String((index%17)+1).padStart(2,'0')}`,kind:'expense' as const,amount:index===0?987654.32:10+index,note:index===0?'Πολύ μεγάλη περιγραφή συναλλαγής που ελέγχει αναδίπλωση κειμένου χωρίς να δημιουργεί οριζόντια κύλιση ή επικάλυψη στα κουμπιά και στα ποσά':index===1?`Unicode δοκιμή 👩🏽‍💻 Cafe\u0301 · «ειδικά» / σύμβολα — ${'Α'.repeat(180)}`:'Επαναλαμβανόμενη δοκιμαστική κίνηση',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',legs:[{accountId:'piraeus-payroll',amount:-(index===0?987654.32:10+index)}],source:'user' as const,createdAt:`2026-08-17T12:${String(index%60).padStart(2,'0')}:00.000Z`,updatedAt:`2026-08-17T12:${String(index%60).padStart(2,'0')}:00.000Z`}))];
    next.state.recurringCustom=[...(next.state.recurringCustom??[]),...Array.from({length:18},(_,index)=>({id:`rec-extreme-${index}`,name:`Συνδρομή με μεγάλο όνομα ${index+1}`,amount:10+index,day:(index%28)+1,accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,status:'active' as const,source:'qa'}))];
    next.state.scheduled=[...(next.state.scheduled??[]),...Array.from({length:18},(_,index)=>({id:`scheduled-extreme-${index}`,dueDate:`2026-${String(8+Math.floor((index+1)/28)).padStart(2,'0')}-${String((index%27)+1).padStart(2,'0')}`,kind:'expense' as const,amount:index===0?123456.78:20+index,note:index===0?'Πολύ μεγάλη περιγραφή προγραμματισμένης πληρωμής για έλεγχο αναδίπλωσης χωρίς overlap στα actions και στο ποσό':`Προγραμματισμένη κίνηση ${index+1}`,category:'Σταθερά έξοδα',accountId:'piraeus-payroll',status:'pending' as const,createdAt:'2026-08-10T10:00:00.000Z',updatedAt:'2026-08-10T10:00:00.000Z'}))];
  }
  if(params.get('state')==='large'){
    const stamp='2026-08-17T12:00:00.000Z';
    next.state.events=[...(next.state.events??[]),...Array.from({length:1500},(_,index)=>({
      id:`large-event-${String(index).padStart(4,'0')}`,
      date:`2026-08-${String((index%28)+1).padStart(2,'0')}`,
      kind:'expense' as const,
      amount:1+(index%250)/10,
      note:index===1499?'Large dataset unique search target':`Large dataset transaction ${index+1}`,
      category:index%3===0?'Τρόφιμα':index%3===1?'Μετακινήσεις':'Σταθερά έξοδα',
      accountId:'piraeus-payroll',
      legs:[{accountId:'piraeus-payroll',amount:-(1+(index%250)/10)}],
      source:'user' as const,createdAt:stamp,updatedAt:stamp,
    }))];
    next.state.recurringCustom=[...(next.state.recurringCustom??[]),...Array.from({length:120},(_,index)=>({
      id:`large-recurring-${index}`,name:`Large recurring ${index+1}`,amount:5+(index%25),day:(index%28)+1,
      accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,status:'active' as const,source:'qa',
    }))];
    next.state.scheduled=[...(next.state.scheduled??[]),...Array.from({length:120},(_,index)=>({
      id:`large-scheduled-${index}`,dueDate:`2026-08-${String((index%28)+1).padStart(2,'0')}`,kind:'expense' as const,
      amount:10+(index%40),note:`Large scheduled ${index+1}`,category:'Σταθερά έξοδα',accountId:'piraeus-payroll',
      status:'pending' as const,createdAt:stamp,updatedAt:stamp,
    }))];
    const largeCategories=Array.from({length:80},(_,index)=>`QA Κατηγορία ${String(index+1).padStart(3,'0')}`);
    next.state.settings.expenseCategories=[...new Set([...(next.state.settings.expenseCategories??[]),...largeCategories])];
    next.state.settings.expenseCategoryTree=[
      ...(next.state.settings.expenseCategoryTree??next.state.settings.expenseCategories.filter(name=>!largeCategories.includes(name)).map(name=>({name,subcategories:[]}))),
      ...largeCategories.map(name=>({name,subcategories:[]})),
    ];
    next.state.budgets=[...(next.state.budgets??[]),...largeCategories.map((category,index)=>({
      id:`large-budget-${index}`,month:'2026-08',scope:'category' as const,category,amount:100+(index%20)*5,
      alertThreshold:.8,createdAt:stamp,updatedAt:stamp,
    }))];
    next.state.transactionRules=[...(next.state.transactionRules??[]),...Array.from({length:80},(_,index)=>({
      id:`large-rule-${index}`,name:`Large rule ${index+1}`,enabled:true,priority:index,scopes:['manual' as const],
      match:{description:`large-rule-token-${index}`,mode:'contains' as const},action:{category:largeCategories[index]},
      createdAt:stamp,updatedAt:stamp,
    }))];
  }
  if(params.get('state')==='overlimit')next.state.cards=(next.state.cards??[]).map(card=>card.kind==='credit'?{...card,creditLimit:100}:card);
  if(params.get('state')==='cards-rich'){
    const cards=next.state.cards??[],base=cards.find(card=>card.id==='qa-debit-card');
    if(base){
      const variants=[
        {id:'qa-card-revolut',bankId:'revolut',nickname:'QA Revolut',kind:'debit' as const,designId:'revolut-sage',network:'mastercard' as const,last4:'2202'},
        {id:'qa-card-alpha',bankId:'alpha',nickname:'QA Alpha',kind:'debit' as const,designId:'alpha-bonus',network:'visa' as const,last4:'3303'},
        {id:'qa-card-payzy',bankId:'payzy',nickname:'QA Payzy',kind:'prepaid' as const,designId:'payzy-neo',network:'visa' as const,last4:'4404'},
        {id:'qa-card-viva',bankId:'viva',nickname:'QA Viva',kind:'debit' as const,designId:'viva-cobalt',network:'mastercard' as const,last4:'5505'},
      ];
      next.state.cards=[...cards,...variants.map((item,index)=>({...base,...item,createdAt:`2026-08-${String(3+index).padStart(2,'0')}T07:00:00.000Z`,updatedAt:`2026-08-${String(3+index).padStart(2,'0')}T07:00:00.000Z`}))];
    }
  }
  if(params.get('state')==='credit-stack'||params.get('state')==='credit-stack-long'){
    const cards=next.state.cards??[],base=cards.find(card=>card.kind==='credit'&&card.active!==false);
    if(base){
      const providers=['revolut','alpha','payzy','viva','piraeus'] as const;
      const designs=['revolut-sage','alpha-bonus','payzy-neo','viva-cobalt','piraeus-midnight'] as const;
      const total=params.get('state')==='credit-stack-long'?24:6;
      const generated=Array.from({length:Math.max(0,total-1)},(_,index)=>({...base,id:`qa-credit-stack-${index+2}`,bankId:providers[index%providers.length],nickname:`QA Credit ${index+2}`,designId:designs[index%designs.length],network:index%2===0?'mastercard' as const:'visa' as const,last4:String(5100+index).padStart(4,'0'),creditLimit:1500+(index*100),statementClosingDay:undefined,statementDueDay:undefined,statementBoundaryRule:undefined,createdAt:`2026-08-${String((index%20)+2).padStart(2,'0')}T08:00:00.000Z`,updatedAt:`2026-08-${String((index%20)+2).padStart(2,'0')}T08:00:00.000Z`}));
      next.state.cards=[...cards.filter(card=>card.kind!=='credit'||card.active===false),base,...generated];
    }
  }
  if(params.get('state')==='loans-long'){
    const longLoan:Loan={id:'qa-loan-120',name:'QA 120 δόσεις',total:12000,installment:100,installments:120,paidCount:60,day:'15',provider:'QA Provider',source:'qa',kind:'loan',accountingMode:'expense-per-installment',defaultAccountId:'piraeus-payroll',firstExpectedDate:'2026-01-15',longTermRecurring:true};
    next.seed.loans=[];next.state.customLoans=[longLoan];next.state.loanOverrides={};next.state.loanExtra={};
  }
  if(params.get('state')==='lending-rich'){
    const people=['Άννα Παπαδοπούλου','Γιώργος Νικολάου','Ελένη Δημητρίου','Νίκος Κωνσταντίνου','Μαρία Αντωνίου'];
    const additions=people.flatMap((person,index)=>{
      const lent=createEvent({kind:'lending',date:`2026-08-${String(6+index).padStart(2,'0')}`,amount:80+(index*25),note:`QA δανεικά ${index+1}`,accountId:'piraeus-payroll',person});
      lent.id=`qa-lending-rich-${index}-lent`;lent.createdAt=`2026-08-${String(6+index).padStart(2,'0')}T10:00:00.000Z`;lent.updatedAt=lent.createdAt;
      if(index>1)return [lent];
      const repaid=createEvent({kind:'repayment',date:`2026-08-${String(13+index).padStart(2,'0')}`,amount:20+(index*10),note:`QA επιστροφή ${index+1}`,accountId:'piraeus-payroll',person});
      repaid.id=`qa-lending-rich-${index}-repaid`;repaid.createdAt=`2026-08-${String(13+index).padStart(2,'0')}T10:00:00.000Z`;repaid.updatedAt=repaid.createdAt;
      return [lent,repaid];
    });
    next.state.events=[...(next.state.events??[]),...additions];
  }
  if(params.get('state')==='recurring-rich'){
    const categories=['Τηλεπικοινωνίες','Διασκέδαση','Σταθερά έξοδα'];
    next.seed.recurring=[];next.state.recurringOverrides={};
    next.state.recurringCustom=Array.from({length:9},(_,index):RecurringItem=>({id:`qa-recurring-rich-${index+1}`,name:`QA Πάγιο ${index+1}`,amount:12+(index*7),day:(index%24)+1,firstExpectedDate:`2026-08-${String((index%20)+1).padStart(2,'0')}`,endDate:index%3===0?'2027-08-01':null,accountId:'piraeus-payroll',category:categories[index%categories.length],active:true,status:'active',source:'qa',recurrenceUnit:index%4===0?'year':'month',recurrenceInterval:index%4===0?1:(index%3)+1}));
  }
  if(params.get('state')==='recurring-branding'){
    next.seed.recurring=[];next.state.recurringOverrides={};
    next.state.recurringCustom=[
      {id:'qa-service-branded',name:'QA Streaming',amount:14.99,day:18,firstExpectedDate:'2026-08-18',endDate:null,accountId:'piraeus-payroll',category:'Διασκέδαση',active:true,status:'active',source:'qa',recurrenceUnit:'month',recurrenceInterval:1,logoAssetKey:'service-asset-aaaaaaaaaaaaaaaaaaaaaaaa'},
      {id:'qa-service-fallback',name:'QA Utility',amount:31.20,day:22,firstExpectedDate:'2026-08-22',endDate:null,accountId:'piraeus-payroll',category:'Σταθερά έξοδα',active:true,status:'active',source:'qa',recurrenceUnit:'month',recurrenceInterval:1},
      {id:'qa-service-paused',name:'QA Paused Service',amount:7.50,day:8,firstExpectedDate:'2026-08-08',endDate:null,accountId:'piraeus-payroll',category:'Τηλεπικοινωνίες',active:false,status:'paused',source:'qa',recurrenceUnit:'month',recurrenceInterval:1,logoAssetKey:'service-asset-cccccccccccccccccccccccc'},
    ];
  }
  if(params.get('state')==='forecast-negative')next.state.scheduled=[...(next.state.scheduled??[]),{id:'qa-negative-forecast',dueDate:'2026-08-18',kind:'expense',amount:3000,note:'Μεγάλη γνωστή υποχρέωση',category:'Σταθερά έξοδα',accountId:'piraeus-payroll',status:'pending',createdAt:'2026-08-10T10:00:00.000Z',updatedAt:'2026-08-10T10:00:00.000Z'}];
  if(params.get('state')==='budget-rules'){
    const stamp='2026-08-17T12:00:00.000Z';
    const event=createEvent({kind:'expense',date:'2026-08-16',amount:90,note:'QA Market Match',category:'Σταθερά έξοδα',accountId:'piraeus-payroll'});event.createdAt=stamp;event.updatedAt=stamp;
    next.state.events=[...(next.state.events??[]),event];
    next.state.budgets=[{id:'budget:2026-08:%CF%83%CF%84%CE%B1%CE%B8%CE%B5%CF%81%CE%AC%20%CE%AD%CE%BE%CE%BF%CE%B4%CE%B1',month:'2026-08',scope:'category',category:'Σταθερά έξοδα',amount:50,alertThreshold:.8,createdAt:stamp,updatedAt:stamp}];
    next.state.transactionRules=[];
  }
  return next;
}

function QaWorkspace(){
  const params=new URLSearchParams(location.search);
  const lazyFailure=params.get('failure')==='lazy';
  const [data,setData]=useState<FinanceData>(()=>buildQaData(params));
  const [undoStack,setUndoStack]=useState<FinanceData[]>([]);
  const [redoStack,setRedoStack]=useState<FinanceData[]>([]);
  const [changeHistory,setChangeHistory]=useState<ChangeHistoryEntry[]>(()=>params.get('state')==='large'
    ?Array.from({length:100},(_,index)=>({id:`qa-large-history-${index+1}`,kind:'change' as const,label:`Large history change ${index+1}`,at:`2026-08-17T${String(11-Math.floor(index/60)).padStart(2,'0')}:${String(59-index%60).padStart(2,'0')}:00.000Z`,current:index===0}))
    :[]);
  const [saveState,setSaveState]=useState<SaveState>(()=>initialSaveState(params.get('save')));
  const [page,setPage]=useState<PageId>(()=>initialPage(params.get('page')));
  const [quickOpen,setQuickOpen]=useState(false);
  const [commandOpen,setCommandOpen]=useState(false);
  const [recoverOpen,setRecoverOpen]=useState(false);
  const [quickContext,setQuickContext]=useState<QuickActionContext|null>(null);
  const [editing,setEditing]=useState<string|null>(null);
  const [crash,setCrash]=useState(false);
  const [month,setMonth]=useState('2026-08');
  const [privacyVisible,setPrivacyVisible]=useState(false);
  const today='2026-08-17';

  useEffect(()=>{document.documentElement.dataset.motion='full';return()=>{delete document.documentElement.dataset.motion}},[]);
  useEffect(()=>{document.documentElement.dataset.textSize=data.state.settings.textSize??'normal';return()=>{delete document.documentElement.dataset.textSize}},[data.state.settings.textSize]);

  const recordHistory=(kind:ChangeHistoryEntry['kind'],label:string)=>{const entry:ChangeHistoryEntry={id:`qa-history-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kind,label,at:new Date().toISOString()};setChangeHistory(items=>[entry,...items].slice(0,20))};
  const update=(recipe:(current:FinanceData)=>FinanceData)=>{const current=data;const next=recipe(current);if(next===current)return;setUndoStack(stack=>[...stack.slice(-19),current]);setRedoStack([]);recordHistory('change',financeChangeLabel(current,next));setData(next)};
  const undo=()=>{const previous=undoStack.at(-1);if(!previous)return;setUndoStack(stack=>stack.slice(0,-1));setRedoStack(stack=>[data,...stack].slice(0,20));recordHistory('undo','Αναίρεση τελευταίας αλλαγής');setData(previous)};
  const redo=()=>{const next=redoStack[0];if(!next)return;setRedoStack(stack=>stack.slice(1));setUndoStack(stack=>[...stack.slice(-19),data]);recordHistory('redo','Επαναφορά τελευταίας αναιρεμένης αλλαγής');setData(next)};
  const refresh=()=>{setSaveState('loading');window.setTimeout(()=>setSaveState('saved'),350)};
  const importData=(incoming:FinanceData)=>{setUndoStack(stack=>[...stack.slice(-19),data]);setRedoStack([]);setData(incoming)};
  const addEvent=(event:FinanceEvent)=>update(current=>{const events=current.state.events??[];const exists=events.some(existing=>existing.id===event.id);const nextEvent=exists?event:applyTransactionRules(current,event);return {...current,state:{...current.state,events:exists?events.map(existing=>existing.id===event.id?nextEvent:existing):[...events,nextEvent]}}});
  const deleteEvent=(id:string)=>update(current=>({...current,state:{...current.state,events:(current.state.events??[]).filter(e=>e.id!==id)}}));
  const editEvent=(id:string)=>{const event=(data.state.events??[]).find(item=>item.id===id);setEditing(id);setQuickContext({token:quickToken(),mode:'generic',kind:event?.kind||'expense',prefill:null});setQuickOpen(true)};
  const editLegacy=(transaction:LegacyTransaction)=>update(current=>withLegacyOverride(current,transaction));
  const deleteLegacy=(id:string)=>update(current=>withLegacyTombstone(current,id));
  const openGeneric=(kind:EventKind='expense',prefill:QuickPrefill|null=null)=>{setEditing(null);setQuickContext({token:quickToken(),mode:'generic',kind,prefill});setQuickOpen(true)};
  const openSpecial=(context:SpecialQuickContext)=>{setEditing(null);setQuickContext({...context,token:quickToken()} as QuickActionContext);setQuickOpen(true)};
  const openCommand=()=>{if(quickOpen)return;setCommandOpen(true)};
  const upsertRecurring=(item:RecurringItem)=>update(current=>{const seeded=current.seed.recurring.some(seed=>seed.id===item.id);if(seeded)return {...current,state:{...current.state,recurringOverrides:{...current.state.recurringOverrides,[item.id]:item}}};return {...current,state:{...current.state,recurringCustom:[...(current.state.recurringCustom??[]).filter(r=>r.id!==item.id),item]}}});
  const withLoan=(current:FinanceData,loan:Loan)=>{if(current.seed.loans.some(item=>item.id===loan.id))return {...current,state:{...current.state,loanOverrides:{...current.state.loanOverrides,[loan.id]:loan}}};return {...current,state:{...current.state,customLoans:[...(current.state.customLoans??[]).filter(item=>item.id!==loan.id),loan]}}};
  const upsertLoan=(loan:Loan)=>update(current=>withLoan(current,loan));
  const createSelfLoan=(loan:Loan,event:FinanceEvent)=>update(current=>{const next=withLoan(current,loan);return {...next,state:{...next.state,events:[...(next.state.events??[]).filter(existing=>existing.id!==event.id),event]}}});
  const upsertBank=(bank:CardBank)=>update(current=>({...current,state:{...current.state,cardBanks:[...(current.state.cardBanks??[]).filter(item=>item.id!==bank.id),bank]}}));
  const upsertCard=(card:PaymentCard)=>update(current=>({...current,state:{...current.state,cards:[...(current.state.cards??[]).filter(item=>item.id!==card.id),card]}}));
  const archiveCard=(card:PaymentCard)=>upsertCard(archiveCardRecord(card));
  const deleteCard=async(card:PaymentCard)=>{update(current=>withCardProfileDeleted(current,card,`${today}T12:00:00.000Z`,today))};
  const upsertScheduled=(item:ScheduledTransaction)=>update(current=>({...current,state:{...current.state,scheduled:[...(current.state.scheduled??[]).filter(existing=>existing.id!==item.id),item]}}));
  const completeScheduled=(item:ScheduledTransaction,event:FinanceEvent)=>update(current=>{const nextEvent=applyTransactionRules(current,event);return {...current,state:{...current.state,scheduled:[...(current.state.scheduled??[]).filter(existing=>existing.id!==item.id),item],events:[...(current.state.events??[]).filter(existing=>existing.id!==nextEvent.id),nextEvent]}}});
  const upsertBudget=(budget:MonthlyBudget)=>update(current=>({...current,state:{...current.state,budgets:[...(current.state.budgets??[]).filter(item=>item.id!==budget.id),budget]}}));
  const deleteBudget=(id:string)=>update(current=>({...current,state:{...current.state,budgets:(current.state.budgets??[]).filter(item=>item.id!==id)}}));
  const updateSavingsTarget=(rate:number)=>update(current=>({...current,state:{...current.state,settings:{...current.state.settings,savingsTargetRate:rate}}}));
  const upsertSavingsGoal=(goal:SavingsGoal)=>update(current=>{const rows=current.state.savingsGoals??[];const exists=rows.some(item=>item.id===goal.id);return {...current,state:{...current.state,savingsGoals:exists?rows.map(item=>item.id===goal.id?goal:item):[...rows,goal]}}});
  const deleteSavingsGoal=(id:string)=>update(current=>({...current,state:{...current.state,savingsGoals:(current.state.savingsGoals??[]).filter(item=>item.id!==id)}}));
  const upsertRule=(rule:TransactionRule)=>update(current=>({...current,state:{...current.state,transactionRules:[...(current.state.transactionRules??[]).filter(item=>item.id!==rule.id),rule]}}));
  const deleteRule=(id:string)=>update(current=>({...current,state:{...current.state,transactionRules:(current.state.transactionRules??[]).filter(item=>item.id!==id)}}));
  const updateTaxonomy=(operation:TaxonomyOperation)=>update(current=>applyTaxonomyOperation(current,operation,today));
  const decideAttention=(id:string,decision:AttentionDecision)=>update(current=>({...current,state:{...current.state,attentionDecisions:{...(current.state.attentionDecisions??{}),[id]:decision}}}));
  const handleAttention=(item:AttentionItem)=>{
    if(item.action==='pay_recurring'&&item.recurringId){openSpecial({mode:'recurring',recurringId:item.recurringId,amount:item.amount,accountId:item.accountId});return}
    if(item.action==='pay_loan'&&item.loanId){openSpecial({mode:'loan',loanId:item.loanId,amount:item.amount,accountId:item.accountId});return}
    if(item.action==='pay_credit'&&item.cardId){openSpecial({mode:'credit',action:'payment',cardId:item.cardId,statementId:item.statementId,amount:item.amount});return}
    if(item.action==='collect_lending'&&item.person){openSpecial({mode:'lending',action:'repay',person:item.person,amount:item.amount,accountId:data.state.settings.defaultIncomeAccount});return}
    if(item.action==='complete_scheduled'&&item.scheduledId){openSpecial({mode:'scheduled',scheduledId:item.scheduledId});return}
    if(item.action==='open_forecast'){setPage('planning');return}
    if(item.action==='open_budgets'){setPage('reports')}
  };
  const handleCommand=(row:RankedCommandSearchItem)=>{
    setCommandOpen(false);const action=row.action;
    if(action.type==='navigate'){setPage(action.page);return}
    if(action.type==='quick_add'){
      if(action.accountId){const account=allAccounts(data).find(item=>item.id===action.accountId);if(account?.kind==='savings'){openSpecial({mode:'savings',toAccountId:action.accountId,savingSource:'manual_transfer'});return}openGeneric(action.kind,{note:'',amount:0,accountId:action.accountId});return}
      openGeneric(action.kind);return;
    }
    if(action.type==='credit_payment'){openSpecial({mode:'credit',action:'payment',cardId:action.cardId});return}
    if(action.type==='loan_payment'){openSpecial({mode:'loan',loanId:action.loanId,accountId:action.accountId});return}
    if(action.type==='lending_repayment'){openSpecial({mode:'lending',action:'repay',person:action.person,accountId:action.accountId??data.state.settings.defaultIncomeAccount});return}
    if(action.type==='recurring_payment'){openSpecial({mode:'recurring',recurringId:action.recurringId,accountId:action.accountId});return}
    if(action.type==='scheduled_complete'){openSpecial({mode:'scheduled',scheduledId:action.scheduledId})}
  };
  const content=page==='dashboard'
    ?<DashboardPage data={data} month={month} asOf={today} motionMode="full" privacyVisible={privacyVisible} onPrivacyVisibleChange={setPrivacyVisible} onQuickAdd={(prefill?:QuickPrefill)=>openGeneric('expense',prefill||null)} onAccountQuickAdd={(accountId,kind)=>kind==='savings'?openSpecial({mode:'savings',toAccountId:accountId,savingSource:'manual_transfer'}):openGeneric('expense',{note:'',amount:0,accountId})} onTransactions={()=>setPage('transactions')} onPlanning={()=>setPage('planning')} onAttention={()=>setPage('attention')} onReports={()=>setPage('reports')}/>
    :page==='transactions'?<TransactionsPage data={data} month={month} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onEditLegacy={editLegacy} onDeleteLegacy={deleteLegacy}/>
    :page==='savings'?<SavingsPage data={data} month={month} asOf={today} onCreate={addEvent} onQuickAdd={openSpecial} onSavingsTargetChange={updateSavingsTarget} onUpsertGoal={upsertSavingsGoal} onDeleteGoal={deleteSavingsGoal}/>
    :page==='cards'?<CardsPage data={data} onUpsertBank={upsertBank} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onDeleteCard={deleteCard}/>
    :page==='credit'?<CreditCardPage data={data} asOf={today} onCreateEvent={addEvent} onEditEvent={editEvent} onDeleteEvent={deleteEvent} onUpsertCard={upsertCard} onArchiveCard={archiveCard} onDeleteCard={deleteCard} onPayCard={cardId=>openSpecial({mode:'credit',action:'payment',cardId})}/>
    :page==='loans'?<LoansPage data={data} asOf={today} onUpsertLoan={upsertLoan} onCreateSelfLoan={createSelfLoan} onPayLoan={loanId=>openSpecial({mode:'loan',loanId})}/>
    :page==='lending'?<LendingPage data={data} asOf={today} privacyVisible={privacyVisible} onPrivacyVisibleChange={setPrivacyVisible} onCreateEvent={addEvent} onQuickAdd={openSpecial}/>
    :page==='recurring'?<RecurringPage data={data} asOf={today} onUpsert={upsertRecurring} onUpsertDurably={async item=>{if(new URLSearchParams(window.location.search).get('recurring-save-failure')==='1')throw new Error('Η δοκιμαστική αποθήκευση απέτυχε.');upsertRecurring(item)}} onOpenLoans={()=>setPage('loans')} onPayLoan={loanId=>openSpecial({mode:'loan',loanId})} onPayRecurring={recurringId=>openSpecial({mode:'recurring',recurringId})}/>
    :page==='planning'?<PlanningPage data={data} asOf={today} onUpsertScheduled={upsertScheduled} onCompleteScheduled={completeScheduled}/>
    :page==='attention'?<AttentionPage data={data} asOf={today} onAction={handleAttention} onDecision={decideAttention} onReviewDecision={(id,decision)=>update(current=>({...current,state:{...current.state,reviewDecisions:{...(current.state.reviewDecisions??{}),[id]:decision}}}))}/>
    :page==='reports'?<ReportsPage data={data} month={month} privacyVisible={privacyVisible} onPrivacyVisibleChange={setPrivacyVisible} onUpsertBudget={upsertBudget} onDeleteBudget={deleteBudget} onUpsertRule={upsertRule} onDeleteRule={deleteRule}/>
    :<SettingsPage data={data} asOf={today} filePath="Synthetic QA" lastSavedAt={data.updatedAt} onImport={async incoming=>importData(incoming)} onBackup={async()=>({path:'synthetic/backup.json'})} onSettings={settings=>update(current=>({...current,state:{...current.state,settings}}))} onTaxonomyOperation={updateTaxonomy} onUpsertRule={upsertRule} onDeleteRule={deleteRule}/>;
  const periodVisible=['dashboard','transactions','savings','reports'].includes(page);

  return <>
    <AppShell page={page} onPage={next=>{setCrash(false);setPage(next)}} onQuickAdd={()=>openGeneric()} onCommand={openCommand} onRefresh={refresh} onUndo={undo} onRedo={redo} canUndo={undoStack.length>0} canRedo={redoStack.length>0} history={changeHistory} saveState={saveState} filePath="Synthetic QA" motionMode="full" userEmail="qa@example.invalid" onLogout={()=>{}}>
      <PersistenceNotice saveState={saveState} onRecover={()=>setRecoverOpen(true)}/>
      {periodVisible?<div className="period-row"><PeriodControl month={month} onChange={setMonth}/><button type="button" className="text-button" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button></div>:<button type="button" className="text-button qa-crash-floating" data-qa-crash onClick={()=>setCrash(true)}>QA render failure</button>}
      {saveState==='loading'?<div className="qa-loading-route"><h1 className="sr-only">{QA_PAGE_HEADINGS[page]}</h1><PageSkeleton/></div>:<PageErrorBoundary resetKey={page} onDashboard={()=>{setCrash(false);setPage('dashboard')}}>{lazyFailure?<Suspense fallback={<PageSkeleton/>}><LazyResourceFailure/></Suspense>:crash?<Crash/>:content}</PageErrorBoundary>}
    </AppShell>
    <CommandPalette open={commandOpen} data={data} motionMode="full" onClose={()=>setCommandOpen(false)} onExecute={handleCommand}/>
    <ContextualQuickAdd open={quickOpen} data={data} asOf={today} context={quickContext} initial={(data.state.events??[]).find(event=>event.id===editing)||null} motionMode="full" onClose={()=>{setQuickOpen(false);setEditing(null);setQuickContext(null)}} onCreate={addEvent} onCompleteScheduled={completeScheduled} currentBalance={id=>accountBalances(data,today)[id]||0}/>
    <ConfirmDialog open={recoverOpen} title="Φόρτωση τελευταίας αποθηκευμένης έκδοσης;" description="Η επαναφόρτωση θα απορρίψει τυχόν τοπικές αλλαγές που δεν αποθηκεύτηκαν και θα φορτώσει την τελευταία έκδοση από τη βάση." confirmLabel="Επαναφόρτωση" tone="destructive" motionMode="full" onConfirm={()=>{setRecoverOpen(false);setSaveState('saved')}} onCancel={()=>setRecoverOpen(false)}/>
  </>;
}

function QaDesktopLockProbe(){
  return <DesktopAppLockGate><main className="boot-screen" data-desktop-lock-probe="protected"><h1>MyFinHub Windows protected workspace</h1></main></DesktopAppLockGate>;
}

function QaPersistenceProbe(){
  const finance=useFinance();
  if(!finance.data)return <main className="boot-screen" data-persistence-probe="loading">Φόρτωση persistence probe…</main>;
  const budget=finance.data.state.settings.monthlyBudget??0;
  return <main className="boot-screen" data-persistence-probe="ready">
    <h1>Persistence QA probe</h1>
    <output data-persistence-state={finance.saveState}>{finance.saveState}</output>
    <output data-persistence-budget={budget}>{budget}</output>
    <button type="button" data-persistence-mutate onClick={()=>finance.update(current=>({...current,state:{...current.state,settings:{...current.state.settings,monthlyBudget:(current.state.settings.monthlyBudget??0)+1}}}))}>Synthetic finance change</button>
    <button type="button" data-persistence-reload onClick={()=>{void finance.reload()}}>Reload persisted state</button>
    <PersistenceNotice saveState={finance.saveState} errorMessage={finance.saveErrorMessage} onRecover={()=>{void finance.reload()}}/>
  </main>;
}

function QaSessionSignalProbe(){
  const session=useSession();
  if(session.state==='loading')return <div className="boot-screen" data-session-probe="loading">Έλεγχος συνεδρίας…</div>;
  if(session.state==='mfa'||session.state==='mfa-enroll')return <MfaScreen mode={session.state==='mfa-enroll'?'enroll':'challenge'} email={session.email} error={session.error} onEnroll={session.enrollMfa} onVerify={session.verifyMfa} onLogout={async()=>{await session.logout()}}/>;
  if(session.state==='authenticated')return <main className="boot-screen" data-session-probe="authenticated"><h1>Authenticated QA shell</h1></main>;
  return <LoginScreen onLogin={session.login} error={session.error}/>;
}

function QaAuthScreen({screen,legacyError}:{screen:string;legacyError:boolean}){
  const loginErrors:Record<string,string>={
    'login-error':'Τα στοιχεία σύνδεσης δεν είναι σωστά.',
    'auth-unavailable':'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη προσωρινά. Δοκίμασε ξανά σε λίγο.',
    'session-expired':'Η συνεδρία έληξε. Συνδέσου ξανά για να συνεχίσεις.',
    'session-revoked':'Η πρόσβαση αυτής της συσκευής έχει ανακληθεί. Συνδέσου ξανά.',
  };
  if(screen==='login'||screen in loginErrors)return <LoginScreen error={screen==='login'&&legacyError?'Τα στοιχεία σύνδεσης δεν είναι σωστά.':loginErrors[screen]??''} onLogin={async()=>false}/>;
  if(screen==='mfa'||screen==='mfa-error'||screen==='mfa-enroll'||screen==='mfa-enroll-error'){
    const enroll=screen.startsWith('mfa-enroll');
    const error=screen==='mfa-error'||(screen==='mfa'&&legacyError)
      ?'Ο κωδικός επαλήθευσης δεν είναι σωστός.'
      :screen==='mfa-enroll-error'
        ?'Δεν ήταν δυνατή η έναρξη ρύθμισης Authenticator. Δοκίμασε ξανά.'
        :'';
    return <MfaScreen mode={enroll?'enroll':'challenge'} email="qa@example.invalid" error={error} onEnroll={async()=>({factorId:'qa-factor',qrCode:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22/%3E',secret:'QA-ONLY-SECRET'})} onVerify={async()=>false} onLogout={async()=>{}}/>;
  }
  return null;
}

function QaApp(){
  const params=new URLSearchParams(location.search);
  const screen=params.get('screen')??'';
  if(screen==='desktop-lock')return <QaDesktopLockProbe/>;
  if(screen==='persistence-probe')return <QaPersistenceProbe/>;
  if(screen==='session-signal')return <QaSessionSignalProbe/>;
  if(screen==='404')return <NotFoundPage onHome={()=>{}} onBack={()=>{}}/>;
  const auth=<QaAuthScreen screen={screen} legacyError={params.get('error')==='1'}/>;
  if(screen.startsWith('login')||screen.startsWith('mfa')||screen==='auth-unavailable'||screen.startsWith('session-'))return auth;
  return <QaWorkspace/>;
}

async function bootstrapQa(){
  const params=new URLSearchParams(location.search);
  if(params.get('desktop-titlebar')==='1'){
    document.documentElement.dataset.myfinhubDesktop='true';
    await import('./styles/desktop-titlebar.css');
  }
  if(params.get('screen')==='desktop-lock'){
    document.documentElement.dataset.myfinhubDesktop='true';
    await Promise.all([import('./components/DesktopAppLockGate.css'),import('./styles/desktop-titlebar.css')]);
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><QaApp/></StrictMode>);
}

void bootstrapQa();
