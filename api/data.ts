import { requireSession } from '../server/auth.js';
import { assertSameOrigin, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../server/http.js';
import { readStore, writeStore } from '../server/storage.js';
import { validateFinanceData } from '../server/validation.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET' && req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);

    const session = await requireSession(req, res);
    if (req.method === 'GET') return sendJson(res, 200, await readStore(session.accessToken));

    assertSameOrigin(req);
    const body = await readJsonBody(req, 5 * 1024 * 1024);
    validateFinanceData(body);
    const expected = Array.isArray(req.headers?.['if-match']) ? req.headers['if-match'][0] : req.headers?.['if-match'];
    return sendJson(res, 200, await writeStore(body, expected || undefined, false, session.accessToken));
  });
}
