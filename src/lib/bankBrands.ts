const piraeusLogo=new URL('../assets/providers/piraeus-logo-green-on-yellow.jpg',import.meta.url).href;
const piraeusWordmark=new URL('../assets/providers/piraeus-wordmark-green-on-white.jpg',import.meta.url).href;
const alphaLogo=new URL('../assets/providers/alpha-logo-white-on-blue.jpg',import.meta.url).href;
const alphaWordmark=new URL('../assets/providers/alpha-wordmark-color.jpg',import.meta.url).href;
const revolutLogo='/brand/banks/revolut-mark.svg';
const payzyLogo=new URL('../assets/canonical-credit-card/payzy-logo.png',import.meta.url).href;
const vivaLogo=new URL('../assets/canonical-credit-card/viva-logo.png',import.meta.url).href;

export type BankBrandKey='piraeus'|'revolut'|'alpha'|'national'|'eurobank'|'payzy'|'viva'|'paypal'|'cash'|'generic';

export type BankBrandTextAsset={label:string;mark:string;cardMark?:string;source:'local-text'};
export type BankBrandImageAsset={label:string;src:string;wordmarkSrc?:string;fallbackMark:string;cardMark?:string;source:'local-image'};
export type BankBrandAsset=BankBrandTextAsset|BankBrandImageAsset;

const BRAND_ASSETS:Partial<Record<BankBrandKey,BankBrandAsset>>={
  piraeus:{label:'Τράπεζα Πειραιώς',src:piraeusLogo,wordmarkSrc:piraeusWordmark,fallbackMark:'ΠΕΙΡΑΙΩΣ',cardMark:'Πειραιώς',source:'local-image'},
  alpha:{label:'Alpha Bank',src:alphaLogo,wordmarkSrc:alphaWordmark,fallbackMark:'ALPHA',cardMark:'Alpha Bank',source:'local-image'},
  revolut:{label:'Revolut',src:revolutLogo,fallbackMark:'REVOLUT',cardMark:'Revolut',source:'local-image'},
  payzy:{label:'payzy by COSMOTE',src:payzyLogo,fallbackMark:'payzy',cardMark:'payzy',source:'local-image'},
  viva:{label:'Viva.com',src:vivaLogo,fallbackMark:'VIVA',cardMark:'VIVA',source:'local-image'},
  paypal:{label:'PayPal',mark:'PayPal',cardMark:'PayPal',source:'local-text'},
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
  if(text.includes('paypal'))return 'paypal';
  if(text.includes('cash')||text.includes('μετρη'))return 'cash';
  return 'generic';
}

export function bankBrandAsset(key:BankBrandKey){return BRAND_ASSETS[key]??null}

export function bankBrandFallbackMark(asset:BankBrandAsset){return asset.source==='local-image'?asset.fallbackMark:asset.mark}

export function bankBrandCardMark(asset:BankBrandAsset){return asset.cardMark??bankBrandFallbackMark(asset)}
