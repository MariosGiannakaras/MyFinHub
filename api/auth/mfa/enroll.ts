import { beginTotpEnrollment, clearSessionCookies, requireSession } from '../../../server/auth.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, sendJson } from '../../../server/http.js';
import { isOwner } from '../../../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    assertSameOrigin(req);
    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }

    const enrollment = await beginTotpEnrollment(session.accessToken);
    return sendJson(res, 200, {
      factorId: enrollment.id,
      qrCode: enrollment.totp!.qr_code!,
      secret: enrollment.totp!.secret!,
    });
  });
}
