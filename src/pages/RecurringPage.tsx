import { Archive, CalendarClock, ImagePlus, MoreHorizontal, PauseCircle, Pencil, PlayCircle, Plus, ReceiptText, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { AppTextInput } from '../components/AppTextInput';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { RecurringBrandMark } from '../components/RecurringBrandMark';
import { Surface } from '../components/Surface';
import { CategorySelectInput } from '../components/CategorySelectInput';
import { FinanceIcon } from '../components/FinanceIcon';
import { FormError } from '../components/FormError';
import { IconButton } from '../components/IconButton';
import { LongTermLoanSummary } from '../components/LongTermLoanSummary';
import { MoneyInput } from '../components/MoneyInput';
import { Tooltip } from '../components/Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { allAccounts } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { recurringDraftError } from '../lib/inputSemantics';
import { activeRecurringItems, inactiveRecurringItems, recurringAccountChoice, recurringAccountError, recurringMonthlyTotal, recurringPayments, recurringStatus, recurringUpcoming, typicalPaymentDay } from '../lib/recurring';
import { recurringCadenceLabel } from '../lib/recurringCadence';
import { deleteRecurringServiceAsset, uploadRecurringServiceAsset, type RecurringServiceAsset } from '../lib/recurringServiceAssetClient';
import { accountDisplayName } from '../lib/ui';
import { userErrorMessage } from '../lib/userMessage';
import type { FinanceData, RecurringItem, RecurringStatus } from '../types';
import './RecurringCompletion.css';

const RECURRING_LOGO_ACCEPT='image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg';
const RECURRING_LOGO_MAX_BYTES=2*1024*1024;
const RECURRING_LOGO_TYPES=new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
function recurringLogoFileError(file:File){
  if(!RECURRING_LOGO_TYPES.has(file.type))return 'Το λογότυπο πρέπει να είναι PNG, JPG, WebP ή SVG.';
  if(file.size<1)return 'Το αρχείο λογοτύπου είναι κενό.';
  if(file.size>RECURRING_LOGO_MAX_BYTES)return 'Το λογότυπο δεν μπορεί να ξεπερνά τα 2 MB.';
  return null;
}

export function RecurringPage({data,asOf,onUpsert,onUpsertDurably,onOpenLoans,onPayLoan,onPayRecurring}:{data:FinanceData;asOf:string;onUpsert:(item:RecurringItem)=>void;onUpsertDurably:(item:RecurringItem)=>Promise<void>;onOpenLoans:()=>void;onPayLoan:(loanId:string)=>void;onPayRecurring:(recurringId:string)=>void}){
  const active=activeRecurringItems(data);
  const inactive=inactiveRecurringItems(data);
  const upcoming=recurringUpcoming(data,asOf);
  const monthlyTotal=recurringMonthlyTotal(data);
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const accountIds=accounts.map(account=>account.id);
  const defaultAccount=recurringAccountChoice(accountIds,data.state.settings.defaultExpenseAccount);
  const [edit,setEdit]=useState<RecurringItem|null>(null);
  const [editAmount,setEditAmount]=useState('');
  const [editError,setEditError]=useState('');
  const [editBusy,setEditBusy]=useState(false);
  const [editLogoFile,setEditLogoFile]=useState<File|null>(null);
  const [editLogoRemoved,setEditLogoRemoved]=useState(false);
  const logoInput=useRef<HTMLInputElement|null>(null);
  const [message,setMessage]=useState('');
  const [mobileActiveLimit,setMobileActiveLimit]=useState(12);
  const [desktopActiveLimit,setDesktopActiveLimit]=useState(24);
  const [inactiveLimit,setInactiveLimit]=useState(24);
  const desktopUpcoming=upcoming.slice(0,desktopActiveLimit);
  const recurringGroups=Array.from(new Set(desktopUpcoming.map(row=>row.item.category))).map(category=>({category,rows:desktopUpcoming.filter(row=>row.item.category===category)}));
  const visibleInactive=inactive.slice(0,inactiveLimit);
  const resetLogoDraft=()=>{setEditLogoFile(null);setEditLogoRemoved(false);if(logoInput.current)logoInput.current.value=''};
  const releaseEdit=()=>{setEdit(null);setEditAmount('');setEditError('');resetLogoDraft()};
  const closeEdit=()=>{if(!editBusy)releaseEdit()};
  const editRef=useModalFocus<HTMLElement>(Boolean(edit),'input',closeEdit);
  const startNew=()=>{resetLogoDraft();setEditError('');setEditAmount('');setEdit({id:`rec-${Date.now()}`,name:'',amount:0,day:null,firstExpectedDate:asOf,endDate:null,accountId:defaultAccount,category:data.state.settings.expenseCategories[0]||'Άλλο',active:true,status:'active',source:'user',recurrenceUnit:'month',recurrenceInterval:1})};
  const startEdit=(item:RecurringItem)=>{resetLogoDraft();setEditError('');setEditAmount(item.amount>0?String(item.amount):'');setEdit({...item,endDate:item.endDate??null,status:recurringStatus(item)})};
  const selectLogo=(file?:File)=>{if(!file)return;const error=recurringLogoFileError(file);if(error){setEditError(error);if(logoInput.current)logoInput.current.value='';return}setEditLogoFile(file);setEditLogoRemoved(false);setEditError('')};
  const removeLogo=()=>{setEditLogoFile(null);setEditLogoRemoved(true);if(logoInput.current)logoInput.current.value=''};
  const save=async()=>{
    if(!edit||editBusy)return;
    const existed=active.some(item=>item.id===edit.id)||inactive.some(item=>item.id===edit.id);
    const base:RecurringItem={...edit,recurrenceUnit:edit.recurrenceUnit??'month',recurrenceInterval:edit.recurrenceInterval??1,active:(edit.status??'active')==='active'};
    const error=recurringDraftError(base)??recurringAccountError(accountIds,base.accountId);
    if(error){setEditError(error);return}
    setEditBusy(true);setEditError('');
    let uploaded:RecurringServiceAsset|null=null;
    let persisted=false;
    const oldKey=base.logoAssetKey;
    try{
      let logoAssetKey=editLogoRemoved?undefined:oldKey;
      if(editLogoFile){
        uploaded=await uploadRecurringServiceAsset({recurringId:base.id,file:editLogoFile});
        logoAssetKey=uploaded.assetKey;
      }
      const normalized:RecurringItem={...base,logoAssetKey:logoAssetKey||undefined};
      // The editor must not close or report success until this exact finance
      // mutation is persisted with its matching revision and history cursor.
      await onUpsertDurably(normalized);
      persisted=true;
      let cleanupWarning='';
      const oldKeyStillShared=Boolean(oldKey&&[...active,...inactive].some(item=>item.id!==base.id&&item.logoAssetKey===oldKey));
      if(oldKey&&oldKey!==normalized.logoAssetKey&&!oldKeyStillShared){
        try{await deleteRecurringServiceAsset(oldKey)}
        catch{cleanupWarning=' Το προηγούμενο λογότυπο δεν ήταν δυνατό να αποδεσμευτεί· η οικονομική αλλαγή έχει αποθηκευτεί.'}
      }
      releaseEdit();
      setMessage((existed?'Το πάγιο ενημερώθηκε και αποθηκεύτηκε.':'Το νέο πάγιο δημιουργήθηκε και αποθηκεύτηκε.')+cleanupWarning);
    }catch(reason){
      let cleanupWarning='';
      if(uploaded&&!persisted){
        try{await deleteRecurringServiceAsset(uploaded.assetKey)}
        catch{cleanupWarning=' Η απομάκρυνση της νέας μη χρησιμοποιούμενης εικόνας απέτυχε· απαιτείται έλεγχος.'}
      }
      setEditError(userErrorMessage(reason,'Η αποθήκευση του παγίου δεν επιβεβαιώθηκε. Επαναφόρτωσε την τελευταία αποθηκευμένη έκδοση πριν συνεχίσεις.')+cleanupWarning);
    }finally{setEditBusy(false)}
  };
  const setLifecycle=(item:RecurringItem,status:RecurringStatus)=>{onUpsert({...item,status,active:status==='active'});setMessage(status==='active'?'Το πάγιο ενεργοποιήθηκε ξανά.':status==='paused'?'Το πάγιο μπήκε σε παύση και διατηρήθηκε στο ιστορικό.':'Το πάγιο σταμάτησε και διατηρήθηκε στο ιστορικό.')};
  const startPay=(item:RecurringItem)=>onPayRecurring(item.id);
  const mobileUpcoming=upcoming.slice(0,mobileActiveLimit);
  const nextThree=upcoming.slice(0,3);
  const nextPayment=nextThree[0]??null;
  const editHasLogo=Boolean(edit&&(editLogoFile||(!editLogoRemoved&&edit.logoAssetKey)));

  return <div className="page-stack recurring-approved-page">
    <PageHeader className="recurring-approved-heading" eyebrow="ΠΑΓΙΑ & ΣΥΝΔΡΟΜΕΣ" title={<>Πάγια<span className="sr-only"> & Συνδρομές</span></>} description={<p>Διαχειριστείτε τις επαναλαμβανόμενες πληρωμές σας και παρακολουθήστε τις επόμενες υποχρεώσεις.</p>} trailing={<Button type="button" variant="primary" onClick={startNew}><Plus size={17}/> Νέο πάγιο</Button>}/>

    <section className="recurring-summary-grid" aria-label="Σύνοψη παγίων">
      <Surface as="article" variant="flat" className="recurring-summary-card"><span className="recurring-summary-icon"><ReceiptText size={24}/></span><div><span>Μηνιαίο ισοδύναμο ενεργών</span><b><AnimatedAmount value={monthlyTotal}/></b><small>{active.length} ενεργά πάγια / συνδρομές με την πραγματική περιοδικότητά τους</small></div></Surface>
      <Surface as="article" variant="flat" className="recurring-summary-card"><span className="recurring-summary-icon recurring-summary-icon-next"><CalendarClock size={24}/></span><div><span>Επόμενη εκτιμώμενη πληρωμή</span><b>{nextPayment?.nextDate?shortDate(nextPayment.nextDate):'—'}</b><small>{nextPayment?`${nextPayment.item.name} · ${money.format(nextPayment.item.amount)}`:'Δεν υπάρχει προγραμματισμένη ημερομηνία'}</small></div></Surface>
    </section>

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <section className="panel surface-raised recurring-active-workspace" data-recurring-active-workspace data-active-recurring>
      <div className="panel-head recurring-active-heading"><div><span>Ενεργά</span><small>Οι ενεργές επαναλαμβανόμενες υποχρεώσεις, οργανωμένες ανά κατηγορία.</small></div></div>
      {upcoming.length?<>
        <div className="semantic-table-wrap desktop-finance-table recurring-approved-table-wrap">
          <table className="semantic-table recurring-workspace-table">
            <caption className="sr-only">Ενεργά πάγια και συνδρομές</caption>
            <thead><tr><th scope="col">Πάγιο</th><th scope="col">Επόμενη πληρωμή</th><th scope="col">Λογαριασμός</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="actions">Ενέργειες</th></tr></thead>
            {recurringGroups.map(group=><tbody key={group.category} data-recurring-group={group.category}>
              <tr className="recurring-group-row"><th scope="rowgroup" colSpan={5}><FinanceIcon settings={data.state.settings} kind="expense" category={group.category} size={16}/><span>{group.category}</span></th></tr>
              {group.rows.map(({item,nextDate,lastPayment})=>{const typical=typicalPaymentDay(data,item);const endDate=item.endDate;return <tr key={item.id} data-recurring-status="active">
                <td><div className="semantic-list-title"><RecurringBrandMark item={item} settings={data.state.settings} size={34}/><div><b>{item.name}</b><small>{recurringCadenceLabel(item)}</small></div></div></td>
                <td><b>{nextDate?shortDate(nextDate):'—'}</b><small>{[typical?`Συνήθης ημέρα ${typical}`:'',lastPayment?`Τελευταία ${shortDate(lastPayment.date)}`:'',endDate?`Λήξη/ανανέωση ${shortDate(endDate)}`:''].filter(Boolean).join(' · ')||'Χωρίς πρόσθετα στοιχεία'}</small></td>
                <td><b className="recurring-account-name">{accountDisplayName(data,item.accountId)}</b><small>Προεπιλεγμένος</small></td>
                <td className="amount"><b>{money.format(item.amount)}</b></td>
                <td className="actions"><span className="row-actions recurring-actions"><Button type="button" variant="primary" className="pay-action" aria-label={`Πληρωμή ${item.name}`} onClick={()=>startPay(item)}><ReceiptText/><span>Πληρωμή</span></Button><Tooltip label={`Επεξεργασία ${item.name}`} side="left"><IconButton type="button" aria-label={`Επεξεργασία ${item.name}`} onClick={()=>startEdit(item)}><Pencil/></IconButton></Tooltip><Tooltip label={`Παύση ${item.name}`} side="left"><IconButton type="button" aria-label={`Παύση ${item.name}`} onClick={()=>setLifecycle(item,'paused')}><PauseCircle/></IconButton></Tooltip><Tooltip label={`Διακοπή ${item.name}`} side="left"><IconButton type="button" aria-label={`Διακοπή ${item.name}`} onClick={()=>setLifecycle(item,'stopped')}><Archive/></IconButton></Tooltip></span></td>
              </tr>})}
            </tbody>)}
          </table>
          {upcoming.length>desktopUpcoming.length?<Button type="button" variant="secondary" className="desktop-recurring-more" onClick={()=>setDesktopActiveLimit(limit=>limit+24)}>Προβολή περισσότερων · {upcoming.length-desktopUpcoming.length} ακόμη</Button>:null}
        </div>
        <div className="mobile-recurring-list" role="list" aria-label="Ενεργά πάγια και συνδρομές κινητού">{mobileUpcoming.map(({item,nextDate,lastPayment})=>{const typical=typicalPaymentDay(data,item);const endDate=item.endDate;return <article className="mobile-recurring-row" role="listitem" data-mobile-recurring={item.id} data-recurring-status="active" key={item.id}><div className="mobile-recurring-head"><div className="semantic-list-title"><RecurringBrandMark item={item} settings={data.state.settings} size={34}/><div><b>{item.name}</b><small>{item.category} · {recurringCadenceLabel(item)}</small></div></div><strong>{money.format(item.amount)}</strong></div><div className="mobile-recurring-meta"><span><b>{nextDate?shortDate(nextDate):'—'}</b><small>{recurringCadenceLabel(item)}{typical?` · Συνήθης ημέρα ${typical}`:''}{endDate?` · Λήξη/ανανέωση ${shortDate(endDate)}`:''}</small></span><span><b>{accountDisplayName(data,item.accountId)}</b><small>{lastPayment?`Τελευταία ${shortDate(lastPayment.date)} · ${money.format(lastPayment.amount)}`:'Δεν έχει πληρωμή'}</small></span></div><div className="mobile-recurring-actions"><Button type="button" variant="primary" className="mobile-pay-action" aria-label={`Πληρωμή ${item.name}`} onClick={()=>startPay(item)}><ReceiptText size={16}/> Πληρωμή</Button><details className="mobile-action-menu"><summary aria-label={`Περισσότερες ενέργειες για ${item.name}`}><MoreHorizontal size={18}/><span className="sr-only">Περισσότερα</span></summary><div><button type="button" onClick={event=>{startEdit(item);(event.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')}}><Pencil size={15}/> Επεξεργασία</button><button type="button" onClick={event=>{setLifecycle(item,'paused');(event.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')}}><PauseCircle size={15}/> Παύση</button><button type="button" onClick={event=>{setLifecycle(item,'stopped');(event.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')}}><Archive size={15}/> Διακοπή</button></div></details></div></article>})}</div>{upcoming.length>mobileUpcoming.length?<Button type="button" variant="secondary" className="mobile-recurring-more" onClick={()=>setMobileActiveLimit(limit=>limit+12)}>Προβολή περισσότερων · {upcoming.length-mobileUpcoming.length} ακόμη</Button>:null}
      </>:<div className="empty-state">Δεν υπάρχουν ενεργά πάγια.</div>}
    </section>

    <LongTermLoanSummary data={data} onPayLoan={onPayLoan} onOpenLoans={onOpenLoans}/>

    <details className={`panel surface-flat inactive-recurring ${inactive.length?'':'is-empty'}`} data-inactive-recurring-history>
      <summary className="panel-head" aria-label={`Παγωμένα και ανενεργά πάγια, ${inactive.length}`}><div><span>Παγωμένα & ανενεργά</span><small>Πάγια που είναι προσωρινά παγωμένα ή ανενεργά.</small></div><strong>{inactive.length}</strong></summary>
      {inactive.length?<><div className="inactive-recurring-list">{visibleInactive.map(item=><article key={item.id} data-recurring-status={recurringStatus(item)}><div className="semantic-list-title"><RecurringBrandMark item={item} settings={data.state.settings} size={34}/><div><b>{item.name}</b><small>{item.category} · {recurringCadenceLabel(item)} · {recurringStatus(item)==='paused'?'Σε παύση':'Σταμάτησε'} · {recurringPayments(data,item.id).length} καταγεγραμμένες πληρωμές{item.endDate?` · Λήξη/ανανέωση ${shortDate(item.endDate!)}`:''}</small></div></div><strong>{money.format(item.amount)}</strong><div className="row-actions"><Tooltip label={`Επεξεργασία ${item.name}`} side="left"><IconButton type="button" aria-label={`Επεξεργασία ${item.name}`} onClick={()=>startEdit(item)}><Pencil/></IconButton></Tooltip><Tooltip label={`Ενεργοποίηση ${item.name}`} side="left"><IconButton type="button" aria-label={`Ενεργοποίηση ${item.name}`} onClick={()=>setLifecycle(item,'active')}><PlayCircle/></IconButton></Tooltip></div></article>)}</div>{inactive.length>visibleInactive.length?<Button type="button" variant="secondary" className="inactive-recurring-more" onClick={()=>setInactiveLimit(limit=>limit+24)}>Προβολή περισσότερων · {inactive.length-visibleInactive.length} ακόμη</Button>:null}</>:<div className="empty-inline">Δεν υπάρχουν ανενεργές συνδρομές ή πάγια.</div>}
    </details>

    {edit?<div className="editor-backdrop" onMouseDown={closeEdit}><input ref={logoInput} type="file" accept={RECURRING_LOGO_ACCEPT} hidden onChange={event=>selectLogo(event.target.files?.[0])}/><section ref={editRef} className="panel surface-raised editor-dialog recurring-editor-dialog" role="dialog" aria-modal="true" aria-busy={editBusy} aria-labelledby="recurring-editor-title" aria-describedby={editError?'recurring-editor-error':undefined} tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="panel-head"><div><span id="recurring-editor-title">{active.some(item=>item.id===edit.id)||inactive.some(item=>item.id===edit.id)?'Επεξεργασία παγίου':'Νέο πάγιο'}</span><small>Το ποσό και ο λογαριασμός είναι προεπιλογές. Η πραγματική πληρωμή μπορεί να αλλάξει κάθε φορά.</small></div><IconButton type="button" aria-label="Κλείσιμο επεξεργασίας παγίου" disabled={editBusy} onClick={closeEdit}><X/></IconButton></div><div className="settings-form editor-grid"><label><span>Όνομα</span><AppTextInput value={edit.name} onChange={event=>setEdit({...edit,name:event.target.value})}/></label><label><span>Προκαθορισμένο ποσό</span><MoneyInput value={editAmount} onValueChange={value=>{setEditAmount(value);setEdit({...edit,amount:value===''?0:Number(value)})}} invalid={Boolean(editError&&edit.amount<=0)} placeholder="0,00"/></label><label><span>Κάθε</span><AppTextInput type="number" min="1" max="120" step="1" value={edit.recurrenceInterval??1} onChange={event=>setEdit({...edit,recurrenceInterval:Number(event.target.value)||1})}/></label><label><span>Μονάδα επανάληψης</span><AppSelectInput value={edit.recurrenceUnit??'month'} onChange={event=>setEdit({...edit,recurrenceUnit:event.target.value as 'month'|'year'})}><option value="month">Μήνα / μήνες</option><option value="year">Χρόνο / χρόνια</option></AppSelectInput></label><label><span>Συνηθισμένη ημέρα μήνα</span><AppTextInput type="number" min="1" max="31" step="1" value={edit.day??''} onChange={event=>setEdit({...edit,day:event.target.value?Number(event.target.value):null})}/></label><label><span>Πρώτη αναμενόμενη ημερομηνία</span><AppDateInput value={edit.firstExpectedDate??''} onChange={event=>setEdit({...edit,firstExpectedDate:event.target.value||null})}/></label><label><span>Λήξη / ανανέωση (προαιρετικά)</span><AppDateInput value={edit.endDate??''} onChange={event=>setEdit({...edit,endDate:event.target.value||null})}/></label><label><span>Προεπιλεγμένος λογαριασμός</span><AppSelectInput value={edit.accountId} onChange={event=>setEdit({...edit,accountId:event.target.value})}>{accounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Κατηγορία</span><CategorySelectInput settings={data.state.settings} kind="expense" category={edit.category} includeSubcategories={false} aria-label="Κατηγορία παγίου" onChange={selection=>setEdit({...edit,category:selection.category})}/></label><label><span>Κατάσταση</span><AppSelectInput value={edit.status??(edit.active?'active':'stopped')} onChange={event=>setEdit({...edit,status:event.target.value as RecurringStatus,active:event.target.value==='active'})}><option value="active">Ενεργό</option><option value="paused">Σε παύση</option><option value="stopped">Σταμάτησε</option></AppSelectInput></label></div><section className="recurring-logo-editor" aria-labelledby="recurring-logo-title"><div className="recurring-logo-editor-preview">{editLogoFile?<span className="recurring-brand-mark recurring-brand-local-selection" style={{width:56,height:56,flexBasis:56}} aria-hidden="true" data-recurring-brand-source="local-selection"><ImagePlus size={24}/></span>:<RecurringBrandMark item={editLogoRemoved?{...edit,logoAssetKey:undefined}:edit} settings={data.state.settings} size={56}/>}<div><b id="recurring-logo-title">Λογότυπο <em>προαιρετικό</em></b><small>{editLogoFile?'Νέο αρχείο επιλεγμένο. Θα ελεγχθεί και θα ανέβει μόνο όταν αποθηκεύσεις.':'PNG, JPG, WebP ή SVG έως 2 MB. Το αρχείο ανεβαίνει μόνο όταν αποθηκεύσεις το πάγιο.'}</small></div></div><div className="recurring-logo-editor-actions"><Button type="button" variant="secondary" disabled={editBusy} onClick={()=>logoInput.current?.click()}><ImagePlus size={16}/> {editHasLogo?'Αλλαγή':'Ανέβασμα'}</Button>{editHasLogo?<Button type="button" variant="ghost" disabled={editBusy} onClick={removeLogo}><Trash2 size={15}/> Αφαίρεση</Button>:null}</div></section>{editError?<FormError id="recurring-editor-error">{editError}</FormError>:null}<div className="editor-actions"><Button type="button" variant="secondary" disabled={editBusy} onClick={closeEdit}>Ακύρωση</Button><Button type="button" variant="primary" disabled={editBusy} onClick={()=>void save()}>{editBusy?'Αποθήκευση…':'Αποθήκευση'}</Button></div></section></div>:null}
  </div>;
}