import { useMemo } from 'react';
import { categoryKey, categoryPath, categoryTree, genericCategoryTree } from '../lib/categories';
import type { FinanceSettings } from '../types';
import { AppSelectInput } from './AppSelectInput';

const VALUE_SEPARATOR='\u001f';
const encodeSelection=(category:string,subcategory:string)=>subcategory?`${category}${VALUE_SEPARATOR}${subcategory}`:category;
const decodeSelection=(value:string)=>{
  const separator=value.indexOf(VALUE_SEPARATOR);
  return separator<0?{category:value,subcategory:''}:{category:value.slice(0,separator),subcategory:value.slice(separator+1)};
};

export type CategorySelection={category:string;subcategory:string};

type CategorySelectInputProps={
  settings:FinanceSettings;
  kind:'expense'|'income';
  category:string;
  subcategory?:string;
  onChange:(selection:CategorySelection)=>void;
  genericOnly?:boolean;
  includeSubcategories?:boolean;
  allowEmpty?:boolean;
  emptyLabel?:string;
  disabled?:boolean;
  className?:string;
  id?:string;
  'aria-label'?:string;
};

export function CategorySelectInput({settings,kind,category,subcategory='',onChange,genericOnly=false,includeSubcategories=true,allowEmpty=false,emptyLabel='Χωρίς κατηγορία',disabled=false,className='',id,'aria-label':ariaLabel='Κατηγορία'}:CategorySelectInputProps){
  const tree=useMemo(()=>genericOnly?genericCategoryTree(settings,kind):categoryTree(settings,kind),[settings,kind,genericOnly]);
  const categoryDefinition=tree.find(item=>categoryKey(item.name)===categoryKey(category));
  const canonicalCategory=categoryDefinition?.name??category;
  const canonicalSubcategory=includeSubcategories&&subcategory&&categoryDefinition?.subcategories.find(item=>categoryKey(item)===categoryKey(subcategory))||subcategory;
  const validCurrent=!category||(Boolean(categoryDefinition)&&(!includeSubcategories||!subcategory||categoryDefinition!.subcategories.some(item=>categoryKey(item)===categoryKey(subcategory))));
  const value=category?encodeSelection(canonicalCategory,includeSubcategories?canonicalSubcategory:''):'';

  return <AppSelectInput id={id} value={value} disabled={disabled} className={`category-select-input ${className}`.trim()} aria-label={ariaLabel} onChange={event=>onChange(decodeSelection(event.target.value))}>
    {allowEmpty?<option value="">{emptyLabel}</option>:null}
    {!validCurrent&&category?<option value={value} disabled data-option-level="invalid" data-trigger-label={categoryPath(category,includeSubcategories?subcategory:undefined)}>Μη διαθέσιμη · {categoryPath(category,includeSubcategories?subcategory:undefined)}</option>:null}
    {tree.flatMap(item=>[
      <option key={`category:${item.name}`} value={encodeSelection(item.name,'')} data-option-level="category" data-trigger-label={item.name}>{item.name}</option>,
      ...(includeSubcategories?item.subcategories.map(sub=><option key={`subcategory:${item.name}:${sub}`} value={encodeSelection(item.name,sub)} data-option-level="subcategory" data-trigger-label={categoryPath(item.name,sub)}>{sub}</option>):[]),
    ])}
  </AppSelectInput>;
}
