import { handleAccountSecurityRequest } from '../../server/accountSecurityHandler.js';

export default async function handler(req:any,res:any){
  await handleAccountSecurityRequest(req,res);
}
