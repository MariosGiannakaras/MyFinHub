import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Landmark, Pencil, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAccountMetadata } from '../hooks/useAccountMetadata';
import { useModalFocus } from '../hooks/useModalFocus';
import { saveAccountMetadata } from '../lib/accountMetadataClient';
import { formatIban, isValidIban, normalizeIban } from '../lib/iban';
import type { Account, CashAccountRole, FinanceData, FinanceSettings } from '../types';
import { AppSelectInput } from './AppSelectInput';
import { ConfirmDialog } from './ConfirmDialog';
import './AccountManagementSettings.css';

type AccountMode='bank'|'cash';
type EditorDraft={
  id:string;
  source:'new'|'seed'|'custom';
  mode:AccountMode;
  originalKind:string;
  name:string;
  provider:string;
  iban:string;
  cashRole:CashAccountRole;
  showInQuickChoices:boolean;
  defaultExpense:boolean;
  defaultIncome:boolean;
  defaultLoan:boolean;
};

function managedAccounts(data:FinanceData,settings:FinanceSettings){
  const overrides=settings.accountOverrides??{};
  const seeded=(data.seed.accounts??[]).map(account=>({...account,...(overrides[account.id]??{}),id:account.id}));
  const seededIds=new Set(seeded.map(account=>account.id));
  return [...seeded,...(settings.customAccounts??[]).filter(account=>!seededIds.has(account.id))].filter(account=>account.kind!=='credit');
}

