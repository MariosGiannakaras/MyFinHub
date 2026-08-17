import { handleApi, methodNotAllowed, sendJson } from '../server/http.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    return sendJson(res, 200, { ok: true, app: 'RheomIQ' });
  });
}
