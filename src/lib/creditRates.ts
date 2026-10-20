import type { CreditRateVersion, PaymentCard } from '../types.js';
import { isValidDateOnly } from './dateOnly.js';

/** Unknown legacy rates remain unknown; no invented historical default. */
export function creditRateAt(card:PaymentCard,asOf:string):CreditRateVersion|null{
  return [...(card.creditRateHistory??[])].filter(row=>row.effectiveFrom<=asOf).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]??null;
}

/** Append future effective dates; never rewrite a prior rate period. */
export function addCreditRate(card:PaymentCard,annualPercent:number,effectiveFrom:string,today:string):PaymentCard{
  if(card.kind!=='credit')throw new Error('Το επιτόκιο αφορά μόνο πιστωτική κάρτα.');
  if(!isValidDateOnly(effectiveFrom)||!isValidDateOnly(today)||effectiveFrom<today)throw new Error('Η ημερομηνία ισχύος δεν μπορεί να είναι παλαιότερη από σήμερα.');
  if(!Number.isFinite(annualPercent)||annualPercent<0||annualPercent>100||Math.abs(Math.round(annualPercent*10000)-annualPercent*10000)>0.00001)throw new Error('Συμπλήρωσε ετήσιο επιτόκιο 0–100% με έως τέσσερα δεκαδικά.');
  const history=card.creditRateHistory??[];
  if(history.length&&effectiveFrom<=history[history.length-1].effectiveFrom)throw new Error('Η νέα ημερομηνία πρέπει να ακολουθεί την τελευταία καταχωρισμένη αλλαγή.');
  return {...card,creditRateHistory:[...history,{effectiveFrom,annualPercent}]};
}

export interface CreditPayoffEstimate {
  feasible:boolean;
  months:number;
  totalInterest:number;
  totalPaid:number;
  remaining:number;
}

/** Advisory fixed-payment monthly simulation in cents; creates no finance events. */
export function estimateCreditPayoff(balance:number,annualPercent:number,monthlyPayment:number,maxMonths=360):CreditPayoffEstimate|null{
  if(!Number.isFinite(balance)||balance<0||!Number.isFinite(annualPercent)||annualPercent<0||annualPercent>100||!Number.isFinite(monthlyPayment)||monthlyPayment<=0||!Number.isInteger(maxMonths)||maxMonths<1||maxMonths>600)return null;
  if(Math.abs(Math.round(balance*100)-balance*100)>0.00001||Math.abs(Math.round(monthlyPayment*100)-monthlyPayment*100)>0.00001)return null;
  let remaining=Math.round(balance*100);const fixedPayment=Math.round(monthlyPayment*100);
  if(remaining===0)return {feasible:true,months:0,totalInterest:0,totalPaid:0,remaining:0};
  if(!Number.isSafeInteger(remaining)||!Number.isSafeInteger(fixedPayment)||fixedPayment<=0)return null;
  let interestPaid=0,amountPaid=0;
  for(let months=1;months<=maxMonths&&remaining>0;months++){
    const interest=Math.round(remaining*annualPercent/1200);
    if(!Number.isSafeInteger(interest)||fixedPayment<=interest)return {feasible:false,months:months-1,totalInterest:interestPaid/100,totalPaid:amountPaid/100,remaining:remaining/100};
    const payment=Math.min(fixedPayment,remaining+interest);
    remaining=remaining+interest-payment;interestPaid+=interest;amountPaid+=payment;
    if(remaining===0)return {feasible:true,months,totalInterest:interestPaid/100,totalPaid:amountPaid/100,remaining:0};
  }
  return {feasible:remaining===0,months:maxMonths,totalInterest:interestPaid/100,totalPaid:amountPaid/100,remaining:remaining/100};
}
