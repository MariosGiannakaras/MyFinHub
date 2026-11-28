import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { allAccounts } from '../lib/domain';
import { normalizeLegacyOverride } from '../lib/legacyTransactions';
import { parseMoneyInputAmount } from '../lib/moneyInput';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, LegacyTransaction } from '../types';
import { AppDateInput } from './AppDateInput';
import { AppSelectInput } from './AppSelectInput';
import { AppTextarea } from './AppTextarea';
import { Button } from './Button';
import { CategorySelectInput } from './CategorySelectInput';
import { DialogShell } from './DialogShell';
import { FormError } from './FormError';
import { IconButton } from './IconButton';
import { MoneyInput } from './MoneyInput';
import { userErrorMessage } from '../lib/userMessage';

const typeLabels: Record<LegacyTransaction['type'], string> = {
  expense: 'Έξοδο',
  income: 'Έσοδο',
  transfer: 'Μεταφορά',
  adjustment: 'Διόρθωση υπολοίπου',
};

export function LegacyTransactionEditor({ data, transaction, onSave, onClose }: {
  data: FinanceData;
  transaction: LegacyTransaction;
  onSave: (transaction: LegacyTransaction) => Promise<void>;
  onClose: () => void;
}) {
  const accounts = useMemo(() => allAccounts(data).filter((account) => account.kind !== 'credit'), [data]);
  const [type, setType] = useState<LegacyTransaction['type']>(transaction.type);
  const [date, setDate] = useState(transaction.date);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [note, setNote] = useState(transaction.note);
  const [category, setCategory] = useState(transaction.category ?? '');
  const [subcategory, setSubcategory] = useState(transaction.subcategory ?? '');
  const [accountId, setAccountId] = useState(transaction.accountId ?? accounts[0]?.id ?? '');
  const [fromAccountId, setFromAccountId] = useState(transaction.fromAccountId ?? transaction.accountId ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(transaction.toAccountId ?? accounts.find((account) => account.id !== (transaction.fromAccountId ?? transaction.accountId))?.id ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const categoryKind = type === 'income' ? 'income' : 'expense';
  // Preserve an unchanged imported amount (including historical precision).
  // New amount/type edits must use the same strict cent parser as Quick Entry.
  const numeric = amount === String(transaction.amount) && type === transaction.type
    ? transaction.amount : parseMoneyInputAmount(amount, type === 'adjustment');
  const amountInvalid = numeric === null || !Number.isFinite(numeric) || (type === 'adjustment' ? numeric === 0 : numeric <= 0);

  const changeType = (next: LegacyTransaction['type']) => {
    setType(next);
    setError('');
    if (next === 'transfer') {
      const from = fromAccountId || accountId || accounts[0]?.id || '';
      setFromAccountId(from);
      if (!toAccountId || toAccountId === from) setToAccountId(accounts.find((account) => account.id !== from)?.id ?? '');
    } else if (!accountId) {
      setAccountId(fromAccountId || accounts[0]?.id || '');
    }
  };

  const submit = async () => {
    if(saving)return;
    try {
      if (numeric === null || amountInvalid) throw new Error('Συμπλήρωσε έγκυρο ποσό με έως δύο δεκαδικά ψηφία.');
      const normalized = normalizeLegacyOverride(data, {
        ...transaction,
        type,
        date,
        amount: numeric,
        note,
        category: category || undefined,
        subcategory: subcategory || undefined,
        accountId: type === 'transfer' ? undefined : accountId,
        fromAccountId: type === 'transfer' ? fromAccountId : undefined,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
      });
      setSaving(true);
      await onSave(normalized);
      onClose();
    } catch (cause) {
      setError(userErrorMessage(cause,'Δεν ήταν δυνατή η αποθήκευση της ιστορικής κίνησης.'));
    } finally {
      setSaving(false);
    }
  };

  return <DialogShell
    open={true}
    className="legacy-transaction-editor"
    busy={saving}
    role="dialog"
    ariaLabelledBy="legacy-editor-title"
    motionMode="none"
    preferredFocus='[data-autofocus="true"]'
    onRequestClose={()=>{if(!saving)onClose()}}
  >
    <header><div><small>ΙΣΤΟΡΙΚΗ ΚΙΝΗΣΗ</small><h2 id="legacy-editor-title">Επεξεργασία συναλλαγής</h2><p>Η αλλαγή αποθηκεύεται ως override. Το αρχικό εισαγόμενο record παραμένει ανέπαφο.</p></div><IconButton type="button" aria-label="Κλείσιμο επεξεργασίας ιστορικής κίνησης" disabled={saving} onClick={onClose}><X aria-hidden="true"/></IconButton></header>
    <div className="form-grid" inert={saving}>
      <label><span>Τύπος</span><AppSelectInput aria-label="Τύπος ιστορικής κίνησης" value={type} onChange={(event) => changeType(event.target.value as LegacyTransaction['type'])}>{(Object.keys(typeLabels) as LegacyTransaction['type'][]).map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</AppSelectInput></label>
      <label><span>Ημερομηνία</span><AppDateInput aria-label="Ημερομηνία ιστορικής κίνησης" value={date} onChange={(event) => setDate(event.target.value)}/></label>
      <label><span>Ποσό</span><MoneyInput data-autofocus="true" aria-label="Ποσό ιστορικής κίνησης" value={amount} onValueChange={setAmount} invalid={Boolean(error && amountInvalid)}/></label>
      {type === 'transfer' ? <>
        <label><span>Από λογαριασμό</span><AppSelectInput aria-label="Λογαριασμός προέλευσης ιστορικής μεταφοράς" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>
        <label><span>Προς λογαριασμό</span><AppSelectInput aria-label="Λογαριασμός προορισμού ιστορικής μεταφοράς" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>
      </> : <label><span>Λογαριασμός</span><AppSelectInput aria-label="Λογαριασμός ιστορικής κίνησης" value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>}
      <label><span>Κατηγορία / υποκατηγορία</span><CategorySelectInput settings={data.state.settings} kind={categoryKind} category={category} subcategory={subcategory} allowEmpty emptyLabel="Χωρίς κατηγορία" aria-label="Κατηγορία ή υποκατηγορία ιστορικής κίνησης" onChange={(selection) => { setCategory(selection.category); setSubcategory(selection.subcategory); }}/></label>
      <label className="full"><span>Περιγραφή / σχόλιο</span><AppTextarea aria-label="Περιγραφή ιστορικής κίνησης" value={note} onChange={(event) => setNote(event.target.value)} rows={4}/></label>
    </div>
    {error ? <FormError id="legacy-transaction-edit-error">{error}</FormError> : null}
    <footer className="editor-actions"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Ακύρωση</Button><Button type="button" variant="primary" disabled={saving} onClick={()=>void submit()}>{saving?'Αποθήκευση…':'Αποθήκευση override'}</Button></footer>
  </DialogShell>;
}
