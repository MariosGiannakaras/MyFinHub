export type BankBrandKey='piraeus'|'revolut'|'alpha'|'payzy'|'viva'|'cash'|'generic';

export type BankBrandAsset={label:string;mark:string;source:'local-text'};

const BRAND_ASSETS:Partial<Record<BankBrandKey,BankBrandAsset>>={
  piraeus:{label:'Τράπεζα Πειραιώς',mark:'ΠΕΙΡΑΙΩΣ',source:'local-text'},
  revolut:{label:'Revolut',mark:'REVOLUT',source:'local-text'},
  alpha:{label:'Alpha Bank',mark:'ALPHA',source:'local-text'},
  payzy:{label:'payzy by COSMOTE',mark:'payzy',source:'local-text'},
  viva:{label:'Viva.com',mark:'VIVA',source:'local-text'},
};

function normalize(value=''){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR')}

export function bankBrandKey(value?:string,name?:string):BankBrandKey{
  const text=`${normalize(value)} ${normalize(name)}`;
  if(text.includes('piraeus')||text.includes('πειραι'))return 'piraeus';
  if(text.includes('revolut'))return 'revolut';
  if(text.includes('alpha'))return 'alpha';
  if(text.includes('payzy'))return 'payzy';
  if(text.includes('viva'))return 'viva';
  if(text.includes('cash')||text.includes('μετρη'))return 'cash';
  return 'generic';
}

export function bankBrandAsset(key:BankBrandKey){return BRAND_ASSETS[key]??null}
