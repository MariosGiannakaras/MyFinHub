// Isolated local Real Stack QA only; never log the synthetic secret values.
// Raw three-digit CVV substring matching across a whole finance archive is
// nondeterministic: legitimate totals, dates and IDs can contain those digits.
// Instead reject explicit credential/vault fields at any depth, and search
// for the longer exact synthetic PAN and expiry plaintext wherever stored.
export type FinanceBackupVaultPrivacyRisk='pan'|'expiry'|'secret-field';

const sensitiveFieldNames=new Set([
  'pan','cardpan','cardnumber','cvv','cvc','cardcvv','cardcvc',
  'cardexpiry','cardexpiration','cardexpirationdate',
  'cardsecret','cardsecrets','cardvault','cardvaultsecret',
  'vaultciphertext','vaultauthtag','encryptedpan','encryptedcvv',
]);

export function financeBackupVaultPrivacyRisk(
  data:unknown,pan:string,expiry:string,
):FinanceBackupVaultPrivacyRisk|null{
  const encoded=JSON.stringify(data);
  if(typeof encoded!=='string')return 'secret-field';
  if(pan&&encoded.includes(pan))return 'pan';
  if(expiry&&encoded.includes(expiry))return 'expiry';
  const pending:unknown[]=[data];
  const seen=new WeakSet<object>();
  while(pending.length){
    const current=pending.pop();
    if(!current||typeof current!=='object'||seen.has(current))continue;
    seen.add(current);
    if(Array.isArray(current)){
      pending.push(...current);
      continue;
    }
    for(const [name,value] of Object.entries(current)){
      const field=name.replace(/[^a-z0-9]/gi,'').toLowerCase();
      if(sensitiveFieldNames.has(field))return 'secret-field';
      pending.push(value);
    }
  }
  return null;
}
