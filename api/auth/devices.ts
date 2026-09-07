import { handleDeviceSessionsRequest } from '../../server/deviceSessionsHandler.js';

export default async function handler(req:any,res:any){
  await handleDeviceSessionsRequest(req,res);
}
