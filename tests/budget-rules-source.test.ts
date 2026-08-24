import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('src/App.tsx');
const qa=read('src/qa.tsx');
const settings=read('src/pages/SettingsPage.tsx');
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

  it('routes budget state and deep actions through the shared persistence/navigation layer',()=>{
    expect(app).toContain('const upsertBudget=');
    expect(app).toContain('const deleteBudget=');
    expect(app).toContain('const upsertRule=');
    expect(app).toContain('const deleteRule=');
    expect(app).toContain("item.action === 'open_budgets'");
    expect(settings).toContain('<BudgetRuleSettings');
    expect(settings).toContain('onUpsertBudget={onUpsertBudget}');
    expect(attention).toContain("action:'open_budgets'");
  });

  it('keeps the dedicated rendered budget/rules suite in the primary-browser CI chain',()=>{
    expect(rendered).toContain("scripts/budget-rules-qa.mjs");
    expect(rendered).toContain("/tmp/myfinhub-budget-rules-qa-chrome");
  });
});
