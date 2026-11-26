import { describe, expect, it } from 'vitest';
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

  it('does not create a spurious error alert when no error exists', () => {
    const html = renderToStaticMarkup(<LoginScreen onLogin={onLogin} error="" />);
    expect(html).not.toContain('id="login-error"');
    expect(html).not.toContain('role="alert"');
  });
});
