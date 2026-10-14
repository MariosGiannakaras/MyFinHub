import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const appShell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const reports=readFileSync(new URL('../src/pages/ReportsPage.tsx',import.meta.url),'utf8');
const dashboardCharts=readFileSync(new URL('../src/components/DashboardRecharts.tsx',import.meta.url),'utf8');
const commandStyles=readFileSync(new URL('../src/styles/command-palette-contextual-entry.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8')) as {name:string;short_name:string;start_url:string;display:string;icons:Array<{src:string;sizes:string;type:string;purpose:string}>};
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')) as {scripts:Record<string,string>};
const desktopPkg=JSON.parse(readFileSync(new URL('../desktop/package.json',import.meta.url),'utf8')) as {scripts:Record<string,string>};
const desktopAuditPolicy=readFileSync(new URL('../desktop/audit-policy.mjs',import.meta.url),'utf8');
const budget=readFileSync(new URL('../scripts/bundle-budget.mjs',import.meta.url),'utf8');
const privacyArtifactGuard=readFileSync(new URL('../scripts/privacy-artifact-guard.mjs',import.meta.url),'utf8');
const webkitWorkflow=readFileSync(new URL('../.github/workflows/cross-engine-smoke.yml',import.meta.url),'utf8');
const webkitSmoke=readFileSync(new URL('../scripts/webkit-smoke.mjs',import.meta.url),'utf8');
const performanceWorkflow=readFileSync(new URL('../.github/workflows/performance-smoke.yml',import.meta.url),'utf8');
const performanceAudit=readFileSync(new URL('../scripts/performance-audit.mjs',import.meta.url),'utf8');
const loadingShiftAudit=readFileSync(new URL('../scripts/loading-shift-audit.mjs',import.meta.url),'utf8');
const performanceConfig=readFileSync(new URL('../vite.performance.config.ts',import.meta.url),'utf8');
const desktopWorkflow=readFileSync(new URL('../.github/workflows/desktop-windows.yml',import.meta.url),'utf8');
const cleanLaunchWorkflow=readFileSync(new URL('../.github/workflows/desktop-clean-launch.yml',import.meta.url),'utf8');

