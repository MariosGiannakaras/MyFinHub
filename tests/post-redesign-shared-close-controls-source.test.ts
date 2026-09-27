import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const cards=read('src/pages/CardsPage.tsx');
const cardCreate=read('src/components/CardCreateDialog.tsx');
const credit=read('src/pages/CreditCardPage.tsx');

describe('post-redesign shared close-control ownership',()=>{
  it('keeps picker close actions on the shared IconButton primitive',()=>{
    expect(cards).toContain('<IconButton type="button" className="close-picker" aria-label="Κλείσιμο"');
    expect(cardCreate).toContain('<IconButton className="close-picker" aria-label="Κλείσιμο"');
    expect(credit).toContain('<IconButton type="button" className="close-picker" aria-label="Κλείσιμο αρχείου καρτών"');
    expect(cards).not.toMatch(/<button\b[^>]*className="close-picker"/);
    expect(cardCreate).not.toMatch(/<button\b[^>]*className="close-picker"/);
    expect(credit).not.toMatch(/<button\b[^>]*className="close-picker"/);
  });

  it('preserves the existing close-picker presentation hook and glyph',()=>{
    expect(cards).toContain('className="close-picker" aria-label="Κλείσιμο" onClick={()=>setBankOpen(false)}>×</IconButton>');
    expect(cardCreate).toContain('className="close-picker" aria-label="Κλείσιμο" onClick={onClose}>×</IconButton>');
    expect(credit).toContain('className="close-picker" aria-label="Κλείσιμο αρχείου καρτών" onClick={()=>setArchiveOpen(false)}>×</IconButton>');
  });
});
