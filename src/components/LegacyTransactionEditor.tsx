import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { categoryTree, subcategoriesFor } from '../lib/categories';
import { allAccounts } from '../lib/domain';
import { normalizeLegacyOverride } from '../lib/legacyTransactions';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, LegacyTransaction } from '../types';
import { AppDateInput } from './AppDateInput';
import { AppSelectInput } from './AppSelectInput';
import { FormError } from './FormError';
import { MoneyInput } from './MoneyInput';

const typeLabels: Record<LegacyTransaction['type'], string> = {
  expense: 'Έξοδο',
  income: 'Έσοδο',
  transfer: 'Μεταφορά',
  adjustment: 'Διόρθωση υπολοίπου',
};

function optionsWithCurrent(values: string[], current?: string) {
  const result = [...values];
  if (current && !result.includes(current)) result.unshift(current);
  return result;
}

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
  const modalRef = useModalFocus<HTMLElement>(true, '[data-autofocus="true"]', onClose);
  const categoryKind = type === 'income' ? 'income' : 'expense';
  const categories = useMemo(() => optionsWithCurrent(categoryTree(data.state.settings, categoryKind).map((item) => item.name), category), [data.state.settings, categoryKind, category]);
  const subcategories = useMemo(() => optionsWithCurrent(subcategoriesFor(data.state.settings, categoryKind, category), subcategory), [data.state.settings, categoryKind, category, subcategory]);

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

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section ref={modalRef} className="quick-modal legacy-transaction-editor neo-raised" role="dialog" aria-modal="true" aria-labelledby="legacy-editor-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>ΙΣΤΟΡΙΚΗ ΚΙΝΗΣΗ</small><h2 id="legacy-editor-title">Επεξεργασία συναλλαγής</h2><p>Η αλλαγή αποθηκεύεται ως override. Το αρχικό εισαγόμενο record παραμένει ανέπαφο.</p></div><button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας ιστορικής κίνησης" onClick={onClose}><X aria-hidden="true"/></button></header>
      <div className="form-grid">
        <label><span>Τύπος</span><AppSelectInput aria-label="Τύπος ιστορικής κίνησης" value={type} onChange={(event) => changeType(event.target.value as LegacyTransaction['type'])}>{(Object.keys(typeLabels) as LegacyTransaction['type'][]).map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}</AppSelectInput></label>
        <label><span>Ημερομηνία</span><AppDateInput aria-label="Ημερομηνία ιστορικής κίνησης" value={date} onChange={(event) => setDate(event.target.value)}/></label>
        <label><span>Ποσό</span><MoneyInput data-autofocus="true" aria-label="Ποσό ιστορικής κίνησης" value={amount} onValueChange={setAmount} invalid={Boolean(error && !Number.isFinite(Number(amount.replace(',', '.'))))}/></label>
        {type === 'transfer' ? <>
          <label><span>Από λογαριασμό</span><AppSelectInput aria-label="Λογαριασμός προέλευσης ιστορικής μεταφοράς" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>
          <label><span>Προς λογαριασμό</span><AppSelectInput aria-label="Λογαριασμός προορισμού ιστορικής μεταφοράς" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>
        </> : <label><span>Λογαριασμός</span><AppSelectInput aria-label="Λογαριασμός ιστορικής κίνησης" value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayName(data, account.id)}</option>)}</AppSelectInput></label>}
        <label><span>Κατηγορία</span><AppSelectInput aria-label="Κατηγορία ιστορικής κίνησης" value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory(''); }}><option value="">Χωρίς κατηγορία</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</AppSelectInput></label>
        <label><span>Υποκατηγορία</span><AppSelectInput aria-label="Υποκατηγορία ιστορικής κίνησης" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} disabled={!category}><option value="">Κληρονομεί / καμία</option>{subcategories.map((value) => <option key={value} value={value}>{value}</option>)}</AppSelectInput></label>
        <label className="full"><span>Περιγραφή / σχόλιο</span><textarea aria-label="Περιγραφή ιστορικής κίνησης" value={note} onChange={(event) => setNote(event.target.value)} rows={4}/></label>
      </div>
      {error ? <FormError id="legacy-transaction-edit-error">{error}</FormError> : null}
      <footer className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Ακύρωση</button><button type="button" className="save-button" onClick={submit}>Αποθήκευση override</button></footer>
    </section>
  </div>;
}
