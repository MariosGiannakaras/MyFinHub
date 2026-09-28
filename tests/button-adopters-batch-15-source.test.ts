import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const dashboard=read('src/pages/DashboardPage.tsx');
const attention=read('src/pages/AttentionPage.tsx');
const budgets=read('src/components/BudgetRuleSettings.tsx');
const rules=read('src/components/TransactionRulesWorkspace.tsx');
const confirmation=read('src/components/LegacyConfirmationPanel.tsx');

describe('Stage 2 Button/IconButton adopters batch 15',()=>{
  it('migrates the Dashboard privacy action to shared Button without changing its approved hook',()=>{
    expect(dashboard).toContain("import { Button } from '../components/Button';");
    expect(dashboard).toContain('<Button type="button" variant="secondary" className="privacy-toggle"');
    expect(dashboard).not.toContain('<button type="button" className="secondary privacy-toggle"');
  });

  it('migrates all four Attention canonical-hook actions while preserving domain-specific row controls',()=>{
    expect(attention).toContain("import { Button } from '../components/Button';");
    expect(attention.match(/<Button type="button" variant="secondary" className="privacy-toggle"/g)?.length).toBe(2);
    expect(attention.match(/<Button type="button" variant="primary" className="compact"/g)?.length).toBe(2);
    expect(attention).not.toContain('className="secondary privacy-toggle"');
    expect(attention).not.toContain('className="save-button compact"');
    expect(attention).toContain('className="attention-approved-icon-action"');
  });

  it('migrates six BudgetRuleSettings canonical-hook row actions and keeps existing shared editor actions',()=>{
    expect(budgets).toContain("import { IconButton } from './IconButton';");
    expect(budgets).toContain('<IconButton aria-label={`Διαγραφή προϋπολογισμού');
    expect(budgets).toContain('<IconButton aria-label={`Μετακίνηση αυτοματισμού ${rule.name} προς τα πάνω`}');
    expect(budgets).toContain('<IconButton aria-label={`Μετακίνηση αυτοματισμού ${rule.name} προς τα κάτω`}');
    expect(budgets).toContain('<Button type="button" variant="secondary" onClick={()=>onUpsertRule');
    expect(budgets).toContain('<IconButton aria-label={`Επεξεργασία αυτοματισμού ${rule.name}`}');
    expect(budgets).toContain('<IconButton aria-label={`Διαγραφή αυτοματισμού ${rule.name}`}');
    expect(budgets).not.toMatch(/<button\b[^>]*className="icon-button"/);
    expect(budgets).not.toMatch(/<button\b[^>]*className="secondary"/);
  });

  it('migrates ten TransactionRulesWorkspace canonical-hook actions to shared primitives',()=>{
    expect(rules).toContain("import { Button } from './Button';");
    expect(rules).toContain("import { IconButton } from './IconButton';");
    expect(rules.match(/<IconButton\b/g)?.length).toBe(5);
    expect(rules.match(/<Button\b/g)?.length).toBe(5);
    expect(rules).toContain('<Button type="button" variant="primary" className="rules-new-button"');
    expect(rules).toContain('<Button type="button" variant="secondary" onClick={()=>clearEditor(false)}>Ακύρωση</Button>');
    expect(rules).toContain('<Button type="button" variant="primary" onClick={saveRule}>');
    expect(rules).not.toMatch(/<button\b[^>]*className="(?:save-button|secondary|icon-button)/);
  });

  it('migrates the three generic LegacyConfirmationPanel split-dialog actions and leaves semantic review actions raw',()=>{
    expect(confirmation).toContain("import { Button } from './Button';");
    expect(confirmation).toContain("import { IconButton } from './IconButton';");
    expect(confirmation).toContain('<IconButton aria-label="Κλείσιμο επεξεργασίας διαχωρισμού"');
    expect(confirmation).toContain('<Button type="button" variant="secondary" onClick={()=>setParts');
    expect(confirmation).toContain('<Button type="button" variant="primary" disabled={!splitValid}');
    expect(confirmation).not.toContain('className="icon-button" aria-label="Κλείσιμο επεξεργασίας διαχωρισμού"');
    expect(confirmation).toContain('className="review-buttons"');
    expect(confirmation).toContain('className="approve"');
    expect(confirmation).toContain('className="danger"');
  });
});
