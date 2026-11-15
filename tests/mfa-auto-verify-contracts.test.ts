import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mfa=read('src/components/MfaScreen.tsx');
const login=read('src/components/LoginScreen.tsx');
const session=read('src/hooks/useSession.ts');
const api=read('src/lib/api.ts');
const handler=read('api/auth/mfa/verify.ts');
const enrollHandler=read('api/auth/mfa/enroll.ts');
const app=read('src/App.tsx');
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
  it('normalizes pasted grouped OTP before maxlength and preserves accessible zoom/browser QA (#649 I03.05)',()=>{
    const runtime=read('scripts/ui-ux-runtime-qa.mjs');
    expect(mfa).toContain('onPaste={event=>{');
    expect(mfa).toContain("event.clipboardData.getData('text').replace(/\\D/g,'')");
    expect(mfa).toContain('if(digits.length===6){event.preventDefault();changeCode(digits)}');
    expect(runtime).toContain("clipboard.setData('text','123 456')");
    expect(runtime).toContain('exactly one MFA verification after grouped paste');
    expect(runtime).toContain("document.documentElement.style.zoom='200%'");
    expect(runtime).toContain('runtime-${label}-dark-200pct-zoom.png');
    expect(runtime).toContain("await authZoom('mfa-error','mfa')");
    expect(runtime).toContain("await authZoom('login-error','login')");
    const authCss=read('src/styles/auth-session-shell.css');
    expect(authCss).toContain('grid-template-columns:minmax(0,1fr);place-items:center');
    expect(authCss).toContain('width:min(430px,100%);max-width:100%;min-width:0');
    expect(authCss).toContain('.login-card>*{min-width:0}');
    expect(authCss).toContain('.login-form,.login-field{min-width:0;grid-template-columns:minmax(0,1fr)}');
    expect(authCss).toContain('.login-shield{display:flex;align-items:center;gap:9px;min-width:0;width:100%');
    expect(runtime).toContain('proof.cardOverflow<=1&&proof.clipped.length===0&&imageWidth<=641');
    expect(runtime).toContain('.login-shield span,.login-form,.login-field,.login-input');
    const zoomStart=runtime.indexOf('const authZoom=async');
    expect(runtime.indexOf("const image=await c.send('Page.captureScreenshot'",zoomStart)).toBeLessThan(runtime.indexOf("assert(proof.theme==='dark'",zoomStart));
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
  it('keeps TOTP enrollment and challenge owner-bound and never renders finance before AAL2 (#649 I03.02)',()=>{
    expect(enrollHandler).toContain("if (req.method !== 'POST')");
    expect(enrollHandler).toContain('assertSameOrigin(req)');
    expect(enrollHandler).toContain('await requireSession(req, res)');
    expect(enrollHandler).toContain('await isOwner(session.accessToken)');
    expect(enrollHandler).toContain('await beginTotpEnrollment(session.accessToken)');
    expect(handler).toContain("if (!/^\\d{6}$/.test(code))");
    expect(handler).toContain("if (isAuthRejection(error)) throw new ApiError(401, 'INVALID_MFA_CODE'");
    expect(handler).toContain("accessTokenAal(tokens.access_token) !== 'aal2'");
    expect(handler).toContain('!(await isOwner(tokens.access_token))');
    expect(handler.indexOf('setSessionCookies(req, res, tokens)'))
      .toBeGreaterThan(handler.indexOf("accessTokenAal(tokens.access_token) !== 'aal2'"));
    expect(app).toContain("if (session.state === 'mfa' || session.state === 'mfa-enroll') return");
    expect(app).toContain("if (session.state !== 'authenticated') return <LoginScreen");
    expect(mfa).toContain('verificationInFlight.current = true');
    expect(mfa).toContain("setCode('')");
    expect(session).toContain("e.code === 'INVALID_MFA_CODE'");
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
