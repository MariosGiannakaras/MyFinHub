import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const headingCss=read('src/styles/workspace-heading-metrics.css');
const cards=read('src/pages/CardsPage.tsx');
const credit=read('src/pages/CreditCardPage.tsx');
const loans=read('src/pages/LoansPage.tsx');

describe('post-redesign heading action layout ownership',()=>{
  it('restores the canonical grouped heading action container contract',()=>{
    expect(headingCss).toContain('.heading-actions{display:flex;gap:8px}');
  });

  it('keeps grouped finance heading actions on the shared container without route markup churn',()=>{
    expect(cards).toContain('className="heading-actions"');
    expect(credit).toContain('className="heading-actions"');
    expect(loans).toContain('className="heading-actions"');
  });
});
