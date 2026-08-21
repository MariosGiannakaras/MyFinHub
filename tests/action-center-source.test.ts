import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

describe('Action Center production integration contracts',()=>{
  it('intercepts Ctrl/Cmd+K globally before modal guards and opens the command palette',()=>{
    const start=app.indexOf('const onKey = (event: KeyboardEvent) =>');
    const end=app.indexOf("addEventListener('keydown', onKey)",start);
    expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);
    const block=app.slice(start,end);
    expect(block).toContain("event.key.toLowerCase() !== 'k'");
    expect(block).toContain('event.preventDefault();');
    expect(block).toContain('if (quickOpen || commandOpen) return;');
    expect(block).toContain('setCommandOpen(true);');
    expect(block).not.toContain('GENERIC_ENTRY_PAGES');
    expect(block.indexOf('event.preventDefault();')).toBeLessThan(block.indexOf('if (quickOpen || commandOpen) return;'));
  });

  it('routes persisted attention decisions through the shared finance update/undo pipeline',()=>{
    expect(app).toMatch(/const decideAttention = .*finance\.update/s);
    expect(app).toContain('attentionDecisions: { ...(current.state.attentionDecisions ?? {}), [id]: decision }');
  });
});