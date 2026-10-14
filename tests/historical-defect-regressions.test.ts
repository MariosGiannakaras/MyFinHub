import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('historically learned deployment and resilience regressions',()=>{
  it('preserves the independent plain Vercel API function TypeScript toolchain (#9)',()=>{
    const api=JSON.parse(read('api/package.json')) as {devDependencies:Record<string,string>;scripts:Record<string,string>};
    const config=JSON.parse(read('api/tsconfig.json')) as {references?:unknown;compilerOptions?:{module?:string};include?:string[]};
    expect(api.devDependencies.typescript).toMatch(/^5\./);
    expect(api.scripts.check).toContain('tsc -p tsconfig.json --noEmit');
    expect(config.references).toBeUndefined();
    expect(config.compilerOptions?.module).toBe('NodeNext');
    expect(config.include).toContain('../server/**/*.ts');
  });

  it('ties production smoke health identity to the MyFinHub release contract (#142)',()=>{
    const smoke=read('.github/workflows/production-smoke.yml');
    expect(smoke).toContain("assert payload == {'ok': True, 'app': 'MyFinHub'}");
    expect(smoke).toContain("health_status");
    expect(smoke).toContain("Cache-Control");
    expect(smoke).toContain("fra1");
  });

  it('keeps failed lazy page imports behind a recoverable page error boundary (#51)',()=>{
    const app=read('src/App.tsx');
    const boundary=read('src/components/PageErrorBoundary.tsx');
    expect(app).toContain('<PageErrorBoundary resetKey={page}');
    expect(app).toContain('<Suspense fallback={<PageLoading/>}>{content}</Suspense></PageErrorBoundary>');
    expect(boundary).toContain('onDashboard');
    expect(boundary).toContain('componentDidCatch');
  });

  it('uses the same Vercel-safe 4 MiB finance document limit for validation (#18)',()=>{
    const limits=read('src/lib/limits.ts');
    const validation=read('server/validation.ts');
    expect(limits).toContain('MAX_FINANCE_DOCUMENT_BYTES = 4 * 1024 * 1024');
    expect(validation).toContain('MAX_FINANCE_DOCUMENT_BYTES');
    expect(read('tests/validation.test.ts')).toContain('MAX_FINANCE_DOCUMENT_BYTES');
  });
});
