import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {OperationFeedback} from '../src/components/OperationFeedback.js';
import {MoneyInput} from '../src/components/MoneyInput.js';

describe('#649 shared operation feedback contract',()=>{
  it('preserves external aria-invalid on MoneyInput and explicit invalid override',()=>{
    const announced=renderToStaticMarkup(<MoneyInput value="10" onValueChange={()=>undefined} aria-label="Ποσό" aria-invalid="true"/>);
    const invalid=renderToStaticMarkup(<MoneyInput value="20" onValueChange={()=>undefined} aria-label="Ποσό" invalid/>);
    const clean=renderToStaticMarkup(<MoneyInput value="30" onValueChange={()=>undefined} aria-label="Ποσό"/>);
    expect(announced).toContain('aria-invalid="true"');
    expect(invalid).toContain('aria-invalid="true"');
    expect(clean).not.toContain('aria-invalid="true"');
  });

  it('announces a rejected operation as an assertive alert with semantic error tone',()=>{
    const html=renderToStaticMarkup(<OperationFeedback tone="error">Η εισαγωγή απέτυχε</OperationFeedback>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('data-feedback-tone="error"');
    expect(html).toContain('Η εισαγωγή απέτυχε');
  });
  it('announces confirmed success as polite status and warns on a partial commit',()=>{
    const ok=renderToStaticMarkup(<OperationFeedback>Αποθηκεύτηκε</OperationFeedback>);
    expect(ok).toContain('role="status"');
    expect(ok).toContain('aria-live="polite"');
    const warning=renderToStaticMarkup(<OperationFeedback tone="warning">Η αποθήκευση ολοκληρώθηκε με προειδοποίηση</OperationFeedback>);
    expect(warning).toContain('role="alert"');
    expect(warning).toContain('data-feedback-tone="warning"');
  });
});
