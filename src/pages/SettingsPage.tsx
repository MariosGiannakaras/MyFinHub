import { Database, Download, FileJson, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AccountMetadataSettings } from '../components/AccountMetadataSettings';
import { AppSelectInput } from '../components/AppSelectInput';
import { BudgetRuleSettings } from '../components/BudgetRuleSettings';
import { CategoryIconsWorkspace } from '../components/CategoryIconsWorkspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DesktopUpdatePanel } from '../components/DesktopUpdatePanel';
import { KeyboardShortcutsPanel } from '../components/KeyboardShortcutsPanel';
import { ReadabilitySettings } from '../components/ReadabilitySettings';
import { categoryTree } from '../lib/categories';
import { allAccounts } from '../lib/domain';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../lib/limits';
import { taxonomyOperationPreview, type TaxonomyOperation } from '../lib/taxonomyManagement';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, FinanceSettings, MonthlyBudget, TransactionRule } from '../types';
import './SettingsPage.css';

type SettingsTab = 'general' | 'profile' | 'accounts' | 'budgets' | 'categories' | 'icons' | 'rules' | 'data';

type SettingsTabDefinition = {
  id: SettingsTab;
  label: string;
};

const SETTINGS_TABS: SettingsTabDefinition[] = [
  { id: 'general', label: 'Γενικά' },
  { id: 'profile', label: 'Λογαριασμός' },
  { id: 'accounts', label: 'Λογαριασμοί' },
  { id: 'budgets', label: 'Προϋπολογισμοί & Στόχοι' },
  { id: 'categories', label: 'Κατηγορίες' },
  { id: 'icons', label: 'Εικονίδια' },
  { id: 'rules', label: 'Κανόνες' },
  { id: 'data', label: 'Δεδομένα' },
];

function cloneSettings(settings: FinanceSettings): FinanceSettings {
  return {
    ...settings,
    motion: 'full',
    accountNames: { ...settings.accountNames },
    expenseCategories: [...settings.expenseCategories],
    incomeCategories: [...settings.incomeCategories],
    expenseCategoryTree: categoryTree(settings, 'expense').map((item) => ({ ...item, subcategories: [...item.subcategories] })),
    incomeCategoryTree: categoryTree(settings, 'income').map((item) => ({ ...item, subcategories: [...item.subcategories] })),
    categoryIcons: { ...(settings.categoryIcons ?? {}) },
    subcategoryIcons: { ...(settings.subcategoryIcons ?? {}) },
    categoryIdentities: Object.fromEntries(
      Object.entries(settings.categoryIdentities ?? {}).map(([id, record]) => [
        id,
        { ...record, aliases: [...(record.aliases ?? [])], parentAliases: record.parentAliases ? [...record.parentAliases] : undefined },
      ]),
    ),
  };
}

function backupFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `MyFinHub-backup-${stamp}.json`;
}

