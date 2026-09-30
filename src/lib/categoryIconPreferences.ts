import type { CategoryIconPackId, FinanceSettings } from '../types.js';
import { inferredCategoryIcon } from './categoryIconInference.js';
import { categoryIconByKey, decodeCategoryIconValue, encodeCategoryIconValue, type CategoryIconPack } from './categoryIconRegistry.js';
import { categoryIconFallbackKeyForPack, categoryIconKeySupportedByPack } from './categoryIconPackSupport.js';

export type CategoryKind='expense'|'income';

const PACKS:readonly CategoryIconPack[]=['lucide','tabler','phosphor','heroicons','bootstrap'];
const clean=(value:string)=>value.trim();

export function categoryIconPreferenceKey(kind:CategoryKind,category:string){return `${kind}:${clean(category)}`}
export function subcategoryIconPreferenceKey(kind:CategoryKind,category:string,subcategory:string){return `${kind}:${clean(category)}:${clean(subcategory)}`}

function validPack(value:unknown):value is CategoryIconPack{return typeof value==='string'&&PACKS.includes(value as CategoryIconPack)}
function validSemanticKey(value:unknown){
  if(typeof value!=='string')return null;
  const decoded=decodeCategoryIconValue(value);
  return categoryIconByKey(decoded.key)?.key??null;
}
function normalizedColor(value:unknown){
  if(typeof value!=='string')return null;
  const color=value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color)?color.toUpperCase():null;
}

export function activeCategoryIconPack(settings:FinanceSettings):CategoryIconPack{
  return validPack(settings.categoryIconPack)?settings.categoryIconPack:'lucide';
}

export function withCategoryIconPack(settings:FinanceSettings,pack:CategoryIconPack):FinanceSettings{
  return {...settings,categoryIconPack:pack};
}

function explicitForPack(
  selections:FinanceSettings['categoryIconPackSelections']|FinanceSettings['subcategoryIconPackSelections']|undefined,
  legacy:Record<string,string>|undefined,
  preferenceKey:string,
  pack:CategoryIconPack,
){
  const remembered=validSemanticKey(selections?.[preferenceKey]?.[pack]);
  if(remembered&&categoryIconKeySupportedByPack(pack,remembered))return encodeCategoryIconValue(pack,remembered);
  const previous=legacy?.[preferenceKey];
  if(previous){
    const decoded=decodeCategoryIconValue(previous);
    if(decoded.pack===pack&&categoryIconByKey(decoded.key)&&categoryIconKeySupportedByPack(pack,decoded.key))return encodeCategoryIconValue(pack,decoded.key);
  }
  return null;
}

export function explicitCategoryIconForPack(settings:FinanceSettings,kind:CategoryKind,category:string,pack:CategoryIconPack){
  return explicitForPack(settings.categoryIconPackSelections,settings.categoryIcons,categoryIconPreferenceKey(kind,category),pack);
}

export function explicitSubcategoryIconForPack(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string,pack:CategoryIconPack){
  return explicitForPack(settings.subcategoryIconPackSelections,settings.subcategoryIcons,subcategoryIconPreferenceKey(kind,category,subcategory),pack);
}

export function explicitCategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string){
  const key=categoryIconPreferenceKey(kind,category);
  if(!settings.categoryIconPack){
    const legacy=settings.categoryIcons?.[key];
    if(!legacy)return null;
    const decoded=decodeCategoryIconValue(legacy);
    return categoryIconByKey(decoded.key)?legacy:null;
  }
  return explicitCategoryIconForPack(settings,kind,category,activeCategoryIconPack(settings));
}

export function explicitSubcategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string){
  const key=subcategoryIconPreferenceKey(kind,category,subcategory);
  if(!settings.categoryIconPack){
    const legacy=settings.subcategoryIcons?.[key];
    if(!legacy)return null;
    const decoded=decodeCategoryIconValue(legacy);
    return categoryIconByKey(decoded.key)?legacy:null;
  }
  return explicitSubcategoryIconForPack(settings,kind,category,subcategory,activeCategoryIconPack(settings));
}

function semanticIconForPack(pack:CategoryIconPack,key:string|null){
  const definition=key?categoryIconByKey(key):null;
  if(!definition)return null;
  return encodeCategoryIconValue(pack,categoryIconFallbackKeyForPack(pack,definition.key));
}

