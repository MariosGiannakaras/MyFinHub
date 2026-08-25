import type { CategoryDefinition, FinanceData, FinanceSettings, RecurringItem } from '../types.js';
import { categoryKey, categoryTree } from './categories.js';
import {
  categoryIdentityLabelAvailable,
  ensureCategoryIdentities,
  moveSubcategoryIdentity,
  renameCategoryIdentity,
  renameSubcategoryIdentity,
  resolveCategoryIdentity,
  resolveSubcategoryIdentity,
  retireCategoryIdentity,
  retireSubcategoryIdentity,
  subcategoryIdentityLabelAvailable,
  type CategoryKind,
} from './categoryIdentity.js';

export type TaxonomyDirection='up'|'down';
export type TaxonomyOperation=
  | {type:'add-category';kind:CategoryKind;label:string}
  | {type:'add-subcategory';kind:CategoryKind;parentId:string;label:string}
  | {type:'rename-category';kind:CategoryKind;identityId:string;label:string}
  | {type:'rename-subcategory';kind:CategoryKind;identityId:string;label:string}
  | {type:'reorder-category';kind:CategoryKind;identityId:string;direction:TaxonomyDirection}
  | {type:'reorder-subcategory';kind:CategoryKind;identityId:string;direction:TaxonomyDirection}
  | {type:'move-subcategory';kind:CategoryKind;identityId:string;targetCategoryId:string}
  | {type:'retire-category';kind:CategoryKind;identityId:string}
  | {type:'retire-subcategory';kind:CategoryKind;identityId:string};

export type TaxonomyRetirementDependency={
  kind:'subcategory'|'recurring'|'scheduled'|'rule'|'budget';
  id:string;
  label:string;
};

type RetirementOperation=Extract<TaxonomyOperation,{type:'retire-category'|'retire-subcategory'}>;

const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
const same=(left?:string,right?:string)=>Boolean(left&&right&&categoryKey(left)===categoryKey(right));

function withTree(settings:FinanceSettings,kind:CategoryKind,tree:CategoryDefinition[]):FinanceSettings{
  return kind==='expense'
    ? {...settings,expenseCategories:tree.map(item=>item.name),expenseCategoryTree:tree}
    : {...settings,incomeCategories:tree.map(item=>item.name),incomeCategoryTree:tree};
}

function cloneTree(settings:FinanceSettings,kind:CategoryKind){
  return categoryTree(settings,kind).map(item=>({...item,subcategories:[...item.subcategories]}));
}

function swap<T>(items:T[],index:number,direction:TaxonomyDirection){
  const target=direction==='up'?index-1:index+1;
  if(index<0||target<0||target>=items.length)return items;
  const next=[...items];
  [next[index],next[target]]=[next[target],next[index]];
  return next;
}

function effectiveRecurringItems(data:FinanceData):RecurringItem[]{
  const seeded=(data.seed.recurring??[]).map(item=>data.state.recurringOverrides?.[item.id]??item);
  return [...seeded,...(data.state.recurringCustom??[])];
}

function recurringIsLive(item:RecurringItem){
  return item.active!==false&&item.status!=='stopped';
}

function dependency(kind:TaxonomyRetirementDependency['kind'],id:string,label:string):TaxonomyRetirementDependency{
  return {kind,id,label};
}

function dependencySummary(items:TaxonomyRetirementDependency[]){
  const labels=items.slice(0,4).map(item=>item.label).join(', ');
  return `Η απόσυρση μπλοκάρεται από ${items.length} ενεργές ή μελλοντικές αναφορές${labels?`: ${labels}`:''}${items.length>4?'…':''}. Τακτοποίησέ τες ρητά πριν συνεχίσεις.`;
}

