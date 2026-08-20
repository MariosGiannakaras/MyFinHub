import { readFileSync, writeFileSync } from 'node:fs';

function replace(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Expected text not found in ${path}: ${oldText.slice(0, 120)}`);
  writeFileSync(path, source.replace(oldText, newText));
}

// Cards: centralized Escape handling, tooltip on icon-only bank add, direct validation copy.
replace('src/pages/CardsPage.tsx', "import { InteractivePaymentCard } from '../components/InteractivePaymentCard';\n", "import { InteractivePaymentCard } from '../components/InteractivePaymentCard';\nimport { Tooltip } from '../components/Tooltip';\n");
replace('src/pages/CardsPage.tsx', "const bankRef=useModalFocus<HTMLElement>(bankOpen,'[data-autofocus=\"true\"]');", "const bankRef=useModalFocus<HTMLElement>(bankOpen,'[data-autofocus=\"true\"]',()=>{setBankOpen(false);setError('')});");
replace('src/pages/CardsPage.tsx', "setError('Συμπλήρωσε όνομα τράπεζας.')", "setError('Γράψε το όνομα της τράπεζας για να μπορέσουμε να τη δημιουργήσουμε.')");
replace('src/pages/CardsPage.tsx', "setError('Η τράπεζα υπάρχει ήδη.')", "setError('Υπάρχει ήδη τράπεζα με αυτό το όνομα. Έλεγξε το όνομα ή χρησιμοποίησε την υπάρχουσα στήλη.')");
replace('src/pages/CardsPage.tsx', '<button type="button" className="bank-add-btn" aria-label={`Προσθήκη κάρτας στην ${bank.name}`} title="Προσθήκη κάρτας" onClick={()=>setCardBankId(bank.id)}><Plus/></button>', '<Tooltip label={`Προσθήκη κάρτας στην ${bank.name}`} side="left"><button type="button" className="bank-add-btn" aria-label={`Προσθήκη κάρτας στην ${bank.name}`} onClick={()=>setCardBankId(bank.id)}><Plus/></button></Tooltip>');
replace('src/pages/CardsPage.tsx', " onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setBankOpen(false)}}}", '');

// Lending: centralized Escape handling and actionable user copy.
replace('src/pages/LendingPage.tsx', "import { accountDisplayName } from '../lib/ui';\n", "import { accountDisplayName } from '../lib/ui';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/pages/LendingPage.tsx', "const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]');", "const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]',()=>{setOpen(false);setError('')});");
replace('src/pages/LendingPage.tsx', "setError('Συμπλήρωσε το πρόσωπο.')", "setError('Γράψε το όνομα του προσώπου για να ξέρεις σε ποιον αφορά η κίνηση.')");
replace('src/pages/LendingPage.tsx', "setError('Βάλε θετικό ποσό.')", "setError('Έλεγξε το ποσό — πρέπει να είναι μεγαλύτερο από μηδέν.')");
replace('src/pages/LendingPage.tsx', "setError(e instanceof Error?e.message:'Δεν ήταν δυνατή η καταχώριση.')", "setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))");
replace('src/pages/LendingPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close()}}}", '');

// Recurring: centralized Escape, tooltips on icon-only desktop actions, actionable copy.
replace('src/pages/RecurringPage.tsx', "import { LongTermLoanSummary } from '../components/LongTermLoanSummary';\n", "import { LongTermLoanSummary } from '../components/LongTermLoanSummary';\nimport { Tooltip } from '../components/Tooltip';\n");
replace('src/pages/RecurringPage.tsx', "import { accountDisplayName } from '../lib/ui';\n", "import { accountDisplayName } from '../lib/ui';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/pages/RecurringPage.tsx', "const editRef=useModalFocus<HTMLElement>(Boolean(edit),'input');const payRef=useModalFocus<HTMLElement>(Boolean(pay),'input');", "const editRef=useModalFocus<HTMLElement>(Boolean(edit),'input',()=>{setEdit(null);setEditError('')});const payRef=useModalFocus<HTMLElement>(Boolean(pay),'input',()=>{setPay(null);setPayError('')});");
replace('src/pages/RecurringPage.tsx', "setPayError('Βάλε θετικό ποσό πληρωμής.')", "setPayError('Έλεγξε το ποσό πληρωμής — πρέπει να είναι μεγαλύτερο από μηδέν.')");
replace('src/pages/RecurringPage.tsx', "setPayError(e instanceof Error?e.message:'Η πληρωμή απέτυχε.')", "setPayError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την πληρωμή. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))");
replace('src/pages/RecurringPage.tsx', '<button type="button" aria-label={`Επεξεργασία ${item.name}`} onClick={()=>startEdit(item)}><Pencil/></button><button type="button" aria-label={`Παύση ${item.name}`} onClick={()=>setLifecycle(item,\'paused\')}><PauseCircle/></button><button type="button" aria-label={`Διακοπή ${item.name}`} onClick={()=>setLifecycle(item,\'stopped\')}><Archive/></button>', '<Tooltip label={`Επεξεργασία ${item.name}`} side="left"><button type="button" aria-label={`Επεξεργασία ${item.name}`} onClick={()=>startEdit(item)}><Pencil/></button></Tooltip><Tooltip label={`Παύση ${item.name}`} side="left"><button type="button" aria-label={`Παύση ${item.name}`} onClick={()=>setLifecycle(item,\'paused\')}><PauseCircle/></button></Tooltip><Tooltip label={`Διακοπή ${item.name}`} side="left"><button type="button" aria-label={`Διακοπή ${item.name}`} onClick={()=>setLifecycle(item,\'stopped\')}><Archive/></button></Tooltip>');
replace('src/pages/RecurringPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closeEdit()}}}", '');
replace('src/pages/RecurringPage.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();closePay()}}}", '');

// Quick Add: keep dirty-state confirmation while centralizing Escape and sanitize thrown errors.
replace('src/components/QuickAdd.tsx', "import { accountDisplayName } from '../lib/ui';\n", "import { accountDisplayName } from '../lib/ui';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/components/QuickAdd.tsx', "  const modalRef = useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]');\n", '');
replace('src/components/QuickAdd.tsx', "  const requestClose=()=>{if(dirty&&!window.confirm('Να κλείσει η καταχώριση; Οι μη αποθηκευμένες αλλαγές θα χαθούν.'))return;onClose()};\n", "  const requestClose=()=>{if(dirty&&!window.confirm('Έχεις αλλαγές που δεν έχουν αποθηκευτεί. Θέλεις να κλείσεις την καταχώριση και να τις απορρίψεις;'))return;onClose()};\n  const modalRef=useModalFocus<HTMLElement>(open,'[data-autofocus=\"true\"]',requestClose);\n");
replace('src/components/QuickAdd.tsx', "}catch(e){setError(e instanceof Error?e.message:'Δεν ήταν δυνατή η καταχώριση.')}", "}catch(e){setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την κίνηση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}");
replace('src/components/QuickAdd.tsx', " onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();requestClose()}}}", '');

// Savings: sanitize thrown error messages.
replace('src/pages/SavingsPage.tsx', "import { accountDisplayName, ratioPercent } from '../lib/ui';\n", "import { accountDisplayName, ratioPercent } from '../lib/ui';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/pages/SavingsPage.tsx', "setError(e instanceof Error?e.message:'Δεν ήταν δυνατή η αποταμίευση.')", "setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την αποταμίευση. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))");

// Credit + Loans: sanitize exceptional failures without hiding actionable validation.
replace('src/pages/CreditCardPage.tsx', "import { accountDisplayName } from '../lib/ui';\n", "import { accountDisplayName } from '../lib/ui';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/pages/CreditCardPage.tsx', "setError(e instanceof Error?e.message:'Η αγορά δεν καταχωρίστηκε.')", "setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την αγορά. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))");
replace('src/pages/CreditCardPage.tsx', "setError(e instanceof Error?e.message:'Η αποπληρωμή δεν καταχωρίστηκε.')", "setError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την αποπληρωμή. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))");
replace('src/pages/LoansPage.tsx', "import { accountDisplayName } from '../lib/ui';\n", "import { accountDisplayName } from '../lib/ui';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/pages/LoansPage.tsx', "setPayError(e instanceof Error?e.message:'Η πληρωμή δεν καταχωρίστηκε.')", "setPayError(userErrorMessage(e,'Δεν μπορέσαμε να καταχωρίσουμε την πληρωμή. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))");

// Settings: never surface raw import/backup exceptions.
replace('src/pages/SettingsPage.tsx', "import { MAX_FINANCE_DOCUMENT_BYTES } from '../lib/limits';\n", "import { MAX_FINANCE_DOCUMENT_BYTES } from '../lib/limits';\nimport { userErrorMessage } from '../lib/userMessage';\n");
replace('src/pages/SettingsPage.tsx', "setMessage(e instanceof Error?e.message:'Η εισαγωγή απέτυχε.')", "setMessage(userErrorMessage(e,'Δεν μπορέσαμε να εισαγάγουμε το αρχείο. Έλεγξε ότι είναι έγκυρο backup του MyFinHub και δοκίμασε ξανά.'))");
replace('src/pages/SettingsPage.tsx', "setMessage(e instanceof Error?e.message:'Η δημιουργία backup απέτυχε.')", "setMessage(userErrorMessage(e,'Δεν μπορέσαμε να δημιουργήσουμε το backup. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.'))");

console.log('Modal and user-message hardening applied.');
