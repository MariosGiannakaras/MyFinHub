import { effectiveLegacyTransactions, flowImpactEvent, flowImpactLegacy, reviewDecision } from './domain.js';
import { categoryKey, categoryPath } from './categories.js';
import { moneyToCents, centsToMoney } from './money.js';
import { pendingScheduled } from './scheduled.js';
import { recurringUpcoming } from './recurring.js';
import type { FinanceData, MonthlyBudget, SplitPart } from '../types.js';

type BudgetStatus = 'ok' | 'near' | 'exceeded';
type BudgetScope = MonthlyBudget['scope'];

interface BudgetProgress {
  id: string;
  month: string;
  scope: BudgetScope;
  category?: string;
  subcategory?: string;
  carryover: boolean;
  carried: number;
  baseLimit: number;
  limit: number;
  used: number;
  rawUsed: number;
  remaining: number;
  projectedDue: number;
  projectedUsed: number;
  projectedRemaining: number;
  ratio: number;
  alertThreshold: number;
  status: BudgetStatus;
  projectedStatus: BudgetStatus;
}

interface BudgetCommitment {
  id: string;
  date: string;
  category: string;
  subcategory?: string;
  amount: number;
  source: 'scheduled' | 'recurring';
}

const DEFAULT_ALERT_THRESHOLD = .8;
const normalize = (value?:string) => categoryKey(value??'');
const pair = (cat?:string,sub?:string) => `${normalize(cat)}\u001f${normalize(sub)}`;
const cents=(amount:number)=>moneyToCents(amount);
const money=(value:number)=>centsToMoney(value);
const spendMonth=(date:string,month:string,asOf?:string)=>date.startsWith(month+'-')&&(!asOf||month!==asOf.slice(0,7)||date<=asOf);
const prevMonth=(month:string)=>{
  const [year,m]=month.split('-').map(Number);
  return new Date(Date.UTC(year,m-2,1)).toISOString().slice(0,7);
};

function add(target:Map<string,number>,key:string,amount:number){
  if(!key||!Number.isFinite(amount)||Math.abs(amount)<.000001)return;
  target.set(key,(target.get(key)??0)+cents(amount));
}

/** Two views from the SAME posting rows. Never add category+subcategory views
 * together: a split is allocated by its actual parts exactly once. */
function spending(data:FinanceData,month:string,asOf?:string){
  const categories=new Map<string,number>(),subcategories=new Map<string,number>();
  const addExpense=(category:string|undefined,subcategory:string|undefined,amount:number)=>{
    if(!category?.trim())return;
    add(categories,normalize(category),amount);
    if(subcategory?.trim())add(subcategories,pair(category,subcategory),amount);
  };
  const parts=(values:SplitPart[]|undefined)=>{
    for(const part of values??[]){
      const kind=part.kind??'expense';
      if(kind==='expense')addExpense(part.category,part.subcategory,Math.abs(Number(part.amount||0)));
      if(kind==='refund')addExpense(part.category,part.subcategory,-Math.abs(Number(part.amount||0)));
    }
  };
  for(const tx of effectiveLegacyTransactions(data)){
    if(!spendMonth(tx.date,month,asOf))continue;
    const decision=reviewDecision(data,tx.id);
    if(decision?.status==='confirmed'&&decision.semanticKind==='split'){parts(decision.parts);continue;}
    const impact=flowImpactLegacy(data,tx);
    if(impact.expense)addExpense(decision?.category||tx.category,decision?.subcategory||tx.subcategory,impact.expense);
  }
  for(const event of data.state.events??[]){
    if(!spendMonth(event.date,month,asOf))continue;
    if(event.parts?.length){parts(event.parts);continue;}
    const impact=flowImpactEvent(event);
    if(impact.expense)addExpense(event.category,event.subcategory,impact.expense);
  }
  return {categories,subcategories};
}

export function categoryBudgetSpending(data:FinanceData,month:string,asOf?:string){
  const totals=spending(data,month,asOf).categories;
  const result=new Map<string,number>();
  // Preserve configured/display category names for legacy callers.
  const names=new Map<string,string>();
  for(const tx of effectiveLegacyTransactions(data)){if(tx.category)names.set(normalize(tx.category),tx.category)}
  for(const e of data.state.events??[]){if(e.category)names.set(normalize(e.category),e.category)}
  for(const item of data.state.settings.expenseCategories)names.set(normalize(item),item);
  for(const [key,value] of totals)result.set(names.get(key)??key,money(value));
  return result;
}

