import type { CardFormFactor, CardKind, CardNetwork, PaymentCard } from '../types.js';

export interface CardDesign {
  id:string;
  bankId:string;
  label:string;
  note:string;
  themeClass:string;
  kind:CardKind;
  network:CardNetwork;
  formFactor:CardFormFactor;
  swatch:string;
}

const d=(bankId:string,id:string,label:string,note:string,themeClass:string,kind:CardKind,network:CardNetwork,formFactor:CardFormFactor,swatch:string):CardDesign=>({bankId,id,label,note,themeClass,kind,network,formFactor,swatch});

export const CARD_DESIGNS:CardDesign[]=[
  d('piraeus','piraeus-yellow','Visa Debit Yellow','Χρεωστική','r-card-piraeus-yellow','debit','visa','physical','linear-gradient(145deg,#ffe000,#f3c900)'),
  d('piraeus','piraeus-virtual','Virtual Debit','Virtual','r-card-piraeus-virtual','debit','visa','virtual','linear-gradient(145deg,#ffe99c,#f4d66d)'),
  d('piraeus','piraeus-green','Visa Classic','Πιστωτική','r-card-piraeus-green','credit','visa','physical','linear-gradient(145deg,#003c3b,#002f39)'),
  d('piraeus','piraeus-gold','Visa Gold','Πιστωτική Gold','r-card-piraeus-gold','credit','visa','physical','linear-gradient(145deg,#d9bb77,#b68b45)'),
  d('piraeus','piraeus-platinum','Visa Platinum','Πιστωτική Platinum','r-card-piraeus-platinum','credit','visa','physical','linear-gradient(145deg,#edf3f7,#bcc9d6)'),
  d('piraeus','piraeus-midnight','Signature Blue','Premium Debit','r-card-piraeus-midnight','debit','visa','physical','linear-gradient(145deg,#123d53,#0a2535)'),

  d('revolut','revolut','Standard Gradient','Iconic','r-card-revolut-gradient','debit','visa','physical','linear-gradient(135deg,#1599d2 0%,#3d54c6 66%,#d22498 100%)'),
  d('revolut','revolut-sage','Premium Sage','Premium','r-card-revolut-sage','debit','visa','physical','linear-gradient(145deg,#8da996,#5d796f)'),
  d('revolut','revolut-midnight','Premium Midnight','Premium','r-card-revolut-midnight','debit','visa','physical','linear-gradient(145deg,#202a43,#10172a)'),
  d('revolut','revolut-slate','Premium Slate','Premium','r-card-revolut-slate','debit','visa','physical','linear-gradient(145deg,#6f7478,#40464b)'),
  d('revolut','revolut-lilac','Premium Lilac','Premium','r-card-revolut-lilac','debit','visa','physical','linear-gradient(145deg,#b07cff,#6147c8)'),
  d('revolut','revolut-arctic','Arctic Ice','Premium','r-card-revolut-arctic','debit','visa','physical','linear-gradient(145deg,#f7fbff,#bfd7ea)'),
  d('revolut','revolut-ruby','Ruby Red','Premium','r-card-revolut-ruby','debit','visa','physical','linear-gradient(145deg,#7a0829,#d1255b)'),
  d('revolut','revolut-emerald','Emerald','Premium','r-card-revolut-emerald','debit','visa','physical','linear-gradient(145deg,#0c7d5c,#0a4f5e)'),
  d('revolut','revolut-metal-black','Metal Black','Metal','r-card-revolut-metal-black','debit','visa','physical','linear-gradient(145deg,#35373a,#0d0e10)'),
  d('revolut','revolut-metal-gold','Metal Gold','Metal','r-card-revolut-metal-gold','debit','visa','physical','linear-gradient(145deg,#d4b76f,#8d6c2d)'),
  d('revolut','revolut-metal-bronze','Metal Bronze','Metal','r-card-revolut-metal-bronze','debit','visa','physical','linear-gradient(145deg,#9c6547,#543125)'),
  d('revolut','revolut-metal-silver','Metal Silver','Metal','r-card-revolut-metal-silver','debit','visa','physical','linear-gradient(145deg,#e2e6e7,#949da3)'),
  d('revolut','revolut-ultra','Ultra Platinum','Ultra','r-card-revolut-ultra','debit','visa','physical','linear-gradient(145deg,#f3f2ee,#c6c7c8)'),

  d('alpha','alpha','Enter','Χρεωστική','r-card-alpha','debit','visa','physical','linear-gradient(135deg,#83c4f4,#5da3de)'),
  d('alpha','alpha-bonus','Bonus Visa','Bonus','r-card-alpha-bonus','credit','visa','physical','linear-gradient(145deg,#173f71,#0b274d)'),
  d('alpha','alpha-gold','Bonus Visa Gold','Gold','r-card-alpha-gold','credit','visa','physical','linear-gradient(145deg,#40351f,#1d1913)'),
  d('alpha','alpha-sky','Sky Blue','Χρεωστική+','r-card-alpha-sky','debit','visa','physical','linear-gradient(145deg,#9ad2f8,#4f93d0)'),
  d('alpha','alpha-midnight','Midnight Blue','Χρεωστική Premium','r-card-alpha-midnight','debit','visa','physical','linear-gradient(145deg,#183d72,#0a203f)'),

  d('payzy','payzy','Virtual Purple','Virtual Visa Debit','r-card-payzy-virtual','debit','visa','virtual','linear-gradient(135deg,#6b03e8,#5100c7)'),
  d('payzy','payzy-physical','Physical Purple','Physical Visa Debit','r-card-payzy-physical','debit','visa','physical','linear-gradient(145deg,#43208f,#6248d2)'),
  d('payzy','payzy-pro','payzy pro Aqua','Business Debit','r-card-payzy-pro','debit','visa','physical','linear-gradient(145deg,#63cfd0,#48b2bb)'),
  d('payzy','payzy-pro-night','payzy pro Night','Business Debit','r-card-payzy-pro-night','debit','visa','physical','linear-gradient(145deg,#101b39,#060c20)'),
  d('payzy','payzy-neo','Neo Purple','Modern Visa Debit','r-card-payzy-neo','debit','visa','physical','linear-gradient(145deg,#ff2ab9,#4f00be)'),

  d('viva','viva','Business Navy','Business Debit','r-card-viva-business','debit','mastercard','physical','linear-gradient(145deg,#202a44,#111828)'),
  d('viva','viva-employee','Employee Navy','Employee Debit','r-card-viva-employee','debit','mastercard','physical','linear-gradient(145deg,#354767,#1a243c)'),
  d('viva','viva-digital','Digital Midnight','Digital Debit','r-card-viva-digital','debit','mastercard','virtual','linear-gradient(145deg,#141d31,#0b1120)'),
  d('viva','viva-signature','Signature Indigo','Modern Corporate','r-card-viva-signature','debit','mastercard','physical','linear-gradient(145deg,#4d2f8a,#22184b)'),
  d('viva','viva-carbon','Carbon Black','Executive Debit','r-card-viva-carbon','debit','mastercard','physical','linear-gradient(145deg,#202020,#080b12)'),
  d('viva','viva-cobalt','Cobalt Blue','Employee / Digital','r-card-viva-cobalt','debit','mastercard','physical','linear-gradient(145deg,#0e5fb0,#113465)'),

  d('custom','custom','Neumorphic Custom','Αυτόματο χρώμα','r-card-custom','debit','visa','physical','linear-gradient(135deg,#3c78ce,#4b4db8)'),
];

export function designsForBank(bankId:string){
  const direct=CARD_DESIGNS.filter(item=>item.bankId===bankId);
  return direct.length?direct:CARD_DESIGNS.filter(item=>item.bankId==='custom');
}

export function cardDesign(id?:string){return CARD_DESIGNS.find(item=>item.id===id)}

export function defaultDesignForCard(card:Pick<PaymentCard,'bankId'|'kind'|'network'|'formFactor'|'designId'>){
  const explicit=cardDesign(card.designId);if(explicit)return explicit;
  const designs=designsForBank(card.bankId);
  return designs.find(item=>item.kind===card.kind&&item.formFactor===(card.formFactor??'physical'))
    ??designs.find(item=>item.kind===card.kind)
    ??designs.find(item=>item.network===card.network)
    ??designs[0];
}

export function cardThemeClass(card:Pick<PaymentCard,'bankId'|'kind'|'network'|'formFactor'|'designId'>){
  return defaultDesignForCard(card)?.themeClass??'r-card-custom';
}