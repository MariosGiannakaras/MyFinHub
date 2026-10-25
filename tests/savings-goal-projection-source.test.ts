import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('savings goal forecast is advisory, shared-first and responsive (#588 #13)',()=>{
  it('keeps realized finance saves separate from read-only hypothetical goal scenarios',()=>{
    const source=readFileSync('src/pages/SavingsPage.tsx','utf8');
    const panel=readFileSync('src/components/SavingsGoalProjectionPanel.tsx','utf8');
    const browser=readFileSync('scripts/savings-remediation-qa.mjs','utf8');
    expect(source).toContain('const [projectionGoalId,setProjectionGoalId]');
    expect(source).toContain('asOf={periodEndDate}');
    expect(source).toContain('aria-expanded={projectionGoalId===goal.id}');
    expect(panel).toContain('savingsGoalProjection(data,goal,asOf,customValue)');
    expect(panel).toContain('<MoneyInput');
    expect(panel).not.toContain('onCreate(');
    expect(panel).not.toContain('onUpsertGoal(');
    expect(panel).toContain('Το υπόλοιπο αποταμίευσης είναι κοινό σε όλους τους στόχους');
    expect(browser).toContain('savings-goal-projection-desktop');
    expect(browser).toContain('savings-goal-projection-mobile');
    expect(browser).toContain('savings-goal-projection-mobile-scenarios');
    expect(browser).toContain("desktop projection is present and can be brought into the viewport");
    expect(browser).toContain('mobile hypothetical scenarios visible in viewport');
    expect(browser).toContain('editable hypothetical contribution does not post finance events');
  });
});
