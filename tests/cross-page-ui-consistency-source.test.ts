import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const routedPages=[
  'src/pages/DashboardPage.tsx',
  'src/pages/TransactionsPage.tsx',
  'src/pages/ReviewPage.tsx',
  'src/pages/SavingsPage.tsx',
  'src/pages/CardsPage.tsx',
  'src/pages/CreditCardPage.tsx',
  'src/pages/LoansPage.tsx',
  'src/pages/LendingPage.tsx',
  'src/pages/RecurringPage.tsx',
  'src/pages/PlanningPage.tsx',
  'src/pages/AttentionPage.tsx',
  'src/pages/ReportsPage.tsx',
  'src/pages/SettingsPage.tsx',
];

describe('cross-page UI consistency contracts',()=>{
  it('keeps the application chrome single-sourced in AppShell',()=>{
    const shell=read('src/components/AppShell.tsx');
    expect(shell).toContain('className="sidebar neo-raised"');
    expect(shell).toContain('className="topbar neo-flat"');
    expect(shell).toContain('className="workspace"');
    for(const file of routedPages){
      const source=read(file);
      expect(source,`${file} should not own a sidebar`).not.toContain('className="sidebar');
      expect(source,`${file} should not own a topbar`).not.toContain('className="topbar');
    }
  });

  it('uses the shared page frame across all routed finance/settings surfaces',()=>{
    for(const file of routedPages){
      const source=read(file);
      expect(source,`${file} should use page-stack`).toContain('page-stack');
      expect(source,`${file} should use page-heading`).toContain('page-heading');
    }
    const base=read('src/styles/part1.css');
    const responsive=read('src/styles/part4.css');
    const hardening=read('src/styles/part30.css');
    expect(base).toContain('.page-stack{display:grid');
    expect(base).toContain('.page-heading{display:flex');
    expect(responsive).toContain('.page-heading{align-items:flex-start}');
    expect(hardening).toContain('.page-heading h1{font-size:var(--ux-heading-size)}');
  });

  it('keeps shared theme and interaction states on the common control families',()=>{
    const theme=read('src/lib/theme.ts');
    const hardening=read('src/styles/part30.css');
    expect(theme).toContain('.sidebar nav button.active,.mobile-nav button.active,.primary-action,.save-button');
    expect(theme).toContain('.top-actions button,.icon-button,.settings-actions button,.secondary');
    expect(theme).toContain('input,select,textarea{background-color:var(--control-bg)!important');
    expect(hardening).toContain('button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible');
    expect(hardening).toContain('min-height:44px');
  });

  it('reuses shared modal action/error roles while keeping only a tiny legacy close-control bridge',()=>{
    const main=read('src/main.tsx');
    const baseStyles=read('src/styles.css');
    const approvedChain=read('src/styles/part47.css');
    const consistency=read('src/styles/cross-page-consistency.css');
    const cardDialog=read('src/components/CardCreateDialog.tsx');
    const cards=read('src/pages/CardsPage.tsx');
    expect(baseStyles.trimEnd()).toMatch(/part46\.css';$/);
    expect(approvedChain).not.toContain('cross-page-consistency.css');
    expect(main).toContain("import './styles.css';\nimport './styles/cross-page-consistency.css';");
    for(const source of [cardDialog,cards]){
      expect(source).toContain('icon-button close-picker');
      expect(source).toContain('secondary modal-secondary');
      expect(source).toContain('save-button modal-primary');
      expect(source).toContain('FormError');
    }
    expect(consistency).toContain('.close-picker{');
    expect(consistency).toContain('var(--control-gradient)');
    expect(consistency).toContain('var(--shadow-soft)');
    expect(consistency).not.toContain('.modal-primary{');
    expect(consistency).not.toContain('.modal-secondary,');
    expect(consistency.length).toBeLessThan(700);
  });
});
