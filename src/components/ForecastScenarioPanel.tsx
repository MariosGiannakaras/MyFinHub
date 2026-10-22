import {useMemo,useRef,useState} from 'react';
import {AppDateInput} from './AppDateInput';
import {AppSelectInput} from './AppSelectInput';
import {Button} from './Button';
import {MoneyInput} from './MoneyInput';
import {cashFlowScenario,type ForecastScenarioAssumption} from '../lib/forecastScenarios';
import {allAccounts} from '../lib/domain';
import {addDays,type ForecastHorizon} from '../lib/forecast';
import {money,shortDate} from '../lib/format';
import {accountDisplayName} from '../lib/ui';
import type {FinanceData} from '../types';

type Draft={
  id:string;
  accountId:string;
  date:string;
  kind:ForecastScenarioAssumption['kind'];
  amountText:string;
};

export function ForecastScenarioPanel({data,asOf}:{data:FinanceData;asOf:string}){
  const [open,setOpen]=useState(false);
  const [horizon,setHorizon]=useState<ForecastHorizon>(30);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const nextId=useRef(0);
  const accountIds=useMemo(()=>allAccounts(data).filter(account=>account.kind!=='credit').map(account=>account.id),[data]);
  const endDate=addDays(asOf,horizon);
  const update=(id:string,patch:Partial<Draft>)=>setDrafts(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));
  const add=()=>{
    if(drafts.length>=16)return;
    nextId.current++;
    setDrafts(rows=>[...rows,{
      id:`scenario-${nextId.current}`,
      accountId:accountIds[0]??'',
      date:addDays(asOf,1),
      kind:'extra_expense',
      amountText:''
    }]);
  };
  const evaluated=useMemo(()=>{
    if(!open||drafts.length===0)return null;
    try{
      const assumptions:ForecastScenarioAssumption[]=drafts.map(row=>({
        id:row.id,accountId:row.accountId,date:row.date,kind:row.kind,
        amount:Number(row.amountText.replace(',','.'))
      }));
      return {value:cashFlowScenario(data,asOf,horizon,assumptions),error:''};
    }catch(reason){return {value:null,error:reason instanceof Error?reason.message:'Μη έγκυρες υποθέσεις σεναρίου.'}}
  },[data,asOf,horizon,drafts,open]);
  const scenario=evaluated?.value;
  const next=()=>setOpen(value=>!value);
  return <section className="panel surface-raised forecast-scenario-panel" data-forecast-scenario-panel aria-label="Προαιρετικά σενάρια ρευστότητας">
    <div className="panel-head"><div><span>Τι θα γινόταν αν…</span>
      <small>Δοκίμασε υποθετικές εισπράξεις ή δαπάνες χωρίς καμία πραγματική καταχώριση ή αποθήκευση.</small>
    </div><Button type="button" variant="secondary" aria-expanded={open} onClick={next}>
      {open?'Κλείσιμο σεναρίου':'Δοκιμή σεναρίου'}
    </Button></div>
    {open?<div className="forecast-scenario-content">
      <div className="forecast-scenario-toolbar">
        <label><span>Ορίζοντας</span><AppSelectInput value={String(horizon)}
          aria-label="Ορίζοντας υποθετικού σεναρίου"
          onChange={event=>setHorizon(Number(event.target.value) as ForecastHorizon)}>
          <option value="30">30 ημέρες</option><option value="60">60 ημέρες</option><option value="90">90 ημέρες</option>
        </AppSelectInput></label>
        <small>Οι υποθέσεις μένουν μόνο σε αυτή την ανοιχτή οθόνη. Δεν δημιουργούνται οικονομικά γεγονότα.</small>
      </div>
      {drafts.map((row,index)=><div className="forecast-scenario-row" role="group"
        aria-label={`Υπόθεση ${index+1}`} key={row.id}>
        <label><span>Τύπος</span><AppSelectInput aria-label={`Τύπος υπόθεσης ${index+1}`} value={row.kind}
          onChange={event=>update(row.id,{kind:event.target.value as Draft['kind']})}>
          <option value="extra_expense">Πρόσθετη δαπάνη</option>
          <option value="extra_income">Πρόσθετη είσπραξη</option>
        </AppSelectInput></label>
        <label><span>Λογαριασμός</span><AppSelectInput aria-label={`Λογαριασμός υπόθεσης ${index+1}`}
          value={row.accountId} onChange={event=>update(row.id,{accountId:event.target.value})}>
          {accountIds.map(id=><option key={id} value={id}>{accountDisplayName(data,id)}</option>)}
        </AppSelectInput></label>
        <label><span>Ημερομηνία</span><AppDateInput aria-label={`Ημερομηνία υπόθεσης ${index+1}`}
          value={row.date} min={addDays(asOf,1)} max={endDate}
          onChange={event=>update(row.id,{date:event.target.value})}/></label>
        <label><span>Ποσό (€)</span><MoneyInput aria-label={`Ποσό υπόθεσης ${index+1}`}
          value={row.amountText} onValueChange={value=>update(row.id,{amountText:value})}/></label>
        <Button type="button" variant="ghost" onClick={()=>setDrafts(items=>items.filter(item=>item.id!==row.id))}
          aria-label={`Αφαίρεση υπόθεσης ${index+1}`}>Αφαίρεση</Button>
      </div>)}
      <div className="forecast-scenario-actions">
        <Button type="button" variant="secondary" disabled={!accountIds.length||drafts.length>=16}
          onClick={add}>+ Προσθήκη υπόθεσης</Button>
        {drafts.length?<Button type="button" variant="ghost" onClick={()=>setDrafts([])}>Καθαρισμός</Button>:null}
      </div>
      {evaluated?.error?<p className="forecast-scenario-validation" role="alert">{evaluated.error}</p>:null}
      {scenario?<div className="forecast-scenario-results" aria-live="polite" data-scenario-results>
        <div><span>Χωρίς υποθέσεις ({horizon} ημέρες)</span><b>{money.format(scenario.baseline.projectedPortfolio)}</b></div>
        <div><span>Με τις υποθέσεις</span><b className={scenario.projectedPortfolio<0?'negative':''}>{money.format(scenario.projectedPortfolio)}</b></div>
        <div><span>Χαμηλότερη υποθετική ρευστότητα</span><b className={scenario.minimumPortfolio<0?'negative':''}>{money.format(scenario.minimumPortfolio)}</b>
          <small>{shortDate(scenario.minimumPortfolioDate)}</small></div>
        {scenario.firstPortfolioShortfallDate?<p role="alert">Υποθετικό αρνητικό συνολικό υπόλοιπο από {shortDate(scenario.firstPortfolioShortfallDate)}.</p>:null}
        <div className="forecast-scenario-evidence"><small>
          Δηλωμένες μελλοντικές κινήσεις: {scenario.evidence.declared} ·
          Εκτιμώμενα πάγια/δάνεια: {scenario.evidence.estimated} ·
          Δικές σου υποθέσεις: {scenario.evidence.hypothetical}.
          Οι προβλέψεις δεν είναι επιβεβαιωμένες εισπράξεις.
        </small></div>
      </div>:drafts.length===0?<p className="forecast-assumption-note">Πρόσθεσε μία υπόθεση για να συγκρίνεις δύο προβολές. Δεν αλλάζει κανένα πραγματικό υπόλοιπο.</p>:null}
    </div>:null}
  </section>;
}
