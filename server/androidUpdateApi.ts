import { accessTokenAal, clearSessionCookiesIfCookie, requireSession } from './auth.js';
import { parseAndroidReleaseChannel, readLatestAndroidRelease } from './androidUpdates.js';
import { ApiError, handleApi, methodNotAllowed, sendJson } from './http.js';
import { isOwner } from './storage.js';

export async function handleAndroidUpdateApi(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

    const session = await requireSession(req, res, { allowBearer: true });
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookiesIfCookie(req, res, session);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') {
      throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    }

    const rawChannel = req.headers?.['x-myfinhub-android-update-channel'];
    const channel = parseAndroidReleaseChannel(rawChannel);
    res.setHeader('cache-control', 'private, no-store');
    res.setHeader('vary', 'authorization, cookie, x-myfinhub-android-update-channel');

    let release = await readLatestAndroidRelease(session.accessToken, channel);
    // Temporary Phase 6 bootstrap: build 6009 predates the explicit channel header. Production
    // metadata remains untouched. Once the first channel-aware build is installed this fallback
    // can be removed; explicit production callers never fall through to test releases.
    if (!release && (rawChannel === undefined || rawChannel === null || rawChannel === '')) {
      release = await readLatestAndroidRelease(session.accessToken, 'phase6-test');
    }
    return sendJson(res, 200, release ? { available: true, release } : { available: false });
  });
}
