import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from './auth.js';
import { ensureDeviceSessionAccess, listDeviceSessions, revokeDeviceSession, revokeOtherDeviceSessions } from './deviceSessionRegistry.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from './http.js';
import { isOwner } from './storage.js';

const MAX_DEVICE_ACTION_BODY_BYTES = 2 * 1024;

type DeviceAction={action:'revoke';sessionId:string}|{action:'revoke-others'};

export function parseDeviceSessionAction(value:unknown):DeviceAction{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
  const body=value as Record<string,unknown>;
  if(body.action==='revoke'){
    if(Object.keys(body).some(key=>key!=='action'&&key!=='sessionId'))throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
    const sessionId=typeof body.sessionId==='string'?body.sessionId.trim():'';
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId))throw new ApiError(400,'INVALID_DEVICE_SESSION_ID','Μη έγκυρη αναφορά συνεδρίας συσκευής.');
    return {action:'revoke',sessionId};
  }
  if(body.action==='revoke-others'){
    if(Object.keys(body).some(key=>key!=='action'))throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
    return {action:'revoke-others'};
  }
  throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
}

function deviceDto(row: Awaited<ReturnType<typeof listDeviceSessions>>['rows'][number], currentSessionId: string) {
  return {
    sessionId: row.session_id,
    platform: row.platform,
    label: row.device_label,
    appVersion: row.app_version,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    current: row.session_id === currentSessionId,
  };
}

export async function handleDeviceSessionsRequest(req: any, res: any) {
  await handleApi(res, async () => {
    const method = String(req.method || '').toUpperCase();
    if (method !== 'GET' && method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookiesIfCookie(req, res, session);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    await ensureDeviceSessionAccess(req, session.accessToken, session.user.id);

    if (method === 'GET') {
      const result = await listDeviceSessions(session.accessToken, session.user.id);
      return sendJson(res, 200, {
        count: result.rows.length,
        devices: result.rows.map(row => deviceDto(row, result.currentSessionId)),
      });
    }

    assertMutationSessionOrigin(req, session);
    const action=parseDeviceSessionAction(await readJsonBody(req,MAX_DEVICE_ACTION_BODY_BYTES));
    if(action.action==='revoke')await revokeDeviceSession(session.accessToken,session.user.id,action.sessionId);
    else await revokeOtherDeviceSessions(session.accessToken,session.user.id);
    const result = await listDeviceSessions(session.accessToken, session.user.id);
    return sendJson(res, 200, {
      count: result.rows.length,
      devices: result.rows.map(row => deviceDto(row, result.currentSessionId)),
    });
  });
}
