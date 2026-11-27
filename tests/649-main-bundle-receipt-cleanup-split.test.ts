import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('#649 I19.04 lazy local receipt cleanup alert without losing finance warning',()=>{
  it('defers rarely visible warning UI rather than raising eager JS budget',()=>{
    const app=readFileSync('src/App.tsx','utf8');
    const notice=readFileSync('src/components/ReceiptCleanupNotice.tsx','utf8');
    expect(app).toContain("const ReceiptCleanupNotice = namedLazy(() => import('./components/ReceiptCleanupNotice'), 'ReceiptCleanupNotice')");
    expect(app).toContain('function namedLazy<Module extends object, Name extends keyof Module>');
    expect(app).not.toContain("import { ReceiptCleanupNotice } from './components/ReceiptCleanupNotice'");
    expect(app).toContain('receiptCleanup.pending.length>0 ? <Suspense fallback={null}><ReceiptCleanupNotice');
    expect(app).toContain('onRetry={receiptCleanup.retry}');
    expect(notice).toContain('Η οικονομική κίνηση έχει αποθηκευτεί');
    expect(notice).toContain('Μην καταχωρίσεις ξανά');
    expect(notice).toContain('disabled={busy}');
    expect(notice).toContain('onClick={()=>void onRetry()}');
  });
});
