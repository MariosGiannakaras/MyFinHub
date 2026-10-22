import type {CounterpartyRecord,FinanceData,FinanceEvent} from '../types.js';

export function counterpartyNameKey(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('el-GR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
export function counterpartyKindForEvent(kind:FinanceEvent['kind']):CounterpartyRecord['kind']|null{
  if(['expense','card_purchase','split','refund'].includes(kind))return 'merchant';
  if(['income','lending','repayment','lending_writeoff'].includes(kind))return 'beneficiary';
  return null;
}
/** A suggestion is not a selection. Never infer an ID from OCR or historic notes. */
export function findCounterpartySuggestion(data:FinanceData,label:string,kind:CounterpartyRecord['kind']){
  const key=counterpartyNameKey(label);
  if(key.length<2)return null;
  const matches=(data.state.counterparties??[]).filter(row=>row.kind===kind&&
    [row.displayName,...(row.aliases??[])].some(item=>counterpartyNameKey(item)===key));
  return matches.length===1?matches[0]:null;
}
/** Pure revisioned state updater: IDs and historical finance descriptions are immutable. */
export function withCounterparty(data:FinanceData,requested:CounterpartyRecord):FinanceData{
  const original=data.state.counterparties??[];
  if(original.length>=2000&&!original.some(row=>row.id===requested.id))throw new Error('Ξεπεράστηκε το όριο αντισυμβαλλομένων.');
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(requested.id))throw new Error('Μη έγκυρη ταυτότητα αντισυμβαλλομένου.');
  const name=requested.displayName.trim();
  if(name.length<2||name.length>120)throw new Error('Το όνομα πρέπει να έχει 2 έως 120 χαρακτήρες.');
  const aliases=[...new Set((requested.aliases??[]).map(s=>s.trim()).filter(Boolean))];
  if(aliases.length>16||aliases.some(s=>s.length>120))throw new Error('Μη έγκυρα ψευδώνυμα.');
  const normalized=counterpartyNameKey(name);
  if(original.some(row=>row.id!==requested.id&&row.kind===requested.kind&&counterpartyNameKey(row.displayName)===normalized)){
    throw new Error('Υπάρχει ήδη ταυτότητα με αυτή την ονομασία.');
  }
  const old=original.find(row=>row.id===requested.id);
  if(old&&(old.kind!==requested.kind||old.createdAt!==requested.createdAt)){
    throw new Error('Η ταυτότητα και ο αρχικός τύπος δεν τροποποιούνται.');
  }
  const value:CounterpartyRecord={...requested,displayName:name,aliases,createdAt:old?.createdAt??requested.createdAt};
  const list=old?original.map(row=>row.id===requested.id?value:row):[...original,value];
  return {...data,state:{...data.state,counterparties:list}};
}
/** Links a posted finance event to an existing owner-chosen immutable ID. */
export function withEventCounterparty(data:FinanceData,eventId:string,counterpartyId:string|undefined,now:string):FinanceData{
  const events=data.state.events??[];
  const old=events.find(event=>event.id===eventId);
  if(!old)throw new Error('Η κίνηση δεν υπάρχει πλέον.');
  const expected=counterpartyKindForEvent(old.kind);
  if(!expected)throw new Error('Αυτός ο τύπος κίνησης δεν υποστηρίζει αντισυμβαλλόμενο.');
  if(counterpartyId){
    const entry=(data.state.counterparties??[]).find(row=>row.id===counterpartyId);
    if(!entry||entry.kind!==expected)throw new Error('Η επιλεγμένη ταυτότητα δεν είναι διαθέσιμη.');
  }
  return {...data,state:{...data.state,events:events.map(event=>event.id===eventId?
    {...event,counterpartyId,updatedAt:now}:event)}};
}
