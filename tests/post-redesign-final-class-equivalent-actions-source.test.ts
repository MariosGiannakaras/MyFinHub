import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const button=read('src/components/Button.tsx');
const transactions=read('src/pages/TransactionsPage.tsx');
const reports=read('src/pages/ReportsPage.tsx');

describe('post-redesign final class-equivalent shared actions',()=>{
  it('keeps ghost Button mapped to the canonical text-button hook',()=>{
    expect(button).toContain("ghost:'text-button'");
  });

  it('moves the compact Transactions delete action without changing its effective classes or touch target',()=>{
    expect(transactions).toContain('<Button type="button" variant="ghost" className="danger-text" style={{minHeight:44}} aria-label={`Διαγραφή ${title}`} onClick={()=>askDelete(row)}>');
    expect(transactions).not.toContain('<button type="button" className="text-button danger-text" style={{minHeight:44}}');
    expect(transactions).toContain('<button type="button" aria-label={`Διαγραφή ${title}`} className="danger" onClick={()=>askDelete(row)}>');
    expect(transactions).toContain('<button type="button" aria-label={`Επεξεργασία ${title}`} onClick={()=>edit(row)}>');
  });

  it('moves the Reports visibility toggle while retaining its report-specific hook and pressed semantics',()=>{
    expect(reports).toContain("from '../components/Button'");
    expect(reports).toContain('<Button type="button" variant="ghost" className="report-eye" aria-pressed={accountsVisible} onClick={()=>setAccountsVisible(value=>!value)}>');
    expect(reports).not.toContain('<button type="button" className="text-button report-eye"');
  });
});
