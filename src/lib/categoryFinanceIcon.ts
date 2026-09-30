import type { CategoryIdentityRecord, FinanceSettings } from '../types.js';
import {
  explicitCategoryIcon,
  explicitSubcategoryIcon,
  resolvedCategoryIcon,
  resolvedCategoryIconColor,
  type CategoryKind,
} from './categoryIconPreferences.js';
import { ensureCategoryIdentities } from './categoryIdentity.js';
import { categoryKey } from './categories.js';
import type { FinanceIconInput } from './financeIcons.js';

function financeCategoryKind(input:FinanceIconInput):CategoryKind{
  return input.kind?.trim().toLocaleLowerCase('el-GR')==='income'?'income':'expense';
}

function matchesLabel(record:CategoryIdentityRecord,label:string){
  const key=categoryKey(label);
  return [record.label,...(record.aliases??[])].some(candidate=>categoryKey(candidate)===key);
}

function canonicalTarget(settings:FinanceSettings,input:FinanceIconInput){
  const category=input.category?.trim();
  if(!category)return null;
  const kind=financeCategoryKind(input);
  const normalized=ensureCategoryIdentities(settings);
  const records=normalized.categoryIdentities??{};
  const categoryIdentity=Object.values(records).find(record=>record.kind===kind&&record.parentId===undefined&&matchesLabel(record,category));
  if(!categoryIdentity)return {settings:normalized,kind,category,subcategory:input.subcategory?.trim()||undefined};

  const subcategory=input.subcategory?.trim();
  if(subcategory){
    const child=Object.values(records).find(record=>record.kind===kind&&(record.parentId===categoryIdentity.id||(record.parentAliases??[]).includes(categoryIdentity.id))&&matchesLabel(record,subcategory));
    if(child){
      const currentParent=child.parentId?records[child.parentId]:undefined;
      return {settings:normalized,kind,category:currentParent?.label??categoryIdentity.label,subcategory:child.label};
    }
  }
  return {settings:normalized,kind,category:categoryIdentity.label,subcategory:undefined};
}

type FinanceCategoryVisual={
  explicitKey:string|null;
  resolvedKey:string|null;
  color:string|null;
};

export function resolveFinanceCategoryVisual(settings:FinanceSettings,input:FinanceIconInput):FinanceCategoryVisual{
  const target=canonicalTarget(settings,input);
  if(!target)return {explicitKey:null,resolvedKey:null,color:null};
  const explicitKey=target.subcategory
    ? explicitSubcategoryIcon(target.settings,target.kind,target.category,target.subcategory)
      ?? explicitCategoryIcon(target.settings,target.kind,target.category)
      ?? null
    : explicitCategoryIcon(target.settings,target.kind,target.category)??null;
  const resolvedKey=explicitKey
    ?? (settings.categoryIconPack
      ? resolvedCategoryIcon(target.settings,target.kind,target.category,target.subcategory)??null
      : null);
  const color=resolvedCategoryIconColor(target.settings,target.kind,target.category,target.subcategory);
  return {explicitKey,resolvedKey,color};
}

export function explicitFinanceCategoryIcon(settings:FinanceSettings,input:FinanceIconInput):string|null{
  return resolveFinanceCategoryVisual(settings,input).explicitKey;
}
