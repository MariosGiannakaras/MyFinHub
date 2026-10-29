import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const planning=read('src/components/PlanningApprovedDesktop.tsx');
const savings=read('src/pages/SavingsPage.tsx');
const reports=read('src/pages/ReportsPage.tsx');
const reportsCss=read('src/pages/ReportsPage.css');
const credit=read('src/pages/CreditCardPage.tsx');
const provider=read('src/components/FinancialProviderManagementSettings.tsx');
const providerCss=read('src/components/FinancialProviderManagementSettings.css');
const theme=read('src/lib/theme.ts');

describe('v2.1 audit presentation regression contracts (#646)',()=>{
  it('makes the current portfolio baseline visible, retains projected values and avoids redundant negative signs',()=>{
    expect(planning).toContain('className="planning-current-portfolio"');
    expect(planning).toContain('money.format(forecasts[30].currentPortfolio)');
    expect(planning).not.toContain('<span className="sr-only">Τρέχουσα συνολική ρευστότητα');
    expect(planning).toContain("percentLabel(Math.abs(change)).replace(/^\\+/,\"\")");
  });

  it('renders constant-value sparklines at mid-height rather than the zero-baseline edge',()=>{
    expect(planning).toContain('if(max===min)return values.map((_,index)=>`${(index/denominator)*100},16`)');
    expect(planning).toContain('const spread=max-min;');
  });

  it('does not substitute monthly savings flow for the common goal balance',()=>{
    expect(savings).toContain('<span>Κοινό υπόλοιπο</span><span>Ποσό στόχου</span>');
    expect(savings).toContain('Αποταμίευση μήνα: {money.format(flow.saving)}');
    expect(savings).toContain('<strong>{money.format(savingsBalance)}</strong><strong>{targetTotal');
  });

  it('uses period-aware recurring lookup while retaining historic-month semantics',()=>{
    expect(reports).toContain('referenceDate=month===asOf.slice(0,7)?asOf:`${month}-01`');
    expect(reports).toContain('recurringUpcoming(data,referenceDate)');
    expect(reports).toContain('},[data,loanBurden.rows,month,asOf])');
    expect(reports).toContain("'Υποχρεώσεις περιόδου'");
    expect(reports).toContain("'Επερχόμενες υποχρεώσεις'");
  });

  it('formats report percentages with the Greek locale, including percentage-point comparisons',()=>{
    expect(reports).toContain("(value*100).toLocaleString('el-GR',{minimumFractionDigits:digits,maximumFractionDigits:digits})");
    expect(reports).toContain("(row.value*100).toLocaleString('el-GR',{minimumFractionDigits:1,maximumFractionDigits:1})");
  });

  it('labels the selected credit card limit without altering portfolio math',()=>{
    expect(credit).toContain('Όριο επιλεγμένης κάρτας {money.format(limit)}');
    expect(credit).not.toContain('Συνολικό όριο {money.format(limit)}');
    expect(reportsCss).toContain('.report-credit-portfolio-card>div{display:grid;gap:5px;min-width:0}');
  });

  it('uses explicit report-entry copy targets rather than brittle nested span indices',()=>{
    expect(reports.match(/className="report-entry-copy"/g)).toHaveLength(2);
    expect(reportsCss).toContain('.report-counterparty-list .report-entry-copy');
    expect(reportsCss).toContain('.report-income-list .report-entry-copy');
    expect(reportsCss).not.toContain('.report-counterparty-list>div>span:nth-of-type(2)');
    expect(reportsCss).not.toContain('.report-income-list>div>span:nth-of-type(2)');
  });

  it('keeps provider list readable and reserves provider IDs for editing',()=>{
    expect(provider).toContain('className="provider-list-summary"');
    expect(provider).toContain('<span>{kindLabel(provider.kind)}</span>');
    expect(provider).not.toContain('{kindLabel(provider.kind)} · {provider.id}');
    expect(provider).toContain('className="provider-id-field"');
    expect(providerCss).toContain('.provider-list-summary{display:inline-flex;align-items:center;gap:10px');
    expect(providerCss).toContain('.provider-management-head{align-items:center}');
  });

  it('uses a destructive theme token without changing the confirmed solid-red dialog action',()=>{
    expect(theme).toContain('.save-button{background:var(--accent-gradient)!important');
    expect(theme).toContain('.save-button.destructive-action{background:var(--error-bg)!important');
    expect(theme).toContain('.save-button.destructive-action{background:var(--error-bg)!important');
    expect(theme).toContain('.app-confirm-dialog .save-button.destructive-action');
    expect(theme).toContain('background:var(--red)!important;color:var(--white)!important');
  });
});
