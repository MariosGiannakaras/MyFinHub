import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const shortcutHook=readFileSync(new URL('../src/hooks/useAppShortcuts.ts',import.meta.url),'utf8');

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
});