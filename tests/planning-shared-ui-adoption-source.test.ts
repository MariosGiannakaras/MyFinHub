import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const planning=fs.readFileSync(path.join(process.cwd(),'src/pages/PlanningPage.tsx'),'utf8');

describe('Planning shared action primitive ownership',()=>{
  it('moves only generic page and dialog actions to shared Button/IconButton primitives',()=>{
    expect(planning).toContain("from '../components/Button'");
    expect(planning).toContain("from '../components/IconButton'");
    expect(planning.match(/<Button/g)).toHaveLength(5);
    expect(planning.match(/<IconButton/g)).toHaveLength(2);
    expect(planning.match(/<Button[^>]+variant=\"primary\"/g)).toHaveLength(3);
    expect(planning.match(/<Button[^>]+variant=\"secondary\"/g)).toHaveLength(2);
    expect(planning).toContain('<Button type="button" variant="primary" onClick={startNew}>');
    expect(planning.match(/<IconButton type="button" aria-label="Κλείσιμο"/g)).toHaveLength(2);
    expect(planning).toContain('<Button type="button" variant="secondary" onClick={closeDraft}>Ακύρωση</Button>');
    expect(planning).toContain('<Button type="button" variant="primary" onClick={saveDraft}>');
    expect(planning).toContain('<Button type="button" variant="secondary" onClick={closeComplete}>Πίσω</Button>');
    expect(planning).toContain('<Button type="button" variant="primary" onClick={submitComplete}>');
    expect(planning).not.toContain('className="secondary"');
    expect(planning).not.toContain('className="icon-button"');
  });

  it('keeps Planning horizon, kind and scheduled-row domain controls raw',()=>{
    expect(planning).toContain('className="horizon-control" role="group"');
    expect(planning).toContain('<button type="button" key={value} aria-pressed={horizon === value}');
    expect(planning).toContain('className="kind-grid scheduled-kind-grid" role="group"');
    expect(planning).toContain('<button type="button" className={draft.kind === \'expense\' ? \'active\' : \'\'}');
    expect(planning).toContain('className="save-button compact" onClick={() => startComplete(item)}');
    expect(planning).toContain('<button type="button" aria-label={`Επεξεργασία ${item.note}`}');
    expect(planning).toContain('<button type="button" aria-label={`Παράλειψη ${item.note}`}');
    expect(planning).toContain('<button type="button" className="danger" aria-label={`Ακύρωση ${item.note}`}');
  });
});
