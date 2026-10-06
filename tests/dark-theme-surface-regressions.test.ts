import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('dark-theme surface regressions',()=>{
  it('keeps Reports privacy placeholders on semantic theme surfaces',()=>{
    const css=read('src/styles/mobile-reports-settings-editors.css');
    expect(css).toContain('.private-report-placeholder');
    expect(css).toContain('background:var(--surface-inset)');
    expect(css).toContain('color:var(--text-secondary)');
    expect(css).not.toContain('.private-report-placeholder{min-height:96px;border-radius:14px;padding:14px;gap:9px;background:#eef4fa');
  });

  it('keeps Dashboard secondary finance text and Reports budget statuses on semantic theme roles',()=>{
    const dashboard=read('src/styles/dashboard-approved-target.css')+read('src/styles/dashboard-desktop-alignment.css');
    const bankmarks=read('src/styles/dashboard-bankmark-chart-attention.css');
    expect(dashboard).toContain('color:var(--text-secondary)');
    expect(dashboard).not.toContain('color:#526987');
    expect(bankmarks).toContain('html[data-theme="dark"] .dashboard-approved .approved-account-icon .bank-brand-mark:is([data-bank-logo-source="local-image"],[data-bank-logo-source="provider-storage"])');
    expect(bankmarks).toContain('background:transparent!important;border:0!important;box-shadow:none!important');

    const reports=read('src/pages/ReportsPage.css');
    expect(reports).toContain('background:var(--success-bg)');
    expect(reports).toContain('background:var(--warning-bg)');
    expect(reports).toContain('background:var(--error-bg)');
  });

  it('keeps Settings icon-management and Rules workspaces on semantic surfaces',()=>{
    const settings=read('src/pages/SettingsPage.css');
    expect(settings).toContain('.settings-icons-only .category-icon-library');
    expect(settings).toContain('background:var(--surface-inset)');
    expect(settings).toContain('.settings-icons-only .category-taxonomy-card');
    expect(settings).toContain('background:var(--surface-2)');

    const rules=read('src/components/TransactionRulesWorkspace.css');
    expect(rules).toContain('.rule-settings-list');
    expect(rules).toContain('background:var(--surface-2)');
    expect(rules).toContain('.rules-builder-section');
    expect(rules).toContain('background:var(--surface-inset)');
    expect(rules).toContain('.rule-preview');
    expect(rules).toContain('background:var(--info-bg)');
  });

  it('keeps access, Credit, Lending, Recurring and Planning data surfaces theme-aware',()=>{
    const access=read('src/components/DeviceAccessSettings.css')+read('src/components/AccountSecuritySettings.css');
    expect(access).toContain('.device-access-empty');
    expect(access).toContain('background:var(--surface-inset)');
    expect(access).toContain('.account-security-pin-input');
    expect(access).toContain('background:var(--control-bg)');

    const credit=read('src/styles/canonical-credit-card-host.css');
    expect(credit).toContain('.credit-card-redesign-page .semantic-table tr');
    expect(credit).toContain('background:var(--surface-2)');

    const lending=read('src/styles/lending-approved-target.css');
    expect(lending).toContain('.lending-metric-grid article');
    expect(lending).toContain('background:var(--surface-2)');
    expect(lending).toContain('.lending-people-search');
    expect(lending).toContain('background:var(--control-bg)');

    const recurring=read('src/styles/recurring-approved-target.css');
    expect(recurring).toContain('background:color-mix(in srgb,var(--accent-soft) 68%,var(--surface))');
    expect(recurring).toContain('background:var(--surface-2)');

    const planning=read('src/styles/planning-approved-target.css');
    expect(planning).toContain('.planning-approved-table tbody td');
    expect(planning).toContain('background:var(--surface-2)');
    expect(planning).toContain('.planning-account-card');
    expect(planning).toContain('background:var(--surface-2)');
  });
});
