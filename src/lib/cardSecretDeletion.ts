import { deleteCardSecret } from './cardVaultClient.js';
import { deleteLocalCvv } from './localCvvVault.js';
import { withCardSecretCleanupComplete } from './cards.js';
import type { FinanceData } from '../types.js';

// Do not remove the durable cleanup marker until both secret stores have
// confirmed deletion. Safe to retry after network/Windows/session failures.
export async function finishCardDeletion(
  cardId:string,
  updateDurably:(recipe:(current:FinanceData)=>FinanceData)=>Promise<void>,
){
  await deleteCardSecret(cardId,true);
  await deleteLocalCvv(cardId);
  await updateDurably(current=>withCardSecretCleanupComplete(current,cardId));
}