export function taxonomyRetirementDependencies(data:FinanceData,operation:RetirementOperation,asOf:string):TaxonomyRetirementDependency[]{
  const settings=ensureCategoryIdentities(data.state.settings);
  const record=settings.categoryIdentities?.[operation.identityId];
  if(!record||record.kind!==operation.kind)throw new Error(operation.type==='retire-category'?'Η κατηγορία δεν βρέθηκε.':'Η υποκατηγορία δεν βρέθηκε.');
  if(operation.type==='retire-category'&&record.parentId)throw new Error('Η κατηγορία δεν βρέθηκε.');
  if(operation.type==='retire-subcategory'&&!record.parentId)throw new Error('Η υποκατηγορία δεν βρέθηκε.');

  const result:TaxonomyRetirementDependency[]=[];
  const currentMonth=asOf.slice(0,7);

  if(operation.type==='retire-category'){
    const treeEntry=categoryTree(settings,operation.kind).find(item=>resolveCategoryIdentity(settings,operation.kind,item.name)?.id===record.id);
    if(!treeEntry)throw new Error('Η κατηγορία έχει ήδη αποσυρθεί από το ενεργό δέντρο.');
    for(const childLabel of treeEntry.subcategories){
      const child=resolveSubcategoryIdentity(settings,operation.kind,treeEntry.name,childLabel);
      result.push(dependency('subcategory',child?.id??childLabel,`Υποκατηγορία «${childLabel}»`));
    }
    for(const item of effectiveRecurringItems(data)){
      if(!recurringIsLive(item))continue;
      if(resolveCategoryIdentity(settings,operation.kind,item.category)?.id===record.id)result.push(dependency('recurring',item.id,`Recurring «${item.name}»`));
    }
    for(const item of data.state.scheduled??[]){
      if(item.status!=='pending'||!item.category)continue;
      if(resolveCategoryIdentity(settings,operation.kind,item.category)?.id===record.id)result.push(dependency('scheduled',item.id,`Προγραμματισμένη «${item.note||item.id}»`));
    }
    for(const rule of data.state.transactionRules??[]){
      if(!rule.enabled||!rule.action.category)continue;
      if(resolveCategoryIdentity(settings,operation.kind,rule.action.category)?.id===record.id)result.push(dependency('rule',rule.id,`Κανόνας «${rule.name}»`));
    }
    for(const budget of data.state.budgets??[]){
      if(budget.scope!=='category'||budget.month<currentMonth||!budget.category)continue;
      if(resolveCategoryIdentity(settings,operation.kind,budget.category)?.id===record.id)result.push(dependency('budget',budget.id,`Budget ${budget.month}`));
    }
  }else{
    const parent=record.parentId?settings.categoryIdentities?.[record.parentId]:undefined;
    if(!parent)throw new Error('Η γονική κατηγορία δεν βρέθηκε.');
    const parentTree=categoryTree(settings,operation.kind).find(item=>resolveCategoryIdentity(settings,operation.kind,item.name)?.id===parent.id);
    if(!parentTree||!parentTree.subcategories.some(label=>resolveSubcategoryIdentity(settings,operation.kind,parentTree.name,label)?.id===record.id))throw new Error('Η υποκατηγορία έχει ήδη αποσυρθεί από το ενεργό δέντρο.');
    for(const item of data.state.scheduled??[]){
      if(item.status!=='pending'||!item.category||!item.subcategory)continue;
      if(resolveSubcategoryIdentity(settings,operation.kind,item.category,item.subcategory)?.id===record.id)result.push(dependency('scheduled',item.id,`Προγραμματισμένη «${item.note||item.id}»`));
    }
    for(const rule of data.state.transactionRules??[]){
      if(!rule.enabled||!rule.action.category||!rule.action.subcategory)continue;
      if(resolveSubcategoryIdentity(settings,operation.kind,rule.action.category,rule.action.subcategory)?.id===record.id)result.push(dependency('rule',rule.id,`Κανόνας «${rule.name}»`));
    }
  }

  return result.sort((a,b)=>a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label,'el')||a.id.localeCompare(b.id));
}

