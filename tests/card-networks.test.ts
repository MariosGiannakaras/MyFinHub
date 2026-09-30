import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardNetworkBrand } from '../src/lib/cardNetworks.js';

const root=process.cwd();
const source=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('card network artwork',()=>{
  it('maps Visa and Mastercard to local vector assets and leaves other networks generic',()=>{
    const visa=cardNetworkBrand('visa');
    const mastercard=cardNetworkBrand('mastercard');
    expect(visa).toMatchObject({id:'visa',label:'Visa',dataNetwork:'VISA'});
    expect(mastercard).toMatchObject({id:'mastercard',label:'Mastercard',dataNetwork:'MASTERCARD'});
    expect(visa?.src).toMatch(/^(?:data:image\/svg\+xml|.*visa.*\.svg)/i);
    expect(mastercard?.src).toMatch(/^(?:data:image\/svg\+xml|.*mastercard.*\.svg)/i);
    expect(cardNetworkBrand('other')).toBeNull();
  });

  it('keeps the network artwork as real SVG assets with canonical brand colors',()=>{
    const visa=source('src/assets/card-networks/visa.svg');
    const mastercard=source('src/assets/card-networks/mastercard.svg');
    expect(visa).toContain('#1434CB');
    expect(mastercard).toContain('#eb001b');
    expect(mastercard).toContain('#ff5f00');
    expect(mastercard).toContain('#f79e1b');
  });

  it('uses the shared network assets in preview, interactive and canonical card renderers',()=>{
    const preview=source('src/components/CardCreateDialog.tsx');
    const interactive=source('src/components/InteractivePaymentCard.tsx');
    const canonical=source('src/components/CanonicalCreditCardStack.tsx');
    expect(preview).toContain('<CardNetworkMark');
    expect(interactive).toContain('<CardNetworkMark');
    expect(canonical).toContain("cardNetworkBrand(card.network)");
    expect(interactive).not.toContain('className="mastercard-symbol"');
    expect(preview).not.toContain("?'MASTERCARD':'VISA'");
  });
});
