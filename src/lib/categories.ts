import type { CategoryDefinition, FinanceSettings } from '../types.js';

const seedSubcategories: Record<string,string[]> = {
  'οχημα':['Καύσιμα','Συντήρηση & Service','Ασφάλεια','Parking & Διόδια'],
  'αυτοκινητο':['Καύσιμα','Συντήρηση & Service','Ασφάλεια','Parking & Διόδια'],
  'μηχανη':['Καύσιμα','Συντήρηση & Service','Ασφάλεια','Parking & Διόδια'],
};
const DOMAIN_CATEGORY_PATTERNS=[/συνδρομ/i,/πάγι/i,/δόσ/i,/δάνει/i,/πιστωτικ/i];
const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
export const categoryKey=(value:string)=>clean(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('el-GR');
const unique=(values:string[])=>{const seen=new Set<string>();const result:string[]=[];for(const value of values){const label=clean(value);if(!label)continue;const key=categoryKey(label);if(seen.has(key))continue;seen.add(key);result.push(label)}return result};

export function normalizeCategoryTree(tree:CategoryDefinition[]):CategoryDefinition[]{
  const result:CategoryDefinition[]=[];
  for(const item of tree){
    const name=clean(item.name);
    if(!name)continue;
    const key=categoryKey(name);
    const subcategories=unique(item.subcategories??[]);
    const existing=result.find(candidate=>categoryKey(candidate.name)===key);
    if(existing)existing.subcategories=unique([...existing.subcategories,...subcategories]);
    else result.push({name,subcategories});
  }
  return result;
}

export function categoryTree(settings:FinanceSettings,kind:'expense'|'income'):CategoryDefinition[]{
  const configured=kind==='expense'?settings.expenseCategoryTree:settings.incomeCategoryTree;
  if(configured?.length)return normalizeCategoryTree(configured);
  const flat=kind==='expense'?settings.expenseCategories:settings.incomeCategories;
  return unique(flat).map(name=>({name,subcategories:seedSubcategories[categoryKey(name)]??[]}));
}

export function genericCategoryTree(settings:FinanceSettings,kind:'expense'|'income'){
  const tree=categoryTree(settings,kind);
  if(kind==='income')return tree;
  const generic=tree.filter(item=>!DOMAIN_CATEGORY_PATTERNS.some(pattern=>pattern.test(item.name)));
  return generic.length?generic:tree;
}

export function subcategoriesFor(settings:FinanceSettings,kind:'expense'|'income',category:string){
  const key=categoryKey(category);
  return categoryTree(settings,kind).find(item=>categoryKey(item.name)===key)?.subcategories??[];
}

export function categoryPath(category?:string,subcategory?:string){
  if(!category)return 'Άλλο';
  return subcategory?`${category} › ${subcategory}`:category;
}

export function parseCategoryTree(raw:string):CategoryDefinition[]{
  const rows=raw.split('\n').map(row=>row.trim()).filter(Boolean);
  const parsed:CategoryDefinition[]=[];
  for(const row of rows){
    const [category,...rest]=row.split('>');
    const name=clean(category??'');
    if(!name)continue;
    parsed.push({name,subcategories:unique(rest.join('>').split(',').map(value=>value.trim()))});
  }
  return normalizeCategoryTree(parsed);
}

export function formatCategoryTree(tree:CategoryDefinition[]){
  return normalizeCategoryTree(tree).map(item=>item.subcategories.length?`${item.name} > ${item.subcategories.join(', ')}`:item.name).join('\n');
}
