import { Download, FileJson, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AccountManagementSettings } from '../components/AccountManagementSettings';
import { FinancialProviderManagementSettings } from '../components/FinancialProviderManagementSettings';
import { AccountSecuritySettings } from '../components/AccountSecuritySettings';
import { CategoryIconAssignmentWorkspace } from '../components/CategoryIconAssignmentWorkspace';
import { CategoryIconsWorkspace } from '../components/CategoryIconsWorkspace';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DesktopUpdatePanel } from '../components/DesktopUpdatePanel';
import { KeyboardShortcutsPanel } from '../components/KeyboardShortcutsPanel';
import { ReadabilitySettings } from '../components/ReadabilitySettings';
import { Surface } from '../components/Surface';
import { SupportDiagnosticsPanel } from '../components/SupportDiagnosticsPanel';
import { TransactionRulesWorkspace } from '../components/TransactionRulesWorkspace';
import { categoryTree } from '../lib/categories';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../lib/limits';
import { taxonomyOperationPreview, type TaxonomyOperation } from '../lib/taxonomyManagement';
import { userErrorMessage } from '../lib/userMessage';
import type { SettingsTabId } from '../lib/routing';
import type { FinanceData, FinanceSettings, TransactionRule } from '../types';
import './SettingsPage.css';
import './SettingsData.css';

type SettingsTab = SettingsTabId;

type SettingsTabDefinition = {
  id: SettingsTab;
  label: string;
};

const SETTINGS_TABS: SettingsTabDefinition[] = [
  { id: 'general', label: 'Γενικά' },
  { id: 'profile', label: 'Χρήστης & Πρόσβαση' },
  { id: 'accounts', label: 'Λογαριασμοί' },
  { id: 'categories', label: 'Κατηγορίες' },
  { id: 'icons', label: 'Εικονίδια' },
  { id: 'rules', label: 'Κανόνες' },
  { id: 'data', label: 'Δεδομένα' },
];

