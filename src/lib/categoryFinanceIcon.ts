import type { FinanceSettings } from '../types.js';
import { explicitCategoryIcon, explicitSubcategoryIcon, resolvedCategoryIcon, type CategoryKind } from './categoryIconPreferences.js';
import { ensureCategoryIdentities, resolveCategoryIdentity, resolveSubcategoryIdentity } from './categoryIdentity.js';
import type { FinanceIconInput } from './financeIcons.js';

export function financeCategoryKind(input:FinanceIconInput):CategoryKind{
  return input.kind?.trim().toLocaleLowerCase('el-GR')==='income'?'income':'expense';
}

export function explicitFinanceCategoryIcon(settings:FinanceSettings,input:FinanceIconInput):string|null{
  const category=input.category?.trim();
  if(!category)return null;
  const kind=financeCategoryKind(input);
  const normalized=ensureCategoryIdentities(settings);
  const categoryIdentity=resolveCategoryIdentity(normalized,kind,category);
  if(!categoryIdentity)return resolvedCategoryIcon(normalized,kind,category,input.subcategory?.trim()||undefined);

  const subcategory=input.subcategory?.trim();
  if(subcategory){
    const subcategoryIdentity=resolveSubcategoryIdentity(normalized,kind,category,subcategory);
    if(subcategoryIdentity?.parentId){
      const records=normalized.categoryIdentities??{};
      const currentParent=records[subcategoryIdentity.parentId];
      if(currentParent){
        return explicitSubcategoryIcon(normalized,kind,currentParent.label,subcategoryIdentity.label)
          ?? explicitCategoryIcon(normalized,kind,currentParent.label)
          ?? null;
      }
    }
  }

  return explicitCategoryIcon(normalized,kind,categoryIdentity.label)??null;
}
