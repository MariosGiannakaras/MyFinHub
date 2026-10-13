import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Historical FinanceSettings.motion is compatibility data, never a UI preference.
const surfaces = [
  'src/pages/LoansPage.tsx',
  'src/pages/CardsPage.tsx',
  'src/pages/CreditCardPage.tsx',
  'src/pages/SavingsPage.tsx',
  'src/pages/PlanningPage.tsx',
  'src/pages/TransactionsPage.tsx',
  'src/components/ReceiptInbox.tsx',
  'src/components/TransactionRulesWorkspace.tsx',
  'src/components/AccountManagementSettings.tsx',
];
const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('legacy motion compatibility is inert', () => {
  it.each(surfaces)('%s does not forward persisted motion metadata to a dialog', (path) => {
    expect(source(path)).not.toMatch(/motionMode\s*=\s*\{[^}]*settings\.motion[^}]*\}/);
  });
  it('retains the OS accessibility override at the shared dialog owner', () => {
    const dialog = source('src/components/DialogShell.tsx');
    expect(dialog).toContain('const systemReduced=useReducedMotion()');
    expect(dialog).toContain('const reduce=Boolean(systemReduced)');
    expect(dialog).not.toContain("motionMode==='reduced'");
  });
});
