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


/* Selector previews must be real, distinct glyphs that the same pack can also
 * expose inside the picker. Never rely on renderer fallbacks for these samples. */
export function categoryIconPackPreviewKeys(pack:CategoryIconPack):readonly CategoryIconKey[]{
  if(pack==='tabler')return ['coffee','home','wallet'];
  if(pack==='phosphor')return ['coffee','home','flight'];
  if(pack==='heroicons'||pack==='bootstrap')return ['shopping','home','flight'];
  return ['coffee','home','wallet'];
}


export function categoryIconPackOptionCount(pack:CategoryIconPack){
  if(pack==='lucide')return null;
  return keysForPack(pack)?.size??0;
}


const COFFEE_GROUP=new Set<CategoryIconKey>(['coffee','dining']);
const SHOPPING_GROUP=new Set<CategoryIconKey>(['groceries','bakery','takeaway','clothing','shoes','shopping','gift','electronics','computer','phone','gaming','tobacco','kiosk','celebration']);
const TRANSPORT_GROUP=new Set<CategoryIconKey>(['fuel','parking','car','motorcycle','public-transport','taxi','service']);
const HOME_GROUP=new Set<CategoryIconKey>(['home','rent','furniture','maintenance','electricity','water','heating','internet','telephone','subscription','streaming','music','cinema','entertainment','education','books','course','child','family']);
const HEALTH_GROUP=new Set<CategoryIconKey>(['sport','gym','health','doctor','dentist','pharmacy','hospital','pet','personal-care','barber','cosmetics']);
const TRAVEL_GROUP=new Set<CategoryIconKey>(['travel','flight','hotel','ferry','holiday']);
const FINANCE_GROUP=new Set<CategoryIconKey>(['insurance','tax','government','bank-fee','cash','card','loan','installment','saving','investment','salary','bonus','income','refund','sale','freelance','business','charity','receipt','wallet','transfer','reconciliation','other']);

export function categoryIconFallbackKeyForPack(pack:CategoryIconPack,key:CategoryIconKey):CategoryIconKey{
  if(categoryIconKeySupportedByPack(pack,key))return key;
  if(COFFEE_GROUP.has(key))return pack==='tabler'||pack==='phosphor'?'coffee':'shopping';
  if(SHOPPING_GROUP.has(key))return 'shopping';
  if(TRANSPORT_GROUP.has(key))return pack==='tabler'||pack==='phosphor'?'car':'flight';
  if(HOME_GROUP.has(key))return pack==='tabler'&&key==='books'?'books':'home';
  if(HEALTH_GROUP.has(key))return 'health';
  if(TRAVEL_GROUP.has(key))return 'flight';
  if(FINANCE_GROUP.has(key)){
    if(pack==='tabler'){
      if(key==='receipt')return 'receipt';
      if(key==='transfer'||key==='reconciliation')return 'transfer';
      if(['cash','card','loan','installment','saving','investment','salary','bonus','income','refund','sale','freelance','business'].includes(key))return 'wallet';
      return key==='other'?'other':'government';
    }
    return 'government';
  }
  return pack==='tabler'?'other':pack==='phosphor'?'government':'home';
}
