import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell=read('src/components/DialogShell.tsx');
const confirm=read('src/components/ConfirmDialog.tsx');
const money=read('src/components/MoneyEditDialog.tsx');
const quickAdd=read('src/components/QuickAdd.tsx');
const legacy=read('src/components/LegacyTransactionEditor.tsx');
const contextual=read('src/components/ContextualQuickAdd.tsx');
const lending=read('src/pages/LendingPage.tsx');
const savings=read('src/pages/SavingsPage.tsx');

describe('DialogShell source contract',()=>{
  it('owns shared modal focus, aria, dismissal and motion infrastructure',()=>{
    expect(shell).toContain("from 'framer-motion'");
    expect(shell).toContain('useReducedMotion');
    expect(shell).toContain("export type DialogMotionMode='system'|'reduced'|'full'|'none'");
    expect(shell).toContain("export type DialogShellPresentation='quick'|'editor'");
    expect(shell).toContain('useModalFocus<HTMLElement>(open&&focusActive,preferredFocus,onRequestClose)');
    expect(shell).toContain('focusActive=true');
    expect(shell).toContain('focusActive?:boolean');
    expect(shell).toContain("presentation='quick'");
    expect(shell).toContain('presentation?:DialogShellPresentation');
    expect(shell).toContain('onMouseDown={onRequestClose}');
    expect(shell).toContain('role={role}');
    expect(shell).toContain('aria-modal="true"');
    expect(shell).toContain('aria-labelledby={ariaLabelledBy}');
    expect(shell).toContain('aria-describedby={ariaDescribedBy}');
    expect(shell).toContain('aria-busy={busy||undefined}');
    expect(shell).toContain('tabIndex={-1}');
    expect(shell).toContain('onMouseDown={event=>event.stopPropagation()}');
    expect(shell).toContain("if(editorPresentation||motionMode==='none')return open?<div className={editorPresentation?'editor-backdrop':'modal-backdrop'}");
    expect(shell).toContain("motionMode==='reduced'");
    expect(shell).toContain('transition={{duration:reduce?0:.18}}');
  });

  it('keeps quick and editor presentation contracts explicit instead of exposing arbitrary shell props',()=>{
    expect(shell).toContain('dataAttributes?:DialogDataAttributes');
    expect(shell).toContain('{...dataAttributes}');
    expect(shell).toContain("const editorPresentation=presentation==='editor'");
    expect(shell).toContain("?['panel','neo-raised','editor-dialog',className].filter(Boolean).join(' ')");
    expect(shell).toContain(":['quick-modal',className,'neo-raised'].filter(Boolean).join(' ')");
    expect(shell).not.toContain('backdropClassName?:');
    expect(shell).not.toContain('surfaceClassName?:');
    expect(shell).not.toContain("from './Button'");
    expect(shell).not.toContain("from './IconButton'");
    expect(shell).not.toContain("from './MoneyInput'");
    expect(shell).not.toContain('destructive');
  });

  it('keeps ConfirmDialog and MoneyEditDialog on the shared shell without changing their product semantics',()=>{
    for(const source of [confirm,money]){
      expect(source).toContain("from './DialogShell'");
      expect(source).toContain('<DialogShell');
      expect(source).not.toContain("from 'framer-motion'");
      expect(source).not.toContain('useModalFocus');
      expect(source).toContain('motionMode={motionMode}');
      expect(source).toContain('busy={busy}');
      expect(source).toContain('onRequestClose={cancel}');
    }
    expect(confirm).toContain('role="alertdialog"');
    expect(confirm).toContain('ariaLabelledBy={titleId}');
    expect(confirm).toContain('ariaDescribedBy={descriptionId}');
    expect(confirm).toContain("dataAttributes={{'data-tone':tone}}");
    expect(money).toContain('role="dialog"');
    expect(money).toContain('ariaLabelledBy={titleId}');
    expect(money).toContain('ariaDescribedBy={describedBy}');
    expect(money).toContain('<MoneyInput');
  });

  it('adopts QuickAdd while preserving its nested discard focus boundary',()=>{
    expect(quickAdd).toContain("from './DialogShell'");
    expect(quickAdd).toContain('<DialogShell open={open}');
    expect(quickAdd).toContain('ariaLabelledBy="quick-add-title"');
    expect(quickAdd).toContain('ariaDescribedBy="quick-add-description"');
    expect(quickAdd).toContain("preferredFocus='[data-autofocus=\"true\"]'");
    expect(quickAdd).toContain('focusActive={!discardOpen}');
    expect(quickAdd).toContain('onRequestClose={requestClose}');
    expect(quickAdd).not.toContain("from 'framer-motion'");
    expect(quickAdd).not.toContain('useModalFocus');
    expect(quickAdd).not.toContain('aria-modal="true"');
  });

  it('adopts the static legacy transaction editor without introducing motion',()=>{
    expect(legacy).toContain("from './DialogShell'");
    expect(legacy).toContain('<DialogShell');
    expect(legacy).toContain('open={true}');
    expect(legacy).toContain('className="legacy-transaction-editor"');
    expect(legacy).toContain('ariaLabelledBy="legacy-editor-title"');
    expect(legacy).toContain('motionMode="none"');
    expect(legacy).toContain("preferredFocus='[data-autofocus=\"true\"]'");
    expect(legacy).toContain('onRequestClose={onClose}');
    expect(legacy).not.toContain('useModalFocus');
    expect(legacy).not.toContain('aria-modal="true"');
    expect(legacy).not.toContain("from 'framer-motion'");
  });

  it('adopts the static contextual quick action shell without changing the generic QuickAdd path',()=>{
    expect(contextual).toContain("from './DialogShell'");
    expect(contextual).toContain('<DialogShell');
    expect(contextual).toContain('open={true}');
    expect(contextual).toContain('className="contextual-quick-modal"');
    expect(contextual).toContain('ariaLabelledBy="context-quick-title"');
    expect(contextual).toContain("ariaDescribedBy={error?'context-quick-error':'context-quick-description'}");
    expect(contextual).toContain('motionMode="none"');
    expect(contextual).toContain("preferredFocus='[data-autofocus=\"true\"]'");
    expect(contextual).toContain('onRequestClose={onClose}');
    expect(contextual).not.toContain('useModalFocus');
    expect(contextual).not.toContain('aria-modal="true"');
    expect(contextual).not.toContain("from 'framer-motion'");
    expect(contextual).toContain("if(context.mode==='generic')return <ReceiptAwareQuickAdd");
    expect(contextual).toContain('motionMode={motionMode}');
  });

  it('adopts the CSS-owned editor presentation in Lending and Savings without moving domain logic',()=>{
    for(const source of [lending,savings]){
      expect(source).toContain("from '../components/DialogShell'");
      expect(source).toContain('<DialogShell open={open} presentation="editor"');
      expect(source).toContain("preferredFocus='[data-autofocus=\"true\"]'");
      expect(source).toContain('onRequestClose={close}');
      expect(source).not.toContain('useModalFocus');
      expect(source).not.toContain('className="editor-backdrop"');
      expect(source).not.toContain('aria-modal="true"');
    }
    expect(lending).toContain('className="lending-dialog"');
    expect(lending).toContain('ariaLabelledBy="lending-dialog-title"');
    expect(lending).toContain("ariaDescribedBy={error?'lending-dialog-error':undefined}");
    expect(lending).toContain('createEvent({kind,date,amount:numeric');
    expect(savings).toContain('className="savings-dialog"');
    expect(savings).toContain('ariaLabelledBy="saving-editor-title"');
    expect(savings).toContain("ariaDescribedBy={error?'saving-editor-error':undefined}");
    expect(savings).toContain('event.savingSource=source;');
  });
});
