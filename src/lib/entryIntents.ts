import type { EventKind } from '../types.js';

export type EntryIntent='expense'|'income'|'transfer'|'withdrawal'|'saving'|'refund'|'reconciliation'|'split';

export type EntryIntentDefinition={
  intent:EntryIntent;
  kind:Extract<EventKind,'expense'|'income'|'transfer'|'withdrawal'|'saving_cash_offset'|'refund'|'reconciliation'|'split'>;
  label:string;
  description:string;
};

export const ENTRY_INTENTS:readonly EntryIntentDefinition[]=[
  {intent:'expense',kind:'expense',label:'Έξοδο',description:'Πλήρωσα για κάτι'},
  {intent:'income',kind:'income',label:'Έσοδο',description:'Μπήκαν χρήματα'},
  {intent:'transfer',kind:'transfer',label:'Μεταφορά',description:'Μεταξύ λογαριασμών'},
  {intent:'withdrawal',kind:'withdrawal',label:'Ανάληψη',description:'Μετέφερα χρήματα σε μετρητά'},
  {intent:'saving',kind:'saving_cash_offset',label:'Αποταμίευση',description:'Μετέφερα χρήματα στην άκρη'},
  {intent:'refund',kind:'refund',label:'Επιστροφή',description:'Μου επέστρεψαν χρήματα από αγορά'},
  {intent:'reconciliation',kind:'reconciliation',label:'Διόρθωση',description:'Διόρθωσα πραγματικό υπόλοιπο'},
  {intent:'split',kind:'split',label:'Σύνθετη αγορά',description:'Μία πληρωμή, πολλές κατηγορίες'},
] as const;

const BY_INTENT=new Map(ENTRY_INTENTS.map(item=>[item.intent,item]));

export function entryKindForIntent(intent:EntryIntent){return BY_INTENT.get(intent)!.kind}
export function entryIntentForKind(kind:EventKind):EntryIntent|null{return ENTRY_INTENTS.find(item=>item.kind===kind)?.intent??null}
export function entryIntentDefinition(intent:EntryIntent){return BY_INTENT.get(intent)!}

export type FrequentEntrySuggestion={
  lastAmount:number;
  category?:string;
  subcategory?:string;
  accountId?:string;
};

export type StructuredEntryPreset={
  amount:number;
  category?:string;
  subcategory?:string;
  accountId?:string;
};

/**
 * Frequent-entry suggestions accelerate structured fields only. Their display
 * label describes why the suggestion exists; it is not the user's comment.
 */
export function structuredPresetFromFrequent(suggestion:FrequentEntrySuggestion):StructuredEntryPreset{
  return {
    amount:Number.isFinite(Number(suggestion.lastAmount))?Number(suggestion.lastAmount):0,
    category:suggestion.category||undefined,
    subcategory:suggestion.subcategory||undefined,
    accountId:suggestion.accountId||undefined,
  };
}
