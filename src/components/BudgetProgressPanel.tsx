import { Gauge, TriangleAlert } from 'lucide-react';
import { AnimatedAmount } from './AnimatedAmount';
import { budgetProgress } from '../lib/budgets';
import type { FinanceData } from '../types';

export function BudgetProgressPanel({data,month,compact=false,onOpen}:{data:FinanceData;month:string;compact?:boolean;onOpen?:()=>void}){
  const rows=budgetProgress(data,month);
  const visible=compact?rows.slice().sort((a,b)=>b.ratio-a.ratio||a.id.localeCompare(b.id)).slice(0,3):rows;
  const exceeded=rows.filter(row=>row.status==='exceeded').length;
  const near=rows.filter(row=>row.status==='near').length;
  return <article className={`panel neo-raised budget-progress-panel ${compact?'compact':''}`} data-budget-panel>
    <div className="panel-head"><div><span>Budgets {month.slice(5)}/{month.slice(0,4)}</span><small>{rows.length?exceeded?`${exceeded} πάνω από το όριο`:near?`${near} πλησιάζουν το όριο`:'Όλα τα ενεργά budgets είναι εντός ορίου':'Δεν έχεις ορίσει budget για αυτόν τον μήνα'}</small></div>{exceeded?<TriangleAlert aria-hidden="true"/>:<Gauge aria-hidden="true"/>}</div>
    {visible.length?<div className="budget-progress-list">{visible.map(row=><div className={`budget-progress-row ${row.status}`} key={row.id} data-budget-id={row.id}><div className="budget-progress-copy"><b>{row.scope==='overall'?'Συνολικό discretionary':row.category}</b><small><AnimatedAmount value={row.used}/> από <AnimatedAmount value={row.limit}/>{row.status==='exceeded'?<> · υπέρβαση <AnimatedAmount value={Math.abs(row.remaining)}/></>:<> · υπόλοιπο <AnimatedAmount value={Math.max(0,row.remaining)}/></>}</small></div><div className="budget-progress-value"><strong>{Math.round(row.ratio*100)}%</strong><span>{row.status==='exceeded'?'Υπέρβαση':row.status==='near'?'Κοντά στο όριο':'Εντός ορίου'}</span></div><div className="budget-meter" role="progressbar" aria-label={`Χρήση budget ${row.scope==='overall'?'συνολικά':row.category}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(row.ratio*100))} aria-valuetext={`${Math.round(row.ratio*100)}% · ${row.status==='exceeded'?'πάνω από το όριο':row.status==='near'?'κοντά στο όριο':'εντός ορίου'}`}><i style={{width:`${Math.min(100,row.ratio*100)}%`}}/></div></div>)}</div>:<div className="empty-inline">Δεν υπάρχουν budgets για την επιλεγμένη περίοδο.</div>}
    {onOpen?<button type="button" className="wide-action" onClick={onOpen}>{rows.length?'Αναλυτική εικόνα budgets':'Ρύθμιση budgets'}</button>:null}
  </article>;
}
