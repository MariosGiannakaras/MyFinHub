import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const performanceRoutes = [
  'DashboardPage',
  'TransactionsPage',
  'SavingsPage',
  'CardsPage',
  'CreditCardPage',
  'LoansPage',
  'LendingPage',
  'RecurringPage',
  'PlanningPage',
  'AttentionPage',
  'ReportsPage',
  'SettingsPage',
] as const;

function productionLikeQaLazyRoutes() {
  return {
    name: 'myfinhub-performance-qa-lazy-routes',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.replace(/\\/g, '/').endsWith('/src/qa.tsx')) return null;
      let next = code.replace(
        "import { StrictMode, useEffect, useState } from 'react';",
        "import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';",
      );
      for (const component of performanceRoutes) {
        const source = `import { ${component} } from './pages/${component}';`;
        if (!next.includes(source)) throw new Error(`Performance fixture route import not found: ${component}`);
        next = next.replace(source, `const ${component}=lazy(()=>import('./pages/${component}').then(module=>({default:module.${component}})));`);
      }
      const contentBoundary = "lazyFailure?<Suspense fallback={<PageSkeleton/>}><LazyResourceFailure/></Suspense>:crash?<Crash/>:content";
      const legacyContentBoundary = 'crash?<Crash/>:content';
      if (next.includes(contentBoundary)) {
        next = next.replace(
          contentBoundary,
          "lazyFailure?<Suspense fallback={<PageSkeleton/>}><LazyResourceFailure/></Suspense>:crash?<Crash/>:<Suspense fallback={<PageSkeleton/>}>{content}</Suspense>",
        );
      } else if (next.includes(legacyContentBoundary)) {
        next = next.replace(
          legacyContentBoundary,
          'crash?<Crash/>:<Suspense fallback={<PageSkeleton/>}>{content}</Suspense>',
        );
      } else {
        throw new Error('Performance fixture content boundary not found.');
      }
      return { code: next, map: null };
    },
  };
}

export default defineConfig({
  plugins: [productionLikeQaLazyRoutes(), react()],
  build: {
    outDir: '.performance-dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(process.cwd(), 'qa.html'),
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
