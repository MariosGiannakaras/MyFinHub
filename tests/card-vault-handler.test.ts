import { readFileSync } from 'node:fs';
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
  it('uses a row-locked, owner-AAL2 RLS SQL RPC for committed deletion',()=>{
    const sql=readFileSync('supabase/migrations/20261010013500_atomic_card_vault_cleanup.sql','utf8');
    const handler=readFileSync('server/cardVaultHandler.ts','utf8');
    const store=readFileSync('server/cardVaultStore.ts','utf8');
    expect(sql).toContain('security invoker');
    expect(sql).toContain('for update');
    expect(sql).toContain('public.rheomiq_is_owner_aal2()');
    expect(sql).toContain('private.rheomiq_cards');
    expect(sql).toContain('pendingCardSecretDeletes');
    expect(sql).toContain('delete from public.rheomiq_card_secrets');
    expect(sql).toContain('grant execute on function public.rheomiq_delete_committed_card_secret(text) to authenticated');
    expect(handler).toContain('await deleteCommittedCardSecrets(body.cardId,session.accessToken)');
    expect(store).toContain("rpc/rheomiq_delete_committed_card_secret");
    expect(sql).not.toMatch(/grant execute.*to anon/i);
  });
  it('rejects unknown fields and malformed card ids',()=>{
    expect(()=>parseCardVaultRequest({cardId:'../../bad',pan:'4242424242424242'},'PUT')).toThrow(ApiError);
    try{parseCardVaultRequest({cardId:'card-123',pan:'4242424242424242',note:'nope'},'PUT')}catch(error){expect((error as ApiError).code).toBe('INVALID_CARD_SECRET_REQUEST')}
  });
});
