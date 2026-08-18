import type { FinanceData } from '../src/types.js';
import { ApiError } from './http.js';
import { validateFinanceData } from './validation.js';

const EMPTY_SEED: FinanceData['seed'] = {
  accounts: [],
  months: [],
  transactions: [],
  snapshots: [],
  recurring: [],
  subscriptions: [],
  loans: [],
  lending: [],
  stats: {},
};

const PERSON_ACTIONS=new Set(['paid_for_other','paid_by_other','shared_purchase','settlement_received','settlement_sent','forgiven']);
const SETTLEMENT_METHODS=new Set(['iris','cash','bank_transfer','other']);

function invalid():never{throw new ApiError(400,'INVALID_DATA','The finance data is invalid.');}
function validatePersonMetadata(state:FinanceData['state']){
  for(const event of state.events??[]){
    if(event.personAction!==undefined){
      if(typeof event.personAction!=='string'||!PERSON_ACTIONS.has(event.personAction)||typeof event.person!=='string'||!event.person.trim())invalid();
      const delta=event.personBalanceDelta??event.receivableDelta;
      if(typeof delta!=='number'||!Number.isFinite(delta)||Math.abs(delta)>1_000_000_000||Math.abs(delta)<.000001)invalid();
    }
    if(event.settlementMethod!==undefined){
      if(typeof event.settlementMethod!=='string'||!SETTLEMENT_METHODS.has(event.settlementMethod))invalid();
      if(event.personAction!=='settlement_received'&&event.personAction!=='settlement_sent')invalid();
    }
    if(event.personBalanceDelta!==undefined&&(!Number.isFinite(event.personBalanceDelta)||Math.abs(event.personBalanceDelta)>1_000_000_000))invalid();
    if(event.paymentTotal!==undefined){
      if(!Number.isFinite(event.paymentTotal)||event.paymentTotal<=0||event.paymentTotal>1_000_000_000)invalid();
      if(event.personAction!=='shared_purchase'||event.paymentTotal<=event.amount)invalid();
    }
  }
}

/**
 * Reuse the canonical full-document validator for the mutable subtree without
 * duplicating finance validation rules. The synthetic seed is deliberately
 * empty and valid; every state-specific invariant is therefore checked by the
 * same code path used for full imports and stored-state reads.
 */
export function validateFinanceState(value: unknown): asserts value is FinanceData['state'] {
  validateFinanceData({
    app: 'RheomIQ',
    schemaVersion: 3,
    updatedAt: '1970-01-01T00:00:00.000Z',
    seed: EMPTY_SEED,
    state: value,
  });
  validatePersonMetadata(value as FinanceData['state']);
}

export function parseMutableWrite(value: unknown): { state: FinanceData['state']; updatedAt: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(['state', 'updatedAt']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt || body.updatedAt.length > 64) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  validateFinanceState(body.state);
  return { state: body.state, updatedAt: body.updatedAt };
}
