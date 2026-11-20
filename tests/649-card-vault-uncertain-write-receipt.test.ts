import {readFileSync} from 'node:fs';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ApiError} from '../src/lib/api.js';
import {
  UnverifiedCardVaultWrite,CardVaultClientError,cardVaultErrorMessage,
  saveCardSecret,deleteCardSecret,
} from '../src/lib/cardVaultClient.js';

afterEach(()=>vi.unstubAllGlobals());

const mockResponse=(payload:unknown,status=200)=>
  new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});

describe('#649 card vault independent write receipt provenance',()=>{
  it('accepts only exact acknowledged save and delete responses',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_u:string,init?:RequestInit)=>
      mockResponse(init?.method==='DELETE'?{deleted:true}:{saved:true,last4:'4242'})));
    await expect(saveCardSecret('card-x',{pan:'4242424242424242',expiry:'12/31'}))
      .resolves.toEqual({saved:true,last4:'4242'});
    await expect(deleteCardSecret('card-x',true)).resolves.toEqual({deleted:true});
  });
  it.each([
    {label:'missing success flag',result:{last4:'4242'}},
    {label:'false saved',result:{saved:false,last4:'4242'}},
    {label:'wrong last4',result:{saved:true,last4:'9999'}},
    {label:'malformed last4',result:{saved:true,last4:'abcdef'}},
    {label:'empty response body',result:{}},
  ])('does not mark a mismatched 200 $label as saved',async({result})=>{
    vi.stubGlobal('fetch',vi.fn(async()=>mockResponse(result)));
    await expect(saveCardSecret('card-x',{pan:'4242424242424242'}))
      .rejects.toMatchObject({name:'UnverifiedCardVaultWrite',operation:'save'});
  });
  it.each([{deleted:false},{ok:true},{}])('does not treat bad 200 deletion as proof',async receipt=>{
    vi.stubGlobal('fetch',vi.fn(async()=>mockResponse(receipt)));
    await expect(deleteCardSecret('card-x'))
      .rejects.toMatchObject({name:'UnverifiedCardVaultWrite',operation:'delete'});
  });
  it.each([
    {label:'transport lost',status:0},
    {label:'timeout',status:408},
    {label:'rate limited',status:429},
    {label:'upstream unavailable',status:503},
  ])('does not infer rollback from $label on save or delete',async({status})=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{
      if(status===0)throw new TypeError('synthetic lost response');
      return mockResponse({code:'VAULT_TEMPORARY',error:'upstream internal'},status);
    }));
    await expect(saveCardSecret('card-x',{pan:'4242424242424242'}))
      .rejects.toMatchObject({operation:'save'});
    await expect(deleteCardSecret('card-x'))
      .rejects.toMatchObject({operation:'delete'});
  });
  it('keeps provably rejected invalid input retryable, without false unverified warnings',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>mockResponse({code:'INVALID_CARD_PAN',error:'bad'},400)));
    await expect(saveCardSecret('card-x',{pan:'bad'})).rejects.toBeInstanceOf(CardVaultClientError);
  });
  it('uses redacted recovery guidance instead of leaking secret bytes or claiming rollback',()=>{
    const message=cardVaultErrorMessage(new UnverifiedCardVaultWrite('save'));
    expect(message).toContain('ίσως ολοκληρώθηκε');
    expect(message).toContain('επαναφόρτωσε');
    expect(message).not.toContain('4242424242424242');
    const timeout=cardVaultErrorMessage(new ApiError('secret low-level stack',0,'NETWORK_TIMEOUT'));
    expect(timeout).not.toContain('δεν άλλαξαν');
    expect(timeout).not.toContain('secret low-level stack');
  });
  it('guards both secure card editors until owner reloads after unknown receipt',()=>{
    const view=readFileSync('src/components/CardDetailsDialog.tsx','utf8');
    expect(view).toContain('vaultReviewRef.current=true;setVaultReviewRequired(true)');
    expect(view).toContain('if(busy||vaultReviewRef.current)return');
    expect(view).toContain('disabled={busy||vaultReviewRequired}');
    expect(view).toContain('saveError instanceof UnverifiedCardVaultWrite');
    expect(view).toContain('vaultReviewRequired?<FormError id={errorId}>{error}</FormError>');
    const qa=readFileSync('scripts/card-vault-runtime-qa.mjs','utf8');
    expect(qa).toContain('card-vault-unverified-mobile');
    expect(qa).toContain('card-vault-unverified-desktop');
    expect(qa).toContain("state.nextPutReceipt==='missing'");
    expect(qa).toContain('unknown.puts===1');
  });
});
