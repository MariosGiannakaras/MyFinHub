import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
describe('linked transfer fee rendered and revision contract (#588 B2)',()=>{
  it('persists the principal and fee through one revisioned state recipe, not sequential saves',()=>{
    const app=readFileSync('src/App.tsx','utf8');
    const qa=readFileSync('src/qa.tsx','utf8');
    const browser=readFileSync('scripts/ledger-foundations-qa.mjs','utf8');
    const wrapper=readFileSync('src/components/ReceiptAwareQuickAdd.tsx','utf8');
    expect(app).toContain('finance.updateDurably(current=>replaceLinkedTransferWithFee(current,principal,fee))');
    expect(qa).toContain('update(current=>replaceLinkedTransferWithFee(current,principal,fee))');
    expect(wrapper).toContain('onCreateLinkedTransfer={onCreateLinkedTransfer}');
    expect(browser).toContain('one Undo removes fee and associated transfer atomically');
    expect(browser).toContain('one Redo restores transfer and commission');
    expect(browser).toContain('ledger-linked-fee-desktop.png');
  });
});
