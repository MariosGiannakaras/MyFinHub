import { handleCardVaultRequest } from '../server/cardVaultHandler.js';

export default async function handler(req: any, res: any) {
  await handleCardVaultRequest(req, res);
}
