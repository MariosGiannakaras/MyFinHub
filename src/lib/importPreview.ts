import { isValidDateStamp } from './dateOnly';
import { isSupportedFinanceSchemaVersion } from './schemaVersion';

/**
 * Bounded client-side preview only. The API remains the sole authoritative
 * validator of full finance relationships, limits and import authorization.
 */
export interface FinanceImportPreview {
  schemaVersion: number;
  updatedAt: string;
  accountCount: number;
  legacyTransactionCount: number;
  eventCount: number;
}

const record=(value:unknown):value is Record<string,unknown> =>
  value!==null&&typeof value==='object'&&!Array.isArray(value);

export function previewFinanceImport(value:unknown):FinanceImportPreview {
  if(!record(value)||typeof value.app!=='string'||!value.app.trim()||value.app.length>64||
    !record(value.seed)||!record(value.state)||
    !Array.isArray(value.seed.accounts)||!Array.isArray(value.seed.transactions)||
    (value.state.events!==undefined&&!Array.isArray(value.state.events))){
    throw new Error('Το JSON δεν έχει τη βασική δομή οικονομικού αντιγράφου MyFinHub. Δεν έγινε εισαγωγή.');
  }
  if(!isSupportedFinanceSchemaVersion(value.schemaVersion)){
    throw new Error('Η έκδοση του JSON δεν υποστηρίζεται από αυτή την εφαρμογή. Δεν έγινε εισαγωγή.');
  }
  if(!isValidDateStamp(value.updatedAt)){
    throw new Error('Το JSON δεν έχει έγκυρη ημερομηνία ενημέρωσης. Δεν έγινε εισαγωγή.');
  }
  return {
    schemaVersion:value.schemaVersion as number,
    updatedAt:value.updatedAt,
    accountCount:value.seed.accounts.length,
    legacyTransactionCount:value.seed.transactions.length,
    eventCount:Array.isArray(value.state.events)?value.state.events.length:0,
  };
}
