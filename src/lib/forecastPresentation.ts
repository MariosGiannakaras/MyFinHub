import type { CashFlowForecast } from './forecast.js';
import type { FinanceData, ScheduledTransaction } from '../types.js';
import { shortDate } from './format.js';

export const forecastSourceLabel:Record<keyof CashFlowForecast['sourceCounts'],string>={
  scheduled:'Προγραμματισμένο · όχι καταχωρισμένο',
  recurring:'Προβλεπόμενο πάγιο',
  loan:'Προβλεπόμενη δόση',
  dated_event:'Καταχωρισμένο · μελλοντική ημερομηνία',
};

export function forecastSourceSummary(counts:CashFlowForecast['sourceCounts']){
  return `${counts.scheduled} προγραμματισμένες · ${counts.recurring} εκτιμήσεις παγίων · ${counts.loan} προβλεπόμενες δόσεις · ${counts.dated_event} καταχωρισμένες με μελλοντική ημερομηνία`;
}

export function completedScheduledDescription(data:FinanceData,item:ScheduledTransaction,asOf:string){
  if(item.status!=='completed')return null;
  const event=data.state.events?.find(event=>event.id===item.completedEventId);
  if(!event)return 'Η συνδεδεμένη κίνηση δεν είναι διαθέσιμη';
  return `${event.date>asOf?'Καταχωρισμένη για μελλοντική ημερομηνία':'Καταχωρισμένη κίνηση'}: ${shortDate(event.date)}`;
}
