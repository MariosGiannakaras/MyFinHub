import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Review consolidation into Έλεγχος',()=>{
  it('exposes one canonical owner-facing review/action surface',()=>{
    const shell=read('src/components/AppShell.tsx');
    const app=read('src/App.tsx');
    const commands=read('src/lib/commandSearch.ts');
    expect(shell).toContain("{id:'attention',label:'Έλεγχος'");
    expect(shell).not.toContain("|'review'|");
    expect(app).not.toContain('ReviewPage');
    expect(app).toContain("raw === 'review'");
    expect(app).toContain("page: 'attention' as PageId");
    expect(app).toContain('onReviewDecision={decide}');
    expect(commands).not.toContain("['review','Έλεγχος παλιών κινήσεων'");
    expect(commands).toContain("['attention','Έλεγχος','Εκκρεμότητες και κινήσεις προς επιβεβαίωση'");
    expect(fs.existsSync(path.join(root,'src/pages/ReviewPage.tsx'))).toBe(false);
  });

  it('keeps legacy confirmation behavior inside Έλεγχος without changing reports implicitly',()=>{
    const attention=read('src/pages/AttentionPage.tsx');
    const confirmation=read('src/components/LegacyConfirmationPanel.tsx');
    expect(attention).toContain('<h1>Έλεγχος</h1>');
    expect(attention).toContain('<LegacyConfirmationPanel');
    expect(confirmation).toContain('reviewSuggestions(data)');
    expect(confirmation).toContain('Καμία αναφορά δεν αλλάζει χωρίς δική σου επιβεβαίωση.');
    expect(confirmation).toContain('Κράτα ως είναι');
    expect(confirmation).toContain('Αργότερα');
    expect(confirmation).toContain("semanticKind:'split'");
    expect(confirmation).toContain("Math.abs(splitSum-(active?.transaction.amount??0))<.01");
  });
});
