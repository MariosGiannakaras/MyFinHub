import { describe, expect, it } from 'vitest';
import { parseCardVaultRequest } from '../server/cardVaultHandler.js';
import { ApiError } from '../server/http.js';

describe('card vault request boundary',()=>{
  it('accepts reveal and save requests with card ids and PAN/expiry/CVV',()=>{
    expect(parseCardVaultRequest({cardId:'card-123'},'POST')).toEqual({cardId:'card-123'});
    expect(parseCardVaultRequest({cardId:'card-123',pan:'4242 4242 4242 4242',expiry:'12/30',cvv:'123'},'PUT')).toEqual({cardId:'card-123',pan:'4242 4242 4242 4242',expiry:'12/30',cvv:'123'});
  });
  it('keeps old clients that save only PAN and expiry compatible with the new server vault',()=>{
    expect(parseCardVaultRequest({cardId:'card-123',pan:'4242 4242 4242 4242',expiry:'12/30'},'PUT')).toEqual({
      cardId:'card-123',
      pan:'4242 4242 4242 4242',
      expiry:'12/30',
      cvv:undefined,
    });
  });
  it('keeps the request key whitelist narrow while allowing canonical cvv',()=>{
    for(const key of ['cvc','securityCode','card_verification_value']){
      try{parseCardVaultRequest({cardId:'card-123',[key]:'123'},'PUT');throw new Error('expected failure')}
      catch(error){expect(error).toBeInstanceOf(ApiError);expect((error as ApiError).code).toBe('INVALID_CARD_SECRET_REQUEST')}
    }
  });
  it('accepts only explicit committed-deletion receipts and keeps old DELETE clients compatible',()=>{
    expect(parseCardVaultRequest({cardId:'card-123'},'DELETE')).toEqual({cardId:'card-123'});
    expect(parseCardVaultRequest({cardId:'card-123',requireCommittedDeletion:true},'DELETE')).toEqual({cardId:'card-123',requireCommittedDeletion:true});
    for(const invalid of [false,'true',1])expect(()=>parseCardVaultRequest({cardId:'card-123',requireCommittedDeletion:invalid},'DELETE')).toThrow(ApiError);
  });
  it('rejects unknown fields and malformed card ids',()=>{
    expect(()=>parseCardVaultRequest({cardId:'../../bad',pan:'4242424242424242'},'PUT')).toThrow(ApiError);
    try{parseCardVaultRequest({cardId:'card-123',pan:'4242424242424242',note:'nope'},'PUT')}catch(error){expect((error as ApiError).code).toBe('INVALID_CARD_SECRET_REQUEST')}
  });
});
