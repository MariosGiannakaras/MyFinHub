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
  | {type:'move-subcategory';kind:CategoryKind;identityId:string;targetCategoryId:string};

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
    return {...item,category:toCategory,...(fromSubcategory!==undefined?{subcategory:toSubcategory}:null)};
  });
}

function reconcileRules(data:FinanceData,fromCategory:string,toCategory:string,fromSubcategory?:string,toSubcategory?:string){
  return (data.state.transactionRules??[]).map(rule=>{
    if(!same(rule.action.category,fromCategory))return rule;
    if(fromSubcategory!==undefined&&!same(rule.action.subcategory,fromSubcategory))return rule;
    return {...rule,action:{...rule.action,category:toCategory,...(fromSubcategory!==undefined?{subcategory:toSubcategory}:null)}};
  });
}

function reconcileBudgets(data:FinanceData,asOf:string,fromCategory:string,toCategory:string){
  const currentMonth=asOf.slice(0,7);
  return (data.state.budgets??[]).map(budget=>budget.scope==='category'&&budget.month>=currentMonth&&same(budget.category,fromCategory)?{...budget,category:toCategory}:budget);
}

export function applyTaxonomyOperation(data:FinanceData,operation:TaxonomyOperation,asOf:string):FinanceData{
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