export function resolvedCategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory?:string){
  const activePack=settings.categoryIconPack?activeCategoryIconPack(settings):null;
  if(subcategory){
    const explicitSubcategory=explicitSubcategoryIcon(settings,kind,category,subcategory);
    if(explicitSubcategory)return explicitSubcategory;
    const semanticSubcategory=inferredCategoryIcon(kind,subcategory);
    if(semanticSubcategory)return activePack?semanticIconForPack(activePack,semanticSubcategory):semanticSubcategory;
  }
  const explicitCategory=explicitCategoryIcon(settings,kind,category);
  if(explicitCategory)return explicitCategory;
  const semanticCategory=inferredCategoryIcon(kind,category);
  return activePack?semanticIconForPack(activePack,semanticCategory):semanticCategory;
}

function nextPackSelections(
  current:Record<string,Partial<Record<CategoryIconPackId,string>>>|undefined,
  preferenceKey:string,
  pack:CategoryIconPack,
  semanticKey:string|null,
){
  const next={...(current??{})};
  const perPack={...(next[preferenceKey]??{})};
  if(semanticKey)perPack[pack]=semanticKey;
  else delete perPack[pack];
  if(Object.keys(perPack).length)next[preferenceKey]=perPack;
  else delete next[preferenceKey];
  return next;
}

export function withCategoryIcon(settings:FinanceSettings,kind:CategoryKind,category:string,iconKey:string|null):FinanceSettings{
  const key=categoryIconPreferenceKey(kind,category);
  const legacy={...(settings.categoryIcons??{})};
  const decoded=iconKey?decodeCategoryIconValue(iconKey):null;
  const pack=decoded?.pack??activeCategoryIconPack(settings);
  const semanticKey=decoded&&categoryIconByKey(decoded.key)&&categoryIconKeySupportedByPack(pack,decoded.key)?decoded.key:null;
  if(semanticKey)legacy[key]=encodeCategoryIconValue(pack,semanticKey);
  else if(legacy[key]&&decodeCategoryIconValue(legacy[key]).pack===pack)delete legacy[key];
  return {
    ...settings,
    categoryIconPack:settings.categoryIconPack??pack,
    categoryIcons:legacy,
    categoryIconPackSelections:nextPackSelections(settings.categoryIconPackSelections,key,pack,semanticKey),
  };
}

export function withSubcategoryIconOverride(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string,iconKey:string|null):FinanceSettings{
  const key=subcategoryIconPreferenceKey(kind,category,subcategory);
  const legacy={...(settings.subcategoryIcons??{})};
  const decoded=iconKey?decodeCategoryIconValue(iconKey):null;
  const pack=decoded?.pack??activeCategoryIconPack(settings);
  const semanticKey=decoded&&categoryIconByKey(decoded.key)&&categoryIconKeySupportedByPack(pack,decoded.key)?decoded.key:null;
  if(semanticKey)legacy[key]=encodeCategoryIconValue(pack,semanticKey);
  else if(legacy[key]&&decodeCategoryIconValue(legacy[key]).pack===pack)delete legacy[key];
  return {
    ...settings,
    categoryIconPack:settings.categoryIconPack??pack,
    subcategoryIcons:legacy,
    subcategoryIconPackSelections:nextPackSelections(settings.subcategoryIconPackSelections,key,pack,semanticKey),
  };
}

export function explicitCategoryIconColor(settings:FinanceSettings,kind:CategoryKind,category:string){
  return normalizedColor(settings.categoryIconColors?.[categoryIconPreferenceKey(kind,category)]);
}

export function explicitSubcategoryIconColor(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string){
  return normalizedColor(settings.subcategoryIconColors?.[subcategoryIconPreferenceKey(kind,category,subcategory)]);
}

export function resolvedCategoryIconColor(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory?:string){
  return (subcategory?explicitSubcategoryIconColor(settings,kind,category,subcategory):null)
    ??explicitCategoryIconColor(settings,kind,category)
    ??null;
}

export function withCategoryIconColor(settings:FinanceSettings,kind:CategoryKind,category:string,color:string|null):FinanceSettings{
  const key=categoryIconPreferenceKey(kind,category);
  const next={...(settings.categoryIconColors??{})};
  const normalized=normalizedColor(color);
  if(normalized)next[key]=normalized;else delete next[key];
  return {...settings,categoryIconColors:next};
}

export function withSubcategoryIconColor(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string,color:string|null):FinanceSettings{
  const key=subcategoryIconPreferenceKey(kind,category,subcategory);
  const next={...(settings.subcategoryIconColors??{})};
  const normalized=normalizedColor(color);
  if(normalized)next[key]=normalized;else delete next[key];
  return {...settings,subcategoryIconColors:next};
}

