import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginScreen } from '../src/components/LoginScreen';

const onLogin = async () => false;

describe('login auth alert regression (#641)', () => {
  it('renders the actual human-readable login error, not a boolean, inside the alert', () => {
    const message = 'Τα στοιχεία σύνδεσης δεν είναι σωστά.';
    const html = renderToStaticMarkup(<LoginScreen onLogin={onLogin} error={message} />);
    expect(html).toContain('id="login-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(`<span>${message}</span>`);
    expect(html).toContain('aria-describedby="login-error"');
  });

  it('uses scoped unavailable/network copy without claiming an anonymous session survived',()=>{
    const source=readFileSync(new URL('../src/hooks/useSession.ts',import.meta.url),'utf8');
    const unavailable='Η υπηρεσία σύνδεσης δεν είναι προσωρινά διαθέσιμη. Δοκίμασε ξανά.';
    const network='Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.';
    expect(source).toContain(unavailable);
    expect(source).toContain(network);
    expect(source).not.toContain('Η συνεδρία σου δεν διαγράφηκε');
    expect(source).toContain("error.status === 0 && error.code?.startsWith('NETWORK_')");
    for(const message of [unavailable,network]){
      const html=renderToStaticMarkup(<LoginScreen onLogin={onLogin} error={message}/>);
      expect(html).toContain('role="alert"');
      expect(html).toContain(`<span>${message}</span>`);
    }
  });

  it('guards duplicate submits synchronously and restores a repeated rejected error',()=>{
    const source=readFileSync(new URL('../src/components/LoginScreen.tsx',import.meta.url),'utf8');
    const qa=readFileSync(new URL('../scripts/keyboard-semantic-accessibility-qa.mjs',import.meta.url),'utf8');
    expect(source).toContain('if(submitting.current||!ready)return');
    expect(source).toContain('submitting.current=true');
    expect(source).toContain('if(!await onLogin(email.trim(),password))setErrorDismissed(false)');
    expect(source).toContain('finally{submitting.current=false;setBusy(false)}');
    expect(qa).toContain('editing dismisses the old error');
    expect(qa).toContain('retry shows the correct alert and re-enables form');
  });

  it('does not create a spurious error alert when no error exists', () => {
    const html = renderToStaticMarkup(<LoginScreen onLogin={onLogin} error="" />);
    expect(html).not.toContain('id="login-error"');
    expect(html).not.toContain('role="alert"');
  });
});
