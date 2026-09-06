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

/* Phosphor currently has seven distinct local glyph groups. `other` shares the
 * finance glyph in the curated renderer, so it must not be exposed as a second
 * visual choice until the local subset gains a genuinely distinct glyph. */
const PHOSPHOR_KEYS=new Set<CategoryIconKey>([
  'coffee','shopping','car','home','health','government','flight',
]);

/* Heroicons and Bootstrap currently expose five genuinely distinct local glyph
 * groups. Keys that collapse to the same SVG are intentionally omitted so the
 * picker never advertises duplicate choices under different semantic labels. */
const HEROICONS_KEYS=new Set<CategoryIconKey>([
  'shopping','home','health','government','flight',
]);
const BOOTSTRAP_KEYS=new Set<CategoryIconKey>([
  'shopping','home','health','government','flight',
]);

const keysForPack=(pack:CategoryIconPack)=>{
  if(pack==='tabler')return TABLER_KEYS;
  if(pack==='phosphor')return PHOSPHOR_KEYS;
  if(pack==='heroicons')return HEROICONS_KEYS;
  if(pack==='bootstrap')return BOOTSTRAP_KEYS;
  return null;
};

export function categoryIconKeySupportedByPack(pack:CategoryIconPack,key:string){
  if(pack==='lucide')return true;
  return Boolean(keysForPack(pack)?.has(key as CategoryIconKey));
}

export function categoryIconPackCoverage(pack:CategoryIconPack){
  if(pack==='lucide')return null;
  return keysForPack(pack)?.size??0;
}

/* Selector previews must be real, distinct glyphs that the same pack can also
 * expose inside the picker. Never rely on renderer fallbacks for these samples. */
export function categoryIconPackPreviewKeys(pack:CategoryIconPack):readonly CategoryIconKey[]{
  if(pack==='tabler')return ['coffee','home','wallet'];
  if(pack==='phosphor')return ['coffee','home','flight'];
  if(pack==='heroicons'||pack==='bootstrap')return ['shopping','home','flight'];
  return ['coffee','home','wallet'];
}
