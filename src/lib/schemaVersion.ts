export const SUPPORTED_FINANCE_SCHEMA_VERSION=3;

export function isSupportedFinanceSchemaVersion(value:unknown){
  return Number.isInteger(value)&&Number(value)>=1&&Number(value)<=SUPPORTED_FINANCE_SCHEMA_VERSION;
}

export function assertSupportedFinanceSchemaVersion(value:unknown){
  if(!isSupportedFinanceSchemaVersion(value)){
    throw new Error(`Unsupported finance schema version: ${String(value)}`);
  }
}
