import { handleAccountMetadataRequest } from '../server/accountMetadataHandler.js';

export default async function handler(req:any,res:any){
  await handleAccountMetadataRequest(req,res);
}
