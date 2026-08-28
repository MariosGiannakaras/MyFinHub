const piraeusLogo=new URL('../assets/bank-brands/piraeus-mark.svg',import.meta.url).href;
const revolutLogo=new URL('../assets/bank-brands/revolut-mark.svg',import.meta.url).href;
const alphaLogo=new URL('../assets/bank-brands/alpha-mark.svg',import.meta.url).href;
const nationalLogo=new URL('../assets/bank-brands/national-mark.svg',import.meta.url).href;
const eurobankLogo=new URL('../assets/bank-brands/eurobank-mark.svg',import.meta.url).href;
const payzyLogo=new URL('../assets/canonical-credit-card/payzy-logo.png',import.meta.url).href;
const vivaLogo=new URL('../assets/canonical-credit-card/viva-logo.png',import.meta.url).href;

export type BankBrandKey='piraeus'|'revolut'|'alpha'|'national'|'eurobank'|'payzy'|'viva'|'cash'|'generic';

export type BankBrandTextAsset={label:string;mark:string;cardMark?:string;source:'local-text'};
export type BankBrandImageAsset={label:string;src:string;fallbackMark:string;cardMark?:string;source:'local-image'};
export type BankBrandAsset=BankBrandTextAsset|BankBrandImageAsset;

const BRAND_ASSETS:Partial<Record<BankBrandKey,BankBrandAsset>>={
  piraeus:{label:'Τράπεζα Πειραιώς',src:piraeusLogo,fallbackMark:'ΠΕΙΡΑΙΩΣ',cardMark:'Piraeus',source:'local-image'},
  revolut:{label:'Revolut',src:revolutLogo,fallbackMark:'REVOLUT',cardMark:'Revolut',source:'local-image'},
  alpha:{label:'Alpha Bank',src:alphaLogo,fallbackMark:'ALPHA',cardMark:'ALPHA BANK',source:'local-image'},
  national:{label:'Εθνική Τράπεζα',src:nationalLogo,fallbackMark:'ΕΤΕ',cardMark:'NBG',source:'local-image'},
  eurobank:{label:'Eurobank',src:eurobankLogo,fallbackMark:'EUROBANK',cardMark:'Eurobank',source:'local-image'},
  payzy:{label:'payzy by COSMOTE',src:payzyLogo,fallbackMark:'payzy',cardMark:'payzy',source:'local-image'},
  viva:{label:'Viva.com',src:vivaLogo,fallbackMark:'VIVA',cardMark:'VIVA',source:'local-image'},
};

function normalize(value=''){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR')}

export function bankBrandKey(value?:string,name?:string):BankBrandKey{
  const text=`${normalize(value)} ${normalize(name)}`;
  if(text.includes('piraeus')||text.includes('πειραι'))return 'piraeus';
  if(text.includes('revolut'))return 'revolut';
  if(text.includes('alpha'))return 'alpha';
  if(text.includes('national')||text.includes('nbg')||text.includes('εθνικ'))return 'national';
  if(text.includes('eurobank'))return 'eurobank';
  if(text.includes('payzy'))return 'payzy';
  if(text.includes('viva'))return 'viva';
  if(text.includes('cash')||text.includes('μετρη'))return 'cash';
  return 'generic';
}

export function bankBrandAsset(key:BankBrandKey){return BRAND_ASSETS[key]??null}

export function bankBrandFallbackMark(asset:BankBrandAsset){return asset.source==='local-image'?asset.fallbackMark:asset.mark}

export function bankBrandCardMark(asset:BankBrandAsset){return asset.cardMark??bankBrandFallbackMark(asset)}
