import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const statements=readFileSync(new URL('../src/lib/creditStatements.ts',import.meta.url),'utf8');

describe('credit statement persistence foundation',()=>{
  it('keeps the exact closing-date boundary explicit instead of embedding a silent default',()=>{
    expect(statements).toContain("StatementBoundaryRule='include-closing-day'|'next-cycle'");
    expect(statements).toContain('statementCloseDateForPurchase(date:string,closingDay:number,boundary:StatementBoundaryRule)');
    expect(statements).not.toContain('DEFAULT_STATEMENT_BOUNDARY');
  });
});
