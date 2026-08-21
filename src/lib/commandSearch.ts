import { allCards, cardBanks, cardKindLabel } from './cards.js';
import { allAccounts, effectiveLegacyTransactions } from './domain.js';
import { lendingRows } from './lending.js';
import { loanRemainingInstallments } from './loans.js';
import { allRecurringItems, recurringStatus } from './recurring.js';
import type { FinanceData, FinanceEvent, Loan } from '../types.js';

export type CommandPage='dashboard'|'transactions'|'review'|'savings'|'cards'|'credit'|'loans'|'lending'|'recurring'|'planning'|'attention'|'reports'|'settings';
export type CommandResultKind='command'|'transaction'|'account'|'card'|'loan'|'lending'|'recurring'|'scheduled'|'budget';
export type CommandAction=
 | {type:'navigate';page:CommandPage}
 | {type:'quick_add';kind:'expense'|'income'|'transfer'|'refund';accountId?:string}
 | {type:'credit_payment';cardId:string}
 | {type:'loan_payment';loanId:string;accountId?:string}
 | {type:'lending_repayment';person:string;accountId?:string}
 | {type:'recurring_payment';recurringId:string;accountId?:string}
 | {type:'scheduled_complete';scheduledId:string};

export interface CommandSearchItem{
  id:string;
  kind:CommandResultKind;
  title:string;
  subtitle:string;
  keywords:string[];
  action:CommandAction;
  priority:number;
}
export interface RankedCommandSearchItem extends CommandSearchItem{score:number}

const pageCommands:Array<[CommandPage,string,string,number]>=[
 ['dashboard','Dashboard','Επισκόπηση λογαριασμών',30],['transactions','Συναλλαγές','Ιστορικό και αναζήτηση κινήσεων',31],['savings','Αποταμίευση','Αποταμιευτικές κινήσεις και στόχοι',32],['cards','Κάρτες','Κάρτες και στοιχεία καρτών',33],['credit','Πιστωτική','Πιστωτικές κάρτες και πληρωμές',34],['loans','Δόσεις & Δάνεια','Δόσεις, δάνεια και αποπληρωμές',35],['lending','Δανεικά & επιστροφές','Πρόσωπα και επιστροφές χρημάτων',36],['recurring','Πάγια & Συνδρομές','Επαναλαμβανόμενες υποχρεώσεις',37],['planning','Προγραμματισμός','Scheduled κινήσεις και πρόβλεψη',38],['attention','Χρειάζεται προσοχή','Ενεργές οικονομικές εκκρεμότητες',39],['reports','Αναφορές','Αναλύσεις, budgets και τάσεις',40],['review','Έλεγχος παλιών κινήσεων','Review εισαγμένων κινήσεων',41],['settings','Ρυθμίσεις','Budgets, κανόνες και προτιμήσεις',42],
];

