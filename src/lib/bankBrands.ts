export type BankBrandKey='piraeus'|'revolut'|'alpha'|'payzy'|'viva'|'cash'|'generic';

export type BankBrandAsset={label:string;src:string;source:'wikimedia'|'verified-web'};

const BRAND_ASSETS:Partial<Record<BankBrandKey,BankBrandAsset>>={
  piraeus:{label:'Τράπεζα Πειραιώς',src:'https://upload.wikimedia.org/wikipedia/commons/0/00/Piraeus_Bank_2024_logo.svg',source:'wikimedia'},
  revolut:{label:'Revolut',src:'https://upload.wikimedia.org/wikipedia/commons/7/73/Revolut_logo.svg',source:'wikimedia'},
  alpha:{label:'Alpha Bank',src:'https://upload.wikimedia.org/wikipedia/commons/3/35/Alpha_Bank_logo.svg',source:'wikimedia'},
  payzy:{label:'payzy by COSMOTE',src:'https://www.neukunden-rabatt.de/payzy_logo.jpg',source:'verified-web'},
  viva:{label:'Viva.com',src:'https://cdn.asp.events/CLIENT_CloserSt_D86EA381_5056_B739_5482D50A1A831DDD/companyProfiles/8bdb9b68-4ddb-11f0-95a-06bd0f937899-logo.png',source:'verified-web'},
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