export function applyTaxonomyOperationToSettings(settings:FinanceSettings,operation:TaxonomyOperation):FinanceSettings{
  const normalized=ensureCategoryIdentities(settings);
  const label='label' in operation?clean(operation.label):'';

  if(operation.type==='add-category'){
    if(!label)throw new Error('Η κατηγορία χρειάζεται όνομα.');
    if(!categoryIdentityLabelAvailable(normalized,operation.kind,label))throw new Error('Το όνομα χρησιμοποιείται ήδη από άλλη κατηγορία ή παλιό όνομα.');
    const tree=cloneTree(normalized,operation.kind);
    return ensureCategoryIdentities(withTree(normalized,operation.kind,[...tree,{name:label,subcategories:[]}]))
  }

  if(operation.type==='add-subcategory'){
    if(!label)throw new Error('Η υποκατηγορία χρειάζεται όνομα.');
    const parent=normalized.categoryIdentities?.[operation.parentId];
    if(!parent||parent.kind!==operation.kind||parent.parentId)throw new Error('Η γονική κατηγορία δεν βρέθηκε.');
    if(!subcategoryIdentityLabelAvailable(normalized,operation.kind,parent.id,label))throw new Error('Το όνομα χρησιμοποιείται ήδη από άλλη υποκατηγορία ή παλιό όνομα σε αυτή την κατηγορία.');
    const tree=cloneTree(normalized,operation.kind);
    const index=tree.findIndex(item=>same(item.name,parent.label));
    if(index<0)throw new Error('Η γονική κατηγορία δεν υπάρχει πλέον στο δέντρο.');
    tree[index]={...tree[index],subcategories:[...tree[index].subcategories,label]};
    return ensureCategoryIdentities(withTree(normalized,operation.kind,tree));
  }

  if(operation.type==='rename-category')return renameCategoryIdentity(normalized,operation.kind,operation.identityId,label);
  if(operation.type==='rename-subcategory')return renameSubcategoryIdentity(normalized,operation.kind,operation.identityId,label);
  if(operation.type==='move-subcategory')return moveSubcategoryIdentity(normalized,operation.kind,operation.identityId,operation.targetCategoryId);
  if(operation.type==='retire-category')return retireCategoryIdentity(normalized,operation.kind,operation.identityId);
  if(operation.type==='retire-subcategory')return retireSubcategoryIdentity(normalized,operation.kind,operation.identityId);

  if(operation.type==='reorder-category'){
    const record=normalized.categoryIdentities?.[operation.identityId];
    if(!record||record.kind!==operation.kind||record.parentId)throw new Error('Η κατηγορία δεν βρέθηκε.');
    const tree=cloneTree(normalized,operation.kind);
    const index=tree.findIndex(item=>same(item.name,record.label));
    if(index<0)throw new Error('Η κατηγορία δεν υπάρχει πλέον στο δέντρο.');
    return ensureCategoryIdentities(withTree(normalized,operation.kind,swap(tree,index,operation.direction)));
  }

  const record=normalized.categoryIdentities?.[operation.identityId];
  if(!record||record.kind!==operation.kind||!record.parentId)throw new Error('Η υποκατηγορία δεν βρέθηκε.');
  const parent=normalized.categoryIdentities?.[record.parentId];
  if(!parent)throw new Error('Η γονική κατηγορία δεν βρέθηκε.');
  const tree=cloneTree(normalized,operation.kind);
  const parentIndex=tree.findIndex(item=>same(item.name,parent.label));
  if(parentIndex<0)throw new Error('Η γονική κατηγορία δεν υπάρχει πλέον στο δέντρο.');
  const childIndex=tree[parentIndex].subcategories.findIndex(item=>same(item,record.label));
  if(childIndex<0)throw new Error('Η υποκατηγορία δεν υπάρχει πλέον στο δέντρο.');
  tree[parentIndex]={...tree[parentIndex],subcategories:swap(tree[parentIndex].subcategories,childIndex,operation.direction)};
  return ensureCategoryIdentities(withTree(normalized,operation.kind,tree));
}

function reconcileRecurringCategory(data:FinanceData,fromCategory:string,toCategory:string){
  const recurringOverrides={...(data.state.recurringOverrides??{})};
  for(const seeded of data.seed.recurring??[]){
    const current=recurringOverrides[seeded.id]??seeded;
    if(same(current.category,fromCategory))recurringOverrides[seeded.id]={...current,category:toCategory};
  }
  const recurringCustom=(data.state.recurringCustom??[]).map(item=>same(item.category,fromCategory)?{...item,category:toCategory}:item);
  return {recurringOverrides,recurringCustom};
}

