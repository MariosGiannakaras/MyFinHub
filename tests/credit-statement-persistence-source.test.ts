import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const statements=readFileSync(new URL('../src/lib/creditStatements.ts',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');
const createDialog=readFileSync(new URL('../src/components/CardCreateDialog.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../src/lib/productMigration.ts',import.meta.url),'utf8');

describe('credit statement persistence foundation',()=>{
  it('keeps the exact closing-date boundary explicit instead of embedding a silent default',()=>{
    expect(types).toMatch(/StatementBoundaryRule\s*=\s*'include-closing-day'\s*\|\s*'next-cycle'/);
    expect(statements).toContain('statementCloseDateForPurchase(date:string,closingDay:number,boundary:StatementBoundaryRule)');
    expect(statements).toMatch(/import type \{[^}]*StatementBoundaryRule[^}]*\} from '\.\.\/types\.js'/);
    expect(statements).not.toContain('export type { StatementBoundaryRule }');
    expect(statements).not.toContain('DEFAULT_STATEMENT_BOUNDARY');
  });

  it('stores an explicit boundary for new credit cards and gives unmigrated legacy cards a compatibility rule once',()=>{
    expect(createDialog).toContain("resolvedKind==='credit'?{statementBoundaryRule:'next-cycle' as const}");
    expect(migration).toContain("card.kind==='credit'&&!card.statementBoundaryRule?{...card,statementBoundaryRule:'next-cycle' as const}:card");
  });
});
