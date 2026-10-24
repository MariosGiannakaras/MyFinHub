import type { FinanceData } from '../types.js';
import { mutableSavePayload } from './persistencePayload.js';
import { notifyAuthExpired } from './authExpiry.js';
import { getAppUnlockToken, clearAppUnlockToken } from './appUnlockToken.js';

interface HistoryPointSummary { id:string; parentId:string|null; label:string; createdAt:string; current:boolean }
export interface HistoryEnvelope {
  available:boolean;
  generation:string;
  financeRevision:string;
  currentPointId:string|null;
  canUndo:boolean;
  canRedo:boolean;
  undoDepth:number;
  redoDepth:number;
  points:HistoryPointSummary[];
}
interface DataEnvelope { data: FinanceData; revision: string; filePath: string; lastSavedAt: string | null }
interface WriteReceipt { revision: string; filePath: string; lastSavedAt: string | null; history:HistoryEnvelope }
interface HistoryMoveEnvelope extends DataEnvelope { history:HistoryEnvelope }
export interface SessionInfo {
  authenticated: boolean;
  email: string | null;
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
}
export interface MfaEnrollment { factorId: string; qrCode: string; secret: string }
interface EmailChangeReceipt { ok:true; email:string|null; pendingEmail:string|null }
interface PasswordChangeReceipt { ok:true }
export interface ConnectedDevice {
  sessionId:string;
  platform:'windows'|'android'|'web'|'unknown';
  label:string;
  defaultLabel?:string;
  nickname?:string|null;
  systemName?:string|null;
  browserName?:string|null;
  deviceType?:'desktop'|'phone'|'tablet'|'unknown'|null;
  appVersion:string|null;
  firstSeenAt:string;
  lastSeenAt:string;
  current:boolean;
}
interface ConnectedDevicesEnvelope { count:number; devices:ConnectedDevice[] }

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(message: string, status: number, code = 'API_ERROR', requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

async function json<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: string; code?: string; requestId?: string } | T | null;
  if (!response.ok) {
    const details = payload && typeof payload === 'object' ? payload as { error?: string; code?: string; requestId?: string } : {};
    notifyAuthExpired(response.status, details.code);
    if(response.status===423&&details.code==='APP_LOCK_REQUIRED'&&typeof window!=='undefined')window.dispatchEvent(new Event('myfinhub:app-lock-now'));
    throw new ApiError(details.error || response.statusText || 'Request failed', response.status, details.code, details.requestId);
  }
  return payload as T;
}

export const API_REQUEST_TIMEOUT_MS = 30_000;

export async function apiRequest(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const headers=new Headers(init.headers);
    const token=getAppUnlockToken();
    if(token)headers.set('x-myfinhub-app-unlock',token);
    return await fetch(input, {
      credentials: 'same-origin',
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiError('Η σύνδεση με το MyFinHub άργησε πολύ. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.', 0, 'NETWORK_TIMEOUT');
    if (callerSignal?.aborted) throw new ApiError('Το αίτημα ακυρώθηκε.', 0, 'REQUEST_ABORTED');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Δεν ήταν δυνατή η σύνδεση με το MyFinHub. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function getSession(): Promise<SessionInfo> {
  return json(await apiRequest('/api/auth/session', { cache: 'no-store' }));
}

export async function login(email: string, password: string): Promise<SessionInfo> {
  return json(await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
}

export async function enrollMfa(): Promise<MfaEnrollment> {
  return json(await apiRequest('/api/auth/mfa/enroll', { method: 'POST' }));
}

export async function verifyMfa(code: string, factorId?: string): Promise<SessionInfo> {
  return json(await apiRequest('/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, ...(factorId ? { factorId } : {}) }),
  }));
}

export async function logout(): Promise<SessionInfo> {
  const result=await json<SessionInfo>(await apiRequest('/api/auth/logout', { method: 'POST' }));
  clearAppUnlockToken();
  return result;
}

export async function changeAccountEmail(email:string):Promise<EmailChangeReceipt>{
  return json(await apiRequest('/api/auth/account',{
    method:'PATCH',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'email',email}),
  }));
}

export async function changeAccountPassword(currentPassword:string,newPassword:string):Promise<PasswordChangeReceipt>{
  return json(await apiRequest('/api/auth/account',{
    method:'PATCH',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'password',currentPassword,newPassword}),
  }));
}

