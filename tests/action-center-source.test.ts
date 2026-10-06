import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const shortcutHook=readFileSync(new URL('../src/hooks/useAppShortcuts.ts',import.meta.url),'utf8');
const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const renderedQa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');

describe('Action Center production integration contracts',()=>{
  it('delegates command shortcut authority to the shared app-shell shortcut hook',()=>{
    expect(app).not.toContain('const onKey = (event: KeyboardEvent) =>');
    expect(app).not.toContain("addEventListener('keydown', onKey)");
    expect(app).not.toContain("removeEventListener('keydown', onKey)");
    expect(app).toContain('const openCommand = () => {');
    expect(app).toContain('if (quickOpen) return;');
    expect(app).toContain('setCommandOpen(true);');
    expect(app).toContain('onCommand={openCommand}');
    expect(shortcutHook).toContain('isEditableShortcutTarget(event.target)');
    expect(shortcutHook).toContain('isEditableShortcutTarget(document.activeElement)');
    expect(shortcutHook).toContain('event.composedPath().some((target) => isEditableShortcutTarget(target))');
  });

  it('routes persisted attention decisions through the shared finance update/undo pipeline',()=>{
    expect(app).toMatch(/const decideAttention = .*finance\.update/s);
    expect(app).toContain('attentionDecisions: { ...(current.state.attentionDecisions ?? {}), [id]: decision }');
  });
  it('keeps focused rendered proof for the restored legacy split-review editor',()=>{
    expect(qa).toContain("params.get('state')==='split-review'");
    expect(qa).toContain("id:'qa-review-split'");
    expect(qa).toContain("note:'Επιστροφή: 5€\\nΑγορά: 15€'");
    expect(renderedQa).toContain("Action Center QA: focused legacy split-review editor");
    expect(renderedQa).toContain("document.querySelector('.split-review-summary')");
    expect(renderedQa).toContain("document.querySelectorAll('.review-part').length>=2");
    expect(renderedQa).toContain("screenshot('action-center-split-review-editor')");
    expect(renderedQa).toContain('Κλείσιμο επεξεργασίας διαχωρισμού');
  });
});