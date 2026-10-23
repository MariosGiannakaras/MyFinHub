import type { CategoryDefinition, FinanceData, RecurringItem } from '../types.js';
import { categoryKey, categoryTree } from './categories.js';
import { ensureCategoryIdentities } from './categoryIdentity.js';
import { applyTaxonomyOperation, taxonomyCategoryId, taxonomySubcategoryId } from './taxonomyManagement.js';

/** 2026-10-23 owner-approved labels and order, sourced from the owner's Excel, not QA ledger rows. */
export const OWNER_EXPENSE_TREE:CategoryDefinition[]=[
  {name:'JobFood',subcategories:[]},
  {name:'Καφές',subcategories:[]},
  {name:'Τσιγάρα',subcategories:[]},
  {name:'Ψιλικά',subcategories:[]},
  {name:'Φαγητό',subcategories:[]},
  {name:'Ψηφιακή υπηρεσία',subcategories:['AI & Λογισμικό','Streaming','Cloud & Αποθήκευση','VPN & Ασφάλεια','Gaming','Εκπαιδευτική εφαρμογή','Λοιπή ψηφιακή συνδρομή']},
  {name:'Όχημα',subcategories:['Βενζίνη','Service','ΚΤΕΟ','Ασφάλεια','Parking']},
  {name:'Σούπερ μάρκετ',subcategories:[]},
  {name:'Μετακίνηση',subcategories:['AthenaCard','ΚΤΕΛ','Ταξί','Ακτοπλοϊκό εισιτήριο','Αεροπορικό εισιτήριο','Τρένο','Διόδια']},
  {name:'Τηλεπικοινωνίες',subcategories:['Κινητή τηλεφωνία','Σταθερή & Internet','Δορυφορικό Internet']},
  {name:'Ψυχαγωγία',subcategories:['Κινηματογράφος','Θέατρο','Ποτό & Νυχτερινή έξοδος','Εκδήλωση']},
  {name:'Αγορά',subcategories:['Ρούχο','Παπούτσι','Ηλεκτρονική συσκευή','Λοιπή αγορά']},
  {name:'Κούρεμα',subcategories:[]},
  {name:'Λογαριασμός κατοικίας',subcategories:['Ρεύμα','Νερό','Κοινόχρηστα','Λοιπός λογαριασμός κατοικίας']},
  {name:'Δώρο & Δωρεά',subcategories:['Δώρο οικογένειας','Δώρο φίλου','Δωρεά','Οικογενειακή οικονομική ενίσχυση']},
  {name:'Χρηματοοικονομικά έξοδα',subcategories:['Τραπεζική προμήθεια','Τραπεζικό πακέτο','Χρεωστικός τόκος & Επιβάρυνση']},
  {name:'Υγεία',subcategories:['Φαρμακείο','Γιατρός','Εξέταση']},
  {name:'Ταξίδι',subcategories:['Διαμονή','Τουριστική δραστηριότητα','Λοιπό ταξιδιωτικό έξοδο']},
  {name:'Σπίτι',subcategories:['Οικιακή συσκευή','Έπιπλο & Είδος σπιτιού','Συντήρηση & Επισκευή']},
  {name:'Άλλο',subcategories:['Μη ταξινομημένο','Λοιπό έκτακτο έξοδο']},
];

export const OWNER_INCOME_TREE:CategoryDefinition[]=[
  {name:'Μισθοδοσία & Εργασία',subcategories:['Βασικός μισθός','Υπερωρία','Δώρο Χριστουγέννων','Δώρο Πάσχα','Επίδομα αδείας','Έκτακτη εργασία']},
  {name:'Δώρο & Οικογενειακή ενίσχυση',subcategories:['Οικογένεια','Φίλος','Άλλη μη επιστρεπτέα παροχή']},
  {name:'Κρατική / Ασφαλιστική παροχή',subcategories:['ΔΥΠΑ','Ασφαλιστική παροχή','Επιστροφή φόρου','Επίδομα']},
  {name:'Τόκος & Απόδοση',subcategories:['Πιστωτικός τόκος','Επενδυτική απόδοση']},
  {name:'Πώληση',subcategories:['Προσωπικό αντικείμενο','Ηλεκτρονική συσκευή','Λοιπή πώληση']},
  {name:'Άλλο πραγματικό έσοδο',subcategories:['Λοιπό μη ταξινομημένο έσοδο']},
];

