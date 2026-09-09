import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const button=read('src/components/Button.tsx');
const iconButton=read('src/components/IconButton.tsx');
const confirm=read('src/components/ConfirmDialog.tsx');
const money=read('src/components/MoneyEditDialog.tsx');
const cardCreate=read('src/components/CardCreateDialog.tsx');
const desktopUpdate=read('src/components/DesktopUpdatePanel.tsx');
const errorBoundary=read('src/components/PageErrorBoundary.tsx');

describe('canonical button primitives',()=>{
  it('maps typed variants onto the approved compatibility classes without changing native type semantics',()=>{
    expect(button).toContain("export type ButtonVariant='primary'|'secondary'|'danger'|'text'");
    expect(button).toContain("primary:'save-button'");
    expect(button).toContain("secondary:'secondary'");
    expect(button).toContain("danger:'save-button destructive-action'");
    expect(button).toContain("text:'text-button'");
    expect(button).toContain('type={type}');
    expect(button).not.toContain("type='button'");
  });

  it('requires an explicit accessible name for icon-only actions',()=>{
    expect(iconButton).toContain("Omit<ButtonHTMLAttributes<HTMLButtonElement>,'aria-label'>");
    expect(iconButton).toContain('label:string');
    expect(iconButton).toContain('aria-label={label}');
    expect(iconButton).toContain('type={type}');
  });

  it('adopts shared actions in representative dialogs and cross-page system surfaces',()=>{
    for(const source of [confirm,money,desktopUpdate,errorBoundary]){
      expect(source).toContain("import { Button }");
      expect(source).not.toMatch(/<button\b/);
    }
    expect(confirm).toContain("import { IconButton }");
    expect(money).toContain("import { IconButton }");
    expect(confirm).toContain('variant={tone===\'destructive\'?\'danger\':\'primary\'}');
    expect(money).toContain('<Button variant="primary"');
    expect(desktopUpdate).toContain('<Button variant="primary"');
  });

  it('keeps card-design radio options domain-owned while sharing generic modal actions',()=>{
    expect(cardCreate).toContain("import { Button }");
    expect(cardCreate).toContain("import { IconButton }");
    const rawButtons=cardCreate.match(/<button\b/g)??[];
    expect(rawButtons).toHaveLength(1);
    expect(cardCreate).toContain('className="design-option" role="radio"');
    expect(cardCreate).toContain('<IconButton className="close-picker" label="Κλείσιμο"');
    expect(cardCreate).toContain('<Button variant="secondary" className="modal-secondary"');
    expect(cardCreate).toContain('<Button variant="primary" className="modal-primary"');
  });
});
