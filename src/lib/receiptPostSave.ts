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
    // A posted finance event must not be posted a second time on "retry".
    // The caller owns a separate, visible local-only cleanup action.
    onCleanupFailure();
  }
}