const renamed:ReadonlyArray<{kind:'expense'|'income';from:string;to:string}>=[
  {kind:'expense',from:'Αγορές',to:'Αγορά'},
  {kind:'expense',from:'Λογαριασμοί',to:'Λογαριασμός κατοικίας'},
  {kind:'expense',from:'Ταξίδια',to:'Ταξίδι'},
  {kind:'expense',from:'Δώρα / οικογένεια',to:'Δώρο & Δωρεά'},
  {kind:'income',from:'Μισθός',to:'Μισθοδοσία & Εργασία'},
  {kind:'income',from:'Δώρο / οικογένεια',to:'Δώρο & Οικογενειακή ενίσχυση'},
  {kind:'income',from:'Άλλο έσοδο',to:'Άλλο πραγματικό έσοδο'},
];
const retired=[{kind:'expense',label:'Συνδρομές'},{kind:'expense',label:'Δόσεις / δάνεια'},{kind:'income',label:'Επιστροφή χρημάτων'},{kind:'income',label:'Κατάθεση'}] as const;
const renamedVehicleSubcategories=[
  {from:'Καύσιμα',to:'Βενζίνη'},
  {from:'Συντήρηση & Service',to:'Service'},
] as const;
const same=(a:string,b:string)=>categoryKey(a)===categoryKey(b);

/**
 * The retired «Συνδρομές» category must not turn every recurring payment
 * into a digital service. Only clearly identified providers are reassigned.
 */
function subscriptionPurpose(name:string):'Ψηφιακή υπηρεσία'|'Τηλεπικοινωνίες'|'Όχημα'|null{
  const label=categoryKey(name);
  const digital=/(spotify|netflix|icloud|disney\\+|youtube|chatgpt|openai|microsoft 365|onedrive|google pro|google one|cloud storage|ubisoft|fortnite|duolingo)/i;
  const telecom=/(cosmote|starlink|vodafone|nova internet|telekom)/i;
  const insurance=/(interamerican|insurance.*moto|ασφαλ.*μηχαν)/i;
  return digital.test(label)?'Ψηφιακή υπηρεσία'
    :telecom.test(label)?'Τηλεπικοινωνίες'
    :insurance.test(label)?'Όχημα'
    :null;
}

function reclassifyKnownSubscription(item:RecurringItem):RecurringItem{
  if(!same(item.category,'Συνδρομές'))return item;
  const target=subscriptionPurpose(item.name);
  if(!target&&(item.active===false||item.status==='stopped'))return item;
  if(!target)throw new Error('Το πάγιο «'+item.name+'» έχει παλιά γενική κατηγορία «Συνδρομές». Επίλεξε πρώτα τον πραγματικό σκοπό του στην καρτέλα του.');
  return {...item,category:target,subcategory:undefined};
}

function reconcileLegacySubscriptions(data:FinanceData):FinanceData{
  const recurringOverrides={...(data.state.recurringOverrides??{})};
  for(const seed of data.seed.recurring??[]){
    const existing=recurringOverrides[seed.id]??seed;
    const next=reclassifyKnownSubscription(existing);
    if(next!==existing)recurringOverrides[seed.id]=next;
  }
  const recurringCustom=(data.state.recurringCustom??[]).map(reclassifyKnownSubscription);
  const transactionRules=(data.state.transactionRules??[]).map(rule=>{
    if(!rule.enabled||!same(rule.action.category,'Συνδρομές'))return rule;
    // Only an exact provider-specific contains match is safe to reclassify;
    // general subscription rules must be explicitly reviewed by their owner.
    const target=rule.match.mode==='contains'&&rule.match.description
      ?subscriptionPurpose(rule.match.description ?? '')
      :null;
    if(!target)throw new Error('Ο ενεργός κανόνας «'+rule.name+'» χρησιμοποιεί γενική κατηγορία «Συνδρομές». Επίλεξε πρώτα τον πραγματικό σκοπό του στον επεξεργαστή κανόνων.');
    return {...rule,action:{...rule.action,category:target,subcategory:undefined}};
  });
  return {...data,state:{...data.state,recurringOverrides,recurringCustom,transactionRules}};
}

