export type FinancialProviderKind='bank'|'fintech'|'wallet'|'payment';
export type BankAccountCategory='payroll'|'current'|'savings'|'term'|'payment'|'other';
export type CashAccountType='cash'|'reserve'|'other';

export type FinancialProvider={
  id:string;
  displayName:string;
  shortName:string;
  kind:FinancialProviderKind;
  kindLabel:string;
  countryCode?:string;
  logoAssetKey:string;
  wordmarkAssetKey:string;
  sortOrder:number;
};

export const FINANCIAL_PROVIDERS:FinancialProvider[]=[
  {id:'piraeus',displayName:'Τράπεζα Πειραιώς',shortName:'Πειραιώς',kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',logoAssetKey:'piraeus',wordmarkAssetKey:'piraeus',sortOrder:10},
  {id:'alpha',displayName:'Alpha Bank',shortName:'Alpha',kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',logoAssetKey:'alpha',wordmarkAssetKey:'alpha',sortOrder:20},
  {id:'national',displayName:'Εθνική Τράπεζα',shortName:'Εθνική',kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',logoAssetKey:'national',wordmarkAssetKey:'national',sortOrder:30},
  {id:'eurobank',displayName:'Eurobank',shortName:'Eurobank',kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',logoAssetKey:'eurobank',wordmarkAssetKey:'eurobank',sortOrder:40},
  {id:'revolut',displayName:'Revolut',shortName:'Revolut',kind:'fintech',kindLabel:'Ψηφιακός πάροχος',countryCode:'LT',logoAssetKey:'revolut',wordmarkAssetKey:'revolut',sortOrder:50},
  {id:'viva',displayName:'Viva.com',shortName:'Viva',kind:'payment',kindLabel:'Πάροχος πληρωμών',countryCode:'GR',logoAssetKey:'viva',wordmarkAssetKey:'viva',sortOrder:60},
  {id:'payzy',displayName:'payzy by COSMOTE',shortName:'payzy',kind:'wallet',kindLabel:'Ψηφιακό πορτοφόλι',countryCode:'GR',logoAssetKey:'payzy',wordmarkAssetKey:'payzy',sortOrder:70},
  {id:'paypal',displayName:'PayPal',shortName:'PayPal',kind:'wallet',kindLabel:'Ψηφιακό πορτοφόλι',countryCode:'US',logoAssetKey:'paypal',wordmarkAssetKey:'paypal',sortOrder:80},
];

export const BANK_ACCOUNT_CATEGORIES:{id:BankAccountCategory;label:string;description:string}[]=[
  {id:'payroll',label:'Μισθοδοσίας',description:'Για μισθό ή σύνταξη.'},
  {id:'current',label:'Τρεχούμενος',description:'Για καθημερινές συναλλαγές.'},
  {id:'savings',label:'Αποταμιευτικός',description:'Για αποταμίευση με διαθέσιμη πρόσβαση.'},
  {id:'term',label:'Προθεσμιακός',description:'Για χρήματα που δεν χρησιμοποιούνται καθημερινά.'},
  {id:'payment',label:'Πληρωμών / Wallet',description:'Για ψηφιακό πορτοφόλι ή λογαριασμό πληρωμών.'},
  {id:'other',label:'Άλλος',description:'Για άλλη τραπεζική χρήση.'},
];

export const CASH_ACCOUNT_TYPES:{id:CashAccountType;label:string}[]=[
  {id:'cash',label:'Μετρητά'},
  {id:'reserve',label:'Καβάτζα'},
  {id:'other',label:'Άλλο'},
];

const normalized=(value='')=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR');

export function financialProviderById(id?:string){return FINANCIAL_PROVIDERS.find(provider=>provider.id===id)}

export function financialProviderId(...values:(string|undefined|null)[]){
  const text=normalized(values.filter(Boolean).join(' '));
  if(text.includes('piraeus')||text.includes('πειραι'))return 'piraeus';
  if(text.includes('alpha'))return 'alpha';
  if(text.includes('national')||text.includes('nbg')||text.includes('εθνικ'))return 'national';
  if(text.includes('eurobank'))return 'eurobank';
  if(text.includes('revolut'))return 'revolut';
  if(text.includes('viva'))return 'viva';
  if(text.includes('payzy'))return 'payzy';
  if(text.includes('paypal'))return 'paypal';
  return '';
}

export function financialProviderLabel(id?:string){
  if(!id)return '';
  return financialProviderById(id)?.displayName??id;
}

export function bankAccountCategoryLabel(category?:BankAccountCategory){
  return BANK_ACCOUNT_CATEGORIES.find(item=>item.id===category)?.label??'Άλλος';
}

export function cashAccountTypeLabel(type?:CashAccountType){
  return CASH_ACCOUNT_TYPES.find(item=>item.id===type)?.label??'Μετρητά';
}
