import mastercardLogo from '../assets/card-networks/mastercard.svg';
import visaLogo from '../assets/card-networks/visa.svg';
import type { CardNetwork } from '../types.js';

type BrandedCardNetwork='visa'|'mastercard';

interface CardNetworkBrand {
  id:BrandedCardNetwork;
  label:'Visa'|'Mastercard';
  dataNetwork:'VISA'|'MASTERCARD';
  src:string;
}

const CARD_NETWORK_BRANDS:Record<BrandedCardNetwork,CardNetworkBrand>={
  visa:{id:'visa',label:'Visa',dataNetwork:'VISA',src:visaLogo},
  mastercard:{id:'mastercard',label:'Mastercard',dataNetwork:'MASTERCARD',src:mastercardLogo},
};

export function cardNetworkBrand(network:CardNetwork):CardNetworkBrand|null{
  return network==='visa'||network==='mastercard'?CARD_NETWORK_BRANDS[network]:null;
}
