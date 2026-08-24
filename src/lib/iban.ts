export function normalizeIban(value:string|null|undefined){
  const normalized=(value??'').replace(/\s+/g,'').toUpperCase();
  return normalized||null;
}

export function isValidIban(value:string|null|undefined){
  const iban=normalizeIban(value);
  if(!iban)return true;
  if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)||iban.length<15||iban.length>34)return false;
  const rearranged=`${iban.slice(4)}${iban.slice(0,4)}`;
  let remainder=0;
  for(const char of rearranged){
    const token=/[0-9]/.test(char)?char:String(char.charCodeAt(0)-55);
    for(const digit of token)remainder=(remainder*10+Number(digit))%97;
  }
  return remainder===1;
}

export function assertValidIban(value:string|null|undefined){
  const normalized=normalizeIban(value);
  if(normalized&&!isValidIban(normalized))throw new Error('INVALID_IBAN');
  return normalized;
}

export function formatIban(value:string|null|undefined){
  const normalized=normalizeIban(value);
  return normalized?normalized.match(/.{1,4}/g)?.join(' ')??normalized:'';
}
