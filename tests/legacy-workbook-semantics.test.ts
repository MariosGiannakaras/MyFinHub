import { describe, expect, it } from 'vitest';
import { approvedLegacyWorkbookDecision, deterministicSplitDecision } from '../src/lib/legacyWorkbookSemantics.js';
import type { LegacyTransaction, SplitPart } from '../src/types.js';

const tx=(note:string,type:LegacyTransaction['type']='income'):LegacyTransaction=>({id:'x',date:'2026-08-01',type,accountId:'bank',amount:10,note,category:'Άλλο'});
const at='2026-08-25T00:00:00.000Z';

describe('owner-approved legacy workbook semantics',()=>{
  it('maps Pay&Save to savings semantics',()=>{expect(approvedLegacyWorkbookDecision(tx('Pay&Save'),at)).toMatchObject({status:'confirmed',semanticKind:'saving_cash_offset'})});
  it('maps HELP and HELP return to internal-transfer semantics rather than income/refund',()=>{expect(approvedLegacyWorkbookDecision(tx('ΒΟΗΘΕΙΑ'),at)?.semanticKind).toBe('transfer');expect(approvedLegacyWorkbookDecision(tx('ΕΠΙΣΤΡΟΦΗ ΒΟΗΘΕΙΑΣ'),at)?.semanticKind).toBe('transfer')});
  it('maps only pure corrections automatically',()=>{expect(approvedLegacyWorkbookDecision(tx('ΔΙΟΡΘΩΣΗ'),at)?.semanticKind).toBe('reconciliation');expect(approvedLegacyWorkbookDecision(tx('ΔΙΟΡΘΩΣΗ\nJobFood: 5€'),at)).toBeNull()});
  it('does not mass-map IRIS, card payments or generic refunds',()=>{expect(approvedLegacyWorkbookDecision(tx('Μαρία IRIS 10€'),at)).toBeNull();expect(approvedLegacyWorkbookDecision(tx('ΠΛΗΡΩΜΗ ΠΙΣΤΩΤΙΚΗΣ'),at)).toBeNull();expect(approvedLegacyWorkbookDecision(tx('ΕΠΙΣΤΡΟΦΗ ΑΓΟΡΑΣ'),at)).toBeNull()});
  it('creates authoritative split overlays without rewriting the parent transaction',()=>{const parts:SplitPart[]=[{id:'a',label:'JobFood',category:'Φαγητό',amount:2,kind:'expense'},{id:'b',label:'Ψιλικά',category:'Ψιλικά',amount:3.5,kind:'expense'}];expect(deterministicSplitDecision(parts,at)).toEqual({status:'confirmed',semanticKind:'split',parts,decidedAt:at})});
});
