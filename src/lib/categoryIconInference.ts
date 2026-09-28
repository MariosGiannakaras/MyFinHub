import type { CategoryIconKey } from './categoryIconRegistry.js';
import type { CategoryKind } from './categoryIconPreferences.js';

const normalize=(value:string)=>value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('el-GR')
  .replace(/[^a-z0-9α-ω]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();

type SemanticRule={icon:CategoryIconKey;terms:readonly string[];kind?:CategoryKind};

/*
 * Ordered from specific concepts to broad umbrella concepts. This is deliberately
 * deterministic rather than fuzzy: category icons are navigational signifiers,
 * so a wrong confident glyph is worse than a neutral fallback.
 */
const RULES:readonly SemanticRule[]=[
  {icon:'groceries',terms:['σουπερ μαρκετ','super market','supermarket','groceries','παντοπωλειο']},
  {icon:'bakery',terms:['φουρνος','αρτοποιειο','bakery','bread']},
  {icon:'coffee',terms:['καφες','καφε','coffee','cafe','espresso']},
  {icon:'takeaway',terms:['delivery','take away','takeaway','wolt','efood']},
  {icon:'dining',terms:['εστιατοριο','εστιαση','φαγητο','τροφίμα','τροφιμα','restaurant','dining','food']},
  {icon:'shoes',terms:['παπουτσια','υποδηματα','shoes','sneakers']},
  {icon:'clothing',terms:['ρουχα','ενδυση','clothing','fashion']},
  {icon:'electronics',terms:['ηλεκτρονικα','electronics','gadgets','συσκευες']},
  {icon:'computer',terms:['υπολογιστης','υπολογιστες','laptop','computer','pc']},
  {icon:'phone',terms:['κινητο','smartphone','mobile phone']},
  {icon:'gaming',terms:['gaming','games','παιχνιδια','playstation','xbox','steam']},
  {icon:'gift',terms:['δωρα','δωρο','gift','present']},
  {icon:'shopping',terms:['αγορες','shopping','λιανικη','retail']},

  {icon:'fuel',terms:['καυσιμα','βενζινη','πετρελαιο κινησης','fuel','petrol','gas station']},
  {icon:'parking',terms:['parking','σταθμευση','διοδια','parking διοδια']},
  {icon:'motorcycle',terms:['μηχανη','μοτοσυκλετα','motorcycle','scooter']},
  {icon:'taxi',terms:['ταξι','taxi','uber','ride']},
  {icon:'public-transport',terms:['μμμ','μετρο','λεωφορειο','τραμ','σιδηροδρομος','train','metro','bus','public transport','μετακινησεις','μεταφορες']},
  {icon:'service',terms:['service','συντηρηση service','συνεργειο','επισκευη οχηματος','car repair']},
  {icon:'insurance',terms:['ασφαλεια','ασφαλιση','insurance']},
  {icon:'car',terms:['οχημα','αυτοκινητο','car','vehicle']},

  {icon:'rent',terms:['ενοικιο','rent','lease']},
  {icon:'furniture',terms:['επιπλα','furniture','sofa']},
  {icon:'maintenance',terms:['συντηρηση σπιτιου','επισκευες σπιτιου','home repair','maintenance']},
  {icon:'electricity',terms:['ρευμα','δεη','electricity','power bill']},
  {icon:'water',terms:['νερο','ευδαπ','water bill']},
  {icon:'heating',terms:['θερμανση','φυσικο αεριο','heating']},
  {icon:'internet',terms:['internet','ιντερνετ','wifi','fiber']},
  {icon:'telephone',terms:['τηλεφωνια','τηλεπικοινωνιες','κινητη τηλεφωνια','σταθερη τηλεφωνια','telecom','telephone']},
  {icon:'home',terms:['στεγαση','σπιτι','κατοικια','home','housing']},

  {icon:'streaming',terms:['streaming','netflix','disney','youtube premium']},
  {icon:'music',terms:['μουσικη','spotify','music']},
  {icon:'cinema',terms:['σινεμα','κινηματογραφος','movie','cinema']},
  {icon:'gym',terms:['γυμναστηριο','fitness','gym']},
  {icon:'sport',terms:['αθλητισμος','sports','sport']},
  {icon:'subscription',terms:['συνδρομη','συνδρομες','παγια','σταθερα εξοδα','subscription','recurring']},
  {icon:'entertainment',terms:['διασκεδαση','ψυχαγωγια','entertainment']},

  {icon:'dentist',terms:['οδοντιατρος','οδοντιατρικα','dentist','dental']},
  {icon:'pharmacy',terms:['φαρμακειο','φαρμακα','pharmacy','medicine']},
  {icon:'hospital',terms:['νοσοκομειο','hospital']},
  {icon:'doctor',terms:['γιατρος','ιατρος','clinic','doctor']},
  {icon:'health',terms:['υγεια','health','medical']},

  {icon:'books',terms:['βιβλια','βιβλιοπωλειο','books','book']},
  {icon:'course',terms:['μαθηματα','σεμιναρια','course','lesson','tuition']},
  {icon:'education',terms:['εκπαιδευση','σχολειο','σπουδες','education','school']},

  {icon:'flight',terms:['πτηση','αεροπορικα','flight','airline']},
  {icon:'hotel',terms:['ξενοδοχειο','διαμονη','hotel','booking']},
  {icon:'ferry',terms:['πλοιο','ακτοπλοικα','ferry','ship']},
  {icon:'holiday',terms:['διακοπες','vacation','holiday']},
  {icon:'travel',terms:['ταξιδι','ταξιδια','travel','trip']},

  {icon:'pet',terms:['κατοικιδια','κατοικιδιο','pet','pets','κτηνιατρος']},
  {icon:'barber',terms:['κομμωτηριο','κουρεμα','barber','haircut']},
  {icon:'cosmetics',terms:['καλλυντικα','cosmetics','beauty products']},
  {icon:'personal-care',terms:['προσωπικη φροντιδα','περιποιηση','personal care','beauty']},
  {icon:'child',terms:['παιδι','παιδια','baby','kids','child']},
  {icon:'family',terms:['οικογενεια','family']},
  {icon:'tobacco',terms:['καπνος','τσιγαρα','tobacco','cigarettes']},
  {icon:'kiosk',terms:['ψιλικα','περιπτερο','kiosk','convenience']},

  {icon:'bank-fee',terms:['τραπεζικα εξοδα','προμηθεια τραπεζας','bank fee','commission']},
  {icon:'installment',terms:['δοση','δοσεις','installment']},
  {icon:'loan',terms:['δανειο','δανεια','loan','debt']},
  {icon:'tax',terms:['φορος','φοροι','εφορια','ααδε','tax','taxes']},
  {icon:'government',terms:['δημοσιο','government','public service']},
  {icon:'saving',terms:['αποταμιευση','αποταμιευσεις','saving','savings']},
  {icon:'investment',terms:['επενδυση','επενδυσεις','μετοχες','investment','stocks']},
  {icon:'card',terms:['καρτα','πιστωτικη','χρεωστικη','credit card','debit card']},
  {icon:'cash',terms:['μετρητα','cash']},
  {icon:'transfer',terms:['μεταφορα χρηματων','τραπεζικη μεταφορα','transfer']},
  {icon:'receipt',terms:['λογαριασμοι','λογαριασμος','αποδειξη','τιμολογιο','bill','bills','receipt','invoice']},

  {icon:'salary',kind:'income',terms:['μισθος','μισθοδοσια','salary','payroll']},
  {icon:'bonus',kind:'income',terms:['bonus','μπονους','πριμ']},
  {icon:'refund',kind:'income',terms:['επιστροφη','refund','reimbursement']},
  {icon:'sale',kind:'income',terms:['πωληση','sale','sold']},
  {icon:'freelance',kind:'income',terms:['freelance','εργο','project income','αμοιβη εργου']},
  {icon:'business',kind:'income',terms:['επιχειρηση','business','εργασια']},
  {icon:'income',kind:'income',terms:['εσοδο','εσοδα','income','revenue']},

  {icon:'charity',terms:['δωρεα','charity','donation']},
  {icon:'celebration',terms:['γιορτη','γενεθλια','party','birthday']},
  {icon:'calendar',terms:['ημερολογιο','calendar']},
  {icon:'wallet',terms:['πορτοφολι','wallet']},
  {icon:'reconciliation',terms:['διορθωση','τακτοποιηση','reconciliation','adjustment']},
];

function hasTerm(label:string,term:string){
  const normalizedTerm=normalize(term);
  return label===normalizedTerm||label.includes(normalizedTerm);
}

export function inferredCategoryIcon(kind:CategoryKind,label:string):CategoryIconKey|null{
  const normalized=normalize(label);
  if(!normalized)return null;
  const match=RULES.find(rule=>(!rule.kind||rule.kind===kind)&&rule.terms.some(term=>hasTerm(normalized,term)));
  if(match)return match.icon;
  if(/^(αλλο|αλλα|other|misc)$/.test(normalized))return kind==='income'?'income':'other';
  return null;
}
