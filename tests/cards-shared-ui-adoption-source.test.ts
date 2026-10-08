import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cards=fs.readFileSync(path.join(process.cwd(),'src/pages/CardsPage.tsx'),'utf8');

describe('Cards shared action primitive ownership',()=>{
  it('moves generic bank-creation and archive-restore actions to shared Button/IconButton primitives',()=>{
    expect(cards).toContain("from '../components/Button'");
    expect(cards).toContain("from '../components/IconButton'");
    expect(cards.match(/<Button/g)).toHaveLength(7);
    expect(cards.match(/<IconButton/g)).toHaveLength(2);
    expect(cards.match(/<Button[^>]+variant=\"primary\"/g)).toHaveLength(4);
    expect(cards.match(/<Button[^>]+variant=\"secondary\"/g)).toHaveLength(2);
    expect(cards.match(/<Button[^>]+variant=\"danger\"/g)).toHaveLength(1);
    expect(cards).toContain('<Button type="button" variant="secondary" onClick={()=>{setBankName(\'\');setError(\'\');setBankOpen(true)}}>');
    expect(cards).toContain('<Button type="button" variant="primary" onClick={()=>openCardCreate()}><Plus/> Προσθήκη κάρτας</Button>');
    expect(cards).toContain('<IconButton type="button" className="bank-add-btn"');
    expect(cards).toContain('<IconButton type="button" className="close-picker" aria-label="Κλείσιμο"');
    expect(cards).toContain('<Button type="button" variant="secondary" className="modal-secondary"');
    expect(cards).toContain('<Button type="button" variant="primary" className="modal-primary"');
    expect(cards).toContain('<Button type="button" variant="primary" onClick={()=>restore(card)}><ArchiveRestore/> Επαναφορά</Button>');
    expect(cards).toContain('<Button type="button" variant="danger" className="danger" onClick={()=>setDeleteTarget(card)}');
  });

  it('keeps card-domain and composite controls raw',()=>{
    expect(cards).not.toContain('<button type="button" className="save-button" onClick={()=>restore(card)}>');
    expect(cards).toContain('className="bank-add-btn"');
    expect(cards).toContain('className="bank-empty"');
    expect(cards).not.toContain('<button type="button" className="danger" onClick={()=>setDeleteTarget(card)}');
  });
});
