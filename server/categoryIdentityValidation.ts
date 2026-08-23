import type { CategoryIdentityRecord, FinanceData } from '../src/types.js';
import { ApiError } from './http.js';

function invalid(message:string):never{throw new ApiError(400,'INVALID_DATA',message)}
function object(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value)}
function text(value:unknown,name:string,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)invalid(`Invalid ${name}.`)}
function stringList(value:unknown,name:string,maxItems:number,maxText:number){
  if(!Array.isArray(value)||value.length>maxItems)invalid(`Invalid ${name}.`);
  for(const item of value)text(item,`${name} item`,maxText);
}
function identityLabelKey(value:string){return value.trim().replace(/\s+/g,' ').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('el-GR')}

export function validateCategoryIdentityState(value:unknown):asserts value is FinanceData['state']{
  if(!object(value))invalid('Invalid finance state.');
  const settings=value.settings;
  if(!object(settings))invalid('Missing settings.');
  const raw=settings.categoryIdentities;
  if(raw===undefined)return;
  if(!object(raw)||Object.keys(raw).length>20_000)invalid('Invalid state.settings.categoryIdentities.');

  const records=new Map<string,CategoryIdentityRecord>();
  for(const [key,item] of Object.entries(raw)){
    text(key,'state.settings.categoryIdentities key',200);
    if(!object(item))invalid(`Invalid state.settings.categoryIdentities.${key}.`);
    text(item.id,`state.settings.categoryIdentities.${key}.id`,200);
    if(item.id!==key)invalid(`Category identity key/id mismatch for ${key}.`);
    if(item.kind!=='expense'&&item.kind!=='income')invalid(`Invalid state.settings.categoryIdentities.${key}.kind.`);
    text(item.label,`state.settings.categoryIdentities.${key}.label`,1_000);
    stringList(item.aliases,`state.settings.categoryIdentities.${key}.aliases`,200,1_000);
    if(item.parentId!==undefined)text(item.parentId,`state.settings.categoryIdentities.${key}.parentId`,200);
    if(item.parentAliases!==undefined)stringList(item.parentAliases,`state.settings.categoryIdentities.${key}.parentAliases`,200,200);
    if(item.parentId===key||(Array.isArray(item.parentAliases)&&item.parentAliases.includes(key)))invalid(`Category identity ${key} cannot parent itself.`);
    records.set(key,item as unknown as CategoryIdentityRecord);
  }

  for(const record of records.values()){
    if(record.parentId!==undefined){
      const parent=records.get(record.parentId);
      if(!parent||parent.parentId!==undefined||parent.kind!==record.kind)invalid(`Invalid parent identity for ${record.id}.`);
    }
    for(const parentId of record.parentAliases??[]){
      const parent=records.get(parentId);
      if(!parent||parent.parentId!==undefined||parent.kind!==record.kind)invalid(`Invalid parent alias identity for ${record.id}.`);
    }
  }

  const claimedPaths=new Map<string,string>();
  for(const record of records.values()){
    const labels=[record.label,...record.aliases];
    const parentIds=record.parentId===undefined?['root']:[record.parentId,...(record.parentAliases??[])];
    for(const parentId of parentIds){
      for(const label of labels){
        const path=`${record.kind}|${parentId}|${identityLabelKey(label)}`;
        const owner=claimedPaths.get(path);
        if(owner&&owner!==record.id)invalid(`Ambiguous category identity alias/path between ${owner} and ${record.id}.`);
        claimedPaths.set(path,record.id);
      }
    }
  }
}
