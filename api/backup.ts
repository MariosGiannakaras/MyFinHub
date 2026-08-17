import { requireSession } from '../server/auth.js';
import { assertSameOrigin, handleApi, methodNotAllowed, sendJson } from '../server/http.js';
import { backupStore } from '../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    assertSameOrigin(req);
    const session = await requireSession(req, res);
    return sendJson(res, 200, { path: await backupStore(session.accessToken) });
  });
}
