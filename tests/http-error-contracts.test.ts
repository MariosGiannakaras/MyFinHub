import { describe, expect, it, vi } from 'vitest';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson, strictQueryValue } from '../server/http.js';
import { readFileSync } from 'node:fs';

function response(){
  const headers=new Map<string,unknown>();
  return {
    statusCode:0,
    payload:null as any,
    setHeader(name:string,value:unknown){headers.set(name.toLowerCase(),value)},
    getHeader(name:string){return headers.get(name.toLowerCase())},
    end(raw:string){this.payload=JSON.parse(raw)},
  };
}

describe('shared HTTP error contracts',()=>{
  it('returns a request id and redacts unexpected 500 details from the client',async()=>{
    const res=response();
    const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
    await handleApi(res,async()=>{throw new Error('database password=secret raw failure')});
    expect(res.statusCode).toBe(500);
    expect(res.getHeader('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.payload).toMatchObject({code:'INTERNAL_ERROR',error:'Unexpected server error.',requestId:res.getHeader('x-request-id')});
    expect(JSON.stringify(res.payload)).not.toContain('password=secret');
    expect(spy).toHaveBeenCalled();
    const logged=JSON.stringify(spy.mock.calls);
    expect(logged).toContain('INTERNAL_ERROR');
    expect(logged).toContain(String(res.getHeader('x-request-id')));
    expect(logged).not.toContain('password=secret');
    expect(logged).not.toContain('raw failure');
    spy.mockRestore();
  });

  it('keeps expected API errors actionable without leaking unrelated details',async()=>{
    const res=response();
    await handleApi(res,async()=>{throw new ApiError(409,'REVISION_CONFLICT','Reload and try again.')});
    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual({error:'Reload and try again.',code:'REVISION_CONFLICT',requestId:res.getHeader('x-request-id')});
  });

  it('includes the handleApi request id on 405 responses and sets Allow',async()=>{
    const res=response();
    await handleApi(res,async()=>methodNotAllowed(res,['GET','PUT']));
    expect(res.statusCode).toBe(405);
    expect(res.getHeader('allow')).toBe('GET, PUT');
    expect(res.payload).toEqual({error:'Method not allowed',code:'METHOD_NOT_ALLOWED',requestId:res.getHeader('x-request-id')});
  });

  it('sets privacy-safe no-store JSON response headers',()=>{
    const res=response();
    sendJson(res,200,{ok:true});
    expect(res.getHeader('content-type')).toBe('application/json; charset=utf-8');
    expect(res.getHeader('cache-control')).toBe('no-store, max-age=0');
    expect(res.getHeader('pragma')).toBe('no-cache');
  });
});

describe('strict query boundaries',()=>{
  it('accepts one string value and rejects ambiguous array/object query shapes',()=>{
    expect(strictQueryValue({query:{resource:' financial-providers '}},'resource')).toBe('financial-providers');
    expect(strictQueryValue({query:{resource:['financial-providers','other']}},'resource')).toBe('');
    expect(strictQueryValue({query:['not-an-object']},'resource')).toBe('');
    expect(strictQueryValue({},'resource')).toBe('');
  });
});

describe('JSON request body boundaries',()=>{
  it('rejects unsupported media types, malformed lengths and oversized bodies',async()=>{
    await expect(readJsonBody({headers:{'content-type':'text/plain'},body:'{}'},32))
      .rejects.toMatchObject({status:415,code:'UNSUPPORTED_MEDIA_TYPE'});
    await expect(readJsonBody({headers:{'content-type':'application/json','content-length':'4x'},body:'{}'},32))
      .rejects.toMatchObject({status:400,code:'INVALID_CONTENT_LENGTH'});
    await expect(readJsonBody({headers:{'content-type':'application/json','content-length':'9007199254740992'},body:'{}'},32))
      .rejects.toMatchObject({status:400,code:'INVALID_CONTENT_LENGTH'});
    await expect(readJsonBody({headers:{'content-type':'application/json','content-length':'64'},body:'{}'},32))
      .rejects.toMatchObject({status:413,code:'PAYLOAD_TOO_LARGE'});
  });

  it('parses string, Buffer and Uint8Array JSON bodies consistently',async()=>{
    expect(await readJsonBody({headers:{'content-type':'application/json'},body:'{"a":1}'},32)).toEqual({a:1});
    expect(await readJsonBody({headers:{'content-type':'application/json'},body:Buffer.from('{"a":2}')},32)).toEqual({a:2});
    expect(await readJsonBody({headers:{'content-type':'application/json'},body:new TextEncoder().encode('{"a":3}')},32)).toEqual({a:3});
  });

  it('rejects invalid or unserializable JSON payloads as 400 rather than accidental 500',async()=>{
    await expect(readJsonBody({headers:{'content-type':'application/json'},body:'{"a":'},64))
      .rejects.toMatchObject({status:400,code:'INVALID_JSON'});
    const circular:any={};circular.self=circular;
    await expect(readJsonBody({headers:{'content-type':'application/json'},body:circular},64))
      .rejects.toMatchObject({status:400,code:'INVALID_JSON'});
  });
});

describe('API routing failure contract',()=>{
  const server=readFileSync(new URL('../server/index.ts',import.meta.url),'utf8');

  it('keeps unknown API paths in JSON 404 handling before static/HTML fallback',()=>{
    const api404=server.indexOf("app.all('/api/{*splat}'");
    const staticFiles=server.indexOf('app.use(express.static');
    expect(api404).toBeGreaterThan(0);
    expect(staticFiles).toBeGreaterThan(api404);
    expect(server).toContain("new ApiError(404, 'API_NOT_FOUND', 'API route not found.')");
    expect(server).not.toContain("app.all('/api/{*splat}', (_req, res) => methodNotAllowed(res, []))");
  });
});


describe('Vercel API 404 routing contract',()=>{
  const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')) as {rewrites:Array<{source:string;destination:string}>};
  const health=readFileSync(new URL('../api/health.ts',import.meta.url),'utf8');

  it('keeps unknown-API JSON routing ahead of the terminal branded web 404',()=>{
    const apiFallback=vercel.rewrites.find(route=>route.source==='/api/(.*)');
    const apiIndex=vercel.rewrites.findIndex(route=>route.source==='/api/(.*)');
    const webIndex=vercel.rewrites.findIndex(route=>route.source==='/(.*)');
    expect(apiFallback).toEqual({source:'/api/(.*)',destination:'/api/health?__myfinhub_route=api-not-found'});
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(webIndex).toBeGreaterThan(apiIndex);
    expect(health).toContain("strictQueryValue(req,'__myfinhub_route') === 'api-not-found'");
    expect(health).toContain("new ApiError(404,'API_NOT_FOUND','API route not found.')");
  });
});