export function normalizeCommandText(value:string){return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('el-GR').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function clean(value:string|undefined){return value?.trim()||''}
function accountName(data:FinanceData,id:string|undefined){if(!id)return '';return data.state.settings.accountNames?.[id]?.trim()||data.seed.accounts.find(account=>account.id===id)?.name||id}
function effectiveLoans(data:FinanceData):Loan[]{const seeded=(data.seed.loans??[]).map(loan=>data.state.loanOverrides?.[loan.id]??loan);return [...seeded,...(data.state.customLoans??[])]}
function item(value:CommandSearchItem){return value}
function eventKindLabel(event:FinanceEvent){return event.kind==='income'?'Έσοδο':event.kind==='transfer'?'Μεταφορά':event.kind==='refund'?'Επιστροφή':event.kind==='split'?'Split αγορά':event.kind==='card_purchase'?'Αγορά κάρτας':event.kind==='card_payment'?'Πληρωμή κάρτας':'Κίνηση'}

export function buildCommandSearchIndex(data:FinanceData):CommandSearchItem[]{
 const rows:CommandSearchItem[]=[
  item({id:'command:quick-expense',kind:'command',title:'Νέα κίνηση',subtitle:'Γρήγορη καταχώριση εξόδου',keywords:['quick add','έξοδο','αγορά','καταχώριση'],action:{type:'quick_add',kind:'expense'},priority:0}),
  item({id:'command:quick-transfer',kind:'command',title:'Νέα μεταφορά',subtitle:'Μεταφορά μεταξύ λογαριασμών',keywords:['transfer','μεταφορά','λογαριασμοί'],action:{type:'quick_add',kind:'transfer'},priority:4}),
  item({id:'command:quick-income',kind:'command',title:'Νέο έσοδο',subtitle:'Γρήγορη καταχώριση εσόδου',keywords:['income','έσοδο','καταχώριση'],action:{type:'quick_add',kind:'income'},priority:5}),
  item({id:'command:quick-refund',kind:'command',title:'Νέα επιστροφή αγοράς',subtitle:'Καταχώριση refund',keywords:['refund','επιστροφή','αγορά'],action:{type:'quick_add',kind:'refund'},priority:6}),
  ...pageCommands.map(([page,title,subtitle,priority])=>item({id:`navigate:${page}`,kind:'command',title,subtitle,keywords:[page,title,subtitle],action:{type:'navigate',page},priority})),
 ];
 for(const account of allAccounts(data)){
  if(account.id==='credit-card')continue;
  const title=accountName(data,account.id);rows.push(item({id:`account:${account.id}`,kind:'account',title,subtitle:account.kind==='savings'?'Λογαριασμός αποταμίευσης':'Λογαριασμός',keywords:[account.id,account.name,account.short??'',account.kind],action:{type:'quick_add',kind:'expense',accountId:account.id},priority:60}));
 }
 for(const tx of effectiveLegacyTransactions(data)){
  rows.push(item({id:`legacy:${tx.id}`,kind:'transaction',title:clean(tx.note)||'Κίνηση χωρίς περιγραφή',subtitle:`${tx.date} · ${tx.type==='income'?'Έσοδο':tx.type==='transfer'?'Μεταφορά':tx.type==='adjustment'?'Διόρθωση':'Έξοδο'}`,keywords:[tx.note,tx.category??'',tx.subcategory??'',accountName(data,tx.accountId??tx.fromAccountId),tx.date,tx.id],action:{type:'navigate',page:'transactions'},priority:90}));
 }
 for(const event of data.state.events??[]){
  rows.push(item({id:`event:${event.id}`,kind:'transaction',title:clean(event.note)||'Κίνηση χωρίς περιγραφή',subtitle:`${event.date} · ${eventKindLabel(event)}`,keywords:[event.note,event.category??'',event.subcategory??'',event.person??'',accountName(data,event.accountId??event.fromAccountId),event.date,event.id],action:{type:'navigate',page:'transactions'},priority:88}));
 }
 const banks=new Map(cardBanks(data).map(bank=>[bank.id,bank.name]));
 for(const card of allCards(data).filter(card=>card.active!==false)){
  const title=clean(card.nickname)||cardKindLabel(card);const page=card.kind==='credit'?'credit':'cards';
  rows.push(item({id:`card:${card.id}`,kind:'card',title,subtitle:`${banks.get(card.bankId)??'Κάρτα'} · ${cardKindLabel(card)}`,keywords:[title,banks.get(card.bankId)??'',card.kind,card.network],action:{type:'navigate',page},priority:55}));
  if(card.kind==='credit')rows.push(item({id:`action:card-payment:${card.id}`,kind:'command',title:`Πληρωμή ${title}`,subtitle:'Πληρωμή συγκεκριμένης πιστωτικής κάρτας',keywords:[title,'πληρωμή','πιστωτική',banks.get(card.bankId)??''],action:{type:'credit_payment',cardId:card.id},priority:18}));
 }
 for(const loan of effectiveLoans(data)){
  rows.push(item({id:`loan:${loan.id}`,kind:'loan',title:loan.name,subtitle:'Δόση / δάνειο',keywords:[loan.name,loan.provider??'',loan.id],action:{type:'navigate',page:'loans'},priority:58}));
  if(loanRemainingInstallments(data,loan)>0)rows.push(item({id:`action:loan-payment:${loan.id}`,kind:'command',title:`Πληρωμή ${loan.name}`,subtitle:'Πληρωμή συγκεκριμένης δόσης ή δανείου',keywords:[loan.name,loan.provider??'','πληρωμή','δόση','δάνειο'],action:{type:'loan_payment',loanId:loan.id,accountId:loan.defaultAccountId},priority:19}));
 }
 for(const lending of lendingRows(data)){
  rows.push(item({id:`lending:${lending.person}`,kind:'lending',title:lending.person,subtitle:'Δανεικά / επιστροφές',keywords:[lending.person,'δανεικά','επιστροφή'],action:{type:'navigate',page:'lending'},priority:57}));
  if(lending.outstanding>0)rows.push(item({id:`action:lending:${lending.person}`,kind:'command',title:`Καταγραφή επιστροφής · ${lending.person}`,subtitle:'Μείωση εκκρεμούς ποσού από συγκεκριμένο πρόσωπο',keywords:[lending.person,'επιστροφή','είσπραξη'],action:{type:'lending_repayment',person:lending.person,accountId:data.state.settings.defaultIncomeAccount},priority:20}));
 }
 for(const recurring of allRecurringItems(data)){
  rows.push(item({id:`recurring:${recurring.id}`,kind:'recurring',title:recurring.name,subtitle:recurringStatus(recurring)==='active'?'Ενεργό πάγιο':'Ανενεργό πάγιο',keywords:[recurring.name,recurring.category,accountName(data,recurring.accountId),recurring.id],action:{type:'navigate',page:'recurring'},priority:56}));
  if(recurringStatus(recurring)==='active')rows.push(item({id:`action:recurring:${recurring.id}`,kind:'command',title:`Πληρωμή ${recurring.name}`,subtitle:'Πληρωμή συγκεκριμένου παγίου',keywords:[recurring.name,recurring.category,'πάγιο','πληρωμή'],action:{type:'recurring_payment',recurringId:recurring.id,accountId:recurring.accountId},priority:21}));
 }
 for(const planned of data.state.scheduled??[]){
  if(planned.status!=='pending')continue;
  rows.push(item({id:`scheduled:${planned.id}`,kind:'scheduled',title:planned.note,subtitle:`Προγραμματισμένη κίνηση · ${planned.dueDate}`,keywords:[planned.note,planned.category??'',planned.dueDate,planned.id,accountName(data,planned.accountId??planned.fromAccountId)],action:{type:'scheduled_complete',scheduledId:planned.id},priority:54}));
 }
 for(const budget of data.state.budgets??[]){
  rows.push(item({id:`budget:${budget.id}`,kind:'budget',title:budget.scope==='overall'?'Συνολικό discretionary budget':`Budget · ${budget.category}`,subtitle:`Budget ${budget.month}`,keywords:[budget.category??'','budget','προϋπολογισμός',budget.month],action:{type:'navigate',page:'reports'},priority:70}));
 }
 return rows;
}

function subsequenceScore(text:string,query:string){let cursor=0,gaps=0,last=-1;for(const char of query){const next=text.indexOf(char,cursor);if(next<0)return 0;if(last>=0)gaps+=Math.max(0,next-last-1);last=next;cursor=next+1}return Math.max(80,300-gaps*4-Math.max(0,text.length-query.length))}
function textScore(text:string,query:string){if(!query)return 0;if(text===query)return 1000;if(text.startsWith(query))return 900;if(text.split(' ').some(word=>word.startsWith(query)))return 780;if(text.includes(query))return 680;return subsequenceScore(text,query)}
function itemScore(row:CommandSearchItem,query:string){const normalized=normalizeCommandText(query);if(!normalized)return 0;const haystacks=[row.title,row.subtitle,...row.keywords].map(normalizeCommandText).filter(Boolean);const tokens=normalized.split(' ').filter(Boolean);let total=0;for(const token of tokens){const best=Math.max(...haystacks.map(value=>textScore(value,token)),0);if(best<=0)return 0;total+=best}const phrase=Math.max(...haystacks.map(value=>textScore(value,normalized)),0);return total+phrase+Math.max(0,80-row.priority)}

export function searchCommandItems(data:FinanceData,query:string,{recentIds=[],limit=14}:{recentIds?:string[];limit?:number}={}):RankedCommandSearchItem[]{
 const index=buildCommandSearchIndex(data);const recentRank=new Map(recentIds.map((id,index)=>[id,recentIds.length-index]));const normalized=normalizeCommandText(query);
 const ranked=index.flatMap(row=>{
  const recentPosition=recentRank.get(row.id)??0;
  if(normalized){const base=itemScore(row,normalized);if(base<=0)return [];return [{...row,score:base+recentPosition*8}]}
  if(recentPosition>0)return [{...row,score:900+recentPosition*20-Math.min(row.priority,80)}];
  if(row.kind!=='command')return [];
  return [{...row,score:500-row.priority}];
 });
 return ranked.sort((a,b)=>b.score-a.score||a.priority-b.priority||a.title.localeCompare(b.title,'el')||a.id.localeCompare(b.id)).slice(0,Math.max(1,limit));
}

export function commandActionKey(action:CommandAction){return JSON.stringify(action)}
