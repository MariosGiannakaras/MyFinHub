import { describe, expect, it } from 'vitest';
import { parseCardVaultRequest } from '../server/cardVaultHandler.js';
import { ApiError } from '../server/http.js';

describe('card vault request boundary',()=>{
  it('accepts reveal and save requests with card ids and PAN/expiry only',()=>{
    expect(parseCardVaultRequest({cardId:'card-123'},'POST')).toEqual({cardId:'card-123'});
    expect(parseCardVaultRequest({cardId:'card-123',pan:'4242 4242 4242 4242',expiry:'12/30'},'PUT')).toEqual({cardId:'card-123',pan:'4242 4242 4242 4242',expiry:'12/30'});
  });
  it('rejects CVV in every server request shape',()=>{
    for(const key of ['cvv','cvc','securityCode','card_verification_value']){
      try{parseCardVaultRequest({cardId:'card-123',[key]:'123'},'PUT');throw new Error('expected failure')}
      catch(error){expect(error).toBeInstanceOf(ApiError);expect((error as ApiError).code).toBe('CVV_PERSISTENCE_DISABLED')}
    }
  });
  it('rejects unknown fields and malformed card ids',()=>{
    expect(()=>parseCardVaultRequest({cardId:'../../bad',pan:'4242424242424242'},'PUT')).toThrow(ApiError);
    try{parseCardVaultRequest({cardId:'card-123',pan:'4242424242424242',note:'nope'},'PUT')}catch(error){expect((error as ApiError).code).toBe('INVALID_CARD_SECRET_REQUEST')}
  });
});
