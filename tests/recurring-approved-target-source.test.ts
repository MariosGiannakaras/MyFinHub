import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/RecurringPage.tsx',import.meta.url),'utf8');
const linked=readFileSync(new URL('../src/components/LongTermLoanSummary.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/styles/recurring-approved-target.css',import.meta.url),'utf8');
const chain=readFileSync(new URL('../src/styles/part47.css',import.meta.url),'utf8');

describe('approved Recurring desktop target boundary',()=>{
  it('keeps canonical recurring calculations, editor validation and payment/lifecycle handlers',()=>{
    expect(page).toContain('activeRecurringItems(data)');
    expect(page).toContain('inactiveRecurringItems(data)');
    expect(page).toContain('recurringUpcoming(data,asOf)');
    expect(page).toContain('recurringMonthlyTotal(data)');
    expect(page).toContain('recurringDraftError(normalized)');
    expect(page).toContain('recurringAccountError(accountIds,normalized.accountId)');
    expect(page).toContain('onPayRecurring(item.id)');
    expect(page).toContain("setLifecycle(item,'paused')");
    expect(page).toContain("setLifecycle(item,'stopped')");
    expect(page).toContain("setLifecycle(item,'active')");
  });

  it('groups the desktop workspace by canonical category data and keeps shared finance icons',()=>{
    expect(page).toContain('new Set(upcoming.map(row=>row.item.category))');
    expect(page).toContain('data-recurring-group={group.category}');
    expect(page).toContain('kind="expense" category={group.category}');
    expect(page).toContain('kind="expense" note={item.name} category={item.category}');
    expect(page).not.toMatch(/item\.name.*(?:Cosmote|ΔΕΗ|ΕΥΔΑΠ)/);
  });

  it('keeps the linked loan obligation on the canonical loan path',()=>{
    expect(page).toContain('<LongTermLoanSummary data={data} onPayLoan={onPayLoan} onOpenLoans={onOpenLoans}/>');
    expect(linked).toContain('activeLongTermLoanObligations(data)');
    expect(linked).toContain('data-linked-loan={loan.id}');
    expect(linked).toContain('onClick={()=>onPayLoan(loan.id)}');
    expect(linked).toContain('loan.defaultAccountId?accountDisplayName(data,loan.defaultAccountId)');
  });

  it('matches the approved desktop hierarchy without replacing mobile behavior',()=>{
    expect(page).toContain('recurring-approved-heading');
    expect(page).toContain('Επόμενη εκτιμώμενη πληρωμή');
    expect(page).toContain('data-recurring-active-workspace');
    expect(page).toContain('<details className="panel neo-flat inactive-recurring"');
    expect(styles).toContain('@media (min-width:1100px)');
    expect(styles).toContain('.recurring-approved-page>.recurring-summary-grid');
    expect(styles).toContain('.recurring-workspace-table .recurring-group-row th');
    expect(styles).toContain('.recurring-approved-page>.long-term-recurring');
    expect(styles).toContain('@media (max-width:1099px)');
    expect(chain).toContain("@import './recurring-approved-target.css';");
  });
});
