import type { FinanceData } from './types';
// Vite treats the query suffix as a distinct module so the import-map wrapper can
// reuse the canonical QA fixture without recursively resolving back to itself.
// TypeScript does not model arbitrary Vite query suffixes, so keep the boundary
// explicitly typed here rather than weakening the production fixture types.
// @ts-expect-error Vite runtime module query; the imported function is typed below.
import { qaFinanceData as untypedBaseQaFinanceData } from './qaFixture.ts?base';

const baseQaFinanceData=untypedBaseQaFinanceData as ()=>FinanceData;
type QaSnapshot=FinanceData['seed']['snapshots'][number];

/**
 * Presentation-only refinement for the owner-approved Dashboard visual QA route.
 * Production finance semantics stay in the canonical selectors/domain layer; this
 * fixture only gives the rendered evidence representative labels and balances.
 */
export function qaFinanceData(){
  const next=baseQaFinanceData();
  const params=new URLSearchParams(globalThis.location?.search??'');
  if(params.get('page')!=='dashboard')return next;

  next.state.settings.accountNames={
    ...next.state.settings.accountNames,
    'piraeus-payroll':'Μισθοδοσία - Πειραιώς',
    'piraeus-savings':'Αποταμίευση - Πειραιώς',
  };

  next.seed.snapshots=next.seed.snapshots.map((snapshot:QaSnapshot)=>snapshot.date==='2026-08-01'?{
    ...snapshot,
    balances:{
      ...snapshot.balances,
      'cash':1712.8,
      'alpha-main':1181.43,
      'revolut-main':810.2,
      'national-main':2320.75,
      'eurobank-main':1450,
    },
  }:snapshot);

  return next;
}
