import type { FinanceData } from '../types.js';

export type MutableSavePayload = Pick<FinanceData, 'state' | 'updatedAt'>;

export function mutableSavePayload(data: FinanceData): MutableSavePayload {
  return { state: data.state, updatedAt: data.updatedAt };
}
