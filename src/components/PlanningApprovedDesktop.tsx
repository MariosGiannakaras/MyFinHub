import { ArrowDown, ArrowLeftRight, ArrowRight, ArrowUp, BarChart3, CalendarClock, Check, ChevronDown, ChevronRight, CircleSlash2, Info, Pencil, Table2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BankBrandMark } from './BankBrandMark';
import { cashFlowForecast, LOW_BALANCE_THRESHOLD, type CashFlowForecast, type ForecastPoint } from '../lib/forecast';
import { money, shortDate } from '../lib/format';
import { scheduledLifecycle } from '../lib/scheduled';
import { accountDisplayName } from '../lib/ui';
import type { FinanceData, ScheduledKind, ScheduledTransaction } from '../types';

type ScheduledView='all'|'pending'|'completed'|'skipped'|'cancelled';
type AccountView='chart'|'table';

type Props={
  data:FinanceData;
  asOf:string;
  pending:ScheduledTransaction[];
  history:ScheduledTransaction[];
  onComplete:(item:ScheduledTransaction)=>void;
  onEdit:(item:ScheduledTransaction)=>void;
  onLifecycle:(item:ScheduledTransaction,status:'skipped'|'cancelled')=>void;
};

const viewLabels:Record<ScheduledView,string>={all:'Όλες',pending:'Εκκρεμείς',completed:'Ολοκληρωμένες',skipped:'Παραλειφθείσες',cancelled:'Ακυρωμένες'};
const kindLabel:Record<ScheduledKind,string>={expense:'Πληρωμή',income:'Έσοδο',transfer:'Μεταφορά'};

function lifecycleLabel(item:ScheduledTransaction,asOf:string){
  const lifecycle=scheduledLifecycle(item,asOf);
  if(lifecycle==='upcoming')return 'Εκκρεμεί';
  if(lifecycle==='due')return 'Εκκρεμεί τώρα';
  if(lifecycle==='completed')return 'Ολοκληρώθηκε';
  if(lifecycle==='skipped')return 'Παραλείφθηκε';
  return 'Ακυρώθηκε';
}

function relativeDue(asOf:string,dueDate:string){
  const start=new Date(`${asOf}T12:00:00Z`).getTime();
  const end=new Date(`${dueDate}T12:00:00Z`).getTime();
  const days=Math.round((end-start)/86400000);
  if(days===0)return 'σήμερα';
  if(days<0)return `${Math.abs(days)} ημέρ${Math.abs(days)===1?'α':'ες'} πριν`;
  return `σε ${days} ημέρ${days===1?'α':'ες'}`;
}

function forecastPercent(forecast:CashFlowForecast){
  if(!forecast.currentPortfolio)return 0;
  return ((forecast.projectedPortfolio-forecast.currentPortfolio)/Math.abs(forecast.currentPortfolio))*100;
}

