import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');
const categoryWorkspace=read('src/components/CategoryIconsWorkspace.tsx');
const budgetRules=read('src/components/BudgetRuleSettings.tsx');
const rules=read('src/components/TransactionRulesWorkspace.tsx');

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

  it('keeps shared Button and IconButton ownership across real budget and Rules surfaces',()=>{
    expect(budgetRules).toContain("from './Button'");
    expect(budgetRules).toContain("from './IconButton'");
    expect(budgetRules.match(/<Button/g)).toHaveLength(2);
    expect(budgetRules.match(/<IconButton/g)).toHaveLength(1);
    expect(budgetRules).toContain('<Button type="button" variant="primary" onClick={saveBudget}>');
    expect(budgetRules).toContain('aria-label={`Διαγραφή προϋπολογισμού');
    expect(budgetRules).not.toContain('onUpsertRule');
    expect(rules).toContain('<Button type="button" variant="primary" disabled={busy} onClick={()=>void saveRule()}>');
    expect(rules).toContain('<Button type="button" variant="secondary" disabled={busy} onClick={dismissEditor}>');
    expect(rules).toContain('className="rule-row-actions"');
    expect(rules).toContain('onReorderRule(rules[index].id,direction)');
    for(const source of [budgetRules,rules]){
      expect(source).not.toContain('<button');
      expect(source).not.toContain('className="save-button"');
      expect(source).not.toContain('className="icon-button"');
    }
  });
});