/**
 * Pure migration. Call only within an owner+AAL2 revision/history-protected save.
 * Safe to preview repeatedly; no financial transactions or historical entries are rewritten.
 * Unsupported active dependencies are rejected by taxonomyManagement rather than silently discarded.
 */
export function prepareApprovedOwnerTaxonomy(input:FinanceData,asOf:string):FinanceData{
  let data:FinanceData={...input,state:{...input.state,settings:ensureCategoryIdentities(input.state.settings)}};
  for(const {kind,from,to} of renamed){
    const present=categoryTree(data.state.settings,kind).find(item=>same(item.name,from));
    if(!present)continue;
    const identityId=taxonomyCategoryId(data.state.settings,kind,present.name);
    if(!identityId)throw new Error('Missing taxonomy identity: '+from);
    data=applyTaxonomyOperation(data,{type:'rename-category',kind,identityId,label:to},asOf);
  }
  for(const {from,to} of renamedVehicleSubcategories){
    const old=taxonomySubcategoryId(data.state.settings,'expense','Όχημα',from);
    if(old&&categoryTree(data.state.settings,'expense').some(c=>same(c.name,'Όχημα')&&c.subcategories.some(s=>same(s,from)))){
      data=applyTaxonomyOperation(data,{type:'rename-subcategory',kind:'expense',identityId:old,label:to},asOf);
    }
  }
  const combinedParking=taxonomySubcategoryId(data.state.settings,'expense','Όχημα','Parking & Διόδια');
  if(combinedParking&&categoryTree(data.state.settings,'expense').some(c=>same(c.name,'Όχημα')&&c.subcategories.some(s=>same(s,'Parking & Διόδια')))){
    data=applyTaxonomyOperation(data,{type:'retire-subcategory',kind:'expense',identityId:combinedParking},asOf);
  }
  data=reconcileLegacySubscriptions(data);
  for(const {kind,label} of retired){
    const category=categoryTree(data.state.settings,kind).find(item=>same(item.name,label));
    if(!category)continue;
    const identityId=taxonomyCategoryId(data.state.settings,kind,label);
    if(!identityId)throw new Error('Missing taxonomy identity: '+label);
    data=applyTaxonomyOperation(data,{type:'retire-category',kind,identityId},asOf);
  }
  for(const [kind,approved] of [['expense',OWNER_EXPENSE_TREE],['income',OWNER_INCOME_TREE]] as const){
    const current=categoryTree(data.state.settings,kind);
    const unexpected=current.filter(existing=>!approved.some(target=>same(existing.name,target.name)));
    if(unexpected.length)throw new Error('Unexpected active categories: '+unexpected.map(item=>item.name).join(', '));
    for(const target of approved){
      const known=categoryTree(data.state.settings,kind).find(item=>same(item.name,target.name));
      if(!known)data=applyTaxonomyOperation(data,{type:'add-category',kind,label:target.name},asOf);
      const active=categoryTree(data.state.settings,kind).find(item=>same(item.name,target.name))!;
      for(const extra of active.subcategories.filter(sub=>!target.subcategories.some(desired=>same(desired,sub)))){
        const id=taxonomySubcategoryId(data.state.settings,kind,target.name,extra);
        if(!id)throw new Error('Missing subcategory identity: '+extra);
        data=applyTaxonomyOperation(data,{type:'retire-subcategory',kind,identityId:id},asOf);
      }
      for(const sub of target.subcategories){
        const present=categoryTree(data.state.settings,kind).find(item=>same(item.name,target.name))!.subcategories.some(old=>same(old,sub));
        if(!present){
          const parentId=taxonomyCategoryId(data.state.settings,kind,target.name);
          if(!parentId)throw new Error('Missing parent identity: '+target.name);
          data=applyTaxonomyOperation(data,{type:'add-subcategory',kind,parentId,label:sub},asOf);
        }
      }
    }
  }
  const settings=ensureCategoryIdentities({...data.state.settings,
    expenseCategoryTree:OWNER_EXPENSE_TREE.map(item=>({...item,subcategories:[...item.subcategories]})),
    incomeCategoryTree:OWNER_INCOME_TREE.map(item=>({...item,subcategories:[...item.subcategories]})),
    expenseCategories:OWNER_EXPENSE_TREE.map(item=>item.name),
    incomeCategories:OWNER_INCOME_TREE.map(item=>item.name),
  });
  return {...data,state:{...data.state,settings}};
}
