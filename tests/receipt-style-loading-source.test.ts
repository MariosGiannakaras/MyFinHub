import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('receipt inbox styles load only with the privacy-first local inbox',()=>{
  it('retains launcher styling eagerly and bounds modal styling to the lazy inbox chunk',()=>{
    const root=readFileSync('src/styles/root-compat.css','utf8');
    const quick=readFileSync('src/components/ReceiptAwareQuickAdd.tsx','utf8');
    const inbox=readFileSync('src/components/ReceiptInbox.tsx','utf8');
    const launch=readFileSync('src/styles/receipt-launch.css','utf8');
    const modal=readFileSync('src/styles/receipt-inbox.css','utf8');
    expect(root).toContain("@import './receipt-launch.css';");
    expect(root).not.toContain("@import './receipt-inbox.css';");
    expect(quick).toContain("lazy(async()=>({default:(await import('./ReceiptInbox')).ReceiptInbox}))");
    expect(quick).toContain('receiptOpen?<Suspense fallback=');
    expect(inbox).toContain("import '../styles/receipt-inbox.css'");
    expect(launch).toContain('min-width:280px;min-height:46px');
    expect(launch).toContain('.quick-modal>footer .receipt-quick-launch{position:static');
    expect(launch).toContain('.secondary.danger,.text-button.danger');
    expect(modal).toContain('.receipt-inbox-backdrop + .modal-backdrop{z-index:140}');
    expect(modal).toContain('.receipt-items-review');
    expect(modal).not.toContain('.quick-modal>footer .receipt-quick-launch');
  });
});
