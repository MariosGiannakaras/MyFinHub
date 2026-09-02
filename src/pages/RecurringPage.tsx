import { Archive, CalendarClock, MoreHorizontal, PauseCircle, Pencil, PlayCircle, Plus, ReceiptText, X } from 'lucide-react';
import { useState } from 'react';
import { AnimatedAmount } from '../components/AnimatedAmount';
import { AppDateInput } from '../components/AppDateInput';
import { AppSelectInput } from '../components/AppSelectInput';
import { FinanceIcon } from '../components/FinanceIcon';
import { LongTermLoanSummary } from '../components/LongTermLoanSummary';
import { MoneyInput } from '../components/MoneyInput';
import { Tooltip } from '../components/Tooltip';
import { useModalFocus } from '../hooks/useModalFocus';
import { allAccounts } from '../lib/domain';
import { money, shortDate } from '../lib/format';
import { recurringDraftError } from '../lib/inputSemantics';
import { activeRecurringItems, inactiveRecurringItems, recurringAccountChoice, recurringAccountError, recurringMonthlyTotal, recurringPayments, recurringStatus, recurringUpcoming, typicalPaymentDay } from '../lib/recurring';
import { recurringCadenceLabel } from '../lib/recurringCadence';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, RecurringItem, RecurringStatus } from '../types';

type EditableRecurring=RecurringItem&{recurrenceUnit?:'month'|'year';recurrenceInterval?:number};