function renameKey<T>(source:Record<string,T>|undefined,from:string,to:string){
  const next={...(source??{})};
  if(next[from]!==undefined){next[to]=next[from];delete next[from]}
  return next;
}
function renamePrefix<T>(source:Record<string,T>|undefined,fromPrefix:string,toPrefix:string){
  const next:Record<string,T>={};
  for(const [key,value] of Object.entries(source??{}))next[key.startsWith(fromPrefix)?`${toPrefix}${key.slice(fromPrefix.length)}`:key]=value;
  return next;
}

export function renameCategoryIconPreferences(settings:FinanceSettings,kind:CategoryKind,from:string,to:string):FinanceSettings{
  const oldCategoryKey=categoryIconPreferenceKey(kind,from);
  const newCategoryKey=categoryIconPreferenceKey(kind,to);
  const oldPrefix=`${kind}:${clean(from)}:`;
  const newPrefix=`${kind}:${clean(to)}:`;
  return {
    ...settings,
    categoryIcons:renameKey(settings.categoryIcons,oldCategoryKey,newCategoryKey),
    categoryIconPackSelections:renameKey(settings.categoryIconPackSelections,oldCategoryKey,newCategoryKey),
    categoryIconColors:renameKey(settings.categoryIconColors,oldCategoryKey,newCategoryKey),
    subcategoryIcons:renamePrefix(settings.subcategoryIcons,oldPrefix,newPrefix),
    subcategoryIconPackSelections:renamePrefix(settings.subcategoryIconPackSelections,oldPrefix,newPrefix),
    subcategoryIconColors:renamePrefix(settings.subcategoryIconColors,oldPrefix,newPrefix),
  };
}

export function moveSubcategoryIconPreferences(
  settings:FinanceSettings,
  kind:CategoryKind,
  fromCategory:string,
  fromSubcategory:string,
  toCategory:string,
  toSubcategory:string,
):FinanceSettings{
  const from=subcategoryIconPreferenceKey(kind,fromCategory,fromSubcategory);
  const to=subcategoryIconPreferenceKey(kind,toCategory,toSubcategory);
  return {
    ...settings,
    subcategoryIcons:renameKey(settings.subcategoryIcons,from,to),
    subcategoryIconPackSelections:renameKey(settings.subcategoryIconPackSelections,from,to),
    subcategoryIconColors:renameKey(settings.subcategoryIconColors,from,to),
  };
}

export function removeSubcategoryIconPreferences(settings:FinanceSettings,kind:CategoryKind,category:string,subcategory:string):FinanceSettings{
  const key=subcategoryIconPreferenceKey(kind,category,subcategory);
  const subcategoryIcons={...(settings.subcategoryIcons??{})};delete subcategoryIcons[key];
  const subcategoryIconPackSelections={...(settings.subcategoryIconPackSelections??{})};delete subcategoryIconPackSelections[key];
  const subcategoryIconColors={...(settings.subcategoryIconColors??{})};delete subcategoryIconColors[key];
  return {...settings,subcategoryIcons,subcategoryIconPackSelections,subcategoryIconColors};
}

export function removeCategoryIconPreferences(settings:FinanceSettings,kind:CategoryKind,category:string):FinanceSettings{
  const categoryKey=categoryIconPreferenceKey(kind,category);
  const prefix=`${kind}:${clean(category)}:`;
  const categoryIcons={...(settings.categoryIcons??{})};delete categoryIcons[categoryKey];
  const categoryIconPackSelections={...(settings.categoryIconPackSelections??{})};delete categoryIconPackSelections[categoryKey];
  const categoryIconColors={...(settings.categoryIconColors??{})};delete categoryIconColors[categoryKey];
  return {
    ...settings,
    categoryIcons,
    categoryIconPackSelections,
    categoryIconColors,
    subcategoryIcons:Object.fromEntries(Object.entries(settings.subcategoryIcons??{}).filter(([key])=>!key.startsWith(prefix))),
    subcategoryIconPackSelections:Object.fromEntries(Object.entries(settings.subcategoryIconPackSelections??{}).filter(([key])=>!key.startsWith(prefix))),
    subcategoryIconColors:Object.fromEntries(Object.entries(settings.subcategoryIconColors??{}).filter(([key])=>!key.startsWith(prefix))),
  };
}