function downloadJson(data: FinanceData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFilename();
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function SettingsPage({
  data,
  asOf,
  filePath,
  lastSavedAt,
  onImport,
  onBackup,
  onSettings,
  onTaxonomyOperation,
  onUpsertBudget,
  onDeleteBudget,
  onUpsertRule,
  onDeleteRule,
}: {
  data: FinanceData;
  asOf: string;
  filePath: string;
  lastSavedAt: string | null;
  onImport: (d: FinanceData) => Promise<void>;
  onBackup: () => Promise<{ path: string }>;
  onSettings: (settings: FinanceData['state']['settings']) => void;
  onTaxonomyOperation: (operation: TaxonomyOperation) => void;
  onUpsertBudget: (budget: MonthlyBudget) => void;
  onDeleteBudget: (id: string) => void;
  onUpsertRule: (rule: TransactionRule) => void;
  onDeleteRule: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const budgetRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<HTMLInputElement | null>(null);
  const creditRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<FinanceSettings>(() => cloneSettings(data.state.settings));
  const draftRef = useRef(draft);
  const [budgetText, setBudgetText] = useState(String(data.state.settings.monthlyBudget ?? 0));
  const [targetText, setTargetText] = useState(String(Math.round((data.state.settings.savingsTargetRate ?? 0) * 100)));
  const [creditText, setCreditText] = useState(String(data.state.settings.creditLimit ?? 0));
  const accounts = allAccounts(data).filter((account) => account.kind !== 'credit');

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const next = cloneSettings(data.state.settings);
    draftRef.current = next;
    setDraft(next);
    if (document.activeElement !== budgetRef.current) setBudgetText(String(next.monthlyBudget ?? 0));
    if (document.activeElement !== targetRef.current) setTargetText(String(Math.round((next.savingsTargetRate ?? 0) * 100)));
    if (document.activeElement !== creditRef.current) setCreditText(String(next.creditLimit ?? 0));
  }, [data.state.settings]);

  const commit = (next: FinanceSettings, feedback = 'Οι ρυθμίσεις αποθηκεύονται αυτόματα.') => {
    const normalized = { ...next, motion: 'full' as const };
    draftRef.current = normalized;
    setDraft(normalized);
    onSettings(normalized);
    if (feedback) setMessage(feedback);
  };

  const change = (patch: Partial<FinanceSettings>) => commit({ ...draftRef.current, ...patch });

  const runTaxonomyOperation = (operation: TaxonomyOperation) => {
    const next = { ...taxonomyOperationPreview(draftRef.current, operation), motion: 'full' as const };
    draftRef.current = next;
    setDraft(next);
    onTaxonomyOperation(operation);
    setMessage(
      operation.type === 'retire-category' || operation.type === 'retire-subcategory'
        ? 'Η απόσυρση ολοκληρώθηκε. Η ιστορική ταυτότητα και οι παλιές οικονομικές αναφορές παραμένουν ανέπαφες.'
        : 'Η ταξινόμηση ενημερώθηκε μαζί με τις ενεργές και μελλοντικές αναφορές της.',
    );
  };

  const commitNumber = (kind: 'budget' | 'target' | 'credit', raw: string) => {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) return false;
    if (kind === 'budget') {
      if (value < 0) return false;
      change({ monthlyBudget: value });
      return true;
    }
    if (kind === 'target') {
      if (value < 0 || value > 100) return false;
      change({ savingsTargetRate: value / 100 });
      return true;
    }
    if (value < 0) return false;
    change({ creditLimit: value });
    return true;
  };

  const resetNumber = (kind: 'budget' | 'target' | 'credit') => {
    if (kind === 'budget') setBudgetText(String(draftRef.current.monthlyBudget ?? 0));
    else if (kind === 'target') setTargetText(String(Math.round((draftRef.current.savingsTargetRate ?? 0) * 100)));
    else setCreditText(String(draftRef.current.creditLimit ?? 0));
  };

  const rejectNumber = (kind: 'budget' | 'target' | 'credit') => {
    resetNumber(kind);
    setMessage(
      kind === 'target'
        ? 'Έλεγξε τον στόχο αποταμίευσης — βάλε ποσοστό από 0 έως 100.'
        : kind === 'budget'
          ? 'Έλεγξε το μηνιαίο budget — βάλε αριθμό ίσο ή μεγαλύτερο από μηδέν.'
          : 'Έλεγξε το πιστωτικό όριο — βάλε αριθμό ίσο ή μεγαλύτερο από μηδέν.',
    );
  };

  const requestImport = (file?: File) => {
    if (!file || busy) return;
    if (file.size > MAX_FINANCE_DOCUMENT_BYTES) {
      setMessage('Το αρχείο είναι μεγαλύτερο από το υποστηριζόμενο όριο των 4 MB. Διάλεξε μικρότερο αντίγραφο ασφαλείας και δοκίμασε ξανά.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setPendingImportFile(file);
  };

  const cancelImport = () => {
    if (busy) return;
    setPendingImportFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = async () => {
    const file = pendingImportFile;
    if (!file || busy) return;
    setBusy(true);
    try {
      await onImport(JSON.parse(await file.text()));
      setMessage('Η εισαγωγή ολοκληρώθηκε και δημιουργήθηκε αυτόματο αντίγραφο ασφαλείας των προηγούμενων δεδομένων.');
    } catch (error) {
      setMessage(userErrorMessage(error, 'Δεν μπορέσαμε να εισαγάγουμε το αρχείο. Έλεγξε ότι είναι έγκυρο αντίγραφο ασφαλείας του MyFinHub και δοκίμασε ξανά.'));
    } finally {
      setBusy(false);
      setPendingImportFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const backup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onBackup();
      downloadJson(data);
      setMessage('Το αντίγραφο ασφαλείας δημιουργήθηκε και κατέβηκε επίσης στη συσκευή σου.');
    } catch (error) {
      setMessage(userErrorMessage(error, 'Δεν μπορέσαμε να δημιουργήσουμε το αντίγραφο ασφαλείας. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.'));
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (id: string) => draft.accountNames[id]?.trim() || accounts.find((account) => account.id === id)?.name || id;

  return (
    <div className="page-stack settings-page settings-tabs-page">
      <section className="page-heading settings-page-heading">
        <div>
          <span className="eyebrow">ΡΥΘΜΙΣΕΙΣ</span>
          <h1>Ρυθμίσεις</h1>
          <p>Διαχειρίσου τις πραγματικές προτιμήσεις και τα εργαλεία του MyFinHub ανά ενότητα.</p>
        </div>
      </section>

      <div className="settings-tablist" role="tablist" aria-label="Ενότητες ρυθμίσεων">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`settings-panel-${activeTab}`} className="settings-tab-panel" role="tabpanel">
        {activeTab === 'general' ? (
          <div className="settings-general-grid">
            <ReadabilitySettings value={draft.textSize ?? 'normal'} onChange={(textSize) => change({ textSize })} />
            <DesktopUpdatePanel />
            <KeyboardShortcutsPanel />
          </div>
        ) : null}

        {activeTab === 'profile' ? (
          <div className="settings-tab-stack settings-profile-tab">
            <section className="panel neo-raised settings-profile-card">
              <div className="panel-head">
                <div>
                  <span>Λογαριασμός MyFinHub</span>
                  <small>Η διαχείριση πρόσβασης παραμένει στην υπάρχουσα ασφαλή ροή σύνδεσης και δεν μεταφέρεται τεχνητά στις ρυθμίσεις.</small>
                </div>
                <ShieldCheck />
              </div>
              <div className="settings-profile-status">
                <div><span>Πρόσβαση</span><b>Υπάρχουσα ασφαλής ροή σύνδεσης</b></div>
                <div><span>Αλλαγή email</span><b>Δεν υποστηρίζεται από αυτή τη σελίδα</b></div>
                <div><span>Αλλαγή κωδικού</span><b>Δεν υποστηρίζεται από αυτή τη σελίδα</b></div>
              </div>
              <div className="logic-note compact">
                <ShieldCheck />
                <span>Η καρτέλα είναι ενεργή και ειλικρινής: δεν εμφανίζει controls που δεν έχουν πραγματικό backend ή ασφαλή ροή εκτέλεσης.</span>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'accounts' ? (
          <div className="settings-tab-stack settings-accounts-tab">
            <AccountMetadataSettings data={data} />
            <section className="panel neo-raised settings-account-defaults">
              <div className="panel-head">
                <div>
                  <span>Λογαριασμοί & προεπιλογές</span>
                  <small>Διαχειρίσου τις πραγματικές ονομασίες και τους λογαριασμούς που προτείνονται στις νέες κινήσεις.</small>
                </div>
              </div>
              <div className="settings-form editor-grid">
                <label>
                  <span>Προεπιλογή εξόδων</span>
                  <AppSelectInput aria-label="Προεπιλεγμένος λογαριασμός εξόδων" value={draft.defaultExpenseAccount} onChange={(event) => change({ defaultExpenseAccount: event.target.value })}>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{labelFor(account.id)}</option>)}
                  </AppSelectInput>
                </label>
                <label>
                  <span>Προεπιλογή εσόδων</span>
                  <AppSelectInput aria-label="Προεπιλεγμένος λογαριασμός εσόδων" value={draft.defaultIncomeAccount} onChange={(event) => change({ defaultIncomeAccount: event.target.value })}>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{labelFor(account.id)}</option>)}
                  </AppSelectInput>
                </label>
                <label>
                  <span>Προεπιλογή πληρωμής δόσεων</span>
                  <AppSelectInput aria-label="Προεπιλεγμένος λογαριασμός πληρωμής δόσεων" value={draft.defaultLoanAccount} onChange={(event) => change({ defaultLoanAccount: event.target.value })}>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{labelFor(account.id)}</option>)}
                  </AppSelectInput>
                </label>
              </div>
              <div className="account-name-grid">
                {accounts.map((account) => (
                  <label key={account.id}>
                    <span>Όνομα: {account.name}</span>
                    <input value={draft.accountNames[account.id] ?? ''} placeholder={account.name} onChange={(event) => change({ accountNames: { ...draftRef.current.accountNames, [account.id]: event.target.value } })} />
                  </label>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'budgets' ? (
          <div className="settings-tab-stack settings-budgets-only">
            <BudgetRuleSettings data={data} asOf={asOf} onUpsertBudget={onUpsertBudget} onDeleteBudget={onDeleteBudget} onUpsertRule={onUpsertRule} onDeleteRule={onDeleteRule} view="budgets" />
            <section className="panel neo-raised settings-legacy-goals">
              <div className="panel-head">
                <div>
                  <span>Βασικοί στόχοι & όρια</span>
                  <small>Οι υπάρχουσες τιμές παραμένουν στο ίδιο settings model και αποθηκεύονται με την ίδια συμπεριφορά.</small>
                </div>
              </div>
              <div className="settings-form">
                <label>
                  <span>Γενικό μηνιαίο budget</span>
                  <input ref={budgetRef} inputMode="decimal" value={budgetText} onChange={(event) => { setBudgetText(event.target.value); void commitNumber('budget', event.target.value); }} onBlur={() => { if (!commitNumber('budget', budgetText)) rejectNumber('budget'); }} />
                </label>
                <label>
                  <span>Στόχος αποταμίευσης %</span>
                  <input ref={targetRef} inputMode="decimal" value={targetText} onChange={(event) => { setTargetText(event.target.value); void commitNumber('target', event.target.value); }} onBlur={() => { if (!commitNumber('target', targetText)) rejectNumber('target'); }} />
                </label>
                <label>
                  <span>Πιστωτικό όριο</span>
                  <input ref={creditRef} inputMode="decimal" value={creditText} onChange={(event) => { setCreditText(event.target.value); void commitNumber('credit', event.target.value); }} onBlur={() => { if (!commitNumber('credit', creditText)) rejectNumber('credit'); }} />
                </label>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'categories' ? (
          <div className="settings-categories-only">
            <CategoryIconsWorkspace data={data} asOf={asOf} settings={draft} onChange={(next) => commit(next, '')} onTaxonomyOperation={runTaxonomyOperation} />
          </div>
        ) : null}

        {activeTab === 'icons' ? (
          <div className="settings-tab-stack settings-icons-only">
            <section className="panel neo-raised settings-section-intro">
              <div className="panel-head">
                <div>
                  <span>Εικονίδια κατηγοριών</span>
                  <small>Άλλαξε μόνο την παρουσίαση των κατηγοριών και των υποκατηγοριών. Η stable ταυτότητα και το οικονομικό ιστορικό δεν αλλάζουν.</small>
                </div>
              </div>
            </section>
            <CategoryIconsWorkspace data={data} asOf={asOf} settings={draft} onChange={(next) => commit(next, '')} onTaxonomyOperation={runTaxonomyOperation} />
          </div>
        ) : null}

        {activeTab === 'rules' ? (
          <div className="settings-tab-stack settings-rules-only">
            <BudgetRuleSettings data={data} asOf={asOf} onUpsertBudget={onUpsertBudget} onDeleteBudget={onDeleteBudget} onUpsertRule={onUpsertRule} onDeleteRule={onDeleteRule} view="rules" />
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-tab-stack settings-data-tab">
            <section className="panel neo-raised">
              <div className="panel-head">
                <div>
                  <span>Αντίγραφα & εισαγωγή</span>
                  <small>Δημιούργησε αντίγραφο ασφαλείας ή επανάφερε δεδομένα από αρχείο JSON.</small>
                </div>
                <Download />
              </div>
              <div className="settings-actions">
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => requestImport(event.target.files?.[0])} />
                <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}><FileJson /> Εισαγωγή JSON</button>
                <button type="button" disabled={busy} onClick={() => void backup()}><Download /> Backup & λήψη</button>
              </div>
              {message ? <div className="logic-note compact" role="status" aria-live="polite"><ShieldCheck /><span>{message}</span></div> : null}
            </section>
            <details className="panel neo-raised technical-settings">
              <summary><Database size={16} /> Τεχνικές πληροφορίες δεδομένων</summary>
              <div className="settings-list">
                <div><span>Πηγή δεδομένων</span><b>{filePath}</b></div>
                <div><span>Έκδοση μορφής</span><b>v{data.schemaVersion}</b></div>
                <div><span>Τελευταία αποθήκευση</span><b>{lastSavedAt ? new Date(lastSavedAt).toLocaleString('el-GR') : '—'}</b></div>
                <div><span>Αρχικές συναλλαγές</span><b>{data.seed.stats.transactions || data.seed.transactions.length}</b></div>
                <div><span>Καταγεγραμμένες κινήσεις</span><b>{data.state.events?.length || 0}</b></div>
              </div>
            </details>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(pendingImportFile)}
        title="Εισαγωγή δεδομένων από JSON;"
        description="Η εισαγωγή θα αντικαταστήσει τα τρέχοντα δεδομένα μόνο αφού δημιουργηθεί αυτόματο αντίγραφο ασφαλείας. Η υπάρχουσα διαδικασία ελέγχου και εισαγωγής παραμένει η ίδια."
        confirmLabel="Εισαγωγή"
        tone="destructive"
        busy={busy}
        motionMode={data.state.settings.motion}
        onConfirm={() => void confirmImport()}
        onCancel={cancelImport}
      />
    </div>
  );
}
