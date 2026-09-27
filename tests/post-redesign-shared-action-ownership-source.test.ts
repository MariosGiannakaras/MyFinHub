import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const button=read('src/components/Button.tsx');
const app=read('src/App.tsx');
const quickAdd=read('src/components/QuickAdd.tsx');
const receipts=read('src/components/ReceiptInbox.tsx');
const cards=read('src/pages/CardsPage.tsx');
const planning=read('src/pages/PlanningPage.tsx');
const transactions=read('src/pages/TransactionsPage.tsx');

describe('post-redesign generic shared-action ownership',()=>{
  it('keeps shared Button variants mapped to the existing canonical CSS hooks',()=>{
    expect(button).toContain("primary:'save-button'");
    expect(button).toContain("secondary:'secondary'");
    expect(button).toContain("ghost:'text-button'");
  });

  it('moves class-equivalent generic actions onto shared Button without changing their intent',()=>{
    expect(app).toContain('<Button variant="secondary" type="button" onClick={() => void session.refresh()}>Δοκιμή ξανά</Button>');
    expect(quickAdd).toContain('<Button type="button" variant="ghost" onClick={()=>{setParts(');
    expect(quickAdd).toContain('+ Προσθήκη μέρους</Button>');
    expect(receipts).toContain('<Button type="button" variant="ghost" className="danger" onClick={requestRemoveSelected}>');
    expect(receipts).toContain('<Button type="button" variant="secondary" className="danger" disabled={scanning} onClick={() => requestRemoveOne(selected)}>');
    expect(cards).toContain('<Button type="button" variant="primary" onClick={()=>restore(card)}><ArchiveRestore/> Επαναφορά</Button>');
    expect(planning).toContain('<Button type="button" variant="primary" className="compact" onClick={() => startComplete(item)}><Check size={15}/> Ολοκλήρωση</Button>');
    expect(transactions).toContain("from '../components/Button'");
    expect(transactions).toContain('<Button type="button" variant="ghost" style={{minHeight:44}} aria-label={`Επεξεργασία ${title}`} onClick={()=>edit(row)}>');
  });

  it('removes only the migrated raw class hooks',()=>{
    expect(app).not.toContain('<button className="secondary" type="button" onClick={() => void session.refresh()}>');
    expect(quickAdd).not.toContain('<button type="button" className="text-button" onClick={()=>{setParts(');
    expect(receipts).not.toContain('<button type="button" className="text-button danger" onClick={requestRemoveSelected}>');
    expect(receipts).not.toContain('<button type="button" className="secondary danger" disabled={scanning}');
    expect(cards).not.toContain('<button type="button" className="save-button" onClick={()=>restore(card)}>');
    expect(planning).not.toContain('<button type="button" className="save-button compact" onClick={() => startComplete(item)}>');
    expect(transactions).not.toContain('<button type="button" className="text-button" style={{minHeight:44}}');
  });

  it('retains intentional domain and composite raw controls',()=>{
    expect(receipts).toContain('<button type="button" className="receipt-draft-open"');
    expect(cards).toContain('<button type="button" className="danger" onClick={()=>setDeleteTarget(card)}>');
    expect(planning).toContain('className="danger" aria-label={`Ακύρωση ${item.note}`}');
    expect(transactions).toContain('aria-label={`Διαγραφή ${title}`} className="danger"');
  });
});
