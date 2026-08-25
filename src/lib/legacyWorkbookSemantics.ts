import type { LegacyTransaction, ReviewDecision } from '../types.js';
import { cleanNote } from './format.js';

const decided=(semanticKind:ReviewDecision['semanticKind'],decidedAt:string):ReviewDecision=>({status:'confirmed',semanticKind,decidedAt});

function explicitAmounts(note:string){
  return [...note.matchAll(/(?:^|[^\d])(\d{1,5}(?:[.,]\d{1,2})?)\s*€/g)].map(match=>Number(match[1].replace(',','.'))).filter(value=>Number.isFinite(value)&&value>0);
}

function hasMixedCorrection(note:string){
  const upper=note.toLocaleUpperCase('el-GR');
  if(!/ΔΙ[ΟΌ]ΡΘΩΣ/.test(upper))return false;
  const lines=note.split(/\n+/).map(line=>line.trim()).filter(Boolean);
  const amounts=explicitAmounts(note);
  return amounts.length>1||lines.some(line=>!/^ΔΙ[ΟΌ]ΡΘΩΣ(?:Η)?\b/i.test(line)&&/\d/.test(line));
}

export function approvedLegacyWorkbookDecision(transaction:LegacyTransaction,decidedAt:string):ReviewDecision|null{
  const note=cleanNote(transaction.note);
  const upper=note.toLocaleUpperCase('el-GR');
  if(/PAY&SAVE/.test(upper))return decided('saving_cash_offset',decidedAt);
  if(/(?:RETURN|ΕΠΙΣΤΡΟΦ)\s*(?:HELP|ΒΟΗΘ)|(?:HELP|ΒΟΗΘ)[\s\S]*(?:RETURN|ΕΠΙΣΤΡΟΦ)/i.test(upper))return decided('transfer',decidedAt);
  if(/\bHELP\b|ΒΟΗΘΕΙΑ/i.test(upper))return decided('transfer',decidedAt);
  if(/ΔΙ[ΟΌ]ΡΘΩΣ/.test(upper)&&!hasMixedCorrection(note))return decided('reconciliation',decidedAt);
  return null;
}

export function deterministicSplitDecision(parts:NonNullable<ReviewDecision['parts']>,decidedAt:string):ReviewDecision{
  return {status:'confirmed',semanticKind:'split',parts,decidedAt};
}
