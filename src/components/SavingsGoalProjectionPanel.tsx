import {useMemo,useState} from 'react';
import {Button} from './Button';
import {MoneyInput} from './MoneyInput';
import {savingsGoalProjection} from '../lib/goalProjections';
import {money} from '../lib/format';
import type {FinanceData,SavingsGoal} from '../types';
import './SavingsGoalProjectionPanel.css';

const scenarioLabel={none:'Χωρίς επιπλέον αποταμίευση',suggested:'Προτεινόμενη συνεισφορά',custom:'Δικό σου σενάριο'} as const;
const statusLabel={reached:'Ο στόχος έχει καλυφθεί από το κοινό υπόλοιπο.',undated:'Δεν υπάρχει προθεσμία για μηνιαία πρόταση.',overdue:'Η προθεσμία έχει παρέλθει.',due_today:'Ο στόχος λήγει σήμερα.',active:'Πρόταση έως τη δηλωμένη ημερομηνία.'} as const;

/** Read-only advice: neither scenarios nor projections write FinanceData. */
export function SavingsGoalProjectionPanel({id,data,goal,asOf,onClose}:{
  id:string;data:FinanceData;goal:SavingsGoal;asOf:string;onClose:()=>void
}){
  const [customText,setCustomText]=useState('');
  const customValid=!customText.trim()||/^\d+(?:[.,]\d{1,2})?$/.test(customText.trim());
  const customValue=customText.trim()&&customValid?Number(customText.replace(',','.')):undefined;
  const result=useMemo(()=>{
    try{return {projection:savingsGoalProjection(data,goal,asOf,customValue),error:''}}
    catch(reason){return {projection:null,error:reason instanceof Error?reason.message:'Δεν είναι διαθέσιμη η προβολή.'}}
  },[data,goal,asOf,customValue]);
  const projection=result.projection;
  return <section id={id} className="savings-goal-projection surface-flat" aria-labelledby={id+'-title'} data-savings-goal-projection>
    <div className="panel-head"><div>
      <span id={id+'-title'}>Εκτίμηση στόχου · {goal.name}</span>
      <small>Η προβολή είναι συμβουλευτική. Καμία μεταφορά ή πραγματική αποταμίευση δεν καταχωρίζεται.</small>
    </div><Button type="button" variant="secondary" onClick={onClose}>Κλείσιμο</Button></div>
    {projection?<><p className="savings-projection-status">{statusLabel[projection.status]}</p>
      <dl className="savings-projection-metrics">
        <div><dt>Κοινό πραγματικό υπόλοιπο στις {asOf}</dt><dd>{money.format(projection.sharedSavingsBalance)}</dd></div>
        <div><dt>Υπόλοιπο προς στόχο</dt><dd>{money.format(projection.remaining)}</dd></div>
        <div><dt>Προτεινόμενο ανά μήνα</dt><dd>{projection.suggestedMonthly===null?'—':money.format(projection.suggestedMonthly)}</dd></div>
        <div><dt>Γνωστό ελάχιστο λειτουργικών λογαριασμών · 90 ημέρες</dt><dd>{money.format(projection.operatingLiquidityMinimum90d)}</dd></div>
      </dl>
      {projection.contributionMonths!==null?<p className="savings-projection-horizon">Εκτίμηση για {projection.contributionMonths} μηνιαίες συνεισφορές έως {projection.targetDate}. Η πρόταση δεν εξασφαλίζει ότι θα υπάρχουν τα χρήματα.</p>:null}
      <label className="savings-projection-custom">
        <span>Υποθετική μηνιαία αποταμίευση (€) <small>Προαιρετική · δεν καταχωρίζεται</small></span>
        <MoneyInput aria-label="Υποθετική μηνιαία αποταμίευση" value={customText} onValueChange={setCustomText} placeholder="0,00" invalid={!customValid}/>
      </label>
      {!customValid?<p role="alert" className="savings-projection-warning">Χρησιμοποίησε μη αρνητικό ποσό με έως δύο δεκαδικά.</p>:null}
      {projection.scenarios.length?<div className="savings-projection-scenarios" role="group" aria-label="Σενάρια χωρίς οικονομική καταχώριση">
        {projection.scenarios.map(scenario=><div className="savings-projection-scenario" key={scenario.label}>
          <b>{scenarioLabel[scenario.label]}</b><span>{money.format(scenario.monthly)} ανά μήνα</span>
          <strong>{money.format(scenario.totalAtDeadline)}</strong><small>Εκτιμώμενο κενό {money.format(scenario.gapAtDeadline)}</small>
        </div>)}
      </div>:null}
      {projection.suggestedContributionRisk==='liquidity_warning'?<p className="savings-projection-warning" role="note">Προσοχή: οι γνωστές υποχρεώσεις 90 ημερών αφήνουν μικρότερο διαθέσιμο λειτουργικό υπόλοιπο από την προτεινόμενη μηνιαία συνεισφορά.</p>:null}
      <p className="savings-projection-disclaimer" role="note">Το υπόλοιπο αποταμίευσης είναι κοινό σε όλους τους στόχους — δεν δεσμεύεται ξεχωριστά. Η πρόβλεψη περιλαμβάνει {projection.knownObligationCount90d} γνωστές κινήσεις υποχρεώσεων στο επόμενο 90ήμερο, όχι άγνωστες δαπάνες ή ημερομηνίες πέρα από αυτό. {projection.forecastCompleteness==='limited'?'Η πρόβλεψη είναι ελλιπής ή δεν υπάρχουν αρκετά δεδομένα.':''}</p>
    </>:<p className="savings-projection-warning" role="alert">{result.error}</p>}
  </section>;
}
