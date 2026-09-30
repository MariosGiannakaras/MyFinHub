import { cardNetworkBrand } from '../lib/cardNetworks';
import type { CardNetwork } from '../types';
import './CardNetworkMark.css';

export function CardNetworkMark({network,detail}:{network:CardNetwork;detail:string}){
  const brand=cardNetworkBrand(network);
  return <div className={`card-network card-network-assets ${brand?`${brand.id}-network`:'other-network'}`} data-network={brand?.dataNetwork??'OTHER'}>
    {brand
      ? <span className="card-network-badge"><img className={`card-network-logo ${brand.id}-logo`} src={brand.src} alt={brand.label}/></span>
      : <span className="card-network-main">CARD</span>}
    <span className="card-network-type">{detail}</span>
  </div>;
}
