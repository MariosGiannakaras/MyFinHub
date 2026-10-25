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
      // QA and Production must load the same real pages. The performance
      // fixture is an audit of committed QA routing, not a separate rewriter:
      // altering only the measured build could conceal regressions in Chromium
      // rendered QA and make its first-paint evidence incomparable.
      if (!code.includes("import { DashboardPage } from './pages/DashboardPage';"))
        throw new Error('Performance fixture eagerly rendered Dashboard is missing.');
      for (const component of performanceRoutes) {
        if (component === 'DashboardPage') continue;
        const dynamicImport = `const ${component}=lazy(()=>import('./pages/${component}').then(module=>({default:module.${component}})));`;
        if (!code.includes(dynamicImport))
          throw new Error(`QA route is not production-lazy: ${component}`);
        if (!code.includes(`<${component} `))
          throw new Error(`QA route is not reachable: ${component}`);
      }
      if (!code.includes('<Suspense fallback={<PageSkeleton/>}>') ||
          !code.includes('<PageErrorBoundary resetKey={page}'))
        throw new Error('QA route loading/error boundary missing.');
      return null;
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
