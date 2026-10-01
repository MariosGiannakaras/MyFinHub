import { ApiError, handleApi, methodNotAllowed, sendJson, strictQueryValue } from '../server/http.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (strictQueryValue(req,'__myfinhub_route') === 'api-not-found') throw new ApiError(404,'API_NOT_FOUND','API route not found.');
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    return sendJson(res, 200, { ok: true, app: 'MyFinHub' });
  });
}
