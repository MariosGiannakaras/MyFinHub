import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mfa=read('src/components/MfaScreen.tsx');
const login=read('src/components/LoginScreen.tsx');
const session=read('src/hooks/useSession.ts');
const api=read('src/lib/api.ts');
const handler=read('api/auth/mfa/verify.ts');
const signIn=read('api/auth/login.ts');
const browser=read('scripts/keyboard-semantic-accessibility-qa.mjs');

describe('automatic MFA and owner auth UX preservation',()=>{
  it('starts exactly one challenge on the sixth digit without a redundant submit action',()=>{
    expect(mfa).toContain("value.replace(/\\D/g, '').slice(0, 6)");
    expect(mfa).toContain('if (next.length !== 6) return');
    expect(mfa).toContain('verificationInFlight.current = true');
    expect(mfa).toContain('if (verificationInFlight.current) return');
    expect(mfa).toContain('await onVerify(next, enrollment?.factorId)');
    expect(mfa).not.toContain('type="submit"');
    expect(mfa).not.toContain('onSubmit={submit}');
    expect(mfa).toContain('onSubmit={event=>event.preventDefault()}');
    expect(mfa).toContain('autoComplete="one-time-code"');
  });
  it('supports errors, clear-to-retry, re-focus, pending and deliberate enrollment/logout',()=>{
    expect(mfa).toContain("setCode('')");
    expect(mfa).toContain('requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))');
    expect(mfa).toContain('setErrorAcknowledged(true)');
    expect(mfa).toContain("const visibleError = localError || (!errorAcknowledged ? error : '')");
    expect(mfa).toContain('readOnly={busy}');
    expect(mfa).toContain('aria-busy={busy}');
    expect(mfa).toContain('role="status" aria-live="polite"');
    expect(mfa).toContain('role="alert"');
    expect(mfa).toContain('onClick={startEnrollment}');
    expect(mfa).toContain('onClick={()=>void onLogout()}');
    expect(browser).toContain('MFA never submits an incomplete code');
    expect(browser).toContain('MFA verifies on sixth digit');
    expect(browser).toContain('MFA rejected code resets for retry');
    expect(browser).toContain('MFA requests are one per complete input');
  });
  it('retains owner-only authentication, real server-side TOTP and AAL2 issuance',()=>{
    expect(api).toContain("apiRequest('/api/auth/mfa/verify'");
    expect(api).toContain('JSON.stringify({ code, ...(factorId ? { factorId } : {}) })');
    expect(session).toContain('const session = await verifyMfaApi(code, factorId)');
    expect(session).toContain('return session.authenticated');
    expect(session).toContain("e.code === 'INVALID_MFA_CODE'");
    expect(session).toContain('if (error.status === 429)');
    expect(handler).toContain("if (!/^\\d{6}$/.test(code))");
    expect(handler).toContain('assertSameOrigin(req)');
    expect(handler).toContain('await requireSession(req, res)');
    expect(handler).toContain('await isOwner(session.accessToken)');
    expect(handler).toContain("accessTokenAal(tokens.access_token) !== 'aal2'");
    expect(handler).toContain('setSessionCookies(req, res, tokens)');
    expect(signIn).toContain('await isOwner(tokens.access_token)');
    expect(signIn).toContain("accessTokenAal(tokens.access_token) === 'aal2'");
  });
  it('preserves explicit password submission, autofill and error editing feedback',()=>{
    expect(login).toContain('autoComplete="username"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).toContain("onLogin(email.trim(),password)");
    expect(login).toContain('setErrorDismissed(true)');
    expect(login).toContain('aria-pressed={showPassword}');
    expect(login).toContain('const ready=Boolean(email.trim())&&password.length>=8');
    expect(login).toContain('disabled={busy||!ready}');
    expect(login).toContain('type="submit"');
  });
});
