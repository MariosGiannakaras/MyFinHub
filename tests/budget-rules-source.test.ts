import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('src/App.tsx');
const qa=read('src/qa.tsx');
const settings=read('src/pages/SettingsPage.tsx');
const reports=read('src/pages/ReportsPage.tsx');
const savings=read('src/pages/SavingsPage.tsx');
const cards=read('src/lib/cards.ts');
const attention=read('src/lib/attention.ts');
const rendered=read('scripts/run-rendered-qa.mjs');

describe('category budget and rule integration source contracts',()=>{
  it('applies rules only to newly submitted events and keeps existing edits explicit',()=>{
    expect(app).toMatch(/const ruledEvent\s*=\s*exists\s*\?\s*event\s*:\s*applyTransactionRules\(current,\s*event\)/);
    expect(app).toContain('prepareCreditStatementEvent(current,ruledEvent)');
    expect(qa).toMatch(/const nextEvent\s*=\s*exists\s*\?\s*event\s*:\s*applyTransactionRules\(current,\s*event\)/);
    expect(app).toContain('const completeScheduled');
    expect(app).toContain('applyTransactionRules(current,event)');
  });

  it('routes budgets, savings target and credit limits to their natural product surfaces while preserving legacy compatibility',()=>{
    expect(app).toContain('const upsertBudget=');
    expect(app).toContain('const deleteBudget=');
    expect(app).toContain('const updateSavingsTarget=');
    expect(app).toContain('const upsertRule=');
    expect(app).toContain('const deleteRule=');
    expect(app).toContain("item.action === 'open_budgets'");
    expect(reports).toContain('<BudgetRuleSettings');
    expect(reports).toContain('budgetMonth={month}');
    expect(reports).toContain('onUpsertBudget={onUpsertBudget}');
    expect(reports).not.toContain('Γενικό budget');
    expect(reports).not.toContain('Ορίζεται από τις Ρυθμίσεις');
    expect(settings).not.toContain("id: 'budgets'");
    expect(settings).not.toContain('settings-legacy-goals');
    expect(settings).not.toContain('Γενικό μηνιαίο budget');
    expect(settings).not.toContain('Στόχος αποταμίευσης %');
    expect(settings).not.toContain('Πιστωτικό όριο');
    expect(savings).toContain('onSavingsTargetChange');
    expect(savings).toContain('Αλλαγή στόχου αποταμίευσης');
    expect(savings).toContain('Στόχος αποταμίευσης %');
    expect(cards).toContain('data.state.settings.creditLimit');
    expect(attention).toContain("action:'open_budgets'");
  });

  it('keeps the dedicated rendered budget/rules suite in the primary-browser CI chain',()=>{
    expect(rendered).toContain("scripts/budget-rules-qa.mjs");
    expect(rendered).toContain("/tmp/myfinhub-budget-rules-qa-chrome");
  });
});