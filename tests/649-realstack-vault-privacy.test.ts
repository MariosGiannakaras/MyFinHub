import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {financeBackupVaultPrivacyRisk} from '../scripts/real-stack-vault-privacy.js';

const fixture={
  state:{revision:123,events:[{id:'synthetic-123',amount:123.45,note:'Payment 123'}]},
  meta:{updatedAt:'2026-11-20T00:43:32.934Z'},
};
const pan='4242424242424242',expiry='12/30';
const risk=(data:unknown)=>financeBackupVaultPrivacyRisk(data,pan,expiry);

describe('#649 deterministic real-stack backup/card-vault privacy proof',()=>{
  it('does not mistake incidental three-digit finance values, IDs or notes for leaked CVV',()=>{
    expect(JSON.stringify(fixture)).toContain('123');
    expect(risk(fixture)).toBeNull();
    expect(risk({nested:[fixture,{note:'legacy record 123 and subtotal 123.45'}]})).toBeNull();
  });
  it('rejects a literal long PAN or expiry even when inserted as a generic finance string',()=>{
    expect(risk({state:{events:[{note:pan}]}})).toBe('pan');
    expect(risk({state:{events:[{note:expiry}]}})).toBe('expiry');
  });
  it.each([
    {name:'cvv',value:'123'},
    {name:'CVV',value:123},
    {name:'card_cvv',value:'123'},
    {name:'pan',value:'1111222233334444'},
    {name:'cardNumber',value:'4111111111111111'},
    {name:'card_expiry',value:'09/31'},
    {name:'cardSecrets',value:{cardId:'card-1'}},
    {name:'card_vault',value:{secret:'encrypted'}},
    {name:'vaultCiphertext',value:'cipher'},
  ])('rejects explicit sensitive backup field $name regardless of nesting',({name,value})=>{
    expect(risk({state:{events:[{notSecret:true,metadata:{[name]:value}}]}})).toBe('secret-field');
  });
  it('uses the deterministic guard in the actual disposable-stack harness without exposing secrets',()=>{
    const source=readFileSync('scripts/real-stack-e2e.ts','utf8');
    expect(source).toContain('financeBackupVaultPrivacyRisk(backupData,TEST_PAN,TEST_EXPIRY)');
    expect(source).not.toContain('serializedBackup.includes(TEST_CVV)');
    expect(source).not.toContain('console.log(TEST_CVV)');
  });
});
