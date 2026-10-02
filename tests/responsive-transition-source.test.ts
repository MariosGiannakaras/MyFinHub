import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const qa=readFileSync(new URL('../scripts/responsive-transition-qa.mjs',import.meta.url),'utf8');
const runner=readFileSync(new URL('../scripts/run-rendered-qa.mjs',import.meta.url),'utf8');

describe('responsive transition QA source contract',()=>{
  it('covers portrait/landscape resize transitions and keyboard-height containment',()=>{
    expect(qa).toContain("await viewport(1112,834,false)");
    expect(qa).toContain("await viewport(812,375,true)");
    expect(qa).toContain("await viewport(375,500,true)");
    expect(qa).toContain("focused Quick Entry control remains visible at keyboard height");
    expect(qa).toContain("horizontal overflow");
  });
  it('runs inside the rendered QA gate',()=>{
    expect(runner).toContain("scripts/responsive-transition-qa.mjs");
  });
});
