import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');
const categoryWorkspace=read('src/components/CategoryIconsWorkspace.tsx');
const budgetRules=read('src/components/BudgetRuleSettings.tsx');

describe('Stage 2 settings shared Button adoption batch 10',()=>{
  it('keeps explicit taxonomy save actions on the shared Button while preserving composite row controls',()=>{
    expect(categoryWorkspace).toContain("from './Button'");
    expect(categoryWorkspace).toContain('<Button type="button" variant="primary" onClick={addCategory}>');
    expect(categoryWorkspace).toContain('<Button type="button" variant="primary" onClick={saveEdit}>');
    expect(categoryWorkspace).toContain('<Button type="button" variant="primary" onClick={saveMove}>');
    expect(categoryWorkspace).toContain('className="taxonomy-row-actions"');
    expect(categoryWorkspace).toContain('<button type="button" disabled={categoryIndex===0}');
    expect(categoryWorkspace).toContain('<button type="button" aria-label={categoryRenameLabel}');
  });

  it('uses shared Buttons and IconButtons for generic budget/rule actions while preserving semantics',()=>{
    expect(budgetRules).toContain("from './Button'");
    expect(budgetRules).toContain("from './IconButton'");
    expect(budgetRules.match(/<Button/g)).toHaveLength(4);
    expect(budgetRules.match(/<Button[^>]+variant="primary"/g)).toHaveLength(2);
    expect(budgetRules.match(/<Button[^>]+variant="secondary"/g)).toHaveLength(2);
    expect(budgetRules.match(/<IconButton/g)).toHaveLength(5);
    expect(budgetRules).not.toContain('<button');
    expect(budgetRules).toContain('<Button type="button" variant="primary" onClick={saveBudget}>');
    expect(budgetRules).toContain('<Button type="button" variant="secondary" onClick={resetRule}>Ακύρωση επεξεργασίας</Button>');
    expect(budgetRules).toContain('<Button type="button" variant="primary" onClick={saveRule}>');
    expect(budgetRules).toContain('<Button type="button" variant="secondary" onClick={()=>onUpsertRule({...rule,enabled:!rule.enabled,updatedAt:now()})}>');
    expect(budgetRules).not.toContain('className="save-button"');
    expect(budgetRules).not.toContain('className="icon-button"');
    expect(budgetRules).toContain('aria-label={`Διαγραφή προϋπολογισμού');
    expect(budgetRules).toContain('className="rule-row-actions"');
  });
});
