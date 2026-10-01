import { describe, expect, it, vi } from 'vitest';
import { ApiError, handleApi, readJsonBody, requestHeader, requestQueryValue, safeErrorDiagnostic } from '../server/http.js';

function recorder(){
  const headers=new Map<string,unknown>();
  let body='';
  return {
    headers,
    statusCode:0,
    setHeader(name:string,value:unknown){headers.set(name.toLowerCase(),value);},
    end(value?:unknown){body=value===undefined?'':String(value);},
    get body(){return body;},
  };
}

describe('HTTP error and request-metadata contracts',()=>{
  it('accepts only scalar request headers and rejects ambiguous repeated header arrays',()=>{
    expect(requestHeader({headers:{'if-match':'12'}},'if-match')).toBe('12');
    expect(requestHeader({headers:{'if-match':['12','13']}},'if-match')).toBe('');
    expect(requestHeader({headers:{'content-length':['2','2000']}},'content-length')).toBe('');
  });

  it('accepts only scalar query values and rejects ambiguous duplicate parameter shapes',()=>{
    expect(requestQueryValue({query:{resource:' financial-providers '}},'resource')).toBe('financial-providers');
    expect(requestQueryValue({query:{resource:['financial-providers','other']}},'resource')).toBe('');
    expect(requestQueryValue({query:{resource:{value:'financial-providers'}}},'resource')).toBe('');
    expect(requestQueryValue({query:null},'resource')).toBe('');
  });

  it('maps non-serializable direct JSON bodies to a stable INVALID_JSON error',async()=>{
    await expect(readJsonBody({headers:{'content-type':'application/json'},body:1n},100))
      .rejects.toMatchObject({status:400,code:'INVALID_JSON'});
    await expect(readJsonBody({headers:{'content-type':'application/json'},body:Symbol('bad')},100))
      .rejects.toMatchObject({status:400,code:'INVALID_JSON'});
  });

  it('rejects malformed and oversized JSON Content-Length values before parsing',async()=>{
    await expect(readJsonBody({headers:{'content-length':'3x'},body:'{}'},100))
      .rejects.toMatchObject({status:400,code:'INVALID_CONTENT_LENGTH'});
    await expect(readJsonBody({headers:{'content-length':'101'},body:'{}'},100))
      .rejects.toMatchObject({status:413,code:'PAYLOAD_TOO_LARGE'});
    await expect(readJsonBody({headers:{'content-type':'text/plain'},body:'{}'},100))
      .rejects.toMatchObject({status:415,code:'UNSUPPORTED_MEDIA_TYPE'});
  });

  it('redacts common credentials, JWTs and long card-like numbers from diagnostics',()=>{
    const diagnostic=safeErrorDiagnostic(new Error(
      'Bearer secret-token eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.signature sb_secret_abcdef 4111111111111111',
    ));
    expect(diagnostic).toContain('Bearer [REDACTED]');
    expect(diagnostic).toContain('[REDACTED_JWT]');
    expect(diagnostic).toContain('[REDACTED_SUPABASE_KEY]');
    expect(diagnostic).toContain('[REDACTED_NUMBER]');
    expect(diagnostic).not.toContain('secret-token');
    expect(diagnostic).not.toContain('4111111111111111');
  });

  it('returns stable public 500 output with request id and keeps raw internal details out of the client response',async()=>{
    const res=recorder();
    const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
    await handleApi(res,async()=>{throw new Error('database password=private-value');});
    expect(res.statusCode).toBe(500);
    const payload=JSON.parse(res.body);
    expect(payload).toMatchObject({code:'INTERNAL_ERROR',error:'Unexpected server error.'});
    expect(typeof payload.requestId).toBe('string');
    expect(res.headers.get('x-request-id')).toBe(payload.requestId);
    expect(res.body).not.toContain('private-value');
    spy.mockRestore();
  });

  it('preserves explicit safe API errors while attaching request ids',async()=>{
    const res=recorder();
    await handleApi(res,async()=>{throw new ApiError(409,'REVISION_CONFLICT','Reload and try again.');});
    expect(res.statusCode).toBe(409);
    const payload=JSON.parse(res.body);
    expect(payload.code).toBe('REVISION_CONFLICT');
    expect(payload.error).toBe('Reload and try again.');
    expect(typeof payload.requestId).toBe('string');
  });
});
