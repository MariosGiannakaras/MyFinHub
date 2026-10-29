import { Download, FileJson, ShieldCheck, TriangleAlert } from 'lucide-react';
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
import { DesktopBackupPanel } from '../components/DesktopBackupPanel';
import { loadData } from '../lib/api';
import { desktopBackupBridge } from '../lib/desktopBackups';
import { KeyboardShortcutsPanel } from '../components/KeyboardShortcutsPanel';
import { ReadabilitySettings } from '../components/ReadabilitySettings';
import { Surface } from '../components/Surface';
import { SupportDiagnosticsPanel } from '../components/SupportDiagnosticsPanel';
import { TransactionRulesWorkspace } from '../components/TransactionRulesWorkspace';
import { CounterpartyDirectorySettings } from '../components/CounterpartyDirectorySettings';
import { withCounterparty } from '../lib/counterparties';
import { categoryTree } from '../lib/categories';
import { OWNER_EXPENSE_TREE, OWNER_INCOME_TREE, prepareApprovedOwnerTaxonomy } from '../lib/ownerApprovedTaxonomy';
import { appendTransactionRule, reorderTransactionRules } from '../lib/transactionRuleEditor';
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
  accountFocusId,
  accountFocusKey,
  activeTab:controlledTab,
  onActiveTabChange,
  onImport,
  onBackup,
  onSettings,
  onFinanceDurably,
  onTaxonomyOperation,
}: {
  data: FinanceData;
  asOf: string;
  filePath: string;
  lastSavedAt: string | null;
  currentEmail?: string | null;
  accountFocusId?:string|null;
  accountFocusKey?:number;
  activeTab?:SettingsTab;
  onActiveTabChange?:(tab:SettingsTab)=>void;
  onImport: (d: FinanceData) => Promise<void>;
  onBackup: () => Promise<{ path: string }>;
  onSettings: (settings: FinanceData['state']['settings']) => void;
  onFinanceDurably:(recipe:(current:FinanceData)=>FinanceData)=>Promise<void>;
  onTaxonomyOperation: (operation: TaxonomyOperation) => void;
}) {
  const saveRule=(rule:TransactionRule)=>{
    const editing=(data.state.transactionRules??[]).some(item=>item.id===rule.id);
    return onFinanceDurably(current=>{
      const rules=current.state.transactionRules??[];
      if(editing&&!rules.some(item=>item.id===rule.id))throw new Error('Ο κανόνας άλλαξε. Επαναφόρτωσε και δοκίμασε ξανά.');
      const next=editing?rules.map(item=>item.id===rule.id?rule:item)
        :appendTransactionRule(rules,rule,new Date().toISOString());
      return {...current,state:{...current.state,transactionRules:next}};
    });
  };
  const deleteRule=(id:string)=>onFinanceDurably(current=>{
    const rules=current.state.transactionRules??[];
    if(!rules.some(item=>item.id===id))throw new Error('Ο κανόνας άλλαξε. Επαναφόρτωσε και δοκίμασε ξανά.');
    return {...current,state:{...current.state,transactionRules:rules.filter(item=>item.id!==id)}};
  });
  const reorderRule=(id:string,direction:-1|1)=>onFinanceDurably(current=>{
    const rules=current.state.transactionRules??[];
    const next=reorderTransactionRules(rules,id,direction,new Date().toISOString());
    return next===rules?current:{...current,state:{...current.state,transactionRules:next}};
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const runtimeEnv=(import.meta as unknown as {env?:{VITE_MYFINHUB_SUPPORT_DIAGNOSTICS?:string}}).env;
  const diagnosticsRequested=typeof location!=='undefined'&&new URLSearchParams(location.search).get('support-diagnostics')==='1';
  const supportDiagnosticsEnabled=runtimeEnv?.VITE_MYFINHUB_SUPPORT_DIAGNOSTICS==='1'||diagnosticsRequested;
  const [localTab,setLocalTab]=useState<SettingsTab>('general');
  const activeTab=controlledTab??localTab;
  const selectTab=(tab:SettingsTab)=>{if(onActiveTabChange)onActiveTabChange(tab);else setLocalTab(tab)};
  const [message, setMessage] = useState('');
  const [backupMessageIsError,setBackupMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupRefreshToken, setBackupRefreshToken] = useState(0);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [pendingOwnerTaxonomy, setPendingOwnerTaxonomy] = useState(false);
  const [draft, setDraft] = useState<FinanceSettings>(() => cloneSettings(data.state.settings));
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const rail = tablistRef.current;
    const selected = rail?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if(!rail||!selected||rail.scrollWidth<=rail.clientWidth+1)return;
    // Scroll only the Settings tab rail; scrollIntoView would also move
    // document ancestors and partially hide the selected mobile tab.
    const bounds=rail.getBoundingClientRect(),tab=selected.getBoundingClientRect();
    rail.scrollTo({left:rail.scrollLeft+(tab.left-bounds.left)-(bounds.width-tab.width)/2,behavior:'auto'});
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
    if (feedback) { setBackupMessageIsError(false); setMessage(feedback); }
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

  const ownerTaxonomyApplied=JSON.stringify(categoryTree(data.state.settings,'expense'))===JSON.stringify(OWNER_EXPENSE_TREE)
    &&JSON.stringify(categoryTree(data.state.settings,'income'))===JSON.stringify(OWNER_INCOME_TREE);
  const confirmOwnerTaxonomy=async()=>{
    if(busy)return;
    setBusy(true);
    setMessage('');
    try{
      await onFinanceDurably(current=>prepareApprovedOwnerTaxonomy(current,asOf));
      setPendingOwnerTaxonomy(false);
    }catch(reason){
      setMessage(userErrorMessage(reason,'Η εφαρμογή των κατηγοριών δεν αποθηκεύτηκε. Τα προηγούμενα δεδομένα παραμένουν ανέπαφα.'));
    }finally{setBusy(false)}
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
    setBackupMessageIsError(false);
    setBusy(true);
    try {
      await onBackup();
      // Download the acknowledged database document, not optimistic in-memory drafts.
      const snapshot = await loadData();
      downloadJson(snapshot.data);
      const bridge = desktopBackupBridge();
      if (bridge) {
        try {
          const receipt = await bridge.saveLocalBackup();
          if (!receipt.verified) throw new Error('Local checksum missing.');
          setBackupRefreshToken(value => value + 1);
        } catch {
          setBackupMessageIsError(true);
          setBackupRefreshToken(value => value + 1);
          setMessage('Δημιουργήθηκε το backup στη βάση και κατέβηκε το JSON, αλλά η τοπική αποθήκευση Windows απέτυχε. Έλεγξε τον φάκελο.');
          return;
        }
      }
      setMessage('Το αντίγραφο ασφαλείας δημιουργήθηκε και κατέβηκε επίσης στη συσκευή σου.');
    } catch (error) {
      setBackupMessageIsError(true);
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

        {activeTab === 'accounts' ? <div className="settings-tab-stack settings-accounts-stack"><FinancialProviderManagementSettings/><AccountManagementSettings data={data} settings={draft} focusAccountId={accountFocusId} focusKey={accountFocusKey} onChange={(next) => commit(next, '')} onChangeDurably={(next)=>onFinanceDurably(current=>({...current,state:{...current.state,settings:cloneSettings(next)}}))} /></div> : null}

        {activeTab === 'categories' ? (
          <div className="settings-categories-only">
            {!ownerTaxonomyApplied?<Surface as="section" variant="flat" className="panel settings-owner-taxonomy"><div className="panel-head"><div><b>Εγκεκριμένη προσωπική ταξινόμηση</b><small>20 κατηγορίες εξόδων · 6 κατηγορίες εσόδων. Αλλαγή με ιστορικό και προστασία συγκρούσεων, χωρίς επανεγγραφή συναλλαγών.</small></div><Button type="button" variant="secondary" disabled={busy} onClick={()=>setPendingOwnerTaxonomy(true)}>Εφαρμογή εγκεκριμένης λίστας</Button></div></Surface>:null}
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
            <TransactionRulesWorkspace data={data} onUpsertRule={saveRule} onDeleteRule={deleteRule} onReorderRule={reorderRule} />
            <CounterpartyDirectorySettings data={data} onSave={record=>onFinanceDurably(current=>withCounterparty(current,record))}/>
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-tab-stack settings-data-tab">
            <div className="settings-data-action-grid">
              <Surface as="section" variant="raised" className="panel settings-data-action-card">
                <div className="settings-data-action-icon" aria-hidden="true"><Download /></div>
                <div className="settings-data-action-copy">
                  <b>Δημιουργία αντιγράφου ασφαλείας</b>
                  <p>Δημιούργησε αντίγραφο των οικονομικών δεδομένων στη βάση και κατέβασε παράλληλα ένα JSON στη συσκευή σου.</p>
                  <small>Δεν αλλάζει τα τρέχοντα οικονομικά δεδομένα. Το JSON δεν είναι πλήρες αντίγραφο PostgreSQL ή Supabase Storage: δεν περιλαμβάνει μυστικά καρτών (PAN/λήξη/CVV), ανεξάρτητα IBAN, ανεβασμένα λογότυπα, τοπικές αποδείξεις ή PIN των Windows.</small>
                </div>
                <Button className="settings-data-action-button" variant="secondary" type="button" disabled={busy} onClick={() => void backup()}><Download /> Backup & λήψη</Button>
              </Surface>

              <Surface as="section" variant="raised" className="panel settings-data-action-card settings-data-import-card">
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => requestImport(event.target.files?.[0])} />
                <div className="settings-data-action-icon" aria-hidden="true"><FileJson /></div>
                <div className="settings-data-action-copy">
                  <b>Επαναφορά από JSON</b>
                  <p>Επίλεξε έγκυρο αντίγραφο MyFinHub. Η εισαγωγή αντικαθιστά τα τρέχοντα δεδομένα μόνο μετά από επιβεβαίωση.</p>
                  <small>Έως 4 MB · αυτόματο backup πριν από την αντικατάσταση · χωρίς Undo της εισαγωγής. Η εισαγωγή δεν επαναφέρει μυστικά καρτών, IBAN, ανεβασμένα λογότυπα ή τοπικές αποδείξεις.</small>
                </div>
                <Button className="settings-data-action-button" variant="secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><FileJson /> Εισαγωγή JSON</Button>
              </Surface>
            </div>
            <DesktopBackupPanel refreshToken={backupRefreshToken} onPrepareRestore={(snapshot) => {
              requestImport(new File([JSON.stringify(snapshot)], 'MyFinHub-local-backup.json', { type: 'application/json' }));
            }}/>

            <details className="settings-import-guide">
              <summary>Οδηγίες χρήσης και δομή αρχείου JSON</summary>
              <div className="settings-import-guide-content">
                <section aria-labelledby="settings-import-instructions">
                  <h3 id="settings-import-instructions">Πώς γίνεται η εισαγωγή</h3>
                  <ol>
                    <li>Δημιούργησε πρώτα αντίγραφο από το «Backup & λήψη».</li>
                    <li>Πάτησε «Εισαγωγή JSON» και επίλεξε έγκυρο αρχείο JSON οικονομικών δεδομένων MyFinHub έως 4 MB.</li>
                    <li>Έλεγξε την προειδοποίηση και επιβεβαίωσε. Η βάση επαληθεύει τη δομή και δημιουργεί αυτόματα backup των προηγούμενων δεδομένων πριν από την αντικατάσταση.</li>
                    <li>Έλεγξε τα στοιχεία μετά την εισαγωγή. Για επιστροφή στα προηγούμενα δεδομένα χρειάζεται ξεχωριστή επαναφορά backup, όχι Undo.</li>
                  </ol>
                </section>
                <section aria-labelledby="settings-import-structure">
                  <h3 id="settings-import-structure">Δομή JSON MyFinHub</h3>
                  <p>Το αρχείο περιέχει δομημένα οικονομικά δεδομένα του MyFinHub, όχι CSV ή απλή λίστα συναλλαγών. Δεν αποτελεί πλήρες αντίγραφο PostgreSQL ή Supabase Storage. Τα κύρια πεδία του είναι:</p>
                  <dl className="settings-import-guide-fields">
                    <div><dt><code>app</code>, <code>schemaVersion</code>, <code>updatedAt</code></dt><dd>Ταυτότητα εφαρμογής, συμβατή έκδοση και ημερομηνία.</dd></div>
                    <div><dt><code>seed</code></dt><dd>Βασικά δεδομένα: <code>accounts</code>, <code>months</code>, <code>transactions</code>, <code>snapshots</code>, <code>recurring</code>, <code>subscriptions</code>, <code>loans</code>, <code>lending</code>, <code>stats</code>.</dd></div>
                    <div><dt><code>state</code></dt><dd>Τρέχουσα κατάσταση: <code>settings</code>, <code>events</code>, <code>cards</code>, <code>budgets</code>, <code>scheduled</code>, <code>transactionRules</code> και τροποποιημένες εγγραφές.</dd></div>
                  </dl>
                  <p>Χρησιμοποίησε το εξαγόμενο backup ως πρότυπο. Ένα χειροποίητο JSON με μόνο αυτά τα πεδία δεν αρκεί: ελέγχονται και τα απαιτούμενα επιμέρους πεδία και οι οικονομικές συσχετίσεις.</p>
                </section>
                <p className="settings-import-guide-warning">Η εισαγωγή αντικαθιστά (δεν συγχωνεύει) τα οικονομικά δεδομένα και δεν αναιρείται με Undo/Redo. Το ξεχωριστό κρυπτογραφημένο Card Vault (PAN/λήξη/CVV) δεν περιλαμβάνεται στο JSON backup. Τα δεδομένα προφίλ κάρτας δεν επαναφέρουν από μόνα τους αυτούς τους κωδικούς.</p>
              </div>
            </details>
            {message ? <div className={`logic-note compact${backupMessageIsError ? ' is-error' : ''}`} role={backupMessageIsError ? 'alert' : 'status'} aria-live="polite">{backupMessageIsError ? <TriangleAlert/> : <ShieldCheck/>}<span>{message}</span></div> : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingOwnerTaxonomy}
        title="Εφαρμογή εγκεκριμένης ταξινομίας;"
        description="Θα οριστούν οι 20 κατηγορίες εξόδων και οι 6 εσόδων με την εγκεκριμένη σειρά και τις υποκατηγορίες τους. Οι υπάρχουσες ταυτότητες, οι συνδεδεμένες εγγραφές και το οικονομικό ιστορικό προστατεύονται. Αν υπάρχουν μη επιλύσιμες εξαρτήσεις, η ενημέρωση θα απορριφθεί ολόκληρη."
        confirmLabel="Εφαρμογή"
        busy={busy}
        onConfirm={()=>void confirmOwnerTaxonomy()}
        onCancel={()=>{if(!busy)setPendingOwnerTaxonomy(false)}}
      />
      <ConfirmDialog
        open={Boolean(pendingImportFile)}
        title="Εισαγωγή δεδομένων από JSON;"
        description="Η εισαγωγή αντικαθιστά όλα τα τρέχοντα οικονομικά δεδομένα (δεν τα συγχωνεύει), αφού δημιουργηθεί αυτόματο backup. Δεν αναιρείται με Undo. Το JSON δεν επαναφέρει Card Vault, ανεξάρτητα IBAN ή αρχεία Supabase Storage. Συνέχεια;"
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
