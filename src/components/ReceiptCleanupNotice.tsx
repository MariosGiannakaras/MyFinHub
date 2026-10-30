import { Button } from './Button';
import { OperationFeedback } from './OperationFeedback';

/** A confirmed finance event is never described as failed by a local-only cleanup. */
export function ReceiptCleanupNotice({pendingCount,busy,onRetry}:{
  pendingCount:number;
  busy:boolean;
  onRetry:()=>Promise<void>;
}){
  if(!pendingCount)return null;
  return <OperationFeedback tone="warning" className="logic-note compact">
    <span>Η οικονομική κίνηση έχει αποθηκευτεί, αλλά η τοπική απόδειξη δεν αφαιρέθηκε. Μην καταχωρίσεις ξανά την ίδια κίνηση. Δοκίμασε εκ νέου μόνο τον καθαρισμό της τοπικής απόδειξης.</span>
    <Button type="button" variant="secondary" disabled={busy} onClick={()=>void onRetry()}>{busy?'Έλεγχος…':'Επανάληψη καθαρισμού'}</Button>
  </OperationFeedback>;
}
