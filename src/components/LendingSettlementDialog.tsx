import {useMemo,useState} from 'react';
import {DialogShell} from '../components/DialogShell';
import {Button} from '../components/Button';
import {AppDateInput} from '../components/AppDateInput';
import {AppTextInput} from '../components/AppTextInput';
import {AppSelectInput} from '../components/AppSelectInput';
import {MoneyInput} from '../components/MoneyInput';
import {FormError} from '../components/FormError';
import {lendingSettlementProjection,type LendingSettlementDraft} from '../lib/lendingPlans';
import {lendingOutstandingFor} from '../lib/lending';
import {money} from '../lib/format';
import {userErrorMessage} from '../lib/userMessage';
import type {FinanceData} from '../types';

export function LendingSettlementDialog({data,asOf,person,onClose,onSave}:{
  data:FinanceData;asOf:string;person:string;onClose:()=>void;
  onSave:(draft:LendingSettlementDraft)=>Promise<void>;
}){
  const existing=(data.state.lendingPlans??[]).find(plan=>plan.person===person);
  const [total,setTotal]=useState(String(existing?.total??lendingOutstandingFor(data,person,asOf)));
  const [firstDueDate,setFirstDueDate]=useState(existing?.firstDueDate??asOf);
  const [installments,setInstallments]=useState(String(existing?.installments??3));
  const [everyMonths,setEveryMonths]=useState(String(existing?.everyMonths??1));
  const [confirmed,setConfirmed]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const draft:LendingSettlementDraft={
    person,asOf,firstDueDate,amount:Number(total.replace(',','.')),
    installments:Number(installments),everyMonths:Number(everyMonths)
  };
  const projection=useMemo(()=>{
    try{return {data:lendingSettlementProjection(data,draft),error:''}}
    catch(reason){return {data:null,error:userErrorMessage(reason,'Έλεγξε το ποσό, τις δόσεις και τις ημερομηνίες.')}}
  },[data,person,asOf,firstDueDate,total,installments,everyMonths]);
  const resetConfirmation=()=>{setConfirmed(false);setError('')};
  const close=()=>{if(!saving)onClose()};
  const save=async()=>{
    if(saving)return;
    try{
      if(!projection.data)throw new Error(projection.error);
      if(!confirmed)throw new Error('Επιβεβαίωσε ρητά το προτεινόμενο πρόγραμμα επιστροφής.');
      setSaving(true);
      await onSave(draft);
      onClose();
    }catch(reason){setError(userErrorMessage(reason,'Δεν αποθηκεύτηκε το πρόγραμμα. Έλεγξε τα στοιχεία και δοκίμασε ξανά.'))}
    finally{setSaving(false)}
  };
  return <DialogShell open={true} className="contextual-quick-modal lending-settlement-modal" ariaLabelledBy="lending-plan-title"
    ariaDescribedBy="lending-plan-description" busy={saving} motionMode="full"
    preferredFocus='[data-autofocus="true"]' onRequestClose={close}>
    <header><div><small>ΕΠΙΒΕΒΑΙΩΜΕΝΟ ΠΡΟΓΡΑΜΜΑ</small><h2 id="lending-plan-title">Πρόγραμμα επιστροφής · {person}</h2>
      <p id="lending-plan-description">Οι ημερομηνίες είναι σχεδιασμός, όχι εισπράξεις. Μόνο πραγματική επιβεβαιωμένη επιστροφή μειώνει το υπόλοιπο.</p>
    </div></header>
    <div className="entry-body" inert={saving}>
      <div className="form-grid">
        <label><span>Ποσό προς προγραμματισμό (€)</span><MoneyInput data-autofocus="true" value={total} onValueChange={value=>{setTotal(value);resetConfirmation()}}/></label>
        <label><span>Πρώτη ημερομηνία επιστροφής</span><AppDateInput min={asOf} value={firstDueDate} onChange={event=>{setFirstDueDate(event.target.value);resetConfirmation()}}/></label>
        <label><span>Αριθμός δόσεων (1–60)</span><AppTextInput type="number" min={1} max={60} step={1} value={installments} onChange={event=>{setInstallments(event.target.value);resetConfirmation()}}/></label>
        <label><span>Επανάληψη</span><AppSelectInput value={everyMonths} onChange={event=>{setEveryMonths(event.target.value);resetConfirmation()}}>
          <option value="1">Κάθε μήνα</option><option value="2">Κάθε 2 μήνες</option><option value="3">Κάθε 3 μήνες</option>
          <option value="6">Κάθε 6 μήνες</option><option value="12">Κάθε χρόνο</option>
        </AppSelectInput></label>
      </div>
      <div className="logic-note" data-lending-plan-preview role="status" aria-live="polite">
        {projection.data?<><b>Προτεινόμενα {money.format(projection.data.total)} από απαίτηση {money.format(projection.data.outstanding)}</b>
          <ul className="lending-plan-schedule">{projection.data.schedule.slice(0,6).map((item,index)=><li key={index}><span>{item.dueDate}</span><strong>{money.format(item.amount)}</strong></li>)}</ul>
          {projection.data.schedule.length>6?<small>Και {projection.data.schedule.length-6} ακόμη προτεινόμενες δόσεις.</small>:null}
          <p>Καμία προγραμματισμένη δόση δεν καταχωρίζεται αυτόματα ως έσοδο ή κίνηση μετρητών.</p></>
          :<span>{projection.error}</span>}
      </div>
      <label className="lending-settlement-confirmation"><input type="checkbox" checked={confirmed}
        onChange={event=>{setConfirmed(event.target.checked);setError('')}}/>
        <span>Έλεγξα και επιβεβαιώνω το συγκεκριμένο πρόγραμμα. Δεν καταχωρίζω ακόμη πραγματική επιστροφή.</span>
      </label>
      {error?<FormError id="lending-plan-save-error">{error}</FormError>:null}
    </div>
    <footer><Button variant="secondary" type="button" disabled={saving} onClick={close}>Ακύρωση</Button>
      <Button variant="primary" type="button" disabled={saving||!projection.data} onClick={()=>void save()}>
        {saving?'Αποθήκευση…':'Αποθήκευση προγράμματος'}
      </Button></footer>
  </DialogShell>;
}
