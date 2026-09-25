import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardVaultClientError, cardVaultErrorMessage, saveCardSecret } from '../src/lib/cardVaultClient.js';

afterEach(()=>{vi.unstubAllGlobals()});

describe('card vault client',()=>{
  it('sends PAN, expiry and CVV through the card vault request',async()=>{
    let sent='';
    vi.stubGlobal('fetch',vi.fn(async (_url:string,init?:RequestInit)=>{
      sent=String(init?.body||'');
      return new Response(JSON.stringify({saved:true,last4:'4242'}),{status:200,headers:{'content-type':'application/json'}});
    }));
    await saveCardSecret('card-1',{pan:'4242424242424242',expiry:'12/30',cvv:'123'});
    expect(JSON.parse(sent)).toEqual({cardId:'card-1',pan:'4242424242424242',expiry:'12/30',cvv:'123'});
  });

  it('maps card-security failures to direct user-facing copy',()=>{
    const panMessage=cardVaultErrorMessage(new CardVaultClientError(400,'INVALID_CARD_PAN','raw internal message'));
    expect(panMessage).toContain('αριθμό κάρτας');
    expect(panMessage).not.toContain('16');
    expect(cardVaultErrorMessage(new CardVaultClientError(400,'INVALID_CARD_CVV','raw internal message'))).toContain('3 ή 4');
    expect(cardVaultErrorMessage(new CardVaultClientError(401,'MFA_REQUIRED','raw internal message'))).toContain('επαληθεύσεις ξανά');
  });

  it('never exposes an unknown server error message verbatim',()=>{
    const raw='SQLSTATE 23505 internal-card-secret-detail';
    const message=cardVaultErrorMessage(new CardVaultClientError(500,'UNEXPECTED_SERVER_FAILURE',raw));
    expect(message).not.toContain(raw);
    expect(message).toContain('Δοκίμασε ξανά');
  });
});
