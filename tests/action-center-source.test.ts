import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

describe('Action Center production integration contracts',()=>{
  it('preserves the existing Ctrl/Cmd+K interception order on generic-entry pages',()=>{
    const start=app.indexOf('const onKey = (event: KeyboardEvent) =>');
    const end=app.indexOf("addEventListener('keydown', onKey)",start);
    expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);
    const block=app.slice(start,end);
    expect(block).toContain("event.key.toLowerCase() !== 'k'");
    expect(block).toContain('if (!GENERIC_ENTRY_PAGES.has(page)) return;');
    expect(block).toContain('event.preventDefault();');
    expect(block).toContain('if (quickOpen) return;');
    expect(block).toContain("openGeneric('expense');");
    expect(block.indexOf('event.preventDefault();')).toBeLessThan(block.indexOf('if (quickOpen) return;'));
  });

  it('routes persisted attention decisions through the shared finance update/undo pipeline',()=>{
    expect(app).toMatch(/const decideAttention = .*finance\.update/s);
    expect(app).toContain('attentionDecisions: { ...(current.state.attentionDecisions ?? {}), [id]: decision }');
  });
});
