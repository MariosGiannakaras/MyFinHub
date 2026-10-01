import { describe, expect, it } from 'vitest';
import { assertSupportedFinanceSchemaVersion, isSupportedFinanceSchemaVersion, SUPPORTED_FINANCE_SCHEMA_VERSION } from '../src/lib/schemaVersion.js';

describe('finance schema compatibility boundary',()=>{
  it('accepts every supported historical schema and the current schema',()=>{
    expect(SUPPORTED_FINANCE_SCHEMA_VERSION).toBe(3);
    for(const version of [1,2,3])expect(isSupportedFinanceSchemaVersion(version)).toBe(true);
  });

  it('rejects malformed, zero/negative and future schema versions',()=>{
    for(const value of [0,-1,4,99,3.5,'3',null,undefined]){
      expect(isSupportedFinanceSchemaVersion(value)).toBe(false);
      expect(()=>assertSupportedFinanceSchemaVersion(value)).toThrow(/Unsupported finance schema version/);
    }
  });
});
