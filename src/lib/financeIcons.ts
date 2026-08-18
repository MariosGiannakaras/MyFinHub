export type FinanceIconKey =
  | 'coffee' | 'dining' | 'supermarket' | 'clothing' | 'electronics' | 'shopping'
  | 'fuel' | 'parking' | 'vehicle' | 'service' | 'doctor' | 'pharmacy' | 'health'
  | 'home' | 'electricity' | 'water' | 'internet' | 'phone' | 'streaming' | 'music'
  | 'ai' | 'gym' | 'barber' | 'insurance' | 'gift' | 'education' | 'travel' | 'pet'
  | 'entertainment' | 'tax' | 'salary' | 'income' | 'expense' | 'transfer' | 'saving'
  | 'cash' | 'refund' | 'reconciliation' | 'lending' | 'card' | 'subscription'
  | 'installment' | 'split' | 'fallback';

export type FinanceIconTone = 'red'|'green'|'blue'|'cyan'|'amber'|'violet'|'teal'|'gold'|'slate';

export type FinanceIconInput = {
  kind?: string;
  category?: string;
  subcategory?: string;
  note?: string;
};

export type FinanceIconSpec = { key: FinanceIconKey; tone: FinanceIconTone };

const normalize=(value='')=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR').replace(/[^a-z0-9α-ω]+/g,' ').trim();
const has=(text:string,patterns:string[])=>patterns.some(pattern=>text.includes(pattern));

const specificRules:Array<{key:FinanceIconKey;tone:FinanceIconTone;patterns:string[]}>=[
  {key:'supermarket',tone:'amber',patterns:['supermarket','σουπερ μαρκετ','σουπερμαρκετ','grocery','lidl','σκλαβεν','ab βασιλοπουλ','μασουτ','market in']},
  {key:'coffee',tone:'amber',patterns:['καφε','coffee','espresso','cappuccino','freddo','starbucks','coffee island','mikel','everest coffee']},
  {key:'pharmacy',tone:'teal',patterns:['φαρμακ','pharmacy']},
  {key:'doctor',tone:'teal',patterns:['γιατρ','ιατρ','doctor','clinic','κλινικ','οδοντ','dentist','φυσιοθεραπε']},
  {key:'fuel',tone:'amber',patterns:['βενζ','καυσιμ','fuel','shell','revoil','avins','bp ','eko ','ελιν']},
  {key:'parking',tone:'slate',patterns:['parking','παρκιν','σταθμευσ']},
  {key:'service',tone:'amber',patterns:['service','συνεργει','ανταλλακτικ','λαστιχ','ελαστικ','επισκευ','κτεο']},
  {key:'electronics',tone:'blue',patterns:['κινητ','smartphone','iphone','android','laptop','tablet','computer','υπολογιστ','ηλεκτρονικ','πλαισιο','public','kotsovol','κοτσοβολ','gaming pc','monitor','οθον']},
  {key:'clothing',tone:'violet',patterns:['ρουχ','παπουτσ','clothing','fashion','zara','bershka','pull bear','stradivarius','h m','nike','adidas','παπουτσι']},
  {key:'dining',tone:'red',patterns:['φαγη','εστιατ','restaurant','delivery','efood','wolt','pizza','burger','σουβλα','ταβερν','brunch','dinner','lunch','snack']},
  {key:'internet',tone:'blue',patterns:['internet','fiber','wifi','σταθερ','router']},
  {key:'phone',tone:'blue',patterns:['τηλεφων','κινητη τηλεφων','mobile plan','cosmote','vodafone','nova']},
  {key:'streaming',tone:'violet',patterns:['netflix','disney','prime video','youtube premium','hbo','cinobo','streaming']},
  {key:'music',tone:'violet',patterns:['spotify','apple music','youtube music','tidal','music']},
  {key:'ai',tone:'violet',patterns:['chatgpt','openai','claude','gemini','perplexity','copilot']},
  {key:'electricity',tone:'amber',patterns:['δεη','ρευμ','electricity','power bill']},
  {key:'water',tone:'cyan',patterns:['ευδαπ','νερο','water bill']},
  {key:'home',tone:'blue',patterns:['ενοικ','rent','σπιτ','home','κοινοχρηστ','ikea','leroy merlin']},
  {key:'gym',tone:'teal',patterns:['γυμναστ','gym','fitness','crossfit']},
  {key:'barber',tone:'violet',patterns:['κουρε','barber','haircut','κομμωτ']},
  {key:'insurance',tone:'blue',patterns:['ασφαλ','insurance']},
  {key:'education',tone:'blue',patterns:['βιβλι','book','σχολ','πανεπιστη','course','udemy','coursera','μαθημα','εκπαιδευ']},
  {key:'travel',tone:'violet',patterns:['αεροπορ','plane','flight','ξενοδοχ','hotel','booking','airbnb','ταξιδ','ferry','πλοιο']},
  {key:'pet',tone:'teal',patterns:['κτηνιατρ','pet','σκυλ','γατ','zooplus']},
  {key:'entertainment',tone:'violet',patterns:['σινεμα','cinema','movie','θεατρ','game','playstation','xbox','steam','gaming']},
  {key:'tax',tone:'slate',patterns:['φορο','tax','ααδε','τελη κυκλοφοριας','δημοσ']},
  {key:'salary',tone:'gold',patterns:['μισθ','salary','payroll','υπερωρ','bonus','δωρο χριστουγεννων','δωρο πασχα','επιδομα']},
  {key:'vehicle',tone:'amber',patterns:['αυτοκινη','οχημα','μηχαν','motorcycle','scooter','honda','forza','car ']},
  {key:'subscription',tone:'violet',patterns:['συνδρομ','subscription','monthly plan','annual plan']},
  {key:'installment',tone:'violet',patterns:['δοση','δοσεις','installment','δανειο','loan']},
  {key:'shopping',tone:'violet',patterns:['αγορα','shopping','shop','skroutz','amazon','bestprice']},
  {key:'gift',tone:'violet',patterns:['δωρο','gift']},
];

