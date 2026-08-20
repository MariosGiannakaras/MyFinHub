import { readFileSync, writeFileSync } from 'node:fs';

function replace(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Expected text not found in ${path}: ${oldText.slice(0, 120)}`);
  writeFileSync(path, source.replace(oldText, newText));
}

// Persisted readability preference: server validation + QA fixture.
replace('server/validation.ts',
  "  if (value.motion !== undefined) oneOf(value.motion, ['system','reduced','full'], 'state.settings.motion');\n",
  "  if (value.motion !== undefined) oneOf(value.motion, ['system','reduced','full'], 'state.settings.motion');\n  if (value.textSize !== undefined) oneOf(value.textSize, ['compact','normal','large'], 'state.settings.textSize');\n",
);
replace('src/qaFixture.ts', "creditLimit:2000,motion:'system'", "creditLimit:2000,motion:'system',textSize:'normal'");

// Loans: explicit sort direction, stable ties, centralized Escape close, friendlier validation copy.
replace('src/pages/LoansPage.tsx',
  "import { AppSelectInput } from '../components/AppSelectInput';\n",
  "import { AppSelectInput } from '../components/AppSelectInput';\nimport { SortDirectionControl, type SortDirection } from '../components/SortDirectionControl';\n",
);
replace('src/pages/LoansPage.tsx',
  "const [sort,setSort]=useState<SortKey>('remaining');",
  "const [sort,setSort]=useState<SortKey>('remaining');const [sortDirection,setSortDirection]=useState<SortDirection>('desc');",
);
replace('src/pages/LoansPage.tsx',
  "const editRef=useModalFocus<HTMLElement>(Boolean(edit),'input');const payRef=useModalFocus<HTMLElement>(Boolean(pay),'input');",
  "const editRef=useModalFocus<HTMLElement>(Boolean(edit),'input',()=>setEdit(null));const payRef=useModalFocus<HTMLElement>(Boolean(pay),'input',()=>setPay(null));",
);
replace('src/pages/LoansPage.tsx',
  "const sorted=useMemo(()=>[...loans].sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name,'el');if(sort==='amount')return loanOutstanding(data,b)-loanOutstanding(data,a);if(sort==='next')return (typicalLoanPaymentDay(data,a)??99)-(typicalLoanPaymentDay(data,b)??99);return loanRemainingInstallments(data,b)-loanRemainingInstallments(data,a)||loanOutstanding(data,b)-loanOutstanding(data,a)}),[loans,sort,data]);",
  "const sorted=useMemo(()=>{const direction=sortDirection==='asc'?1:-1;return [...loans].sort((a,b)=>{let result=0;if(sort==='name')result=a.name.localeCompare(b.name,'el');else if(sort==='amount')result=loanOutstanding(data,a)-loanOutstanding(data,b);else if(sort==='next')result=(typicalLoanPaymentDay(data,a)??99)-(typicalLoanPaymentDay(data,b)??99);else result=loanRemainingInstallments(data,a)-loanRemainingInstallments(data,b)||loanOutstanding(data,a)-loanOutstanding(data,b);return direction*(result||a.id.localeCompare(b.id))})},[loans,sort,sortDirection,data]);",
);
replace('src/pages/LoansPage.tsx',
  "<section className=\"loan-toolbar neo-flat\"><label>Ταξινόμηση <AppSelectInput aria-label=\"Ταξινόμηση δόσεων και δανείων\" value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value=\"remaining\">Περισσότερες δόσεις που απομένουν</option><option value=\"amount\">Μεγαλύτερο υπόλοιπο</option><option value=\"next\">Νωρίτερη συνήθης ημέρα</option><option value=\"name\">Όνομα</option></AppSelectInput></label><span>{loans.length} ενεργές/ιστορικές υποχρεώσεις</span></section>",
  "<section className=\"loan-toolbar neo-flat\"><div className=\"loan-sort-controls\"><label>Ταξινόμηση <AppSelectInput aria-label=\"Κριτήριο ταξινόμησης δόσεων και δανείων\" value={sort} onChange={e=>setSort(e.target.value as SortKey)}><option value=\"remaining\">Δόσεις που απομένουν</option><option value=\"amount\">Υπόλοιπο</option><option value=\"next\">Συνήθης ημέρα</option><option value=\"name\">Όνομα</option></AppSelectInput></label><SortDirectionControl value={sortDirection} onChange={setSortDirection} label=\"Κατεύθυνση ταξινόμησης δόσεων και δανείων\"/></div><span>{loans.length} ενεργές/ιστορικές υποχρεώσεις</span></section>",
);
replace('src/pages/LoansPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeEdit()}}}", '');
replace('src/pages/LoansPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closePay()}}}", '');
replace('src/pages/LoansPage.tsx', "setEditError('Συμπλήρωσε όνομα.')", "setEditError('Γράψε ένα όνομα για την υποχρέωση ώστε να μπορείς να την αναγνωρίζεις.')");
replace('src/pages/LoansPage.tsx', "setEditError('Το συνολικό ποσό πρέπει να είναι θετικό.')", "setEditError('Έλεγξε το συνολικό ποσό — πρέπει να είναι μεγαλύτερο από μηδέν.')");
replace('src/pages/LoansPage.tsx', "setEditError('Ο αριθμός δόσεων πρέπει να είναι θετικός ακέραιος.')", "setEditError('Έλεγξε τον αριθμό δόσεων — χρειάζεται θετικός ακέραιος αριθμός.')");
replace('src/pages/LoansPage.tsx', "setEditError('Το ποσό δόσης πρέπει να είναι θετικό.')", "setEditError('Έλεγξε το ποσό της δόσης — πρέπει να είναι μεγαλύτερο από μηδέν.')");
replace('src/pages/LoansPage.tsx', "setPayError('Βάλε θετικό ποσό πληρωμής.')", "setPayError('Έλεγξε το ποσό πληρωμής — πρέπει να είναι μεγαλύτερο από μηδέν.')");

// Credit: explicit ASC/DESC on purchases and repayments, centralized Escape, actionable copy.
replace('src/pages/CreditCardPage.tsx',
  "import { InteractivePaymentCard } from '../components/InteractivePaymentCard';\n",
  "import { InteractivePaymentCard } from '../components/InteractivePaymentCard';\nimport { SortDirectionControl, type SortDirection } from '../components/SortDirectionControl';\nimport { Tooltip } from '../components/Tooltip';\n",
);
replace('src/pages/CreditCardPage.tsx',
  "const [selectedCardId,setSelectedCardId]=useState('');",
  "const [selectedCardId,setSelectedCardId]=useState('');const [purchaseSortDirection,setPurchaseSortDirection]=useState<SortDirection>('desc');const [paymentSortDirection,setPaymentSortDirection]=useState<SortDirection>('desc');",
);
replace('src/pages/CreditCardPage.tsx',
  "const purchases=useMemo(()=>cardEvents.filter(event=>event.kind==='card_purchase').sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[cardEvents]);",
  "const purchases=useMemo(()=>{const direction=purchaseSortDirection==='asc'?1:-1;return cardEvents.filter(event=>event.kind==='card_purchase').sort((a,b)=>direction*(a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)))},[cardEvents,purchaseSortDirection]);",
);
replace('src/pages/CreditCardPage.tsx',
  "const payments=useMemo(()=>cardEvents.filter(event=>event.kind==='card_payment'&&!event.loanId).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[cardEvents]);",
  "const payments=useMemo(()=>{const direction=paymentSortDirection==='asc'?1:-1;return cardEvents.filter(event=>event.kind==='card_payment'&&!event.loanId).sort((a,b)=>direction*(a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)))},[cardEvents,paymentSortDirection]);",
);
replace('src/pages/CreditCardPage.tsx',
  "const purchaseRef=useModalFocus<HTMLElement>(purchaseOpen,'[data-autofocus=\"true\"]');const repayRef=useModalFocus<HTMLElement>(repayOpen,'[data-autofocus=\"true\"]');",
  "const purchaseRef=useModalFocus<HTMLElement>(purchaseOpen,'[data-autofocus=\"true\"]',()=>setPurchaseOpen(false));const repayRef=useModalFocus<HTMLElement>(repayOpen,'[data-autofocus=\"true\"]',()=>setRepayOpen(false));",
);
replace('src/pages/CreditCardPage.tsx', "setError('Βάλε θετικό ποσό αγοράς.')", "setError('Έλεγξε το ποσό της αγοράς — πρέπει να είναι μεγαλύτερο από μηδέν.')");
replace('src/pages/CreditCardPage.tsx', "setError('Βάλε θετικό ποσό αποπληρωμής.')", "setError('Έλεγξε το ποσό αποπληρωμής — πρέπει να είναι μεγαλύτερο από μηδέν.')");
replace('src/pages/CreditCardPage.tsx', "setMessage('Το όριο πρέπει να είναι μη αρνητικός αριθμός.')", "setMessage('Έλεγξε το όριο που έβαλες — χρειάζεται αριθμός ίσος ή μεγαλύτερος από μηδέν.')");
replace('src/pages/CreditCardPage.tsx',
  '<div className="panel-head"><div><span>Αγορές πιστωτικής</span><small>{card?`Ιστορικό μόνο για «${card.nickname}».`:\'Επίλεξε πιστωτική κάρτα.\'}</small></div><WalletCards/></div>',
  '<div className="panel-head"><div><span>Αγορές πιστωτικής</span><small>{card?`Ιστορικό μόνο για «${card.nickname}».`:\'Επίλεξε πιστωτική κάρτα.\'}</small></div><div className="panel-head-actions"><SortDirectionControl value={purchaseSortDirection} onChange={setPurchaseSortDirection} label="Σειρά αγορών πιστωτικής ανά ημερομηνία"/><WalletCards/></div></div>',
);
replace('src/pages/CreditCardPage.tsx', '<thead><tr><th>Ημερομηνία</th><th>Περιγραφή</th><th>Κατηγορία</th>', '<thead><tr><th aria-sort={purchaseSortDirection===\'asc\'?\'ascending\':\'descending\'}>Ημερομηνία</th><th>Περιγραφή</th><th>Κατηγορία</th>');
replace('src/pages/CreditCardPage.tsx',
  '<div className="panel-head"><div><span>Αποπληρωμές πιστωτικής</span><small>Μειώνουν μόνο την οφειλή της επιλεγμένης κάρτας και τον λογαριασμό πληρωμής, χωρίς δεύτερο έξοδο.</small></div><ReceiptText/></div>',
  '<div className="panel-head"><div><span>Αποπληρωμές πιστωτικής</span><small>Μειώνουν μόνο την οφειλή της επιλεγμένης κάρτας και τον λογαριασμό πληρωμής, χωρίς δεύτερο έξοδο.</small></div><div className="panel-head-actions"><SortDirectionControl value={paymentSortDirection} onChange={setPaymentSortDirection} label="Σειρά αποπληρωμών πιστωτικής ανά ημερομηνία"/><ReceiptText/></div></div>',
);
replace('src/pages/CreditCardPage.tsx', '<thead><tr><th>Ημερομηνία</th><th>Από λογαριασμό</th>', '<thead><tr><th aria-sort={paymentSortDirection===\'asc\'?\'ascending\':\'descending\'}>Ημερομηνία</th><th>Από λογαριασμό</th>');
replace('src/pages/CreditCardPage.tsx',
  '<button type="button" className="inline-icon-action" aria-label="Αλλαγή ορίου πιστωτικής" onClick={editLimit}><Pencil/></button>',
  '<Tooltip label="Αλλαγή ορίου πιστωτικής" side="top"><button type="button" className="inline-icon-action" aria-label="Αλλαγή ορίου πιστωτικής" onClick={editLimit}><Pencil/></button></Tooltip>',
);
replace('src/pages/CreditCardPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closePurchase()}}}", '');
replace('src/pages/CreditCardPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeRepay()}}}", '');

// Savings: shared Escape behavior + direct validation copy.
replace('src/pages/SavingsPage.tsx',
  "const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]');",
  "const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]',()=>setOpen(false));",
);
replace('src/pages/SavingsPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close()}}}", '');
replace('src/pages/SavingsPage.tsx', "setError('Βάλε θετικό ποσό αποταμίευσης.')", "setError('Έλεγξε το ποσό αποταμίευσης — πρέπει να είναι μεγαλύτερο από μηδέν.')");

// Shared styles for sorting controls and denser responsive layout.
const cssPath='src/styles/part30.css';
let css=readFileSync(cssPath,'utf8');
css += `\n.sort-direction-control{display:inline-flex;align-items:center;gap:4px;padding:3px;border:1px solid var(--line);border-radius:10px;background:#eef3fa}\n.sort-direction-control button{border:0;border-radius:7px;background:transparent;padding:6px 8px;min-height:30px;font-size:var(--ux-tiny-size);font-weight:750;color:var(--muted);cursor:pointer}\n.sort-direction-control button.active{background:#fff;color:var(--blue);box-shadow:var(--shadow-soft)}\n.transaction-sort-summary,.loan-sort-controls,.panel-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.loan-sort-controls label{display:flex;align-items:center;gap:8px}\n.panel-head-actions>svg{flex:0 0 auto}\n@media(max-width:720px){.transaction-sort-summary,.loan-sort-controls{width:100%;align-items:stretch}.loan-sort-controls label{width:100%;justify-content:space-between}.sort-direction-control{align-self:flex-start}.panel-head-actions{width:100%;justify-content:space-between}}\n`;
writeFileSync(cssPath,css);

console.log('Coordinated UX hardening transformations applied.');
