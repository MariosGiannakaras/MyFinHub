import type { CategoryIconKey, CategoryIconPack } from './categoryIconRegistry.js';

/*
 * The local third-party bundles are intentionally curated. Do not present several
 * semantic labels when they render the same underlying glyph: one visible option
 * must correspond to one distinct glyph within a pack.
 */
const TABLER_KEYS=new Set<CategoryIconKey>([
  'coffee','shopping','gift','car','home','electricity','health','books','flight',
  'government','wallet','receipt','transfer','other',
]);

const MULTI_PACK_KEYS=new Set<CategoryIconKey>([
  'coffee','shopping','car','home','health','government','flight','other',
]);

export function categoryIconKeySupportedByPack(pack:CategoryIconPack,key:string){
  if(pack==='lucide')return true;
  if(pack==='tabler')return TABLER_KEYS.has(key as CategoryIconKey);
  return MULTI_PACK_KEYS.has(key as CategoryIconKey);
}

export function categoryIconPackCoverage(pack:CategoryIconPack){
  if(pack==='lucide')return null;
  return pack==='tabler'?TABLER_KEYS.size:MULTI_PACK_KEYS.size;
}
