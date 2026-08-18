import type { CategoryDefinition, FinanceSettings } from '../types';

const seedSubcategories: Record<string,string[]> = {
  'όχημα':['Βενζίνη','Service','Συνεργείο','Ανταλλακτικά'],
  'αυτοκίνητο':['Βενζίνη','Service','Συνεργείο','Ανταλλακτικά'],
  'μηχανή':['Βενζίνη','Service','Συνεργείο','Ανταλλακτικά'],
};
const DOMAIN_CATEGORY_PATTERNS=[/συνδρομ/i,/πάγι/i,/δόσ/i,/δάνει/i,/πιστωτικ/i];
const norm=(value:string)=>value.trim().toLocaleLowerCase('el-GR');
const unique=(values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))];

export function categoryTree(settings:FinanceSettings,kind:'expense'|'income'):CategoryDefinition[]{
  const configured=kind==='expense'?settings.expenseCategoryTree:settings.incomeCategoryTree;
  if(configured?.length)return configured.map(item=>({name:item.name.trim(),subcategories:unique(item.subcategories)})).filter(item=>item.name);
  const flat=kind==='expense'?settings.expenseCategories:settings.incomeCategories;
  return unique(flat).map(name=>({name,subcategories:seedSubcategories[norm(name)]??[]}));
}

export function genericCategoryTree(settings:FinanceSettings,kind:'expense'|'income'){
  const tree=categoryTree(settings,kind);
  if(kind==='income')return tree;
  const generic=tree.filter(item=>!DOMAIN_CATEGORY_PATTERNS.some(pattern=>pattern.test(item.name)));
  return generic.length?generic:tree;
}

export function subcategoriesFor(settings:FinanceSettings,kind:'expense'|'income',category:string){
  return categoryTree(settings,kind).find(item=>item.name===category)?.subcategories??[];
}

export function categoryPath(category?:string,subcategory?:string){
  if(!category)return 'Άλλο';
  return subcategory?`${category} › ${subcategory}`:category;
}

export function parseCategoryTree(raw:string):CategoryDefinition[]{
  const rows=raw.split('\n').map(row=>row.trim()).filter(Boolean);
  const result:CategoryDefinition[]=[];
  for(const row of rows){
    const [category,...rest]=row.split('>');
    const name=category?.trim();
    if(!name)continue;
    const subcategories=unique(rest.join('>').split(',').map(value=>value.trim()));
    const existing=result.find(item=>norm(item.name)===norm(name));
    if(existing)existing.subcategories=unique([...existing.subcategories,...subcategories]);
    else result.push({name,subcategories});
  }
  return result;
}

export function formatCategoryTree(tree:CategoryDefinition[]){
  return tree.map(item=>item.subcategories.length?`${item.name} > ${item.subcategories.join(', ')}`:item.name).join('\n');
}
