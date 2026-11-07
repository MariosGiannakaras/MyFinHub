import { useRef, useState } from 'react';

/**
 * A local receipt cleanup may fail AFTER the finance save is committed.
 * Track only opaque local draft IDs. Retrying never invokes a finance writer.
 * Shared between the authenticated App and isolated QA fixture so the
 * partial-success browser probe exercises the production cleanup path.
 */
export function useReceiptCleanup(){
  const [pending,setPending]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const inFlight=useRef(false);

  const onFailure=(draftId:string)=>{
    setPending(current=>current.includes(draftId)?current:[...current,draftId]);
  };

  const retry=async()=>{
    if(inFlight.current||!pending.length)return;
    inFlight.current=true;
    setBusy(true);
    const ids=[...pending],completed:string[]=[];
    try{
      const {deleteReceiptDraft}=await import('../lib/receiptDrafts');
      for(const id of ids){
        try{await deleteReceiptDraft(id);completed.push(id)}
        catch{/* Keep this local draft visible for a later local-only retry. */}
      }
    }catch{/* A blocked local store cannot invalidate a committed finance event. */}
    finally{
      setPending(current=>current.filter(id=>!completed.includes(id)));
      inFlight.current=false;
      setBusy(false);
    }
  };

  return {pending,busy,onFailure,retry};
}