function displayName(settings:FinanceSettings,account:Account){return settings.accountNames[account.id]?.trim()||account.name}
function providerName(account:Account){
  if(account.provider?.trim())return account.provider.trim();
  if(account.kind==='cash')return '';
  const lower=account.id.toLowerCase();
  if(lower.includes('piraeus'))return 'Τράπεζα Πειραιώς';
  if(lower.includes('eurobank'))return 'Eurobank';
  if(lower.includes('alpha'))return 'Alpha Bank';
  if(lower.includes('national'))return 'Εθνική Τράπεζα';
  if(lower.includes('revolut'))return 'Revolut';
  if(lower.includes('viva'))return 'Viva Wallet';
  if(lower.includes('payzy'))return 'payzy';
  const candidate=account.name.split(/\s[-–·]\s/)[0]?.trim();
  return candidate&&candidate!==account.name?candidate:'';
}
function maskedIban(value?:string|null){
  const normalized=(value??'').replace(/\s+/g,'').toUpperCase();
  if(!normalized)return '';
  if(normalized.length<=8)return formatIban(normalized);
  return `${normalized.slice(0,4)} •••• ${normalized.slice(-4)}`;
}
function accountId(){return `account-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function accountReferenced(data:FinanceData,id:string){
  const legacy=[...(data.seed.transactions??[]),...(data.state.customTransactions??[]),...Object.values(data.state.overrides??{})];
  if(legacy.some(item=>item.accountId===id||item.fromAccountId===id||item.toAccountId===id))return true;
  if((data.state.events??[]).some(item=>item.accountId===id||item.fromAccountId===id||item.toAccountId===id||item.legs.some(leg=>leg.accountId===id)))return true;
  if((data.state.scheduled??[]).some(item=>item.accountId===id||item.fromAccountId===id||item.toAccountId===id))return true;
  const recurring=[...(data.seed.recurring??[]),...(data.state.recurringCustom??[]),...Object.values(data.state.recurringOverrides??{})];
  if(recurring.some(item=>item.accountId===id))return true;
  const loans=[...(data.seed.loans??[]),...(data.state.customLoans??[]),...Object.values(data.state.loanOverrides??{})];
  if(loans.some(item=>item.defaultAccountId===id))return true;
  if((data.state.transactionRules??[]).some(item=>item.match.accountId===id))return true;
  return false;
}

function AccountIcon({account}:{account:Account}){
  return <span className={`account-management-icon ${account.kind==='cash'?'is-cash':'is-bank'}`}>{account.kind==='cash'?<WalletCards/>:<Landmark/>}</span>;
}
function EditorIcon({mode}:{mode:AccountMode}){
  return <span className={`account-management-icon ${mode==='cash'?'is-cash':'is-bank'}`}>{mode==='cash'?<WalletCards/>:<Landmark/>}</span>;
}

export function AccountManagementSettings({data,settings,onChange}:{data:FinanceData;settings:FinanceSettings;onChange:(next:FinanceSettings)=>void}){
  const metadata=useAccountMetadata();
  const reduce=Boolean(useReducedMotion());
  const accounts=useMemo(()=>managedAccounts(data,settings),[data,settings]);
  const defaultAccounts=useMemo(()=>accounts.filter(account=>account.showInQuickChoices!==false),[accounts]);
  const[editor,setEditor]=useState<EditorDraft|null>(null);
  const[editorError,setEditorError]=useState('');
  const[message,setMessage]=useState('');
  const[busy,setBusy]=useState(false);
  const[pendingDelete,setPendingDelete]=useState<Account|null>(null);
  const modalRef=useModalFocus<HTMLElement>(Boolean(editor),'[data-autofocus="true"]',()=>{if(!busy)setEditor(null)});

  const patch=(next:Partial<FinanceSettings>)=>onChange({...settings,...next});
  const closeEditor=()=>{if(busy)return;setEditor(null);setEditorError('')};
  const openNew=()=>{
    setMessage('');setEditorError('');
    setEditor({id:accountId(),source:'new',mode:'bank',originalKind:'bank',name:'',provider:'',iban:'',cashRole:'daily',showInQuickChoices:true,defaultExpense:false,defaultIncome:false,defaultLoan:false});
  };
  const openEdit=(account:Account)=>{
    setMessage('');setEditorError('');
    const custom=Boolean((settings.customAccounts??[]).some(item=>item.id===account.id));
    setEditor({
      id:account.id,
      source:custom?'custom':'seed',
      mode:account.kind==='cash'?'cash':'bank',
      originalKind:account.kind,
      name:displayName(settings,account),
      provider:providerName(account),
      iban:formatIban(metadata.records[account.id]?.iban??''),
      cashRole:account.cashRole??'daily',
      showInQuickChoices:account.showInQuickChoices!==false,
      defaultExpense:settings.defaultExpenseAccount===account.id,
      defaultIncome:settings.defaultIncomeAccount===account.id,
      defaultLoan:settings.defaultLoanAccount===account.id,
    });
  };

  const save=async()=>{
    if(!editor||busy)return;
    const name=editor.name.trim();
    if(!name){setEditorError('Συμπλήρωσε όνομα λογαριασμού.');return}
    if(editor.source==='new'&&editor.mode==='bank'&&!editor.provider.trim()){setEditorError('Συμπλήρωσε τράπεζα ή πάροχο.');return}
    if(editor.mode==='bank'&&editor.iban.trim()&&!isValidIban(editor.iban)){setEditorError('Έλεγξε το IBAN.');return}
    setBusy(true);setEditorError('');
    try{
      const isCustom=editor.source==='new'||editor.source==='custom';
      const effectiveKind=editor.mode==='cash'?'cash':editor.originalKind==='savings'?'savings':'bank';
      const selectable=editor.mode!=='cash'||editor.cashRole==='daily';
      const nextAccount:Account={
        id:editor.id,
        name,
        kind:effectiveKind,
        provider:editor.mode==='bank'?(editor.provider.trim()||undefined):undefined,
        cashRole:editor.mode==='cash'?editor.cashRole:undefined,
        showInQuickChoices:editor.mode==='cash'?selectable:true,
        excludeFromAvailable:editor.mode==='cash'&&editor.cashRole==='reserve',
        custom:isCustom||undefined,
      };
      if(editor.mode==='bank')await saveAccountMetadata(editor.id,editor.iban.trim()?normalizeIban(editor.iban):'');
      else if(metadata.records[editor.id]?.iban)await saveAccountMetadata(editor.id,'');

      const names={...settings.accountNames,[editor.id]:name};
      const excluded=new Set(settings.excludedFromAvailable??[]);
      if(nextAccount.excludeFromAvailable)excluded.add(editor.id);else excluded.delete(editor.id);
      let next:FinanceSettings;
      if(isCustom){
        const custom=settings.customAccounts??[];
        const exists=custom.some(item=>item.id===editor.id);
        next={...settings,accountNames:names,excludedFromAvailable:[...excluded],customAccounts:exists?custom.map(item=>item.id===editor.id?nextAccount:item):[...custom,nextAccount]};
      }else{
        next={...settings,accountNames:names,excludedFromAvailable:[...excluded],accountOverrides:{...(settings.accountOverrides??{}),[editor.id]:nextAccount}};
      }

      if(editor.source!=='new'){
        const fallback=accounts.find(account=>account.id!==editor.id&&account.showInQuickChoices!==false)?.id||'';
        const resolveDefault=(checked:boolean,current:string)=>{
          if(!selectable)return current===editor.id?fallback:current;
          if(checked)return editor.id;
          return current===editor.id?fallback:current;
        };
        next={
          ...next,
          defaultExpenseAccount:resolveDefault(editor.defaultExpense,settings.defaultExpenseAccount),
          defaultIncomeAccount:resolveDefault(editor.defaultIncome,settings.defaultIncomeAccount),
          defaultLoanAccount:resolveDefault(editor.defaultLoan,settings.defaultLoanAccount),
        };
      }

      onChange(next);
      setMessage(editor.source==='new'?'Ο λογαριασμός δημιουργήθηκε.':'Οι αλλαγές αποθηκεύτηκαν.');
      setEditor(null);
    }catch{setEditorError('Δεν ήταν δυνατή η αποθήκευση του λογαριασμού. Δοκίμασε ξανά.')}
    finally{setBusy(false)}
  };

  const requestDelete=(account:Account)=>{
    const custom=(settings.customAccounts??[]).some(item=>item.id===account.id);
    if(!custom){setMessage('Οι αρχικοί λογαριασμοί διατηρούνται για να μην χαθεί το ιστορικό τους. Μπορείς να αλλάξεις όνομα και στοιχεία.');return}
    if(accountReferenced(data,account.id)){setMessage('Ο λογαριασμός χρησιμοποιείται ήδη σε οικονομικό ιστορικό και δεν μπορεί να διαγραφεί.');return}
    setMessage('');setPendingDelete(account);
  };
  const confirmDelete=async()=>{
    if(!pendingDelete||busy)return;
    setBusy(true);
    try{
      const id=pendingDelete.id;
      const remaining=(settings.customAccounts??[]).filter(item=>item.id!==id);
      const names={...settings.accountNames};delete names[id];
      const overrides={...(settings.accountOverrides??{})};delete overrides[id];
      const active=accounts.filter(item=>item.id!==id&&item.showInQuickChoices!==false);
      const fallback=active[0]?.id||'';
      const next:FinanceSettings={...settings,customAccounts:remaining,accountNames:names,accountOverrides:overrides,excludedFromAvailable:(settings.excludedFromAvailable??[]).filter(item=>item!==id),defaultExpenseAccount:settings.defaultExpenseAccount===id?fallback:settings.defaultExpenseAccount,defaultIncomeAccount:settings.defaultIncomeAccount===id?fallback:settings.defaultIncomeAccount,defaultLoanAccount:settings.defaultLoanAccount===id?fallback:settings.defaultLoanAccount};
      if(metadata.records[id]?.iban)await saveAccountMetadata(id,'');
      onChange(next);setMessage('Ο λογαριασμός διαγράφηκε.');setPendingDelete(null);
    }catch{setMessage('Δεν ήταν δυνατή η διαγραφή του λογαριασμού.')}
    finally{setBusy(false)}
  };

  const defaultOptions=(current:string)=>{
    const ids=new Set(defaultAccounts.map(account=>account.id));
    const currentAccount=accounts.find(account=>account.id===current);
    return current&&!ids.has(current)&&currentAccount?<><option value={current} disabled>{displayName(settings,currentAccount)}</option>{defaultAccounts.map(account=><option key={account.id} value={account.id}>{displayName(settings,account)}</option>)}</>:defaultAccounts.map(account=><option key={account.id} value={account.id}>{displayName(settings,account)}</option>);
  };
  const editorAccount=editor&&editor.source!=='new'?accounts.find(account=>account.id===editor.id):undefined;
  const editorDeletable=Boolean(editorAccount&&editor?.source==='custom'&&!accountReferenced(data,editor.id));
  const editorCanBeDefault=Boolean(editor&&(editor.mode==='bank'||editor.cashRole==='daily'));

  return <div className="account-management-settings settings-tab-stack settings-accounts-tab">
    <section className="panel neo-raised account-management-defaults">
      <div className="panel-head"><div><span>Προεπιλεγμένοι λογαριασμοί</span></div></div>
      <div className="account-management-default-grid">
        <label><span>Έξοδα</span><AppSelectInput aria-label="Προεπιλεγμένος λογαριασμός εξόδων" value={settings.defaultExpenseAccount} onChange={event=>patch({defaultExpenseAccount:event.target.value})}>{defaultOptions(settings.defaultExpenseAccount)}</AppSelectInput></label>
        <label><span>Έσοδα</span><AppSelectInput aria-label="Προεπιλεγμένος λογαριασμός εσόδων" value={settings.defaultIncomeAccount} onChange={event=>patch({defaultIncomeAccount:event.target.value})}>{defaultOptions(settings.defaultIncomeAccount)}</AppSelectInput></label>
        <label><span>Πληρωμή δόσεων</span><AppSelectInput aria-label="Προεπιλεγμένος λογαριασμός πληρωμής δόσεων" value={settings.defaultLoanAccount} onChange={event=>patch({defaultLoanAccount:event.target.value})}>{defaultOptions(settings.defaultLoanAccount)}</AppSelectInput></label>
      </div>
    </section>

    <section className="panel neo-raised account-management-list-card">
      <div className="panel-head account-management-list-head"><div><span>Οι λογαριασμοί μου</span></div><button type="button" className="save-button account-management-create" onClick={openNew}><Plus size={17}/> Νέος λογαριασμός</button></div>
      {metadata.error?<div className="logic-note compact" role="status">Τα IBAN δεν είναι προσωρινά διαθέσιμα. Οι υπόλοιπες ρυθμίσεις λογαριασμών λειτουργούν κανονικά.</div>:null}
      <div className="account-management-list" role="list">
        {accounts.map(account=>{
          const iban=maskedIban(metadata.records[account.id]?.iban);
          const reserve=account.kind==='cash'&&(account.cashRole??'daily')==='reserve';
          return <div className="account-management-row" role="listitem" key={account.id}>
            <AccountIcon account={account}/>
            <div className="account-management-copy"><b>{displayName(settings,account)}</b>{account.kind==='cash'?<span>Μετρητά{reserve?' · εκτός καθημερινής χρήσης':''}</span>:<span>{providerName(account)||'Τραπεζικός λογαριασμός'}{iban?` · ${iban}`:''}</span>}</div>
            <div className="account-management-row-actions"><button type="button" className="account-management-edit" onClick={()=>openEdit(account)}><Pencil size={15}/> Επεξεργασία</button><button type="button" className="icon-button danger-text" aria-label={`Διαγραφή ${displayName(settings,account)}`} title="Διαγραφή" onClick={()=>requestDelete(account)}><Trash2 size={16}/></button></div>
          </div>;
        })}
      </div>
      {message?<div className="account-management-message" role="status" aria-live="polite">{message}</div>:null}
    </section>

    <AnimatePresence>{editor?<motion.div className="account-management-backdrop" initial={reduce?false:{opacity:0}} animate={{opacity:1}} exit={reduce?undefined:{opacity:0}} onMouseDown={closeEditor}>
      <motion.section ref={modalRef} className={`account-management-modal ${editor.source==='new'?'is-new':'is-edit'}`} role="dialog" aria-modal="true" aria-labelledby="account-editor-title" tabIndex={-1} initial={reduce?false:{opacity:0,scale:.975,y:12}} animate={{opacity:1,scale:1,y:0}} exit={reduce?undefined:{opacity:0,scale:.985,y:8}} transition={{duration:reduce?0:.18}} onMouseDown={event=>event.stopPropagation()}>
        <header><h2 id="account-editor-title">{editor.source==='new'?'Νέος λογαριασμός':'Επεξεργασία λογαριασμού'}</h2><button type="button" className="icon-button" aria-label="Κλείσιμο" disabled={busy} onClick={closeEditor}><X/></button></header>
        <div className="account-management-editor-body">
          {editor.source==='new'?<fieldset className="account-management-segment"><legend>Τύπος λογαριασμού</legend><div><button type="button" className={editor.mode==='bank'?'active':''} aria-pressed={editor.mode==='bank'} onClick={()=>setEditor({...editor,mode:'bank'})}><Landmark size={16}/> Τραπεζικός</button><button type="button" className={editor.mode==='cash'?'active is-cash':''} aria-pressed={editor.mode==='cash'} onClick={()=>setEditor({...editor,mode:'cash',cashRole:editor.cashRole||'daily',showInQuickChoices:editor.cashRole!=='reserve'})}><WalletCards size={16}/> Μετρητά</button></div></fieldset>:<div className="account-management-edit-summary"><EditorIcon mode={editor.mode}/><div><b>{editor.name||'Λογαριασμός'}</b><span>{editor.mode==='cash'?(editor.cashRole==='reserve'?'Καβάτζα':'Μετρητά'):(editor.provider||'Τραπεζικός λογαριασμός')}</span></div></div>}

          <label className="account-management-field"><span>Όνομα λογαριασμού</span><input data-autofocus="true" value={editor.name} onChange={event=>setEditor({...editor,name:event.target.value})} placeholder={editor.mode==='cash'?'π.χ. Καβάτζα':'π.χ. Μισθοδοσία'}/></label>

          {editor.mode==='bank'?<>{editor.source==='new'?<label className="account-management-field"><span>Τράπεζα / πάροχος</span><input value={editor.provider} onChange={event=>setEditor({...editor,provider:event.target.value})} placeholder="π.χ. Τράπεζα Πειραιώς"/></label>:null}<label className="account-management-field"><span>IBAN</span><input inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={editor.iban} onChange={event=>setEditor({...editor,iban:event.target.value.toUpperCase()})} placeholder="GR16 0110 …"/></label></>:<fieldset className="account-management-segment compact"><legend>Τύπος μετρητών</legend><div><button type="button" className={editor.cashRole==='daily'?'active is-cash':''} aria-pressed={editor.cashRole==='daily'} onClick={()=>setEditor({...editor,cashRole:'daily',showInQuickChoices:true})}>Καθημερινά μετρητά</button><button type="button" className={editor.cashRole==='reserve'?'active is-cash':''} aria-pressed={editor.cashRole==='reserve'} onClick={()=>setEditor({...editor,cashRole:'reserve',showInQuickChoices:false})}>Καβάτζα</button></div></fieldset>}

          {editor.source!=='new'&&editorCanBeDefault?<fieldset className="account-management-edit-defaults"><legend>Προεπιλογές</legend><div>
            <label className="account-management-default-choice"><input type="checkbox" checked={editor.defaultExpense} onChange={event=>setEditor({...editor,defaultExpense:event.target.checked})}/><i aria-hidden="true"/><span>Έξοδα</span></label>
            <label className="account-management-default-choice"><input type="checkbox" checked={editor.defaultIncome} onChange={event=>setEditor({...editor,defaultIncome:event.target.checked})}/><i aria-hidden="true"/><span>Έσοδα</span></label>
            <label className="account-management-default-choice"><input type="checkbox" checked={editor.defaultLoan} onChange={event=>setEditor({...editor,defaultLoan:event.target.checked})}/><i aria-hidden="true"/><span>Πληρωμή δόσεων</span></label>
          </div></fieldset>:null}
          {editorError?<div className="account-management-editor-error" role="alert" aria-live="assertive">{editorError}</div>:null}
        </div>
        <footer className="account-management-modal-footer">
          <div>{editor.source!=='new'?<button type="button" className="account-management-delete-modal" disabled={busy||!editorDeletable} title={editorDeletable?'Διαγραφή λογαριασμού':editor.source==='seed'?'Οι αρχικοί λογαριασμοί διατηρούνται για το ιστορικό.':'Ο λογαριασμός χρησιμοποιείται ήδη στο οικονομικό ιστορικό.'} onClick={()=>{if(!editorAccount||!editorDeletable)return;setEditor(null);requestDelete(editorAccount)}}><Trash2 size={16}/> Διαγραφή</button>:null}</div>
          <div className="account-management-modal-actions"><button type="button" className="secondary" disabled={busy} onClick={closeEditor}>Ακύρωση</button><button type="button" className="save-button" disabled={busy} onClick={()=>void save()}>{busy?'Αποθήκευση…':editor.source==='new'?'Δημιουργία λογαριασμού':'Αποθήκευση'}</button></div>
        </footer>
      </motion.section>
    </motion.div>:null}</AnimatePresence>

    <ConfirmDialog open={Boolean(pendingDelete)} title="Διαγραφή λογαριασμού;" description={pendingDelete?`Ο λογαριασμός «${displayName(settings,pendingDelete)}» θα αφαιρεθεί οριστικά. Η ενέργεια επιτρέπεται μόνο επειδή δεν υπάρχει οικονομικό ιστορικό που να τον χρησιμοποιεί.`:''} confirmLabel="Διαγραφή" tone="destructive" busy={busy} motionMode={settings.motion} onConfirm={()=>void confirmDelete()} onCancel={()=>{if(!busy)setPendingDelete(null)}}/>
  </div>;
}