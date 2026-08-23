import type { CategoryDefinition, CategoryIdentityRecord, FinanceSettings } from '../types.js';
import { categoryKey, categoryTree } from './categories.js';
import { renameCategoryIconPreferences, subcategoryIconPreferenceKey } from './categoryIconPreferences.js';

export type CategoryKind=CategoryIdentityRecord['kind'];

const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
const sameLabel=(a:string,b:string)=>categoryKey(a)===categoryKey(b);
const uniqueLabels=(values:string[])=>{
  const seen=new Set<string>();
  const result:string[]=[];
  for(const value of values){
    const label=clean(value);
    if(!label)continue;
    const key=categoryKey(label);
    if(seen.has(key))continue;
    seen.add(key);
    result.push(label);
  }
  return result;
};
const uniqueIds=(values:string[])=>[...new Set(values.filter(Boolean))];

function hashToken(value:string){
  let hash=2166136261;
  for(let index=0;index<value.length;index+=1){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(36);
}

function generatedIdentityId(kind:CategoryKind,label:string,parentId?:string){
  const scope=parentId?`sub:${parentId}`:'category';
  return `${parentId?'sub':'cat'}-${kind}-${hashToken(`${kind}|${scope}|${categoryKey(label)}`)}`;
}

function parentMatches(record:CategoryIdentityRecord,parentId:string|undefined){
  if(parentId===undefined)return record.parentId===undefined;
  return record.parentId===parentId||(record.parentAliases??[]).includes(parentId);
}

function recordMatches(record:CategoryIdentityRecord,kind:CategoryKind,parentId:string|undefined,label:string){
  if(record.kind!==kind||!parentMatches(record,parentId))return false;
  return [record.label,...(record.aliases??[])].some(candidate=>sameLabel(candidate,label));
}

function findRecord(records:Record<string,CategoryIdentityRecord>,kind:CategoryKind,parentId:string|undefined,label:string){
  return Object.values(records).find(record=>recordMatches(record,kind,parentId,label));
}

function availableId(records:Record<string,CategoryIdentityRecord>,kind:CategoryKind,label:string,parentId?:string){
  const base=generatedIdentityId(kind,label,parentId);
  if(!records[base])return base;
  let suffix=2;
  while(records[`${base}-${suffix}`])suffix+=1;
  return `${base}-${suffix}`;
}

function normalizedRecord(record:CategoryIdentityRecord,label:string):CategoryIdentityRecord{
  const previous=clean(record.label);
  const current=clean(label);
  const aliases=uniqueLabels([...(record.aliases??[]),...(previous&&!sameLabel(previous,current)?[previous]:[])]).filter(alias=>!sameLabel(alias,current));
  const parentAliases=record.parentId===undefined?undefined:uniqueIds(record.parentAliases??[]).filter(id=>id!==record.parentId);
  return {...record,label:current,aliases,parentAliases};
}

export function ensureCategoryIdentities(settings:FinanceSettings):FinanceSettings{
  const records:Record<string,CategoryIdentityRecord>={};
  for(const [id,record] of Object.entries(settings.categoryIdentities??{})){
    if(!record||record.id!==id||(record.kind!=='expense'&&record.kind!=='income')||!clean(record.label))continue;
    records[id]={...record,label:clean(record.label),aliases:uniqueLabels(record.aliases??[]),parentAliases:record.parentId===undefined?undefined:uniqueIds(record.parentAliases??[]).filter(parentId=>parentId!==record.parentId)};
  }

  for(const kind of ['expense','income'] as const){
    for(const category of categoryTree(settings,kind)){
      const current=findRecord(records,kind,undefined,category.name);
      const categoryId=current?.id??availableId(records,kind,category.name);
      records[categoryId]=normalizedRecord(current??{id:categoryId,kind,label:category.name,aliases:[]},category.name);

      for(const subcategory of category.subcategories){
        const child=findRecord(records,kind,categoryId,subcategory);
        const childId=child?.id??availableId(records,kind,subcategory,categoryId);
        const currentChild=child??{id:childId,kind,label:subcategory,aliases:[],parentId:categoryId};
        records[childId]=normalizedRecord({...currentChild,parentId:categoryId},subcategory);
      }
    }
  }
  return {...settings,categoryIdentities:records};
}

export function resolveCategoryIdentity(settings:FinanceSettings,kind:CategoryKind,category:string){
  const normalized=ensureCategoryIdentities(settings);
  return findRecord(normalized.categoryIdentities??{},kind,undefined,category)??null;
}

export function resolveSubcategoryIdentity(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string){
  const normalized=ensureCategoryIdentities(settings);
  const records=normalized.categoryIdentities??{};
  const parent=findRecord(records,kind,undefined,category);
  if(!parent)return null;
  return findRecord(records,kind,parent.id,subcategory)??null;
}

function withTree(settings:FinanceSettings,kind:CategoryKind,tree:CategoryDefinition[]){
  return kind==='expense'
    ? {...settings,expenseCategories:tree.map(item=>item.name),expenseCategoryTree:tree}
    : {...settings,incomeCategories:tree.map(item=>item.name),incomeCategoryTree:tree};
}

export function renameCategoryIdentity(settings:FinanceSettings,kind:CategoryKind,identityId:string,nextRawLabel:string):FinanceSettings{
  const nextLabel=clean(nextRawLabel);
  if(!nextLabel)throw new Error('Η κατηγορία χρειάζεται όνομα.');
  const normalized=ensureCategoryIdentities(settings);
  const records={...(normalized.categoryIdentities??{})};
  const record=records[identityId];
  if(!record||record.kind!==kind||record.parentId)throw new Error('Η κατηγορία δεν βρέθηκε.');
  const tree=categoryTree(normalized,kind).map(item=>({...item,subcategories:[...item.subcategories]}));
  const index=tree.findIndex(item=>sameLabel(item.name,record.label));
  if(index<0)throw new Error('Η κατηγορία δεν υπάρχει πλέον στο δέντρο.');
  if(tree.some((item,itemIndex)=>itemIndex!==index&&sameLabel(item.name,nextLabel)))throw new Error('Υπάρχει ήδη κατηγορία με αυτό το όνομα.');
  const previousLabel=tree[index].name;
  tree[index]={...tree[index],name:nextLabel};
  records[identityId]=normalizedRecord(record,nextLabel);
  const iconMigrated=renameCategoryIconPreferences(normalized,kind,previousLabel,nextLabel);
  return withTree({...iconMigrated,categoryIdentities:records},kind,tree);
}

export function renameSubcategoryIdentity(settings:FinanceSettings,kind:CategoryKind,identityId:string,nextRawLabel:string):FinanceSettings{
  const nextLabel=clean(nextRawLabel);
  if(!nextLabel)throw new Error('Η υποκατηγορία χρειάζεται όνομα.');
  const normalized=ensureCategoryIdentities(settings);
  const records={...(normalized.categoryIdentities??{})};
  const record=records[identityId];
  if(!record||record.kind!==kind||!record.parentId)throw new Error('Η υποκατηγορία δεν βρέθηκε.');
  const parent=records[record.parentId];
  if(!parent)throw new Error('Η γονική κατηγορία δεν βρέθηκε.');
  const tree=categoryTree(normalized,kind).map(item=>({...item,subcategories:[...item.subcategories]}));
  const parentIndex=tree.findIndex(item=>sameLabel(item.name,parent.label));
  if(parentIndex<0)throw new Error('Η γονική κατηγορία δεν υπάρχει πλέον στο δέντρο.');
  const childIndex=tree[parentIndex].subcategories.findIndex(label=>sameLabel(label,record.label));
  if(childIndex<0)throw new Error('Η υποκατηγορία δεν υπάρχει πλέον στο δέντρο.');
  if(tree[parentIndex].subcategories.some((label,index)=>index!==childIndex&&sameLabel(label,nextLabel)))throw new Error('Υπάρχει ήδη υποκατηγορία με αυτό το όνομα.');
  const previousLabel=tree[parentIndex].subcategories[childIndex];
  tree[parentIndex].subcategories[childIndex]=nextLabel;
  records[identityId]=normalizedRecord(record,nextLabel);
  const subcategoryIcons={...(normalized.subcategoryIcons??{})};
  const oldIconKey=subcategoryIconPreferenceKey(kind,parent.label,previousLabel);
  const newIconKey=subcategoryIconPreferenceKey(kind,parent.label,nextLabel);
  if(subcategoryIcons[oldIconKey]){subcategoryIcons[newIconKey]=subcategoryIcons[oldIconKey];delete subcategoryIcons[oldIconKey]}
  return withTree({...normalized,subcategoryIcons,categoryIdentities:records},kind,tree);
}

export function moveSubcategoryIdentity(settings:FinanceSettings,kind:CategoryKind,identityId:string,targetCategoryId:string):FinanceSettings{
  const normalized=ensureCategoryIdentities(settings);
  const records={...(normalized.categoryIdentities??{})};
  const record=records[identityId];
  const target=records[targetCategoryId];
  if(!record||record.kind!==kind||!record.parentId)throw new Error('Η υποκατηγορία δεν βρέθηκε.');
  if(!target||target.kind!==kind||target.parentId)throw new Error('Η κατηγορία προορισμού δεν βρέθηκε.');
  if(record.parentId===target.id)return normalized;
  const source=records[record.parentId];
  if(!source)throw new Error('Η αρχική κατηγορία δεν βρέθηκε.');
  const tree=categoryTree(normalized,kind).map(item=>({...item,subcategories:[...item.subcategories]}));
  const sourceIndex=tree.findIndex(item=>sameLabel(item.name,source.label));
  const targetIndex=tree.findIndex(item=>sameLabel(item.name,target.label));
  if(sourceIndex<0||targetIndex<0)throw new Error('Η μεταφορά δεν μπορεί να ολοκληρωθεί στο τρέχον δέντρο.');
  if(tree[targetIndex].subcategories.some(label=>sameLabel(label,record.label)))throw new Error('Η κατηγορία προορισμού έχει ήδη υποκατηγορία με αυτό το όνομα.');
  tree[sourceIndex].subcategories=tree[sourceIndex].subcategories.filter(label=>!sameLabel(label,record.label));
  tree[targetIndex].subcategories=[...tree[targetIndex].subcategories,record.label];
  records[identityId]={...record,parentId:target.id,parentAliases:uniqueIds([...(record.parentAliases??[]),source.id]).filter(parentId=>parentId!==target.id)};
  const subcategoryIcons={...(normalized.subcategoryIcons??{})};
  const oldIconKey=subcategoryIconPreferenceKey(kind,source.label,record.label);
  const newIconKey=subcategoryIconPreferenceKey(kind,target.label,record.label);
  if(subcategoryIcons[oldIconKey]){subcategoryIcons[newIconKey]=subcategoryIcons[oldIconKey];delete subcategoryIcons[oldIconKey]}
  return withTree({...normalized,subcategoryIcons,categoryIdentities:records},kind,tree);
}
