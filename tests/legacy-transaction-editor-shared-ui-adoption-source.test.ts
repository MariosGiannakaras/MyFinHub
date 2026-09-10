import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const editor=fs.readFileSync(path.join(process.cwd(),'src/components/LegacyTransactionEditor.tsx'),'utf8');

describe('LegacyTransactionEditor shared action primitive ownership',()=>{
  it('moves the generic dialog actions to shared Button/IconButton primitives',()=>{
    expect(editor).toContain("from './Button'");
    expect(editor).toContain("from './IconButton'");
    expect(editor.match(/<Button/g)).toHaveLength(2);
    expect(editor.match(/<IconButton/g)).toHaveLength(1);
    expect(editor.match(/<Button[^>]+variant=\"primary\"/g)).toHaveLength(1);
    expect(editor.match(/<Button[^>]+variant=\"secondary\"/g)).toHaveLength(1);
    expect(editor).toContain('<IconButton type="button" aria-label="Κλείσιμο επεξεργασίας ιστορικής κίνησης" onClick={onClose}>');
    expect(editor).toContain('<Button type="button" variant="secondary" onClick={onClose}>Ακύρωση</Button>');
    expect(editor).toContain('<Button type="button" variant="primary" onClick={submit}>Αποθήκευση override</Button>');
  });

  it('removes direct generic class ownership from this editor',()=>{
    expect(editor).not.toContain('className="save-button"');
    expect(editor).not.toContain('className="secondary"');
    expect(editor).not.toContain('className="icon-button"');
  });
});
