import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {readLocalCvvMock}=vi.hoisted(()=>({readLocalCvvMock:vi.fn()}));
vi.mock('../src/lib/localCvvVault.js',()=>({readLocalCvv:readLocalCvvMock}));

import { CardVaultClientError, cardVaultErrorMessage, deleteCardSecret, revealCardSecret, saveCardSecret } from '../src/lib/cardVaultClient.js';

afterEach(()=>{vi.unstubAllGlobals();readLocalCvvMock.mockReset()});

describe('card vault client source contract',()=>{
  it('uses legacy local CVV only as reveal fallback and never uploads it implicitly',()=>{
    const source=readFileSync(new URL('../src/lib/cardVaultClient.ts',import.meta.url),'utf8');
    const reveal=source.slice(source.indexOf('export async function revealCardSecret'),source.indexOf('export async function saveCardSecret'));
    expect(reveal).toContain('readLocalCvv(cardId)');
    expect(reveal).not.toContain('saveCardSecret(');
    expect(reveal).not.toContain("'PUT'");
    expect(reveal).toContain('Explicit Save/Update is the migration boundary');
  });
});

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

  it('reveals the server-backed secret through the explicit POST boundary',async()=>{
    let method='';let sent='';
    const fetchMock=vi.fn(async(_url:string,init?:RequestInit)=>{
      method=String(init?.method||'');sent=String(init?.body||'');
      return new Response(JSON.stringify({pan:'4111111111111111',expiry:'12/30',cvv:'123'}),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);
    await expect(revealCardSecret('card-server')).resolves.toEqual({pan:'4111111111111111',expiry:'12/30',cvv:'123'});
    expect(method).toBe('POST');
    expect(JSON.parse(sent)).toEqual({cardId:'card-server'});
    expect(readLocalCvvMock).not.toHaveBeenCalled();
  });

  it('deletes card secrets only through the explicit DELETE boundary',async()=>{
    let method='';let sent='';
    vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{
      method=String(init?.method||'');sent=String(init?.body||'');
      return new Response(JSON.stringify({deleted:true}),{status:200,headers:{'content-type':'application/json'}});
    }));
    await expect(deleteCardSecret('card-delete')).resolves.toEqual({deleted:true});
    expect(method).toBe('DELETE');
    expect(JSON.parse(sent)).toEqual({cardId:'card-delete'});
  });

  it('uses opt-in atomic cleanup only for new clients and preserves the legacy payload',async()=>{
    const bodies:Record<string,unknown>[]=[];
    vi.stubGlobal('fetch',vi.fn(async (_url:string,init?:RequestInit)=>{
      bodies.push(JSON.parse(String(init?.body||'{}')));
      return new Response(JSON.stringify({deleted:true}),{status:200,headers:{'content-type':'application/json'}});
    }));
    await deleteCardSecret('card-a');
    await deleteCardSecret('card-b',true);
    expect(bodies).toEqual([{cardId:'card-a'},{cardId:'card-b',requireCommittedDeletion:true}]);
  });

  it('reveals a legacy local CVV without silently uploading it to the server',async()=>{
    let method='';
    const fetchMock=vi.fn(async(_url:string,init?:RequestInit)=>{method=String(init?.method||'');return new Response(JSON.stringify({code:'CARD_SECRET_NOT_FOUND',error:'missing'}),{status:404,headers:{'content-type':'application/json'}})});
    vi.stubGlobal('fetch',fetchMock);vi.stubGlobal('indexedDB',{});
    readLocalCvvMock.mockResolvedValue('123');
    await expect(revealCardSecret('card-legacy')).resolves.toEqual({cvv:'123'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(method).toBe('POST');
    expect(readLocalCvvMock).toHaveBeenCalledWith('card-legacy');
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
