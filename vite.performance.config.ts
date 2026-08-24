import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const performanceRoutes = [
  'DashboardPage',
  'TransactionsPage',
  'ReviewPage',
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
      const content = '{crash?<Crash/>:content}';
      if (!next.includes(content)) throw new Error('Performance fixture content boundary not found.');
      next = next.replace(content, '{crash?<Crash/>:<Suspense fallback={<PageSkeleton/>}>{content}</Suspense>}');
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
