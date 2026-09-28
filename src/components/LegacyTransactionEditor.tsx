import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { allAccounts } from '../lib/domain';
import { normalizeLegacyOverride } from '../lib/legacyTransactions';
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

const typeLabels: Record<LegacyTransaction['type'], string> = {
  expense: 'Έξοδο',
  income: 'Έσοδο',
  transfer: 'Μεταφορά',
  adjustment: 'Διόρθωση υπολοίπου',
};

export function LegacyTransactionEditor({ data, transaction, onSave, onClose }: {
  data: FinanceData;
  transaction: LegacyTransaction;
  onSave: (transaction: LegacyTransaction) => void;
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
  const categoryKind = type === 'income' ? 'income' : 'expense';

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

  const submit = () => {
    try {
      const numeric = Number(amount.replace(',', '.'));
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
      onSave(normalized);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Δεν ήταν δυνατή η αποθήκευση της ιστορικής κίνησης.');
    }
  };

  return <DialogShell
    open={true}
    className="legacy-transaction-editor"
    role="dialog"
    ariaLabelledBy="legacy-editor-title"
    motionMode="none"
    preferredFocus='[data-autofocus="true"]'
    onRequestClose={onClose}
  >
    <header><div><small>ΙΣΤΟΡΙΚΗ ΚΙΝΗΣΗ</small><h2 id="legacy-editor-title">Επεξεργασία συναλλαγής</h2><p>Η αλλαγή αποθηκεύεται ως override. Το αρχικό εισαγόμενο record παραμένει ανέπαφο.</p></div><IconButton type="button" aria-label="Κλείσιμο επεξεργασίας ιστορικής κίνησης" onClick={onClose}><X aria-hidden="true"/></IconButton></header>
    <div className="form-grid">
      <label><span>Τύπος</span><AppSelectInput aria-label="Τύπος ιστορικής κίνησης" value={type} onChange={(event) => changeType(event.target.value as LegacyTransaction['type'])}>{(Object.keys(typeLabels) as LegacyTransaction['type'][]).map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</AppSelectInput></label>
      <label><span>Ημερομηνία</span><AppDateInput aria-label="Ημερομηνία ιστορικής κίνησης" value={date} onChange={(event) => setDate(event.target.value)}/></label>
      <label><span>Ποσό</span><MoneyInput data-autofocus="true" aria-label="Ποσό ιστορικής κίνησης" value={amount} onValueChange={setAmount} invalid={Boolean(error && !Number.isFinite(Number(amount.replace(',', '.'))))}/></label>
      {type === 'transfer' ? <>
        <label><span>Από λογαριασμό</span><AppSelectInput aria-label="Λογαριασμός προέλευσης ιστορικής μεταφοράς" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>
        <label><span>Προς λογαριασμό</span><AppSelectInput aria-label="Λογαριασμός προορισμού ιστορικής μεταφοράς" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>
      </> : <label><span>Λογαριασμός</span><AppSelectInput aria-label="Λογαριασμός ιστορικής κίνησης" value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>}
      <label><span>Κατηγορία / υποκατηγορία</span><CategorySelectInput settings={data.state.settings} kind={categoryKind} category={category} subcategory={subcategory} allowEmpty emptyLabel="Χωρίς κατηγορία" aria-label="Κατηγορία ή υποκατηγορία ιστορικής κίνησης" onChange={(selection) => { setCategory(selection.category); setSubcategory(selection.subcategory); }}/></label>
      <label className="full"><span>Περιγραφή / σχόλιο</span><AppTextarea aria-label="Περιγραφή ιστορικής κίνησης" value={note} onChange={(event) => setNote(event.target.value)} rows={4}/></label>
    </div>
    {error ? <FormError id="legacy-transaction-edit-error">{error}</FormError> : null}
    <footer className="editor-actions"><Button type="button" variant="secondary" onClick={onClose}>Ακύρωση</Button><Button type="button" variant="primary" onClick={submit}>Αποθήκευση override</Button></footer>
  </DialogShell>;
}