function reconcilePendingScheduled(data:FinanceData,fromCategory:string,toCategory:string,fromSubcategory?:string,toSubcategory?:string){
  return (data.state.scheduled??[]).map(item=>{
    if(item.status!=='pending'||!same(item.category,fromCategory))return item;
    if(fromSubcategory!==undefined&&!same(item.subcategory,fromSubcategory))return item;
    return {...item,category:toCategory,...(fromSubcategory!==undefined?{subcategory:toSubcategory}:{})};
  });
}

function reconcileRules(data:FinanceData,fromCategory:string,toCategory:string,fromSubcategory?:string,toSubcategory?:string){
  return (data.state.transactionRules??[]).map(rule=>{
    if(!same(rule.action.category,fromCategory))return rule;
    if(fromSubcategory!==undefined&&!same(rule.action.subcategory,fromSubcategory))return rule;
    return {...rule,action:{...rule.action,category:toCategory,...(fromSubcategory!==undefined?{subcategory:toSubcategory}:{})}};
  });
}

function reconcileBudgets(data:FinanceData,asOf:string,fromCategory:string,toCategory:string){
  const currentMonth=asOf.slice(0,7);
  return (data.state.budgets??[]).map(budget=>budget.scope==='category'&&budget.month>=currentMonth&&same(budget.category,fromCategory)?{...budget,category:toCategory}:budget);
}

export function applyTaxonomyOperation(data:FinanceData,operation:TaxonomyOperation,asOf:string):FinanceData{
  if(operation.type==='retire-category'||operation.type==='retire-subcategory'){
    const dependencies=taxonomyRetirementDependencies(data,operation,asOf);
    if(dependencies.length)throw new Error(dependencySummary(dependencies));
  }
  const before=ensureCategoryIdentities(data.state.settings);
  const nextSettings=applyTaxonomyOperationToSettings(before,operation);
  let nextState={...data.state,settings:nextSettings};

  if(operation.type==='rename-category'){
    const previous=before.categoryIdentities?.[operation.identityId];
    const current=nextSettings.categoryIdentities?.[operation.identityId];
    if(previous&&current&&previous.parentId===undefined&&current.parentId===undefined&&!same(previous.label,current.label)){
      const recurring=reconcileRecurringCategory(data,previous.label,current.label);
      nextState={
        ...nextState,
        ...recurring,
        scheduled:reconcilePendingScheduled(data,previous.label,current.label),
        transactionRules:reconcileRules(data,previous.label,current.label),
        budgets:reconcileBudgets(data,asOf,previous.label,current.label),
      };
    }
  }

  if(operation.type==='rename-subcategory'||operation.type==='move-subcategory'){
    const previous=before.categoryIdentities?.[operation.identityId];
    const current=nextSettings.categoryIdentities?.[operation.identityId];
    const previousParent=previous?.parentId?before.categoryIdentities?.[previous.parentId]:undefined;
    const currentParent=current?.parentId?nextSettings.categoryIdentities?.[current.parentId]:undefined;
    if(previous&&current&&previousParent&&currentParent){
      nextState={
        ...nextState,
        scheduled:reconcilePendingScheduled(data,previousParent.label,currentParent.label,previous.label,current.label),
        transactionRules:reconcileRules(data,previousParent.label,currentParent.label,previous.label,current.label),
      };
    }
  }

  return {...data,state:nextState};
}

export function taxonomyOperationPreview(settings:FinanceSettings,operation:TaxonomyOperation){
  return applyTaxonomyOperationToSettings(settings,operation);
}

export function taxonomyCategoryId(settings:FinanceSettings,kind:CategoryKind,label:string){
  return resolveCategoryIdentity(settings,kind,label)?.id??null;
}

export function taxonomySubcategoryId(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string){
  return resolveSubcategoryIdentity(settings,kind,category,subcategory)?.id??null;
}