function cloneSettings(settings: FinanceSettings): FinanceSettings {
  const {motion:_legacyMotion,...persisted}=settings;
  return {
    ...persisted,
    accountNames: { ...settings.accountNames },
    customAccounts: (settings.customAccounts ?? []).map((account) => ({ ...account })),
    accountOverrides: Object.fromEntries(Object.entries(settings.accountOverrides ?? {}).map(([id, account]) => [id, { ...account }])),
    expenseCategories: [...settings.expenseCategories],
    incomeCategories: [...settings.incomeCategories],
    expenseCategoryTree: categoryTree(settings, 'expense').map((item) => ({ ...item, subcategories: [...item.subcategories] })),
    incomeCategoryTree: categoryTree(settings, 'income').map((item) => ({ ...item, subcategories: [...item.subcategories] })),
    categoryIcons: { ...(settings.categoryIcons ?? {}) },
    subcategoryIcons: { ...(settings.subcategoryIcons ?? {}) },
    categoryIconPack: settings.categoryIconPack,
    categoryIconPackSelections: Object.fromEntries(Object.entries(settings.categoryIconPackSelections ?? {}).map(([key, packs]) => [key, { ...packs }])),
    subcategoryIconPackSelections: Object.fromEntries(Object.entries(settings.subcategoryIconPackSelections ?? {}).map(([key, packs]) => [key, { ...packs }])),
    categoryIconColors: { ...(settings.categoryIconColors ?? {}) },
    subcategoryIconColors: { ...(settings.subcategoryIconColors ?? {}) },
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
  currentEmail,
  activeTab:controlledTab,
  onActiveTabChange,
  onImport,
  onBackup,
  onSettings,
  onFinanceDurably,
  onTaxonomyOperation,
  onUpsertRule,
  onDeleteRule,
}: {
  data: FinanceData;
  asOf: string;
  filePath: string;
  lastSavedAt: string | null;
  currentEmail?: string | null;
  activeTab?:SettingsTab;
  onActiveTabChange?:(tab:SettingsTab)=>void;
  onImport: (d: FinanceData) => Promise<void>;
  onBackup: () => Promise<{ path: string }>;
  onSettings: (settings: FinanceData['state']['settings']) => void;
  onFinanceDurably:(recipe:(current:FinanceData)=>FinanceData)=>Promise<void>;
  onTaxonomyOperation: (operation: TaxonomyOperation) => void;
  onUpsertRule: (rule: TransactionRule) => void;
  onDeleteRule: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const runtimeEnv=(import.meta as unknown as {env?:{VITE_MYFINHUB_SUPPORT_DIAGNOSTICS?:string}}).env;
  const diagnosticsRequested=typeof location!=='undefined'&&new URLSearchParams(location.search).get('support-diagnostics')==='1';
  const supportDiagnosticsEnabled=runtimeEnv?.VITE_MYFINHUB_SUPPORT_DIAGNOSTICS==='1'||diagnosticsRequested;
  const [localTab,setLocalTab]=useState<SettingsTab>('general');
  const activeTab=controlledTab??localTab;
  const selectTab=(tab:SettingsTab)=>{if(onActiveTabChange)onActiveTabChange(tab);else setLocalTab(tab)};
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<FinanceSettings>(() => cloneSettings(data.state.settings));
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const selected = tablistRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    const next = cloneSettings(data.state.settings);
    draftRef.current = next;
    setDraft(next);
  }, [data.state.settings]);

  const commit = (next: FinanceSettings, feedback = 'Οι ρυθμίσεις αποθηκεύονται αυτόματα.') => {
    const normalized = cloneSettings(next);
    draftRef.current = normalized;
    setDraft(normalized);
    onSettings(normalized);
    if (feedback) setMessage(feedback);
  };

  const change = (patch: Partial<FinanceSettings>) => commit({ ...draftRef.current, ...patch });

  const runTaxonomyOperation = (operation: TaxonomyOperation) => {
    const next = cloneSettings(taxonomyOperationPreview(draftRef.current, operation));
    draftRef.current = next;
    setDraft(next);
    onTaxonomyOperation(operation);
    setMessage(
      operation.type === 'retire-category' || operation.type === 'retire-subcategory'
        ? 'Η απόσυρση ολοκληρώθηκε. Η ιστορική ταυτότητα και οι παλιές οικονομικές αναφορές παραμένουν ανέπαφες.'
        : 'Η ταξινόμηση ενημερώθηκε μαζί με τις ενεργές και μελλοντικές αναφορές της.',
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
      downloadJson({...data,state:{...data.state,settings:cloneSettings(draftRef.current)}});
      setMessage('Το αντίγραφο ασφαλείας δημιουργήθηκε και κατέβηκε επίσης στη συσκευή σου.');
    } catch (error) {
      setMessage(userErrorMessage(error, 'Δεν μπορέσαμε να δημιουργήσουμε το αντίγραφο ασφαλείας. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack settings-page settings-tabs-page">
      <PageHeader className="settings-page-heading" eyebrow="ΡΥΘΜΙΣΕΙΣ" title="Ρυθμίσεις" description={<p>Διαχειρίσου τις πραγματικές προτιμήσεις και τα εργαλεία του MyFinHub ανά ενότητα.</p>}/>

      <div ref={tablistRef} className="settings-tablist" role="tablist" aria-label="Ενότητες ρυθμίσεων">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`settings-panel-${activeTab}`} className="settings-tab-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
        {activeTab === 'general' ? (
          <div className="settings-general-grid">
            <ReadabilitySettings value={draft.textSize ?? 'normal'} onChange={(textSize) => change({ textSize })} />
            <DesktopUpdatePanel />
            <KeyboardShortcutsPanel />
            {supportDiagnosticsEnabled?<SupportDiagnosticsPanel data={data} filePath={filePath} lastSavedAt={lastSavedAt}/>:null}
          </div>
        ) : null}

        {activeTab === 'profile' ? <AccountSecuritySettings currentEmail={currentEmail} /> : null}

        {activeTab === 'accounts' ? <div className="settings-tab-stack settings-accounts-stack"><FinancialProviderManagementSettings/><AccountManagementSettings data={data} settings={draft} onChange={(next) => commit(next, '')} onChangeDurably={(next)=>onFinanceDurably(current=>({...current,state:{...current.state,settings:cloneSettings(next)}}))} /></div> : null}

        {activeTab === 'categories' ? (
          <div className="settings-categories-only">
            <CategoryIconsWorkspace data={data} asOf={asOf} settings={draft} onChange={(next) => commit(next, '')} onTaxonomyOperation={runTaxonomyOperation} view="taxonomy" />
          </div>
        ) : null}

        {activeTab === 'icons' ? (
          <div className="settings-icons-only">
            <CategoryIconAssignmentWorkspace settings={draft} onChange={(next) => commit(next, '')} />
          </div>
        ) : null}

        {activeTab === 'rules' ? (
          <div className="settings-tab-stack settings-rules-only">
            <TransactionRulesWorkspace data={data} onUpsertRule={onUpsertRule} onDeleteRule={onDeleteRule} />
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-tab-stack settings-data-tab">
            <div className="settings-data-action-grid">
              <Surface as="section" variant="raised" className="panel settings-data-action-card">
                <div className="settings-data-action-icon" aria-hidden="true"><Download /></div>
                <div className="settings-data-action-copy">
                  <b>Δημιουργία αντιγράφου ασφαλείας</b>
                  <p>Δημιούργησε το κανονικό backup του MyFinHub και κατέβασε παράλληλα ένα JSON στη συσκευή σου.</p>
                  <small>Δεν αλλάζει τα τρέχοντα οικονομικά δεδομένα.</small>
                </div>
                <Button className="settings-data-action-button" variant="secondary" type="button" disabled={busy} onClick={() => void backup()}><Download /> Backup & λήψη</Button>
              </Surface>

              <Surface as="section" variant="raised" className="panel settings-data-action-card settings-data-import-card">
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => requestImport(event.target.files?.[0])} />
                <div className="settings-data-action-icon" aria-hidden="true"><FileJson /></div>
                <div className="settings-data-action-copy">
                  <b>Επαναφορά από JSON</b>
                  <p>Επίλεξε έγκυρο αντίγραφο MyFinHub. Η εισαγωγή αντικαθιστά τα τρέχοντα δεδομένα μόνο μετά από επιβεβαίωση.</p>
                  <small>Έως 4 MB · δημιουργείται αυτόματο backup πριν από την αντικατάσταση.</small>
                </div>
                <Button className="settings-data-action-button" variant="secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><FileJson /> Εισαγωγή JSON</Button>
              </Surface>
            </div>

            {message ? <div className="logic-note compact" role="status" aria-live="polite"><ShieldCheck /><span>{message}</span></div> : null}
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
        motionMode="full"
        onConfirm={() => void confirmImport()}
        onCancel={cancelImport}
      />
    </div>
  );
}