export function subcategoryBudgetSpending(data:FinanceData,month:string,asOf?:string){
  const allocations=spending(data,month,asOf).subcategories;
  const names=new Map<string,string>();
  for(const e of data.state.events??[]){if(e.category&&e.subcategory)names.set(pair(e.category,e.subcategory),categoryPath(e.category,e.subcategory))}
  for(const tx of effectiveLegacyTransactions(data)){if(tx.category&&tx.subcategory)names.set(pair(tx.category,tx.subcategory),categoryPath(tx.category,tx.subcategory))}
  const result=new Map<string,number>();
  for(const [key,value] of allocations)result.set(names.get(key)??key.replace('\u001f',' › '),money(value));
  return result;
}

function identities(data:FinanceData,budget:MonthlyBudget){
  const records=data.state.settings.categoryIdentities??{};
  const category=budget.categoryIdentityId?records[budget.categoryIdentityId]:undefined;
  const subcategory=budget.subcategoryIdentityId?records[budget.subcategoryIdentityId]:undefined;
  const cats=new Set([budget.category,category?.label,...(category?.aliases??[])].filter((v):v is string=>Boolean(v)).map(normalize));
  const subs=new Set([budget.subcategory,subcategory?.label,...(subcategory?.aliases??[])].filter((v):v is string=>Boolean(v)).map(normalize));
  return {cats,subs};
}

function matchingBudget(data:FinanceData,a:MonthlyBudget,b:MonthlyBudget){
  if(a.scope!==b.scope)return false;
  if(a.scope==='overall')return true;
  if(a.categoryIdentityId&&b.categoryIdentityId)return a.categoryIdentityId===b.categoryIdentityId&&
    (a.scope!=='subcategory'||a.subcategoryIdentityId===b.subcategoryIdentityId);
  const aa=identities(data,a),bb=identities(data,b);
  if(![...aa.cats].some(name=>bb.cats.has(name)))return false;
  return a.scope!=='subcategory'||[...aa.subs].some(name=>bb.subs.has(name));
}

function useBudget(data:FinanceData,budget:MonthlyBudget,allocation:ReturnType<typeof spending>){
  if(budget.scope==='overall')return [...allocation.categories.values()].reduce((a,b)=>a+b,0);
  const {cats,subs}=identities(data,budget);
  if(budget.scope==='category')return [...allocation.categories].reduce((n,[key,value])=>n+(cats.has(key)?value:0),0);
  return [...allocation.subcategories].reduce((n,[key,value])=>{
    const [cat,sub]=key.split('\u001f');
    return n+(cats.has(cat)&&subs.has(sub)?value:0);
  },0);
}

function monthlyBudgets(data:FinanceData,month:string){
  return (data.state.budgets??[]).filter(b=>b.month===month&&b.amount>0)
    .slice().sort((a,b)=>a.scope.localeCompare(b.scope)||(a.category??'').localeCompare(b.category??'','el')||a.id.localeCompare(b.id));
}

/** Explicit, known but NOT booked obligations. Do not turn future bills into
 * financial events, count completed scheduled payments or double-count a
 * recurring bill already represented by a pending scheduled obligation. */
export function budgetProjectedCommitments(data:FinanceData,month:string,asOf:string):BudgetCommitment[]{
  const end=`${month}-${new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate()}`;
  if(end<=asOf)return [];
  const result:BudgetCommitment[]=[];
  const scheduled=pendingScheduled(data).filter(item=>item.kind==='expense'&&item.dueDate>asOf&&item.dueDate<=end&&
    item.dueDate.startsWith(month+'-')&&!item.completedEventId&&item.category&&Number(item.amount)>0);
  for(const item of scheduled)result.push({id:item.id,date:item.dueDate,category:item.category!,subcategory:item.subcategory,
    amount:Number(item.amount),source:'scheduled'});
  for(const {item,nextDate} of recurringUpcoming(data,asOf)){
    if(!nextDate||!nextDate.startsWith(month+'-')||nextDate<=asOf||!item.category||Number(item.amount)<=0)continue;
    if((data.state.events??[]).some(e=>e.recurringId===item.id&&e.date.slice(0,7)===month))continue;
    const duplicate=scheduled.some(s=>s.dueDate===nextDate&&s.accountId===item.accountId&&
      cents(s.amount)===cents(item.amount)&&normalize(s.category)===normalize(item.category));
    if(duplicate)continue;
    result.push({id:item.id,date:nextDate,category:item.category,amount:Number(item.amount),source:'recurring'});
  }
  return result;
}

