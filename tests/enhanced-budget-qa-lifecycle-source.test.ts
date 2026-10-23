import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('enhanced budget rendered QA owns its CDP connection through completion',()=>{
 it('never closes the socket before the new subcategory rollover and edit test',()=>{
  const source=readFileSync('scripts/budget-rules-qa.mjs','utf8');
  const marker="console.log('Budget/Rules QA: enhanced subcategory budget + rollover + edit')";
  const pivot=source.indexOf(marker);
  expect(pivot).toBeGreaterThan(0);
  expect(source.slice(0,pivot)).not.toContain('c.close()');
  expect(source.slice(pivot)).toContain("await navigate('reports','budget-enhanced',1440,1000)");
  expect(source.slice(pivot)).toContain("await screenshot('reports-subcategory-rollover-mobile')");
  expect(source).toContain("if(name.startsWith('reports-subcategory-rollover-'))");
  expect(source).toContain("row.scrollIntoView({block:'center',behavior:'instant'})");
  expect(source.slice(pivot)).toContain("await screenshot('reports-subcategory-rollover-tablet')");
  expect(source.slice(pivot)).toContain("finally{c?.close();child.kill('SIGTERM')}");
 });
});
