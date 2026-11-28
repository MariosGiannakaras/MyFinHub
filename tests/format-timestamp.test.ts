import {describe,expect,it} from 'vitest';
import {formatLocalTimestamp} from '../src/lib/formatTimestamp.js';
import {readFileSync} from 'node:fs';
describe('Greek timestamp and transaction entry contracts (#649)',()=>{
  it('does not label unavailable timestamps as recent or emit Invalid Date',()=>{
    for(const value of [undefined,null,'','not-a-date'])expect(formatLocalTimestamp(value)).toBe('Μη διαθέσιμη ημερομηνία');
    const instant='2025-12-15T12:34:56.000Z';
    expect(formatLocalTimestamp(instant)).toBe(new Date(instant).toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
    expect(formatLocalTimestamp(instant)).toContain('2025');
  });
  it('validates direct lending input before creating a finance event',()=>{
    const page=readFileSync('src/pages/LendingPage.tsx','utf8');
    const submit=page.slice(page.indexOf('  const submit='),page.indexOf('  return <div className="page-stack lending-page"'));
    expect(submit).toContain('const numeric=parseMoneyInputAmount(amount)');
    expect(submit.indexOf('if(numeric===null||numeric<=0)')).toBeLessThan(submit.indexOf('createEvent('));
  });
  it('captures immutable synthetic fixture and observed privacy provenance per final screenshot',()=>{
    const source=readFileSync('scripts/final-screenshots-qa.mjs','utf8');
    expect(source).toContain('fixture:{path:evidence.fixturePath,query:evidence.fixtureQuery}');
    expect(source).toContain('privacyControls:evidence.privacyControls');
    expect(source).toContain("sha256:createHash('sha256').update(bytes).digest('hex')");
    expect(source).toContain('if(evidence.theme!==theme)throw new Error');
  });
});