export function RecurringPage({data,asOf,onUpsert,onOpenLoans,onPayLoan,onPayRecurring}:{data:FinanceData;asOf:string;onUpsert:(item:RecurringItem)=>void;onOpenLoans:()=>void;onPayLoan:(loanId:string)=>void;onPayRecurring:(recurringId:string)=>void}){
  const active=activeRecurringItems(data);
  const inactive=inactiveRecurringItems(data);
  const upcoming=recurringUpcoming(data,asOf);
  const monthlyTotal=recurringMonthlyTotal(data);
  const recurringGroups=Array.from(new Set(upcoming.map(row=>row.item.category))).map(category=>({category,rows:upcoming.filter(row=>row.item.category===category)}));
  const accounts=allAccounts(data).filter(account=>account.kind!=='credit');
  const accountIds=accounts.map(account=>account.id);
  const defaultAccount=recurringAccountChoice(accountIds,data.state.settings.defaultExpenseAccount);
  const [edit,setEdit]=useState<EditableRecurring|null>(null);
  const [editAmount,setEditAmount]=useState('');
  const [editError,setEditError]=useState('');
  const [message,setMessage]=useState('');
  const editRef=useModalFocus<HTMLElement>(Boolean(edit),'input',()=>{setEdit(null);setEditAmount('');setEditError('')});
  const startNew=()=>{setEditError('');setEditAmount('');setEdit({id:`rec-${Date.now()}`,name:'',amount:0,day:null,firstExpectedDate:asOf,accountId:defaultAccount,category:data.state.settings.expenseCategories[0]||'Άλλο',active:true,status:'active',source:'user',recurrenceUnit:'month',recurrenceInterval:1})};
  const startEdit=(item:RecurringItem)=>{setEditError('');setEditAmount(item.amount>0?String(item.amount):'');setEdit({...item,status:recurringStatus(item)} as EditableRecurring)};
  const closeEdit=()=>{setEdit(null);setEditAmount('');setEditError('')};
  const save=()=>{if(!edit)return;const normalized={...edit,recurrenceUnit:edit.recurrenceUnit??'month',recurrenceInterval:edit.recurrenceInterval??1,active:(edit.status??'active')==='active'};const error=recurringDraftError(normalized)??recurringAccountError(accountIds,normalized.accountId);if(error){setEditError(error);return}onUpsert(normalized);setMessage('Το πάγιο ενημερώθηκε και αποθηκεύεται.');closeEdit()};
  const setLifecycle=(item:RecurringItem,status:RecurringStatus)=>{onUpsert({...item,status,active:status==='active'});setMessage(status==='active'?'Το πάγιο ενεργοποιήθηκε ξανά.':status==='paused'?'Το πάγιο μπήκε σε παύση και διατηρήθηκε στο ιστορικό.':'Το πάγιο σταμάτησε και διατηρήθηκε στο ιστορικό.')};
  const startPay=(item:RecurringItem)=>onPayRecurring(item.id);
  const nextThree=upcoming.slice(0,3);
  const nextPayment=nextThree[0]??null;

  return <div className="page-stack recurring-approved-page">
    <section className="page-heading recurring-approved-heading"><div><span className="eyebrow">ΠΑΓΙΑ & ΣΥΝΔΡΟΜΕΣ</span><h1>Πάγια<span className="sr-only"> & Συνδρομές</span></h1><p>Διαχειριστείτε τις επαναλαμβανόμενες πληρωμές σας και παρακολουθήστε τις επόμενες υποχρεώσεις.</p></div><button type="button" className="save-button" onClick={startNew}><Plus size={17}/> Νέο πάγιο</button></section>

    <section className="recurring-summary-grid" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}} aria-label="Σύνοψη παγίων">
      <article className="neo-raised recurring-summary-card"><span className="recurring-summary-icon"><ReceiptText size={24}/></span><div><span>Μηνιαίο ισοδύναμο ενεργών</span><b><AnimatedAmount value={monthlyTotal}/></b><small>{active.length} ενεργά πάγια / συνδρομές με την πραγματική περιοδικότητά τους</small></div></article>
      <article className="neo-raised recurring-summary-card"><span className="recurring-summary-icon recurring-summary-icon-next"><CalendarClock size={24}/></span><div><span>Επόμενη εκτιμώμενη πληρωμή</span><b>{nextPayment?.nextDate?shortDate(nextPayment.nextDate):'—'}</b><small>{nextPayment?`${nextPayment.item.name} · ${money.format(nextPayment.item.amount)}`:'Δεν υπάρχει προγραμματισμένη ημερομηνία'}</small></div></article>
    </section>

    {message?<div className="action-status" role="status" aria-live="polite">{message}</div>:null}

    <section className="panel neo-raised recurring-active-workspace" data-recurring-active-workspace>
      <div className="panel-head recurring-active-heading"><div><span>Ενεργά</span><small>Οι ενεργές επαναλαμβανόμενες υποχρεώσεις, οργανωμένες ανά κατηγορία.</small></div></div>
      <section className="recurring-active-recurring" data-active-recurring>
        {upcoming.length?<>
          <div className="semantic-table-wrap desktop-finance-table recurring-approved-table-wrap">
            <table className="semantic-table recurring-workspace-table">
              <caption className="sr-only">Ενεργά πάγια και συνδρομές</caption>
              <thead><tr><th scope="col">Πάγιο</th><th scope="col">Επόμενη πληρωμή</th><th scope="col">Λογαριασμός</th><th scope="col" className="amount">Ποσό</th><th scope="col" className="actions">Ενέργειες</th></tr></thead>
              {recurringGroups.map(group=><tbody key={group.category} data-recurring-group={group.category}>
                <tr className="recurring-group-row"><th scope="rowgroup" colSpan={5}><FinanceIcon settings={data.state.settings} kind="expense" category={group.category} size={16}/><span>{group.category}</span></th></tr>
                {group.rows.map(({item,nextDate,lastPayment})=>{const typical=typicalPaymentDay(data,item);return <tr key={item.id} data-recurring-status="active">
                  <td><div className="semantic-list-title"><FinanceIcon settings={data.state.settings} kind="expense" note={item.name} category={item.category} size={17}/><div><b>{item.name}</b><small>{recurringCadenceLabel(item)}</small></div></div></td>
                  <td><b>{nextDate?shortDate(nextDate):'—'}</b><small>{recurringCadenceLabel(item)}{typical?` · Συνήθης ημέρα ${typical}`:''}{lastPayment?` · Τελευταία ${shortDate(lastPayment.date)}`:''}</small></td>
                  <td><b className="recurring-account-name">{accountDisplayName(data,item.accountId)}</b><small>Προεπιλεγμένος</small></td>
                  <td className="amount"><b>{money.format(item.amount)}</b></td>
                  <td className="actions"><span className="row-actions recurring-actions"><button type="button" className="pay-action" aria-label={`Πληρωμή ${item.name}`} onClick={()=>startPay(item)}><ReceiptText/><span>Πληρωμή</span></button><Tooltip label={`Επεξεργασία ${item.name}`} side="left"><button type="button" aria-label={`Επεξεργασία ${item.name}`} onClick={()=>startEdit(item)}><Pencil/></button></Tooltip><Tooltip label={`Παύση ${item.name}`} side="left"><button type="button" aria-label={`Παύση ${item.name}`} onClick={()=>setLifecycle(item,'paused')}><PauseCircle/></button></Tooltip><Tooltip label={`Διακοπή ${item.name}`} side="left"><button type="button" aria-label={`Διακοπή ${item.name}`} onClick={()=>setLifecycle(item,'stopped')}><Archive/></button></Tooltip></span></td>
                </tr>})}
              </tbody>)}
            </table>
          </div>
          <div className="mobile-recurring-list" role="list" aria-label="Ενεργά πάγια και συνδρομές κινητού">{upcoming.map(({item,nextDate,lastPayment})=>{const typical=typicalPaymentDay(data,item);return <article className="mobile-recurring-row" role="listitem" data-mobile-recurring={item.id} data-recurring-status="active" key={item.id}><div className="mobile-recurring-head"><div className="semantic-list-title"><FinanceIcon settings={data.state.settings} kind="expense" note={item.name} category={item.category} size={17}/><div><b>{item.name}</b><small>{item.category} · {recurringCadenceLabel(item)}</small></div></div><strong>{money.format(item.amount)}</strong></div><div className="mobile-recurring-meta"><span><b>{nextDate?shortDate(nextDate):'—'}</b><small>{recurringCadenceLabel(item)}{typical?` · Συνήθης ημέρα ${typical}`:''}</small></span><span><b>{accountDisplayName(data,item.accountId)}</b><small>{lastPayment?`Τελευταία ${shortDate(lastPayment.date)} · ${money.format(lastPayment.amount)}`:'Δεν έχει πληρωμή'}</small></span></div><div className="mobile-recurring-actions"><button type="button" className="save-button mobile-pay-action" aria-label={`Πληρωμή ${item.name}`} onClick={()=>startPay(item)}><ReceiptText size={16}/> Πληρωμή</button><details className="mobile-action-menu"><summary aria-label={`Περισσότερες ενέργειες για ${item.name}`}><MoreHorizontal size={18}/><span className="sr-only">Περισσότερα</span></summary><div><button type="button" onClick={event=>{startEdit(item);(event.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')}}><Pencil size={15}/> Επεξεργασία</button><button type="button" onClick={event=>{setLifecycle(item,'paused');(event.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')}}><PauseCircle size={15}/> Παύση</button><button type="button" onClick={event=>{setLifecycle(item,'stopped');(event.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open')}}><Archive size={15}/> Διακοπή</button></div></details></div></article>})}</div>
        </>:<div className="empty-state">Δεν υπάρχουν ενεργά πάγια.</div>}
      </section>
      <LongTermLoanSummary data={data} onPayLoan={onPayLoan} onOpenLoans={onOpenLoans}/>
    </section>

    <details className="panel neo-flat inactive-recurring" data-inactive-recurring-history>
      <summary className="panel-head" aria-label={`Παγωμένα και ανενεργά πάγια, ${inactive.length}`}><div><span>Παγωμένα & ανενεργά</span><small>Πάγια που είναι προσωρινά παγωμένα ή ανενεργά.</small></div><strong>{inactive.length}</strong></summary>
      {inactive.length?<div className="inactive-recurring-list" style={{marginTop:8}}>{inactive.map(item=><article key={item.id} data-recurring-status={recurringStatus(item)}><div className="semantic-list-title"><FinanceIcon settings={data.state.settings} kind="expense" note={item.name} category={item.category} size={16}/><div><b>{item.name}</b><small>{item.category} · {recurringCadenceLabel(item)} · {recurringStatus(item)==='paused'?'Σε παύση':'Σταμάτησε'} · {recurringPayments(data,item.id).length} καταγεγραμμένες πληρωμές</small></div></div><strong>{money.format(item.amount)}</strong><div className="row-actions"><Tooltip label={`Επεξεργασία ${item.name}`} side="left"><button type="button" aria-label={`Επεξεργασία ${item.name}`} onClick={()=>startEdit(item)}><Pencil/></button></Tooltip><Tooltip label={`Ενεργοποίηση ${item.name}`} side="left"><button type="button" aria-label={`Ενεργοποίηση ${item.name}`} onClick={()=>setLifecycle(item,'active')}><PlayCircle/></button></Tooltip></div></article>)}</div>:<div className="empty-inline" style={{marginTop:8}}>Δεν υπάρχουν ανενεργές συνδρομές ή πάγια.</div>}
    </details>

    {edit?<div className="editor-backdrop" onMouseDown={closeEdit}><section ref={editRef} className="panel neo-raised editor-dialog" role="dialog" aria-modal="true" aria-labelledby="recurring-editor-title" tabIndex={-1} onMouseDown={event=>event.stopPropagation()}><div className="panel-head"><div><span id="recurring-editor-title">{active.some(item=>item.id===edit.id)||inactive.some(item=>item.id===edit.id)?'Επεξεργασία παγίου':'Νέο πάγιο'}</span><small>Το ποσό και ο λογαριασμός είναι προεπιλογές. Η πραγματική πληρωμή μπορεί να αλλάξει κάθε φορά.</small></div><button type="button" className="icon-button" aria-label="Κλείσιμο επεξεργασίας παγίου" onClick={closeEdit}><X/></button></div><div className="settings-form editor-grid"><label><span>Όνομα</span><input value={edit.name} onChange={event=>setEdit({...edit,name:event.target.value})}/></label><label><span>Προκαθορισμένο ποσό</span><MoneyInput value={editAmount} onValueChange={value=>{setEditAmount(value);setEdit({...edit,amount:value===''?0:Number(value)})}} invalid={Boolean(editError&&edit.amount<=0)} placeholder="0,00"/></label><label><span>Κάθε</span><input type="number" min="1" max="120" step="1" value={edit.recurrenceInterval??1} onChange={event=>setEdit({...edit,recurrenceInterval:Number(event.target.value)||1})}/></label><label><span>Μονάδα επανάληψης</span><AppSelectInput value={edit.recurrenceUnit??'month'} onChange={event=>setEdit({...edit,recurrenceUnit:event.target.value as 'month'|'year'})}><option value="month">Μήνα / μήνες</option><option value="year">Χρόνο / χρόνια</option></AppSelectInput></label><label><span>Συνηθισμένη ημέρα μήνα</span><input type="number" min="1" max="31" step="1" value={edit.day??''} onChange={event=>setEdit({...edit,day:event.target.value?Number(event.target.value):null})}/></label><label><span>Πρώτη αναμενόμενη ημερομηνία</span><AppDateInput value={edit.firstExpectedDate??''} onChange={event=>setEdit({...edit,firstExpectedDate:event.target.value||null})}/></label><label><span>Προεπιλεγμένος λογαριασμός</span><AppSelectInput value={edit.accountId} onChange={event=>setEdit({...edit,accountId:event.target.value})}>{accounts.map(account=><option key={account.id} value={account.id}>{accountDisplayName(data,account.id)}</option>)}</AppSelectInput></label><label><span>Κατηγορία</span><AppSelectInput value={edit.category} onChange={event=>setEdit({...edit,category:event.target.value})}>{data.state.settings.expenseCategories.map(category=><option key={category}>{category}</option>)}</AppSelectInput></label><label><span>Κατάσταση</span><AppSelectInput value={edit.status??(edit.active?'active':'stopped')} onChange={event=>setEdit({...edit,status:event.target.value as RecurringStatus,active:event.target.value==='active'})}><option value="active">Ενεργό</option><option value="paused">Σε παύση</option><option value="stopped">Σταμάτησε</option></AppSelectInput></label></div>{editError?<div className="form-error" role="alert" aria-live="assertive">{editError}</div>:null}<div className="editor-actions"><button type="button" className="secondary" onClick={closeEdit}>Ακύρωση</button><button type="button" className="save-button" onClick={save}>Αποθήκευση</button></div></section></div>:null}
  </div>;
}
