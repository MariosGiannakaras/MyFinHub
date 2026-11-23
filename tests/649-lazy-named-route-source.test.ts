import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('#649 lazy route name provenance and eager bundle regression',()=>{
  it('retains typed lazy imports without making finance pages eager',()=>{
    const app=readFileSync('src/App.tsx','utf8');
    expect(app).toContain('function namedLazy<Module extends object, Name extends keyof Module>');
    expect(app).toContain('Extract<Module[Name],ComponentType<any>>');
    for(const name of [
      'DashboardPage','TransactionsPage','SavingsPage','CardsPage',
      'CreditCardPage','LoansPage','RecurringPage','LendingPage',
      'PlanningPage','AttentionPage','SettingsPage',
    ])expect(app).toContain(`namedLazy(() => import('./pages/${name}'), '${name}')`);
    for(const name of ['ReceiptCleanupNotice','CommandPalette','ContextualQuickAdd'])
      expect(app).toContain(`namedLazy(() => import('./components/${name}'), '${name}')`);
    for(const name of ['PersistenceNotice','ConfirmDialog','ReportsPage','NotFoundPage'])
      expect(app).toContain(`const ${name} = lazy(() => import(`);
    expect(app).not.toContain("import { DashboardPage } from './pages/DashboardPage'");
  });
});