export function budgetProgress(data:FinanceData,month:string,asOf?:string):BudgetProgress[]{
  const selected=monthlyBudgets(data,month);
  if(!selected.length)return [];
  const previousSpending=new Map<string,ReturnType<typeof spending>>();
  const spent=(m:string,cutoff?:string)=>{
    const key=`${m}:${cutoff??''}`;
    const cached=previousSpending.get(key);
    if(cached)return cached;
    const s=spending(data,m,cutoff);previousSpending.set(key,s);return s;
  };
  const previousCarry=(budget:MonthlyBudget,depth:number):number=>{
    if(!budget.carryover||depth>24)return 0;
    const previousMonth=prevMonth(budget.month);
    const parent=monthlyBudgets(data,previousMonth).find(b=>matchingBudget(data,budget,b));
    if(!parent)return 0;
    const before=cents(parent.amount)+previousCarry(parent,depth+1);
    const used=Math.max(0,useBudget(data,parent,spent(previousMonth)));
    return Math.max(0,before-used);
  };
  const actual=spent(month,asOf);
  const commitments=asOf?budgetProjectedCommitments(data,month,asOf):[];
  return selected.map(budget=>{
    const usedCents=useBudget(data,budget,actual);
    const carriedCents=previousCarry(budget,0);
    const baseCents=cents(budget.amount),limitCents=baseCents+carriedCents;
    const used=Math.max(0,usedCents);
    const future=commitments.reduce((sum,obligation)=>{
      const fake:MonthlyBudget={...budget};
      const sources={categories:new Map([[normalize(obligation.category),cents(obligation.amount)]]),
        subcategories:new Map(obligation.subcategory?[[pair(obligation.category,obligation.subcategory),cents(obligation.amount)]]:[])};
      return sum+useBudget(data,fake,sources);
    },0);
    const threshold=Math.min(.99,Math.max(.5,Number(budget.alertThreshold??DEFAULT_ALERT_THRESHOLD)));
    const ratio=limitCents>0?used/limitCents:0,projectedUsed=Math.max(0,usedCents+future);
    const projectedRatio=limitCents>0?projectedUsed/limitCents:0;
    const status=(r:number):BudgetStatus=>r>1?'exceeded':r>=threshold?'near':'ok';
    return {id:budget.id,month,scope:budget.scope,category:budget.category,subcategory:budget.subcategory,
      carryover:Boolean(budget.carryover),carried:money(carriedCents),baseLimit:money(baseCents),limit:money(limitCents),
      used:money(used),rawUsed:money(usedCents),remaining:money(limitCents-used),
      projectedDue:money(future),projectedUsed:money(projectedUsed),projectedRemaining:money(limitCents-projectedUsed),
      ratio,alertThreshold:threshold,status:status(ratio),projectedStatus:status(projectedRatio)};
  });
}

export function normalizeBudget(input:MonthlyBudget):MonthlyBudget{
  const amount=Number(input.amount);
  if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(input.month))throw new Error('Διάλεξε έγκυρο μήνα για το budget.');
  if(!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(cents(amount))||Math.abs(amount*100-cents(amount))>1e-6)
    throw new Error('Το όριο budget πρέπει να είναι θετικό ποσό σε ακριβή λεπτά ευρώ.');
  const category=input.scope==='overall'?undefined:input.category?.trim();
  const subcategory=input.scope==='subcategory'?input.subcategory?.trim():undefined;
  if(input.scope!=='category'&&input.scope!=='subcategory'&&input.scope!=='overall')
    throw new Error('Διάλεξε έγκυρο τύπο προϋπολογισμού.');
  if(input.scope!=='overall'&&!category)throw new Error('Διάλεξε κατηγορία για το συγκεκριμένο budget.');
  if(input.scope==='subcategory'&&!subcategory)throw new Error('Διάλεξε υποκατηγορία για το όριο.');
  const alertThreshold=Math.min(.99,Math.max(.5,Number(input.alertThreshold??DEFAULT_ALERT_THRESHOLD)));
  return {...input,amount:money(cents(amount)),category,subcategory,
    categoryIdentityId:input.scope==='overall'?undefined:input.categoryIdentityId,
    subcategoryIdentityId:input.scope==='subcategory'?input.subcategoryIdentityId:undefined,
    carryover:input.carryover===true,alertThreshold};
}

export function budgetStableId(month:string,scope:BudgetScope,category?:string,subcategory?:string,categoryId?:string,subcategoryId?:string){
  const suffix=scope==='overall'?'overall':scope==='subcategory'
    ?`sub:${encodeURIComponent(categoryId||normalize(category))}:${encodeURIComponent(subcategoryId||normalize(subcategory))}`
    :encodeURIComponent(normalize(category));
  return `budget:${month}:${suffix}`;
}
