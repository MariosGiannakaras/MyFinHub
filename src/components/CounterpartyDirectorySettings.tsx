import {useState} from 'react';
import {AppTextInput} from './AppTextInput';
import {AppTextarea} from './AppTextarea';
import {AppSelectInput} from './AppSelectInput';
import {Button} from './Button';
import {FormError} from './FormError';
import {Surface} from './Surface';
import type {CounterpartyRecord,FinanceData} from '../types';
import './CounterpartyDirectorySettings.css';

export function CounterpartyDirectorySettings({data,onSave}:{data:FinanceData;onSave:(record:CounterpartyRecord)=>Promise<void>}){
 const [editingId,setEditingId]=useState<string|null>(null),[kind,setKind]=useState<CounterpartyRecord['kind']>('merchant');
 const [name,setName]=useState(''),[aliases,setAliases]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const records=data.state.counterparties??[];
 const clear=()=>{setEditingId(null);setName('');setAliases('');setKind('merchant');setError('')};
 const edit=(row:CounterpartyRecord)=>{setEditingId(row.id);setKind(row.kind);setName(row.displayName);setAliases((row.aliases??[]).join('\n'));setError('')};
 const save=async()=>{
   if(busy)return;
   const original=editingId?records.find(row=>row.id===editingId):undefined;
   if(editingId&&!original){setError('Η ταυτότητα έχει αλλάξει. Ανανέωσε τα στοιχεία.');return}
   const now=new Date().toISOString();
   const record:CounterpartyRecord={
     id:original?.id??('cp-'+crypto.randomUUID()),kind:original?.kind??kind,
     displayName:name,aliases:aliases.split('\n').map(x=>x.trim()).filter(Boolean),
     createdAt:original?.createdAt??now,updatedAt:now,
   };
   setBusy(true);setError('');
   try{await onSave(record);clear()}catch(reason){setError(reason instanceof Error?reason.message:'Η αλλαγή δεν επιβεβαιώθηκε.')}finally{setBusy(false)}
 };
 return <Surface as="section" variant="raised" className="panel counterparty-directory">
  <div><h3>Έμποροι και δικαιούχοι</h3><p>Προαιρετικές δικές σου ταυτότητες. Οι παλιές συναλλαγές και σημειώσεις παραμένουν αμετάβλητες.</p></div>
  {records.length?<ul className="counterparty-directory-list">{records.map(row=><li key={row.id}><span><strong>{row.displayName}</strong><small>{row.kind==='merchant'?'Έμπορος':'Δικαιούχος'}</small></span><Button type="button" variant="secondary" disabled={busy} aria-label={'Επεξεργασία '+row.displayName} onClick={()=>edit(row)}>Επεξεργασία</Button></li>)}</ul>:<p>Δεν έχουν καταχωριστεί ταυτότητες.</p>}
  <div className="counterparty-directory-form" role="group" aria-label={editingId?'Επεξεργασία αντισυμβαλλομένου':'Νέος αντισυμβαλλόμενος'}>
    <label><span>Τύπος</span><AppSelectInput value={kind} disabled={busy||Boolean(editingId)} aria-label="Τύπος αντισυμβαλλομένου" onChange={event=>setKind(event.target.value as CounterpartyRecord['kind'])}><option value="merchant">Έμπορος</option><option value="beneficiary">Δικαιούχος</option></AppSelectInput></label>
    <label><span>Όνομα</span><AppTextInput value={name} maxLength={120} disabled={busy} aria-label="Όνομα αντισυμβαλλομένου" onChange={event=>setName(event.target.value)}/></label>
    <label className="counterparty-alias-field"><span>Εναλλακτικές ονομασίες · μία ανά γραμμή</span><AppTextarea value={aliases} rows={2} maxLength={1935} disabled={busy} aria-label="Εναλλακτικές ονομασίες αντισυμβαλλομένου" onChange={event=>setAliases(event.target.value)}/></label>
  </div>
  {error?<FormError id="counterparty-directory-error">{error}</FormError>:null}
  <div className="counterparty-directory-actions"><Button type="button" variant="primary" disabled={busy||name.trim().length<2} onClick={()=>void save()}>{editingId?'Αποθήκευση ονόματος':'Προσθήκη ταυτότητας'}</Button>{editingId?<Button type="button" variant="secondary" disabled={busy} onClick={clear}>Ακύρωση επεξεργασίας</Button>:null}</div>
 </Surface>;
}