const categoryRules:Array<{key:FinanceIconKey;tone:FinanceIconTone;patterns:string[]}>=[
  {key:'dining',tone:'red',patterns:['τροφιμ','φαγη','εστιαση']},
  {key:'vehicle',tone:'amber',patterns:['οχημα','αυτοκινη','μηχαν','μετακινησ']},
  {key:'health',tone:'teal',patterns:['υγεια','ιατρικ']},
  {key:'home',tone:'blue',patterns:['σπιτι','στεγαση','οικια']},
  {key:'subscription',tone:'violet',patterns:['παγια','σταθερα εξοδα','συνδρομ']},
  {key:'shopping',tone:'violet',patterns:['αγορες','shopping','ρουχισμ']},
  {key:'entertainment',tone:'violet',patterns:['ψυχαγωγ','διασκεδασ']},
  {key:'education',tone:'blue',patterns:['εκπαιδευ','μαθηση']},
  {key:'travel',tone:'violet',patterns:['ταξιδ']},
  {key:'salary',tone:'gold',patterns:['μισθος','μισθοδοσια']},
  {key:'installment',tone:'violet',patterns:['δοσεις','δανεια']},
];

function matchRules(text:string,rules= specificRules):FinanceIconSpec|null{
  for(const rule of rules)if(has(text,rule.patterns))return {key:rule.key,tone:rule.tone};
  return null;
}

const broadKeys=new Set<FinanceIconKey>(['shopping','subscription','installment']);
function matchSpecific(text:string){
  const match=matchRules(text);
  return match&&!broadKeys.has(match.key)?match:null;
}

export function financeIconSpec(input:FinanceIconInput):FinanceIconSpec{
  const kind=normalize(input.kind);
  if(kind==='transfer')return {key:'transfer',tone:'blue'};
  if(kind==='saving cash offset'||kind==='saving_cash_offset')return {key:'saving',tone:'cyan'};
  if(kind==='withdrawal')return {key:'cash',tone:'blue'};
  if(kind==='refund')return {key:'refund',tone:'slate'};
  if(kind==='reconciliation'||kind==='adjustment')return {key:'reconciliation',tone:'amber'};
  if(kind==='lending'||kind==='repayment')return {key:'lending',tone:'violet'};
  if(kind==='card payment'||kind==='card_payment')return {key:'card',tone:'blue'};

  const note=normalize(input.note);
  const subcategory=normalize(input.subcategory);
  const category=normalize(input.category);
  const noteSpecific=matchSpecific(note);
  if(noteSpecific)return noteSpecific;
  const subSpecific=matchSpecific(subcategory);
  if(subSpecific)return subSpecific;
  const categorySpecific=matchSpecific(category);
  if(categorySpecific)return categorySpecific;
  const subBroad=matchRules(subcategory);
  if(subBroad)return subBroad;
  const categoryFallback=matchRules(category,categoryRules);
  if(categoryFallback)return categoryFallback;
  const categoryBroad=matchRules(category);
  if(categoryBroad)return categoryBroad;
  const noteBroad=matchRules(note);
  if(noteBroad)return noteBroad;

  if(kind==='card purchase'||kind==='card_purchase')return {key:'card',tone:'red'};
  if(kind==='split')return {key:'split',tone:'violet'};
  if(kind==='income')return {key:'income',tone:'green'};
  if(kind==='expense')return {key:'expense',tone:'red'};
  return {key:'fallback',tone:'slate'};
}

export function financeIconKey(input:FinanceIconInput){return financeIconSpec(input).key;}
