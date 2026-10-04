import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync('scripts/real-stack-browser-e2e.ts','utf8');

describe('actual-browser real-stack source contract',()=>{
  it('uses the real app UI and same-origin API without fetch interception',()=>{
    expect(source).toContain("origin+'/#/transactions'");
    expect(source).toContain("document.querySelector('#login-title')");
    expect(source).toContain("document.querySelector('#mfa-title')");
    expect(source).toContain('[data-global-quick-entry]');
    expect(source).toContain("querySelectorAll('label')");
    expect(source).toContain("wrapper?.querySelector('input,textarea,select')");
    expect(source).toContain("getAttribute('aria-label')===label");
    expect(source).toContain("fetch('/api/data'");
    expect(source).toContain('Page.reload');
    expect(source).not.toContain('globalThis.fetch=');
    expect(source).not.toContain('SUPABASE_ACCESS_TOKEN');
    expect(source).toContain('attempt<=2');
    expect(source).toContain("stdio:['ignore','pipe','pipe']");
    expect(source).toContain('child.exitCode!==null');
    expect(source).toContain('Chromium bootstrap attempt');
    expect(source).toContain('await stopBrowser(child)');
  });
  it('covers modern and legacy durable mutation lifecycles across hard reload',()=>{
    expect(source).toContain('stage modern-create-reload');
    expect(source).toContain('stage modern-edit-delete-undo');
    expect(source).toContain('stage legacy-edit-delete-undo');
    expect(source).toContain('stage credit-purchase-payment-reload');
    expect(source).toContain('Real Browser Credit Purchase');
    expect(source).toContain('waitCreditState(false)');
    expect(source).toContain('waitCreditState(true)');
    expect(source).toContain('stage savings-goal-transfer-reload');
    expect(source).toContain('stage loan-create-reload');
    expect(source).toContain('stage lending-repayment-reload');
    expect(source).toContain('stage recurring-create-pause-reload');
    expect(source).toContain('stage account-create-delete-reload');
    expect(source).toContain('waitRecurringStatus');
    expect(source).toContain('Real Browser Savings Transfer');
    expect(source).toContain('Real Browser Loan');
    expect(source).toContain('Real Browser Repayment');
    expect(source).toContain('Real Browser Recurring');
    expect(source).toContain('Real Browser Temp Cash');
    expect(source).toContain('stage data-management-backup-import');
    expect(source).toContain('Backup & λήψη');
    expect(source).toContain('400 /api/import');
    expect(source).toContain('Imported QA Cash');
    expect(source).toContain('change-history-title');
    expect(source).toContain('Durable modern undo is unavailable after reload.');
    expect(source).toContain('Durable legacy undo is unavailable after reload.');
    expect(source).toContain('actual browser auth + modern/legacy/credit/savings/loans/lending/recurring/accounts/data-management persistence across hard reload');
  });
});
