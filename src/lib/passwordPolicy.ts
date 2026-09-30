export const ACCOUNT_PASSWORD_MIN_LENGTH=12;

export function accountPasswordPolicyError(value:string){
  if(value.length<ACCOUNT_PASSWORD_MIN_LENGTH)return `Ο νέος κωδικός πρέπει να έχει τουλάχιστον ${ACCOUNT_PASSWORD_MIN_LENGTH} χαρακτήρες.`;
  if(value.length>512)return 'Ο νέος κωδικός είναι υπερβολικά μεγάλος.';
  const categories=[
    /\p{Ll}/u.test(value),
    /\p{Lu}/u.test(value),
    /\p{N}/u.test(value),
    /[\p{P}\p{S}]/u.test(value),
  ];
  if(categories.some(match=>!match))return 'Ο νέος κωδικός πρέπει να περιέχει πεζό, κεφαλαίο, αριθμό και σύμβολο.';
  return '';
}
