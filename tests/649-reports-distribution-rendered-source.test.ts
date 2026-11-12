import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('src/pages/ReportsPage.tsx');
const browser=read('scripts/reports-visual-qa.mjs');
const workflow=read('.github/workflows/fb-focused-rendered-qa.yml');

describe('#649 I14.03 positive-only Reports distribution and responsive copy',()=>{
  it('keeps the canonical cutoff, five highest positive balances, and non-net-worth scope',()=>{
    expect(page).toContain('reportingPeriodEndDate(month,asOf)');
    expect(page).toContain('accountBalances(data,periodEndDate)');
    expect(page).toContain('.filter(row=>row.balance>.005).sort((a,b)=>b.balance-a.balance).slice(0,5)');
    expect(page).toContain('const accountDistributionTotal=accountDistribution.reduce((sum,row)=>sum+row.balance,0)');
    expect(page).toContain('Μεγαλύτερα θετικά υπόλοιπα');
    expect(page).toContain('έως 5 μη πιστωτικοί λογαριασμοί, όχι καθαρή περιουσία');
    expect(page).toContain('Θετικά υπόλοιπα έως σήμερα');
    expect(page).toContain('Θετικά υπόλοιπα στο τέλος της περιόδου');
  });
  it('uses the configured Chromium and fresh isolated loopback launch for the existing focused suite',()=>{
    expect(browser).toContain('MYFINHUB_QA_PRIMARY_BROWSER');
    expect(browser).toContain('createServer');
    expect(browser).toContain("listener.listen(0,'127.0.0.1'");
    expect(browser).toContain('myfinhub-reports-visual-qa-chrome-${port}');
    expect(browser).toContain('rmSync(profile');
    expect(browser).toContain('--disable-dev-shm-usage');
    expect(browser).toContain('Chromium exited before CDP ready');
    expect(browser).toContain('child.stderr');
  });
  it('requires visible captions and captured screenshots at four actual responsive states',()=>{
    expect(browser).toContain('inspectDistribution');
    expect(browser).toContain('detail.xoverflow<=2&&detail.yoverflow<=2');
    expect(browser).toContain('detail.documentOverflow<=2');
    for(const viewport of ['desktop-1440','historical-desktop-1440','tablet-768','mobile-375','mobile-320'])expect(browser).toContain("inspectDistribution('"+viewport+"'");
    expect(browser).toContain('reports-positive-only-distribution-${label}.png');
    expect(browser).toContain("navigate('budget-rules',768,1024,false)");
    expect(workflow).toContain('<!-- run-649-reports-planning-qa -->');
    expect(workflow).toContain("'reports-visual planning-forecast'");
  });
});
