import type { FinanceData } from '../types';

export interface DataEnvelope { data: FinanceData; revision: string; filePath: string; lastSavedAt: string | null }

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function loadData(): Promise<DataEnvelope> {
  return json(await fetch('/api/data', { cache: 'no-store' }));
}

export async function saveData(data: FinanceData, revision: string): Promise<DataEnvelope> {
  return json(await fetch('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': revision },
    body: JSON.stringify(data),
  }));
}

export async function importData(data: FinanceData): Promise<DataEnvelope> {
  return json(await fetch('/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function createBackup(): Promise<{ path: string }> {
  return json(await fetch('/api/backup', { method: 'POST' }));
}
