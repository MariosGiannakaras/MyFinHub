import payzyLogo from '../assets/canonical-credit-card/payzy-logo.png';
import vivaLogo from '../assets/canonical-credit-card/viva-logo.png';

export type BankBrandKey='piraeus'|'revolut'|'alpha'|'payzy'|'viva'|'cash'|'generic';

export type BankBrandTextAsset={label:string;mark:string;cardMark?:string;source:'local-text'};
export type BankBrandImageAsset={label:string;src:string;fallbackMark:string;cardMark?:string;source:'local-image'};
export type BankBrandAsset=BankBrandTextAsset|BankBrandImageAsset;

const BRAND_ASSETS:Partial<Record<BankBrandKey,BankBrandAsset>>={
  piraeus:{label:'Τράπεζα Πειραιώς',mark:'ΠΕΙΡΑΙΩΣ',cardMark:'Piraeus',source:'local-text'},
  revolut:{label:'Revolut',mark:'REVOLUT',cardMark:'Revolut',source:'local-text'},
  alpha:{label:'Alpha Bank',mark:'ALPHA',cardMark:'ALPHA BANK',source:'local-text'},
  payzy:{label:'payzy by COSMOTE',src:payzyLogo,fallbackMark:'payzy',cardMark:'payzy',source:'local-image'},
  viva:{label:'Viva.com',src:vivaLogo,fallbackMark:'VIVA',cardMark:'VIVA',source:'local-image'},
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

export function bankBrandFallbackMark(asset:BankBrandAsset){return asset.source==='local-image'?asset.fallbackMark:asset.mark}

export function bankBrandCardMark(asset:BankBrandAsset){return asset.cardMark??bankBrandFallbackMark(asset)}
