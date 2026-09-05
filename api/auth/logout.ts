import { clearSessionCookies, requireSession, revokeSession } from '../../server/auth.js';
import { endCurrentDeviceSession } from '../../server/deviceSessionRegistry.js';
import { assertSameOrigin, handleApi, methodNotAllowed, sendJson } from '../../server/http.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    assertSameOrigin(req);
    try {
      const session = await requireSession(req, res);
      await endCurrentDeviceSession(session.accessToken, session.user.id);
      await revokeSession(session.accessToken);
    } catch {
      // Logout is intentionally idempotent.
    }
    clearSessionCookies(req, res);
    return sendJson(res, 200, { authenticated: false });
  });
}
