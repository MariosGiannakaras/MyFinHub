import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { userErrorMessage } from '../src/lib/userMessage.js';

const hardened=[
  'src/components/BudgetRuleSettings.tsx',
  'src/components/CategoryIconsWorkspace.tsx',
  'src/components/LegacyTransactionEditor.tsx',
  'src/components/TransactionRulesWorkspace.tsx',
  'src/components/ContextualQuickAdd.tsx',
  'src/pages/AttentionPage.tsx',
  'src/lib/accountMetadataClient.ts',
  'src/components/FinancialProviderManagementSettings.tsx',
];

describe('user-facing error hardening',()=>{
  it('keeps concise domain messages while redacting technical/runtime details',()=>{
    expect(userErrorMessage(new Error('Το ποσό πρέπει να είναι μεγαλύτερο από μηδέν.'),'fallback')).toContain('ποσό');
    expect(userErrorMessage(new TypeError('fetch failed at internal stack'),'Ασφαλές μήνυμα')).toBe('Ασφαλές μήνυμα');
    expect(userErrorMessage(new Error('SQLSTATE_42501 Supabase trace'),'Ασφαλές μήνυμα')).toBe('Ασφαλές μήνυμα');
    expect(userErrorMessage(new Error('x'.repeat(221)),'Ασφαλές μήνυμα')).toBe('Ασφαλές μήνυμα');
  });

  it.each(hardened)('%s routes unexpected Error values through the shared redaction boundary',(path)=>{
    const source=readFileSync(path,'utf8');
    expect(source).toContain('userErrorMessage');
    expect(source).not.toMatch(/instanceof Error\s*\?\s*\w+\.message/);
  });

  it('sanitizes account metadata server copy before it can reach the Settings UI',()=>{
    const source=readFileSync('src/lib/accountMetadataClient.ts','utf8');
    expect(source).toContain("return new Error(userErrorMessage(candidate?new Error(candidate):null,fallback))");
    expect(source).not.toContain("return new Error(payload?.error||payload?.message||fallback)");
  });

});
