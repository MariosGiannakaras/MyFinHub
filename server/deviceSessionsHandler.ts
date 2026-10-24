import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from './auth.js';
import { ensureDeviceSessionAccess, listDeviceSessions, renameDeviceSession, revokeDeviceSession, revokeOtherDeviceSessions } from './deviceSessionRegistry.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from './http.js';
import { isOwner } from './storage.js';

const MAX_DEVICE_ACTION_BODY_BYTES = 2 * 1024;

type DeviceAction={action:'revoke';sessionId:string}|{action:'revoke-others'}|{action:'rename';sessionId:string;nickname:string|null};

export function parseDeviceSessionAction(value:unknown):DeviceAction{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
  const body=value as Record<string,unknown>;
  if(body.action==='revoke'){
    if(Object.keys(body).some(key=>key!=='action'&&key!=='sessionId'))throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
    const sessionId=typeof body.sessionId==='string'?body.sessionId.trim():'';
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId))throw new ApiError(400,'INVALID_DEVICE_SESSION_ID','Μη έγκυρη αναφορά συνεδρίας συσκευής.');
    return {action:'revoke',sessionId};
  }
  if(body.action==='rename'){
    if(Object.keys(body).some(key=>!['action','sessionId','nickname'].includes(key)))throw new ApiError(400,'INVALID_DEVICE_ACTION','Μη έγκυρη ενέργεια συσκευής.');
    const sessionId=typeof body.sessionId==='string'?body.sessionId.trim():'';
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId))throw new ApiError(400,'INVALID_DEVICE_SESSION_ID','Μη έγκυρη αναφορά συνεδρίας συσκευής.');
    if(typeof body.nickname!=='string'||body.nickname.length>120||/[\u0000-\u001f\u007f]/.test(body.nickname))throw new ApiError(400,'INVALID_DEVICE_NICKNAME','Μη έγκυρο όνομα συσκευής.');
    const nickname=body.nickname.replace(/\s+/g,' ').trim();
    if(nickname.length>60)throw new ApiError(400,'INVALID_DEVICE_NICKNAME','Το όνομα συσκευής είναι πολύ μεγάλο.');
    return {action:'rename',sessionId,nickname:nickname||null};
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
    label: row.nickname || row.device_label,
    nickname: row.nickname ?? null,
    defaultLabel: row.device_label,
    systemName: row.system_name ?? null,
    browserName: row.browser_name ?? null,
    deviceType: row.device_type ?? null,
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
    else if(action.action==='rename')await renameDeviceSession(session.accessToken,session.user.id,action.sessionId,action.nickname);
    else await revokeOtherDeviceSessions(session.accessToken,session.user.id);
    const result = await listDeviceSessions(session.accessToken, session.user.id);
    return sendJson(res, 200, {
      count: result.rows.length,
      devices: result.rows.map(row => deviceDto(row, result.currentSessionId)),
    });
  });
}
