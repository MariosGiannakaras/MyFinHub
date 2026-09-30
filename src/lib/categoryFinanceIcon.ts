import type { FinanceSettings } from '../types.js';
import {
  explicitCategoryIcon,
  explicitSubcategoryIcon,
  resolvedCategoryIcon,
  resolvedCategoryIconColor,
  type CategoryKind,
} from './categoryIconPreferences.js';
import { ensureCategoryIdentities, resolveCategoryIdentity, resolveSubcategoryIdentity } from './categoryIdentity.js';
import type { FinanceIconInput } from './financeIcons.js';

function financeCategoryKind(input:FinanceIconInput):CategoryKind{
  return input.kind?.trim().toLocaleLowerCase('el-GR')==='income'?'income':'expense';
}

function canonicalTarget(settings:FinanceSettings,input:FinanceIconInput){
  const category=input.category?.trim();
  if(!category)return null;
  const kind=financeCategoryKind(input);
  const normalized=ensureCategoryIdentities(settings);
  const categoryIdentity=resolveCategoryIdentity(normalized,kind,category);
  if(!categoryIdentity)return {settings:normalized,kind,category,subcategory:input.subcategory?.trim()||undefined};

  const subcategory=input.subcategory?.trim();
  if(subcategory){
    const subcategoryIdentity=resolveSubcategoryIdentity(normalized,kind,category,subcategory);
    if(subcategoryIdentity?.parentId){
      const records=normalized.categoryIdentities??{};
      const currentParent=records[subcategoryIdentity.parentId];
      if(currentParent)return {settings:normalized,kind,category:currentParent.label,subcategory:subcategoryIdentity.label};
    }
  }
  return {settings:normalized,kind,category:categoryIdentity.label,subcategory:undefined};
}

export function explicitFinanceCategoryIcon(settings:FinanceSettings,input:FinanceIconInput):string|null{
  const target=canonicalTarget(settings,input);
  if(!target)return null;
  if(target.subcategory){
    return explicitSubcategoryIcon(target.settings,target.kind,target.category,target.subcategory)
      ?? explicitCategoryIcon(target.settings,target.kind,target.category)
      ?? null;
  }
  return explicitCategoryIcon(target.settings,target.kind,target.category)??null;
}

export function resolvedFinanceCategoryIcon(settings:FinanceSettings,input:FinanceIconInput):string|null{
  const target=canonicalTarget(settings,input);
  if(!target)return null;
  return resolvedCategoryIcon(target.settings,target.kind,target.category,target.subcategory)??null;
}

export function resolvedFinanceCategoryIconColor(settings:FinanceSettings,input:FinanceIconInput):string|null{
  const target=canonicalTarget(settings,input);
  if(!target)return null;
  return resolvedCategoryIconColor(target.settings,target.kind,target.category,target.subcategory);
}
