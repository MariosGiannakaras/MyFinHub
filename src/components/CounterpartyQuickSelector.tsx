import {AppSelectInput} from './AppSelectInput';
import {counterpartyKindForEvent,findCounterpartySuggestion} from '../lib/counterparties';
import type {FinanceData,FinanceEvent} from '../types';
export function CounterpartyQuickSelector({data,kind,note,value,onChange}:{
 data:FinanceData;kind:FinanceEvent['kind'];note:string;value:string;onChange:(value:string)=>void
}){
 const expected=counterpartyKindForEvent(kind);
 const records=(data.state.counterparties??[]).filter(row=>row.kind===expected);
 if(!expected||!records.length)return null;
 const candidate=findCounterpartySuggestion(data,note,expected);
 const unknown=value&&!records.some(row=>row.id===value);
 return <label className="quick-field wide" data-filled="true">
   <span>{expected==='merchant'?'Έμπορος':'Δικαιούχος'} <em>προαιρετικά</em></span>
   <AppSelectInput value={value} aria-label="Ρητή επιλογή αντισυμβαλλομένου" onChange={event=>onChange(event.target.value)}>
     <option value="">Χωρίς συσχέτιση</option>
     {unknown?<option value={value} disabled>Μη διαθέσιμη ταυτότητα</option>:null}
     {records.map(row=><option key={row.id} value={row.id}>{row.displayName}</option>)}
   </AppSelectInput>
   {candidate&&!value?<small role="note">Πιθανή αντιστοίχιση: {candidate.displayName}. Δεν επιλέγεται αυτόματα.</small>:null}
 </label>;
}