interface SharedAppLockState {ok:boolean;enabled:boolean;idleMinutes:number;retryAfterMs:number;error?:string;unlockToken?:string}
type SharedAppLockAction='configure'|'verify'|'change'|'timeout'|'disable'|'lock';
export async function getSharedAppLockState():Promise<SharedAppLockState>{
  return json(await apiRequest('/api/auth/app-lock',{cache:'no-store'}));
}
export async function updateSharedAppLock(value:{action:SharedAppLockAction;pin?:string;newPin?:string;idleMinutes?:number;unlockToken?:string}):Promise<SharedAppLockState>{
  return json(await apiRequest('/api/auth/app-lock',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(value),
  }));
}

export async function getConnectedDevices():Promise<ConnectedDevicesEnvelope>{
  return json(await apiRequest('/api/auth/devices',{cache:'no-store'}));
}

export async function renameConnectedDevice(sessionId:string,nickname:string):Promise<ConnectedDevicesEnvelope>{
  return json(await apiRequest('/api/auth/devices',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'rename',sessionId,nickname}),
  }));
}

export async function revokeConnectedDevice(sessionId:string):Promise<ConnectedDevicesEnvelope>{
  return json(await apiRequest('/api/auth/devices',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'revoke',sessionId}),
  }));
}

export async function revokeOtherConnectedDevices():Promise<ConnectedDevicesEnvelope>{
  return json(await apiRequest('/api/auth/devices',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'revoke-others'}),
  }));
}

export async function loadData(): Promise<DataEnvelope> {
  const canMeasure = typeof performance !== 'undefined' && typeof performance.mark === 'function';
  if (canMeasure) performance.mark('rheomiq:data-load-start');
  try {
    return await json(await apiRequest('/api/data', { cache: 'no-store' }));
  } finally {
    if (canMeasure) {
      performance.mark('rheomiq:data-load-end');
      performance.clearMeasures('rheomiq:data-load');
      performance.measure('rheomiq:data-load', 'rheomiq:data-load-start', 'rheomiq:data-load-end');
      performance.clearMarks('rheomiq:data-load-start');
      performance.clearMarks('rheomiq:data-load-end');
    }
  }
}

export async function loadHistory(): Promise<HistoryEnvelope> {
  return json(await apiRequest('/api/history', { cache:'no-store' }));
}

export async function saveData(data: FinanceData, revision: string, historyGeneration:string, historyLabel:string): Promise<WriteReceipt> {
  return json(await apiRequest('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': revision, 'x-rheomiq-history-generation':historyGeneration },
    body: JSON.stringify({ ...mutableSavePayload(data), historyLabel }),
  }));
}

export async function moveHistory(direction:'undo'|'redo',revision:string,historyGeneration:string):Promise<HistoryMoveEnvelope>{
  return json(await apiRequest('/api/history',{
    method:'POST',
    headers:{'content-type':'application/json','if-match':revision,'x-rheomiq-history-generation':historyGeneration},
    body:JSON.stringify({action:direction,updatedAt:new Date().toISOString()}),
  }));
}

export async function importData(data: FinanceData): Promise<DataEnvelope> {
  return json(await apiRequest('/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-rheomiq-confirm-import': 'replace' },
    body: JSON.stringify(data),
  }));
}

export async function createBackup(): Promise<{ path: string }> {
  return json(await apiRequest('/api/backup', { method: 'POST' }));
}
