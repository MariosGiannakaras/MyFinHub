import type { FinanceSettings } from '../types.js';
import { categoryIconByKey } from './categoryIconRegistry.js';

export type CategoryKind='expense'|'income';

const clean=(value:string)=>value.trim();
export function categoryIconPreferenceKey(kind:CategoryKind,category:string){return `${kind}:${clean(category)}`}
export function subcategoryIconPreferenceKey(kind:CategoryKind,category:string,subcategory:string){return `${kind}:${clean(category)}:${clean(subcategory)}`}

export function explicitCategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string){
  const key=settings.categoryIcons?.[categoryIconPreferenceKey(kind,category)];
  return key&&categoryIconByKey(key)?key:null;
}

export function explicitSubcategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string){
  const key=settings.subcategoryIcons?.[subcategoryIconPreferenceKey(kind,category,subcategory)];
  return key&&categoryIconByKey(key)?key:null;
}

export function resolvedCategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory?:string){
  return (subcategory&&explicitSubcategoryIcon(settings,kind,category,subcategory))||explicitCategoryIcon(settings,kind,category)||null;
}

export function withCategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string,iconKey:string|null):FinanceSettings{
  const key=categoryIconPreferenceKey(kind,category);
  const next={...(settings.categoryIcons??{})};
  if(iconKey&&categoryIconByKey(iconKey))next[key]=iconKey;else delete next[key];
  return {...settings,categoryIcons:next};
}

export function withSubcategoryIconOverride(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string,iconKey:string|null):FinanceSettings{
  const key=subcategoryIconPreferenceKey(kind,category,subcategory);
  const next={...(settings.subcategoryIcons??{})};
  if(iconKey&&categoryIconByKey(iconKey))next[key]=iconKey;else delete next[key];
  return {...settings,subcategoryIcons:next};
}

export function renameCategoryIconPreferences(settings:FinanceSettings,kind:CategoryKind,from:string,to:string):FinanceSettings{
  const oldCategoryKey=categoryIconPreferenceKey(kind,from);
  const newCategoryKey=categoryIconPreferenceKey(kind,to);
  const categoryIcons={...(settings.categoryIcons??{})};
  if(categoryIcons[oldCategoryKey]){categoryIcons[newCategoryKey]=categoryIcons[oldCategoryKey];delete categoryIcons[oldCategoryKey]}
  const subcategoryIcons:Record<string,string>={};
  const oldPrefix=`${kind}:${clean(from)}:`;
  for(const [key,value] of Object.entries(settings.subcategoryIcons??{}))subcategoryIcons[key.startsWith(oldPrefix)?`${kind}:${clean(to)}:${key.slice(oldPrefix.length)}`:key]=value;
  return {...settings,categoryIcons,subcategoryIcons};
}

export function removeCategoryIconPreferences(settings:FinanceSettings,kind:CategoryKind,category:string):FinanceSettings{
  const categoryIcons={...(settings.categoryIcons??{})};
  delete categoryIcons[categoryIconPreferenceKey(kind,category)];
  const prefix=`${kind}:${clean(category)}:`;
  const subcategoryIcons=Object.fromEntries(Object.entries(settings.subcategoryIcons??{}).filter(([key])=>!key.startsWith(prefix)));
  return {...settings,categoryIcons,subcategoryIcons};
}
