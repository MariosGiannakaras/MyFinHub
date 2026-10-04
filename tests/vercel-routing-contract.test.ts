import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('Vercel production routing contract',()=>{
  it('keeps API compatibility rewrites ahead of a terminal branded HTTP 404 fallback',()=>{
    const config=JSON.parse(read('vercel.json')) as {
      rewrites?:Array<{source:string;destination:string;statusCode?:number}>
    };
    const rewrites=config.rewrites??[];
    expect(rewrites).toEqual(expect.arrayContaining([
      {source:'/api/android-update',destination:'/api/data?__myfinhub_route=android-update'},
      {source:'/api/auth/account',destination:'/api/auth/session?__myfinhub_route=account'},
      {source:'/api/auth/devices',destination:'/api/auth/session?__myfinhub_route=devices'},
      {source:'/api/(.*)',destination:'/api/health?__myfinhub_route=api-not-found'},
    ]));
    expect(rewrites.at(-1)).toEqual({
      source:'/(.*)',
      destination:'/404.html',
      statusCode:404,
    });
    expect(rewrites.findIndex(route=>route.source==='/api/(.*)')).toBeLessThan(rewrites.length-1);
  });

  it('ships a privacy-safe branded static 404 document for the terminal fallback',()=>{
    const notFound=read('public/404.html');
    expect(notFound).toContain('<title>404 · MyFinHub</title>');
    expect(notFound).toContain('404 · MYFINHUB');
    expect(notFound).toContain('Χάσαμε τη διαδρομή, όχι τα δεδομένα σου.');
    expect(notFound).toContain('Δεν εμφανίζονται οικονομικά στοιχεία');
    expect(notFound).toContain('href="/#/dashboard"');
    expect(notFound).not.toMatch(/sb_secret_|service_role|Bearer\s+/i);
  });

  it('keeps deployed smoke verification for real 404 status + branded HTML',()=>{
    const smoke=read('.github/workflows/production-smoke.yml');
    expect(smoke).toContain("unknown_status=\"$(fetch_path '/__myfinhub-unknown-route-probe' unknown)\"");
    expect(smoke).toContain("[[ \"$unknown_status\" == '404' ]]");
    expect(smoke).toContain("Expected branded MyFinHub HTML 404");
    expect(smoke).toContain("content-type");
  });
});