describe('release-readiness source contracts',()=>{
  it('keeps large feature pages route-lazy and chart code out of the eager app shell',()=>{
    const lazyPages=[...app.matchAll(/const\s+\w+Page\s*=\s*lazy\(\(\)\s*=>\s*import\('\.\/pages\//g)];
    expect(lazyPages.length).toBeGreaterThanOrEqual(12);
    expect(app).toContain("const ReportsPage = lazy(() => import('./pages/ReportsPage')");
    expect(app).not.toContain("from 'recharts'");
    expect(reports).toContain("from 'recharts'");
    expect(dashboardCharts).toContain('ResponsiveContainer');
    expect(dashboardCharts.match(/<ResponsiveContainer/g)?.length).toBe(3);
    expect(dashboardCharts).not.toContain('<PieChart responsive');
    expect(dashboardCharts).not.toContain('<BarChart responsive');
  });

  it('enforces explicit main, chart and CSS bundle budgets after every production build',()=>{
    expect(pkg.scripts.build).toContain('node scripts/bundle-budget.mjs');
    expect(budget).toContain("label:'main application JS'");
    expect(budget).toContain("label:'chart JS'");
    expect(budget).toContain("label:'eager application CSS'");
    expect(budget).toContain("label:'total application CSS'");
    expect(budget).toContain("raw:256*1024,gzip:46*1024");
    expect(budget).toContain("raw:520*1024,gzip:100*1024");
  });

  it('reruns Windows package validation when root production-build inputs change',()=>{
    expect(pkg.scripts.prebuild).toContain('scripts/sync-ocr-assets.mjs');
    expect(pkg.scripts.build).toContain('tsc -b');
    expect(pkg.scripts.build).toContain('vite build');
    expect(pkg.scripts.build).toContain('scripts/bundle-budget.mjs');
    expect(desktopWorkflow).toContain('run: npm run build');
    expect(desktopWorkflow).toContain('run: npm run desktop:pack:from-dist');
    expect(desktopWorkflow).toContain('run: npm run desktop:dist:from-dist');
    expect(cleanLaunchWorkflow).toContain('run: npm run desktop:dist');
    const required=['vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','scripts/sync-ocr-assets.mjs','scripts/bundle-budget.mjs'];
    for(const path of required){
      expect(desktopWorkflow.split(`- ${path}`).length-1).toBeGreaterThanOrEqual(2);
      expect(cleanLaunchWorkflow.split(`- ${path}`).length-1).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps browser/PWA identity consistently MyFinHub with resolvable install icons',()=>{
    expect(manifest.name).toBe('MyFinHub');
    expect(manifest.short_name).toBe('MyFinHub');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(index).toContain('<title>MyFinHub</title>');
    expect(index).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(index).toContain('href="/brand/favicon-light.svg"');
    expect(index).toContain('href="/brand/favicon-dark.svg"');
    for(const icon of manifest.icons){
      expect(icon.src.startsWith('/brand/')).toBe(true);
      expect(existsSync(new URL(`../public${icon.src}`,import.meta.url))).toBe(true);
    }
    expect(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.type==='image/png')).toBe(true);
    expect(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.type==='image/png'&&icon.purpose==='any')).toBe(true);
    expect(manifest.icons.some(icon=>icon.sizes==='any'&&icon.type==='image/svg+xml'&&icon.purpose==='any')).toBe(true);
    expect(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.purpose==='maskable')).toBe(true);
    expect(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable')).toBe(true);
    const svg=readFileSync(new URL('../public/brand/icon-512.svg',import.meta.url),'utf8');
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="512"');
    expect(svg).toContain('viewBox="0 0 512 512"');
  });

  it('keeps one visible global Quick Add route per form factor without a floating mobile overlay',()=>{
    const mobileShell=readFileSync(new URL('../src/styles/mobile-app-shell.css',import.meta.url),'utf8');
    const responsive=readFileSync(new URL('../src/styles/root-responsive-coordination.css',import.meta.url),'utf8');
    expect(appShell).not.toContain('className="command-pill"');
    expect(appShell).toContain('data-global-quick-entry="desktop"');
    expect(appShell).toContain('className="mobile-nav-quick"');
    expect(appShell).toContain('data-global-quick-entry="mobile"');
    expect(appShell).not.toContain('className="mobile-quick-action"');
    expect(appShell).not.toContain("page!=='settings'");
    expect(appShell).not.toContain('genericEntry');
    expect(commandStyles).not.toContain('.mobile-quick-action{');
    expect(responsive).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(mobileShell).toContain('.mobile-nav .mobile-nav-quick');
    expect(mobileShell).toContain('padding-bottom:calc(94px + env(safe-area-inset-bottom,0px))');
  });

  it('keeps WebKit compatibility coverage isolated, pinned and intentionally small',()=>{
    expect(webkitWorkflow).toContain('playwright@1.62.1');
    expect(webkitWorkflow).toContain('TOOL_ROOT=/tmp/myfinhub-playwright-tool');
    expect(webkitWorkflow).toContain('install --with-deps webkit');
    expect(webkitWorkflow).toContain('node scripts/webkit-smoke.mjs');
    expect(webkitWorkflow).not.toContain('npm run qa:frontend');
    expect(webkitWorkflow).not.toContain('playwright@latest');
    expect(webkitSmoke).toContain("import { webkit } from 'playwright'");
    expect(webkitSmoke).toContain("?screen=login");
    expect(webkitSmoke).toContain("?screen=mfa");
    expect(webkitSmoke).toContain("getByRole('combobox',{name:'Λογαριασμός'})");
    expect(webkitSmoke).toContain("getByLabel('Ημερομηνία')");
    expect(webkitSmoke).toContain('WebKit QA Expense');
    expect(webkitSmoke).toContain("name:'Αναίρεση τελευταίας αλλαγής'");
    expect(webkitSmoke).toContain("width:390,height:844");
  });

  it('keeps Lighthouse performance evidence pinned, production-mode and preserves the all-route loading-shift boundary',()=>{
    expect(performanceWorkflow).toContain('lighthouse@13.4.1');
    expect(performanceWorkflow).not.toContain('lighthouse@latest');
    expect(performanceWorkflow).toContain('vite build --config vite.performance.config.ts --mode production');
    expect(performanceWorkflow).toContain('MYFINHUB_LIGHTHOUSE_BIN: /tmp/myfinhub-lighthouse-tool/node_modules/.bin/lighthouse');
    expect(performanceWorkflow).toContain('node scripts/performance-audit.mjs');
    expect(performanceWorkflow).toContain('node scripts/loading-shift-audit.mjs');
    expect(performanceWorkflow).not.toContain('npm run qa:frontend');
    expect(performanceConfig).toContain("outDir: '.performance-dist'");
    expect(performanceConfig).toContain("input: resolve(process.cwd(), 'qa.html')");
    expect(performanceAudit).toContain("id:'desktop-dashboard'");
    expect(performanceAudit).toContain("id:'desktop-reports'");
    expect(performanceAudit).toContain("id:'mobile-dashboard'");
    expect(performanceAudit).toContain("id:'mobile-extreme'");
    expect(performanceAudit).toContain('largest-contentful-paint');
    expect(performanceAudit).toContain('cumulative-layout-shift');
    expect(performanceAudit).toContain('total-blocking-time');
    expect(performanceAudit).toContain("--only-categories=performance,accessibility,best-practices");
    expect(performanceAudit).toContain('state=extreme');
    expect(performanceAudit).toContain("MYFINHUB_LIGHTHOUSE_RUNS||'3'");
    expect(performanceAudit).toContain("MYFINHUB_LIGHTHOUSE_LAUNCH_RETRIES||'1'");
    expect(performanceAudit).toContain('waiting for dynamic debugging port in chrome-err\\.log');
    expect(performanceAudit).toContain('transient Lighthouse launcher failure; retrying');
    expect(performanceAudit).toContain('median(samples.map');
    expect(loadingShiftAudit).toContain("PerformanceObserver");
    expect(loadingShiftAudit).toContain("type:'layout-shift'");
    expect(loadingShiftAudit).toContain("'.qa-loading-route'");
    expect(loadingShiftAudit).toContain("const pages=['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings']");
    expect(loadingShiftAudit).toContain("{name:'desktop',width:1280,height:900,mobile:false}");
    expect(loadingShiftAudit).toContain("{name:'mobile',width:375,height:812,mobile:true}");
    expect(loadingShiftAudit).toContain('assert(cls<=0.10');
  });

  it('keeps a release-artifact privacy scan in the production build',()=>{
    expect(pkg.scripts.build).toContain('node scripts/privacy-artifact-guard.mjs');
    expect(pkg.scripts.build.indexOf('privacy-artifact-guard.mjs')).toBeGreaterThan(pkg.scripts.build.indexOf('vite build'));
    expect(privacyArtifactGuard).toContain("'SUPABASE_SECRET_KEY'");
    expect(privacyArtifactGuard).toContain("'SUPABASE_SERVICE_ROLE_KEY'");
    expect(privacyArtifactGuard).toContain("'CARD_VAULT_KEY'");
    expect(privacyArtifactGuard).toContain("possible payment-card PAN ending");
    expect(privacyArtifactGuard).toContain("Release privacy artifact guard passed.");
  });


  it('keeps the desktop dependency audit exception narrow and self-expiring',()=>{
    expect(desktopPkg.scripts.audit).toBe('node audit-policy.mjs');
    expect(desktopAuditPolicy).toContain("const allowedAdvisory='GHSA-ch52-4w7c-c8xp'");
    expect(desktopAuditPolicy).toContain("const blockedSeverities=new Set(['high','critical'])");
    expect(desktopAuditPolicy).toContain('process.env.npm_execpath');
    expect(desktopAuditPolicy).toContain("process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'npm'");
    expect(desktopAuditPolicy).toContain("if(blocking.length)");
    expect(desktopAuditPolicy).toContain("process.exit(1)");
    expect(desktopAuditPolicy).not.toContain('--force');
  });

});
