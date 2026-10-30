/**
 * A confirmed finance mutation is never represented as a failure merely because
 * deleting the separate local receipt draft failed afterwards.
 * Local cleanup runs only after a durable finance save acknowledgment.
 */
export async function saveFinanceThenCleanupReceipt(
  saveFinance:()=>Promise<void>,
  deleteLocalDraft:(()=>Promise<void>)|null,
  onCleanupFailure:()=>void,
):Promise<void>{
  await saveFinance();
  if(!deleteLocalDraft)return;
  try{await deleteLocalDraft()}
  catch{
    // A posted finance event must never be posted again on "retry".
    // Even a broken UI notification cannot turn its committed receipt
    // into a rejected finance save, because QuickAdd may offer resubmission.
    try{onCleanupFailure()}
    catch{/* The durable finance receipt remains authoritative. */}
  }
}
