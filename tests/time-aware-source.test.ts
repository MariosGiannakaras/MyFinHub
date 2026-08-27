import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/components/AppShell.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const planning = readFileSync(new URL('../src/pages/PlanningPage.tsx', import.meta.url), 'utf8');
const planningStyles = readFileSync(new URL('../src/styles/part37.css', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../scripts/run-rendered-qa.mjs', import.meta.url), 'utf8');
const qa = readFileSync(new URL('../src/qa.tsx', import.meta.url), 'utf8');

describe('time-aware product integration', () => {
  it('owns a dedicated Planning route in production and synthetic QA', () => {
    expect(shell).toContain("'planning'");
    expect(shell).toContain("label:'Προγραμματισμός'");
    expect(app).toMatch(/page\s*===\s*'planning'/);
    expect(qa).toContain("planning:'Προγραμματισμός & πρόβλεψη ρευστότητας'");
  });

  it('posts scheduled completion as one finance.update recipe containing both scheduled and events state', () => {
    expect(app).toMatch(/const\s+completeScheduled\s*=\s*\([^)]*\)\s*=>\s*finance\.update\(\s*\(current\)\s*=>\s*\{[^]*scheduled:[^]*events:/);
    expect(planning).toContain('onCompleteScheduled(completed, event)');
  });

  it('keeps deterministic forecast language and an accessible text alternative', () => {
    expect(planning).toContain('ντετερμινιστική προβολή');
    expect(planning).toContain('Πρόβλεψη σε κείμενο');
    expect(planning).toContain('Οι εσωτερικές μεταφορές');
  });

  it('surfaces scheduled items on Dashboard without replacing actual transaction entry', () => {
    expect(dashboard).toContain("item.source==='recurring'?'Πάγια':item.source==='loan'?'Δόσεις / Δάνεια':'Προγραμματισμένα'");
    expect(dashboard).toContain('cashFlowForecast(data,asOf,30)');
    expect(dashboard).toContain('onPlanning');
    expect(dashboard).toContain('Νέα κίνηση');
  });

  it('keeps mobile Planning tooltip actions on the real shared Tooltip wrapper and at least 44px', () => {
    expect(planningStyles).toContain('.scheduled-actions .app-tooltip>button');
    expect(planningStyles).not.toContain('.scheduled-actions .tooltip-trigger>button');
    expect(planningStyles).toMatch(/\.scheduled-actions \.app-tooltip>button\{width:44px;height:44px;min-width:44px;min-height:44px/);
  });

  it('runs the dedicated planning lifecycle browser suite in the rendered QA chain', () => {
    expect(runner).toContain('scripts/planning-forecast-qa.mjs');
  });
});