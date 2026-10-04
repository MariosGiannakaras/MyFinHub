import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const directRoutes=[
  ['api/auth/login.ts',["POST"]],
  ['api/auth/logout.ts',["POST"]],
  ['api/auth/mfa/enroll.ts',["POST"]],
  ['api/auth/mfa/verify.ts',["POST"]],
  ['api/backup.ts',["POST"]],
  ['api/data.ts',["GET","PUT"]],
  ['api/health.ts',["GET"]],
  ['api/history.ts',["GET","POST"]],
  ['api/import.ts',["POST"]],
] as const;

const delegatedRoutes=[
  ['api/account-metadata.ts','server/accountMetadataHandler.ts',["GET","PUT","POST","PATCH"]],
  ['api/card-secrets.ts','server/cardVaultHandler.ts',["POST","PUT","DELETE"]],
] as const;

describe('complete API method matrix',()=>{
  it.each(directRoutes)('%s keeps the declared Allow contract', (path,methods)=>{
    const source=read(path);
    const compact=source.replace(/\s+/g,'');
    const expected=`methodNotAllowed(res,[${methods.map(method=>`'${method}'`).join(',')}])`;
    expect(compact).toContain(expected);
  });

  it.each(delegatedRoutes)('%s delegates to a handler with the expected methods', (route,handler,methods)=>{
    const routeSource=read(route);
    const handlerSource=read(handler).replace(/\s+/g,'');
    expect(routeSource).toMatch(/handle[A-Za-z]+Request\(req,\s*res\)/);
    const allowed=methods.every(method=>handlerSource.includes(`'${method}'`));
    expect(allowed).toBe(true);
    expect(handlerSource).toContain('methodNotAllowed(res');
  });

  it('session route keeps GET plus explicit nested security/device action delegation',()=>{
    const source=read('api/auth/session.ts').replace(/\s+/g,'');
    expect(source).toContain("methodNotAllowed(res,['GET'])");
    expect(source).toContain("handleAccountSecurityRequest(req,res)");
    expect(source).toContain("handleDeviceSessionsRequest(req,res)");
  });

  it('unknown API paths stay JSON and precede the terminal branded web 404',()=>{
    const health=read('api/health.ts');
    const vercel=JSON.parse(read('vercel.json')) as {rewrites:Array<{source:string;destination:string;statusCode?:number}>};
    const apiIndex=vercel.rewrites.findIndex(route=>route.source==='/api/(.*)');
    const webIndex=vercel.rewrites.findIndex(route=>route.source==='/(.*)');
    expect(vercel.rewrites[apiIndex]).toEqual({source:'/api/(.*)',destination:'/api/health?__myfinhub_route=api-not-found'});
    expect(apiIndex).toBeGreaterThanOrEqual(0);
    expect(webIndex).toBeGreaterThan(apiIndex);
    expect(vercel.rewrites[webIndex]).toEqual({source:'/(.*)',destination:'/404.html',statusCode:404});
    expect(health).toContain("new ApiError(404,'API_NOT_FOUND','API route not found.')");
    expect(read('server/index.ts')).toContain("app.all('/api/{*splat}'");
  });
});
