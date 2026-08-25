import type { FinanceData } from '../types';
import { mutableSavePayload } from './persistencePayload';

export interface HistoryPointSummary { id:string; parentId:string|null; label:string; createdAt:string; current:boolean }
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
export interface DataEnvelope { data: FinanceData; revision: string; filePath: string; lastSavedAt: string | null }
export interface WriteReceipt { revision: string; filePath: string; lastSavedAt: string | null; history:HistoryEnvelope }
export interface HistoryMoveEnvelope extends DataEnvelope { history:HistoryEnvelope }
export interface SessionInfo {
  authenticated: boolean;
  email: string | null;
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
}
export interface MfaEnrollment { factorId: string; qrCode: string; secret: string }

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
    if (response.status === 401 && details.code === 'AUTH_REQUIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('rheomiq:auth-expired'));
    }
    throw new ApiError(details.error || response.statusText || 'Request failed', response.status, details.code, details.requestId);
  }
  return payload as T;
}

const request = (input: RequestInfo | URL, init: RequestInit = {}) => fetch(input, {
  credentials: 'same-origin',
  ...init,
});

export async function getSession(): Promise<SessionInfo> {
  return json(await request('/api/auth/session', { cache: 'no-store' }));
}

export async function login(email: string, password: string): Promise<SessionInfo> {
  return json(await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
}

export async function enrollMfa(): Promise<MfaEnrollment> {
  return json(await request('/api/auth/mfa/enroll', { method: 'POST' }));
}

export async function verifyMfa(code: string, factorId?: string): Promise<SessionInfo> {
  return json(await request('/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, ...(factorId ? { factorId } : {}) }),
  }));
}

export async function logout(): Promise<SessionInfo> {
  return json(await request('/api/auth/logout', { method: 'POST' }));
}

export async function loadData(): Promise<DataEnvelope> {
  const canMeasure = typeof performance !== 'undefined' && typeof performance.mark === 'function';
  if (canMeasure) performance.mark('rheomiq:data-load-start');
  try {
    return await json(await request('/api/data', { cache: 'no-store' }));
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
  return json(await request('/api/history', { cache:'no-store' }));
}

export async function saveData(data: FinanceData, revision: string, historyGeneration:string, historyLabel:string): Promise<WriteReceipt> {
  return json(await request('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': revision, 'x-rheomiq-history-generation':historyGeneration },
    body: JSON.stringify({ ...mutableSavePayload(data), historyLabel }),
  }));
}

export async function moveHistory(direction:'undo'|'redo',revision:string,historyGeneration:string):Promise<HistoryMoveEnvelope>{
  return json(await request('/api/history',{
    method:'POST',
    headers:{'content-type':'application/json','if-match':revision,'x-rheomiq-history-generation':historyGeneration},
    body:JSON.stringify({action:direction,updatedAt:new Date().toISOString()}),
  }));
}

export async function importData(data: FinanceData): Promise<DataEnvelope> {
  return json(await request('/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-rheomiq-confirm-import': 'replace' },
    body: JSON.stringify(data),
  }));
}

export async function createBackup(): Promise<{ path: string }> {
  return json(await request('/api/backup', { method: 'POST' }));
}