function percentLabel(value:number){
  const normalized=Math.abs(value)<0.05?0:value;
  return `${normalized>0?'+':''}${normalized.toLocaleString('el-GR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
}

function accountSummary(forecast:CashFlowForecast,accountId:string){
  return forecast.accounts.find(row=>row.accountId===accountId);
}

function sparklinePoints(points:ForecastPoint[],accountId:string){
  const values=points.map(point=>Number(point.balances[accountId]??0));
  if(!values.length)return '';
  const min=Math.min(...values);const max=Math.max(...values);const spread=max-min||1;const denominator=Math.max(values.length-1,1);
  return values.map((value,index)=>`${(index/denominator)*100},${27-((value-min)/spread)*22}`).join(' ');
}

function KindIcon({kind}:{kind:ScheduledKind}){
  if(kind==='income')return <ArrowUp size={15}/>;
  if(kind==='transfer')return <ArrowLeftRight size={15}/>;
  return <ArrowDown size={15}/>;
}

export function PlanningApprovedDesktop({data,asOf,pending,history,onComplete,onEdit,onLifecycle}:Props){
  const forecasts=useMemo(()=>({
    30:cashFlowForecast(data,asOf,30),
    60:cashFlowForecast(data,asOf,60),
    90:cashFlowForecast(data,asOf,90),
  }),[data,asOf]);
  const [view,setView]=useState<ScheduledView>('all');
  const [accountView,setAccountView]=useState<AccountView>('chart');
  const [detailsOpen,setDetailsOpen]=useState(false);
  const counts={
    pending:pending.length,
    completed:history.filter(item=>item.status==='completed').length,
    skipped:history.filter(item=>item.status==='skipped').length,
    cancelled:history.filter(item=>item.status==='cancelled').length,
  };
  const allScheduled=useMemo(()=>[...pending,...history],[pending,history]);
  const visibleScheduled=allScheduled.filter(item=>view==='all'||(view==='pending'?item.status==='pending':item.status===view));
  const accountRows=forecasts[90].accounts;

  return <div className="planning-approved-desktop" data-planning-approved-desktop>
    <section className="panel neo-raised planning-approved-forecast" aria-label="Πρόβλεψη συνολικής ρευστότητας">
      <div className="planning-forecast-intro"><span className="planning-forecast-icon"><BarChart3/></span><div><b>Πρόβλεψη συνολικής ρευστότητας</b><small>Με βάση τα τρέχοντα υπόλοιπα, τα πάγια, τις δόσεις και τις προγραμματισμένες κινήσεις.</small><span className="sr-only">Τρέχουσα συνολική ρευστότητα {money.format(forecasts[30].currentPortfolio)}</span></div></div>
      {([30,60,90] as const).map(days=>{const forecast=forecasts[days];const change=forecastPercent(forecast);return <article className="planning-forecast-kpi" key={days}><span>Σε {days} ημέρες</span><b className={forecast.projectedPortfolio<0?'negative':''}>{money.format(forecast.projectedPortfolio)}</b><small className={change<0?'negative':'positive'}>{change>=0?<ArrowUp size={12}/>:<ArrowDown size={12}/>} {percentLabel(change)}</small></article>})}
      <button type="button" className="planning-detail-toggle" aria-expanded={detailsOpen} aria-controls="planning-approved-details" onClick={()=>setDetailsOpen(value=>!value)}>Αναλυτική πρόβλεψη <ArrowRight size={15}/></button>
    </section>

    <section className="panel neo-raised planning-approved-scheduled" aria-labelledby="planning-approved-scheduled-title">
      <header className="planning-approved-panel-head"><div className="planning-approved-title"><span className="planning-section-icon"><CalendarClock/></span><div><span id="planning-approved-scheduled-title">Προγραμματισμένες κινήσεις</span><small>Οι γνωστές μελλοντικές κινήσεις που έχεις καταχωρίσει.</small></div><em>{pending.length} εκκρεμείς</em></div><div className="planning-lifecycle-tabs" role="group" aria-label="Φίλτρο κατάστασης προγραμματισμένων κινήσεων">{(Object.keys(viewLabels) as ScheduledView[]).map(key=><button type="button" key={key} aria-pressed={view===key} className={view===key?'active':''} onClick={()=>setView(key)}>{viewLabels[key]}{key!=='all'?` (${counts[key]})`:''}</button>)}</div></header>
      {visibleScheduled.length?<div className="planning-approved-table-wrap"><table className="planning-approved-table"><caption className="sr-only">Προγραμματισμένες κινήσεις</caption><thead><tr><th scope="col">Ημερομηνία</th><th scope="col">Τύπος</th><th scope="col">Περιγραφή</th><th scope="col">Λογαριασμός / Λογαριασμοί</th><th scope="col" className="amount">Ποσό</th><th scope="col">Κατάσταση</th><th scope="col" className="actions">Ενέργειες</th></tr></thead><tbody>{visibleScheduled.map(item=>{const lifecycle=scheduledLifecycle(item,asOf);const fromName=accountDisplayName(data,item.fromAccountId);const toName=accountDisplayName(data,item.toAccountId);const accountName=accountDisplayName(data,item.accountId);return <tr key={item.id} data-planning-row={item.id} data-status={item.status}><td><b>{shortDate(item.dueDate)}</b><small>{relativeDue(asOf,item.dueDate)}</small></td><td><span className={`planning-kind-chip ${item.kind}`}><KindIcon kind={item.kind}/>{kindLabel[item.kind]}</span></td><td><b>{item.note}</b><small>{item.category||'Χωρίς κατηγορία'}{item.subcategory?` · ${item.subcategory}`:''}</small></td><td>{item.kind==='transfer'?<div className="planning-account-route"><span><BankBrandMark id={item.fromAccountId} name={fromName}/><b>{fromName}</b></span><ArrowRight size={14}/><span><BankBrandMark id={item.toAccountId} name={toName}/><b>{toName}</b></span></div>:<div className="planning-account-route single"><span><BankBrandMark id={item.accountId} name={accountName}/><b>{accountName}</b></span></div>}</td><td className={`amount ${item.kind==='expense'?'negative':item.kind==='income'?'positive':''}`}><b>{item.kind==='expense'?'−':item.kind==='income'?'+':''}{money.format(item.amount)}</b></td><td><span className={`planning-status-pill ${lifecycle}`}>{lifecycle==='upcoming'||lifecycle==='due'?<i/>:null}{lifecycleLabel(item,asOf)}</span></td><td className="actions">{item.status==='pending'?<details className="planning-row-menu"><summary>Ενέργειες <ChevronDown size={14}/></summary><div><button type="button" onClick={()=>onComplete(item)}><Check size={14}/> Ολοκλήρωση</button><button type="button" onClick={()=>onEdit(item)}><Pencil size={14}/> Επεξεργασία</button><button type="button" onClick={()=>onLifecycle(item,'skipped')}><CircleSlash2 size={14}/> Παράλειψη</button><button type="button" className="danger" onClick={()=>onLifecycle(item,'cancelled')}><X size={14}/> Ακύρωση</button></div></details>:<span className="planning-closed-row">Κλειστή</span>}</td></tr>})}</tbody></table></div>:<div className="empty-state">Δεν υπάρχουν κινήσεις για το επιλεγμένο φίλτρο.</div>}
    </section>

    <section className="panel neo-raised planning-approved-accounts" aria-labelledby="planning-approved-accounts-title">
      <header className="planning-approved-panel-head"><div className="planning-approved-title"><span className="planning-section-icon"><BarChart3/></span><div><span id="planning-approved-accounts-title">Πρόβλεψη ανά λογαριασμό</span><small>Εκτιμώμενο υπόλοιπο με βάση τις γνωστές κινήσεις.</small></div></div><div className="planning-account-view" role="group" aria-label="Τρόπος προβολής πρόβλεψης λογαριασμών"><button type="button" aria-pressed={accountView==='chart'} className={accountView==='chart'?'active':''} onClick={()=>setAccountView('chart')}><BarChart3 size={14}/> Γράφημα</button><button type="button" aria-pressed={accountView==='table'} className={accountView==='table'?'active':''} onClick={()=>setAccountView('table')}><Table2 size={14}/> Πίνακας</button></div></header>
      {accountView==='chart'?<div className="planning-account-cards">{accountRows.map((row,index)=>{const name=accountDisplayName(data,row.accountId);const day30=accountSummary(forecasts[30],row.accountId);const day60=accountSummary(forecasts[60],row.accountId);const day90=accountSummary(forecasts[90],row.accountId);return <article className="planning-account-card" data-tone={index%4} key={row.accountId}><header><BankBrandMark id={row.accountId} name={name}/><b>{name}</b><ChevronRight size={17}/></header><div className="planning-account-today"><span>Σήμερα</span><strong className={row.current<0?'negative':''}>{money.format(row.current)}</strong></div><svg className="planning-account-sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={`Προβολή υπολοίπου ${name} για 90 ημέρες`}><polyline points={sparklinePoints(forecasts[90].points,row.accountId)} vectorEffect="non-scaling-stroke"/></svg><div className="planning-account-horizons"><span><small>σε 30 ημέρες</small><b className={(day30?.projected??0)<0?'negative':''}>{money.format(day30?.projected??0)}</b></span><span><small>σε 60 ημέρες</small><b className={(day60?.projected??0)<0?'negative':''}>{money.format(day60?.projected??0)}</b></span><span><small>σε 90 ημέρες</small><b className={(day90?.projected??0)<0?'negative':''}>{money.format(day90?.projected??0)}</b></span></div></article>})}</div>:<div className="planning-account-table-wrap"><table className="planning-account-table"><caption className="sr-only">Πρόβλεψη υπολοίπων ανά λογαριασμό</caption><thead><tr><th scope="col">Λογαριασμός</th><th scope="col">Σήμερα</th><th scope="col">30 ημέρες</th><th scope="col">60 ημέρες</th><th scope="col">90 ημέρες</th></tr></thead><tbody>{accountRows.map(row=>{const name=accountDisplayName(data,row.accountId);return <tr key={row.accountId}><th scope="row"><BankBrandMark id={row.accountId} name={name}/><span>{name}</span></th><td>{money.format(row.current)}</td><td>{money.format(accountSummary(forecasts[30],row.accountId)?.projected??0)}</td><td>{money.format(accountSummary(forecasts[60],row.accountId)?.projected??0)}</td><td>{money.format(accountSummary(forecasts[90],row.accountId)?.projected??0)}</td></tr>})}</tbody></table></div>}
    </section>

    <section className="planning-approved-note" role="note"><Info size={16}/><span>Η πρόβλεψη βασίζεται στα τρέχοντα υπόλοιπα, τις προγραμματισμένες κινήσεις, τα ενεργά πάγια και τις δόσεις/δάνεια. Δεν περιλαμβάνει άγνωστες μελλοντικές αγορές.</span><button type="button" aria-expanded={detailsOpen} aria-controls="planning-approved-details" onClick={()=>setDetailsOpen(value=>!value)}>Μάθε περισσότερα <ArrowRight size={14}/></button></section>

    <section id="planning-approved-details" className="planning-approved-details" hidden={!detailsOpen} aria-label="Αναλυτικές παραδοχές πρόβλεψης"><div><h3>Αναλυτική πρόβλεψη 90 ημερών</h3><p>Χαμηλότερη συνολική ρευστότητα: <b className={forecasts[90].minimumPortfolio<0?'negative':''}>{money.format(forecasts[90].minimumPortfolio)}</b> στις {shortDate(forecasts[90].minimumPortfolioDate)}. Γνωστές κινήσεις: {forecasts[90].movements.length}.</p></div><div><h3>Λογαριασμοί που χρειάζονται προσοχή</h3>{forecasts[90].accounts.some(row=>row.firstLowDate||row.firstNegativeDate)?<ul>{forecasts[90].accounts.filter(row=>row.firstLowDate||row.firstNegativeDate).map(row=><li key={row.accountId}>{accountDisplayName(data,row.accountId)} · {row.firstNegativeDate?`αρνητικό από ${shortDate(row.firstNegativeDate)}`:`κάτω από ${money.format(LOW_BALANCE_THRESHOLD)} από ${shortDate(row.firstLowDate!)}`}</li>)}</ul>:<p>Κανένας λογαριασμός δεν περνά το χαμηλό όριο στον ορίζοντα.</p>}</div>{forecasts[90].omitted.length?<div><h3>Παραλείψεις λόγω ανεπαρκών στοιχείων</h3><ul>{forecasts[90].omitted.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul></div>:null}<div><h3>Παραδοχές</h3><p>Δεν προβλέπονται άγνωστες αγορές, μεταβολές εισοδήματος ή συμπεριφορά. Οι εσωτερικές μεταφορές αλλάζουν επιμέρους λογαριασμούς αλλά έχουν καθαρή επίδραση 0€ στη συνολική ρευστότητα.</p></div></section>
  </div>;
}
